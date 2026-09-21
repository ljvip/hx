package listener

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"game-hx/internal/repository"
	"game-hx/internal/service"
	"game-hx/pkg/database"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/rpc"
	"github.com/shopspring/decimal"
)

// ==================== 配置区域 ====================

// BSCConfig BSC监听器配置
type BSCConfig struct {
	WSEndpoint      string            // WebSocket 节点地址
	HTTPEndpoint    string            // HTTP 节点地址（用于查询 finalized）
	USDTContract    string            // USDT 合约地址
	GameAddresses   map[string]string // 游戏地址 -> 游戏名称（从数据库加载）
	AmountThreshold decimal.Decimal   // 金额阈值（USDT）
	Confirmations   uint64            // 区块确认数
}

// DefaultBSCConfig 返回默认配置
func DefaultBSCConfig() *BSCConfig {
	return &BSCConfig{
		WSEndpoint:      "wss://bsc-mainnet.nodereal.io/ws/v1/88e9edda225f481ca5ea8e5c82051e58",
		HTTPEndpoint:    "https://bsc-mainnet.nodereal.io/v1/88e9edda225f481ca5ea8e5c82051e58",
		USDTContract:    "0x55d398326f99059fF775485246999027B3197955",
		GameAddresses:   make(map[string]string),
		AmountThreshold: decimal.NewFromInt(1),
		Confirmations:   5, // 5个区块确认
	}
}

// USDT ABI
const bscUSDTABI = `[
	{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}
]`

// ==================== 数据结构 ====================

// BSCTransferEvent USDT转账事件
type BSCTransferEvent struct {
	From  common.Address
	To    common.Address
	Value *big.Int
}

// PendingBet 待确认的投注
type PendingBet struct {
	TxHash      string
	BlockNumber uint64
	BlockHash   string
	From        string
	To          string
	Amount      decimal.Decimal
	TimeStr     string
	GameName    string
	ReceivedAt  time.Time
	IsRecharge  bool
}

// ==================== 监听器结构 ====================

type BSCListener struct {
	config         *BSCConfig
	wsClient       *ethclient.Client
	httpClient     *ethclient.Client
	rpcClient      *rpc.Client
	parsedABI      abi.ABI
	gameRepo       *repository.GameRepository
	betService     *service.BetService
	shareholderSvc *service.ShareholderService
	betLimitSvc    *service.BetLimitService
	settingRepo    *repository.SettingRepository
	pendingBets    map[string]*PendingBet
	pendingMu      sync.RWMutex
	gameAddrMu     sync.RWMutex // 保护 GameAddresses map 的读写锁
	stopConfirm    chan struct{}
	confirmWg      sync.WaitGroup
}

// NewBSCListener 创建BSC监听器
func NewBSCListener(config *BSCConfig) *BSCListener {
	if config == nil {
		config = DefaultBSCConfig()
	}

	return &BSCListener{
		config:         config,
		gameRepo:       repository.NewGameRepository(),
		betService:     service.NewBetService(),
		shareholderSvc: service.NewShareholderService(),
		betLimitSvc:    service.NewBetLimitService(),
		settingRepo:    repository.NewSettingRepository(),
		pendingBets:    make(map[string]*PendingBet),
	}
}

// ==================== 数据库地址加载 ====================

func (l *BSCListener) loadGameAddressesFromDB() error {
	if database.GetDB() == nil {
		database.InitDB()
	}

	addresses, err := l.gameRepo.GetAllAddresses()
	if err != nil {
		return fmt.Errorf("从数据库获取地址配置失败: %w", err)
	}

	// 先构建新的 map
	newAddresses := make(map[string]string)
	for _, addr := range addresses {
		addrLower := strings.ToLower(addr.Address)
		newAddresses[addrLower] = addr.Name
		log.Printf("   📍 加载地址: %s -> %s", addr.Address, addr.Name)
	}

	// 加写锁替换整个 map
	l.gameAddrMu.Lock()
	l.config.GameAddresses = newAddresses
	l.gameAddrMu.Unlock()

	log.Printf("✅ 从数据库加载了 %d 个游戏地址", len(newAddresses))
	return nil
}

func (l *BSCListener) startAddressUpdate(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			log.Println("🔄 定时更新BSC游戏地址配置...")
			if err := l.loadGameAddressesFromDB(); err != nil {
				log.Printf("❌ 更新地址配置失败: %v", err)
			} else {
				log.Printf("✅ 地址配置更新成功，当前监控 %d 个地址", l.getGameAddressCount())
			}
		case <-ctx.Done():
			return
		}
	}
}

// getGameAddressCount 获取当前游戏地址数量（线程安全）
func (l *BSCListener) getGameAddressCount() int {
	l.gameAddrMu.RLock()
	defer l.gameAddrMu.RUnlock()
	return len(l.config.GameAddresses)
}

// ==================== 确认处理器 ====================

// startConfirmationHandler 启动确认处理协程
func (l *BSCListener) startConfirmationHandler(ctx context.Context) {
	l.confirmWg.Add(1)
	go func() {
		defer l.confirmWg.Done()
		ticker := time.NewTicker(12 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				l.checkConfirmations(ctx)
			case <-ctx.Done():
				return
			case <-l.stopConfirm:
				return
			}
		}
	}()
	log.Printf("🔍 BSC 区块确认处理器已启动，需要 %d 个确认或 finalized 状态", l.confirmations())
}

func (l *BSCListener) minBetUSDT() decimal.Decimal {
	if l.settingRepo == nil {
		return l.config.AmountThreshold
	}
	return l.settingRepo.MinBetUSDTBsc()
}

func (l *BSCListener) confirmations() uint64 {
	if l.settingRepo == nil {
		return l.config.Confirmations
	}
	return l.settingRepo.BscConfirmations()
}

func (l *BSCListener) removePending(txHash string) {
	l.pendingMu.Lock()
	delete(l.pendingBets, txHash)
	l.pendingMu.Unlock()
}

// checkConfirmations 检查待确认交易的确认数
func (l *BSCListener) checkConfirmations(ctx context.Context) {
	if l.httpClient == nil {
		log.Printf("⚠️ httpClient 未初始化，跳过确认检查")
		return
	}

	header, err := l.httpClient.HeaderByNumber(ctx, nil)
	if err != nil {
		log.Printf("⚠️ 获取最新区块高度失败: %v", err)
		return
	}
	currentHeight := header.Number.Uint64()

	type pendingItem struct {
		txHash        string
		bet           *PendingBet
		confirmations uint64
	}

	l.pendingMu.Lock()
	ready := make([]pendingItem, 0)
	for txHash, bet := range l.pendingBets {
		// uint64 减法在块号大于当前高度时会下溢，重组/节点回退必须先比较
		if currentHeight < bet.BlockNumber {
			log.Printf("⏳ 当前高度 %d 低于投注块 %d，可能发生重组，暂不结算 %s", currentHeight, bet.BlockNumber, txHash)
			continue
		}
		confirmations := currentHeight - bet.BlockNumber + 1
		if confirmations >= l.confirmations() {
			ready = append(ready, pendingItem{txHash, bet, confirmations})
		}
	}
	l.pendingMu.Unlock()

	extraWait := l.confirmations() + 5
	for _, item := range ready {
		if ctx.Err() != nil {
			return
		}

		txHash, bet, confirmations := item.txHash, item.bet, item.confirmations

		finalized, finErr := l.isBlockFinalized(ctx, bet.BlockNumber)
		if finErr != nil {
			if confirmations < extraWait {
				log.Printf("⚠️ 检查区块 %d finalized 失败，继续等待更多确认 (%d/%d): %v", bet.BlockNumber, confirmations, extraWait, finErr)
				continue
			}
			log.Printf("⚠️ finalized 检查失败，确认数已达 %d，继续结算 %s", confirmations, txHash)
		} else if !finalized && confirmations < extraWait {
			log.Printf("⏳ 区块 %d 尚未 finalized，继续等待 (当前确认: %d)", bet.BlockNumber, confirmations)
			continue
		}

		receipt, err := l.httpClient.TransactionReceipt(ctx, common.HexToHash(txHash))
		if err != nil || receipt == nil || receipt.Status != 1 {
			if receipt != nil {
				log.Printf("❌ 交易 %s 状态异常 (status=%d)，跳过处理", txHash, receipt.Status)
			} else {
				log.Printf("❌ 交易 %s 获取收据失败: %v，跳过处理", txHash, err)
			}
			l.removePending(txHash)
			continue
		}

		blockNumber := bet.BlockNumber
		blockHash := bet.BlockHash
		if receipt.BlockNumber != nil {
			blockNumber = receipt.BlockNumber.Uint64()
		}
		if receipt.BlockHash != (common.Hash{}) {
			blockHash = receipt.BlockHash.Hex()
		}

		log.Printf("✅ BSC 交易 %s 已确认 (确认数: %d, finalized: %v)", txHash, confirmations, finalized)

		if bet.IsRecharge {
			if err := l.shareholderSvc.ProcessRecharge(bet.From, bet.To, bet.Amount, "USDT", txHash); err != nil {
				log.Printf("❌ 处理股东 BSC 充值失败: %v", err)
			}
			l.removePending(txHash)
			continue
		}

		gameResult, userResult, finalAmount := l.betService.ProcessBet(
			bet.TimeStr,
			int64(blockNumber),
			blockHash,
			bet.From,
			bet.To,
			bet.GameName,
			bet.Amount,
			"USDT",
			txHash,
		)

		log.Printf("   📝 游戏结果: %s, 用户输赢: %s, 返奖金额: %s USDT", gameResult, userResult, finalAmount)
		l.removePending(txHash)
	}
}

// isBlockFinalized 检查区块是否已被 finalize
func (l *BSCListener) isBlockFinalized(ctx context.Context, blockNumber uint64) (bool, error) {
	// 添加 nil 检查
	if l.rpcClient == nil {
		return false, fmt.Errorf("rpcClient not initialized")
	}

	// 获取 finalized 区块
	var finalizedBlock map[string]interface{}
	err := l.rpcClient.CallContext(ctx, &finalizedBlock, "eth_getBlockByNumber", "finalized", false)
	if err != nil {
		return false, err
	}
	if finalizedBlock == nil {
		return false, nil
	}

	finalizedNumHex, ok := finalizedBlock["number"].(string)
	if !ok {
		return false, nil
	}

	// 解析十六进制区块号
	finalizedNum := new(big.Int)
	finalizedNum.SetString(finalizedNumHex[2:], 16)

	return finalizedNum.Uint64() >= blockNumber, nil
}

// addPendingBet 添加待确认投注
func (l *BSCListener) addPendingBet(txHash string, bet *PendingBet) {
	l.pendingMu.Lock()
	defer l.pendingMu.Unlock()
	l.pendingBets[txHash] = bet
	log.Printf("📦 BSC 交易 %s 已加入待确认队列，当前队列长度: %d", txHash, len(l.pendingBets))
}

// safeCloseStopConfirm 安全关闭 stopConfirm channel
func (l *BSCListener) safeCloseStopConfirm() {
	if l.stopConfirm == nil {
		return
	}

	// 使用 recover 防止 panic
	defer func() {
		if r := recover(); r != nil {
			log.Printf("关闭 stopConfirm channel 时发生 panic（已忽略）: %v", r)
		}
	}()

	select {
	case <-l.stopConfirm:
		// channel 已经关闭，不做任何事
	default:
		close(l.stopConfirm)
		log.Println("✅ stopConfirm channel 已安全关闭")
	}
}

// ==================== 主要方法 ====================

// Start 启动BSC监听器
func (l *BSCListener) Start(ctx context.Context) {
	log.Println("🚀 BSC监听器启动...")
	log.Printf("📊 区块确认数要求: %d", l.confirmations())

	if err := l.loadGameAddressesFromDB(); err != nil {
		log.Printf("⚠️ 加载游戏地址配置失败: %v", err)
	}

	log.Printf("🎮 监听游戏地址: %d 个", l.getGameAddressCount())

	// 线程安全地打印所有游戏地址
	l.gameAddrMu.RLock()
	for addr, name := range l.config.GameAddresses {
		log.Printf("   📍 %s -> %s", addr, name)
	}
	l.gameAddrMu.RUnlock()

	go l.startAddressUpdate(ctx)

	for {
		if err := l.run(ctx); err != nil {
			log.Printf("BSC监听器出现错误: %v，5秒后重连...", err)
			time.Sleep(5 * time.Second)
			l.loadGameAddressesFromDB()
		}
		select {
		case <-ctx.Done():
			log.Println("BSC监听器已停止")
			return
		default:
		}
	}
}

// run 运行监听逻辑
func (l *BSCListener) run(ctx context.Context) error {
	// 安全关闭旧的 channel 并创建新的
	l.safeCloseStopConfirm()
	l.stopConfirm = make(chan struct{})

	// 连接 WebSocket
	wsClient, err := ethclient.DialContext(ctx, l.config.WSEndpoint)
	if err != nil {
		return fmt.Errorf("连接WebSocket节点失败: %w", err)
	}
	defer wsClient.Close()
	l.wsClient = wsClient

	// 连接 HTTP 客户端（用于查询 finalized）
	httpClient, err := ethclient.Dial(l.config.HTTPEndpoint)
	if err != nil {
		return fmt.Errorf("连接HTTP节点失败: %w", err)
	}
	defer httpClient.Close()
	l.httpClient = httpClient

	// 连接 RPC 客户端
	rpcClient, err := rpc.Dial(l.config.HTTPEndpoint)
	if err != nil {
		return fmt.Errorf("连接RPC节点失败: %w", err)
	}
	defer rpcClient.Close()
	l.rpcClient = rpcClient

	log.Println("✅ 成功连接到BSC节点")

	parsedABI, err := abi.JSON(strings.NewReader(bscUSDTABI))
	if err != nil {
		return fmt.Errorf("解析ABI失败: %w", err)
	}
	l.parsedABI = parsedABI

	// 启动确认处理协程
	l.startConfirmationHandler(ctx)
	// 确保退出时安全关闭 channel
	defer l.safeCloseStopConfirm()

	transferEventSignature := []byte("Transfer(address,address,uint256)")
	transferEventID := crypto.Keccak256Hash(transferEventSignature)
	usdtContractAddress := common.HexToAddress(l.config.USDTContract)

	query := ethereum.FilterQuery{
		Addresses: []common.Address{usdtContractAddress},
		Topics:    [][]common.Hash{{transferEventID}},
	}

	logs := make(chan types.Log)
	sub, err := wsClient.SubscribeFilterLogs(ctx, query, logs)
	if err != nil {
		return fmt.Errorf("订阅日志失败: %w", err)
	}
	defer sub.Unsubscribe()
	log.Println("🔔 开始监听BSC USDT Transfer事件...")

	var totalTxCount, gameTxCount int64

	for {
		select {
		case err := <-sub.Err():
			return fmt.Errorf("订阅错误: %w", err)

		case vLog := <-logs:
			totalTxCount++

			transferEvent, err := l.parseTransferEvent(vLog)
			if err != nil {
				log.Printf("解析事件失败: %v", err)
				continue
			}

			amountVal := decimal.NewFromBigInt(transferEvent.Value, -18)

			if l.settingRepo.IsShareholderRechargeAddress(transferEvent.To.Hex()) &&
				amountVal.GreaterThanOrEqual(l.settingRepo.ShareholderRechargeMin()) {
				l.addPendingBet(vLog.TxHash.Hex(), &PendingBet{
					TxHash: vLog.TxHash.Hex(), BlockNumber: vLog.BlockNumber,
					From: transferEvent.From.Hex(), To: transferEvent.To.Hex(),
					Amount: amountVal, ReceivedAt: time.Now(), IsRecharge: true,
				})
				continue
			}

			// 检查是否是游戏地址（线程安全）
			gameName, isGameAddr := l.isGameAddress(transferEvent.To)

			if isGameAddr && l.betLimitSvc.AmountAllowed(transferEvent.From.Hex(), "USDT", service.BetNetworkBSC, amountVal) {
				gameTxCount++

				block, err := wsClient.BlockByNumber(ctx, big.NewInt(int64(vLog.BlockNumber)))
				timestamp := time.Now().Unix()
				blockHash := ""
				if err == nil && block != nil {
					timestamp = int64(block.Time())
					blockHash = block.Hash().Hex()
				}
				timeStr := time.Unix(timestamp, 0).Format("2006-01-02 15:04:05")

				l.printTransaction(vLog, transferEvent, gameName, amountVal, gameTxCount, totalTxCount)

				// 加入待确认队列
				pending := &PendingBet{
					TxHash:      vLog.TxHash.Hex(),
					BlockNumber: vLog.BlockNumber,
					BlockHash:   blockHash,
					From:        transferEvent.From.Hex(),
					To:          transferEvent.To.Hex(),
					Amount:      amountVal,
					TimeStr:     timeStr,
					GameName:    gameName,
					ReceivedAt:  time.Now(),
				}
				l.addPendingBet(vLog.TxHash.Hex(), pending)

				log.Printf("⏳ BSC 交易 %s 进入待确认，当前区块 %d，需等待 %d 个确认",
					vLog.TxHash.Hex(), vLog.BlockNumber, l.confirmations())
			} else {
				if totalTxCount%5000 == 0 && totalTxCount > 0 {
					log.Printf("📊 BSC已扫描 %d 笔USDT交易，其中游戏投注 %d 笔", totalTxCount, gameTxCount)
				}
			}

		case <-ctx.Done():
			log.Printf("📊 BSC监听结束，共扫描 %d 笔USDT交易，游戏投注 %d 笔", totalTxCount, gameTxCount)
			l.confirmWg.Wait()
			return nil
		}
	}
}

// ==================== 辅助方法 ====================

func (l *BSCListener) parseTransferEvent(vLog types.Log) (*BSCTransferEvent, error) {
	var transferEvent BSCTransferEvent
	err := l.parsedABI.UnpackIntoInterface(&transferEvent, "Transfer", vLog.Data)
	if err != nil {
		return nil, err
	}
	if len(vLog.Topics) >= 3 {
		transferEvent.From = common.BytesToAddress(vLog.Topics[1].Bytes())
		transferEvent.To = common.BytesToAddress(vLog.Topics[2].Bytes())
	}
	return &transferEvent, nil
}

// isGameAddress 检查地址是否是游戏地址（线程安全）
func (l *BSCListener) isGameAddress(addr common.Address) (string, bool) {
	addrStr := strings.ToLower(addr.Hex())

	// 加读锁保护 map 遍历
	l.gameAddrMu.RLock()
	defer l.gameAddrMu.RUnlock()

	for gameAddr, gameName := range l.config.GameAddresses {
		if strings.ToLower(gameAddr) == addrStr {
			return gameName, true
		}
	}
	return "", false
}

func (l *BSCListener) printTransaction(vLog types.Log, event *BSCTransferEvent, gameName string, amount decimal.Decimal, gameTxCount, totalTxCount int64) {
	log.Printf("🎲 [BSC游戏投注] #%d (总计扫描: %d)", gameTxCount, totalTxCount)
	log.Printf("   🎮 游戏: %s", gameName)
	log.Printf("   📦 区块: %d", vLog.BlockNumber)
	log.Printf("   🔗 交易哈希: %s", vLog.TxHash.Hex())
	log.Printf("   👤 玩家: %s", event.From.Hex())
	log.Printf("   🎯 游戏地址: %s", event.To.Hex())
	log.Printf("   💰 金额: %s USDT", amount)
	log.Printf("   🔍 BSCScan: https://bscscan.com/tx/%s", vLog.TxHash.Hex())
}

// ==================== 全局启动函数 ====================

func StartBSCListener() {
	log.Println("🚀 启动BSC USDT地址监听程序...")

	config := DefaultBSCConfig()
	listener := NewBSCListener(config)

	ctx, cancel := context.WithCancel(context.Background())

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigs
		log.Println("收到退出信号，正在关闭BSC监听器...")
		cancel()
	}()

	listener.Start(ctx)
}

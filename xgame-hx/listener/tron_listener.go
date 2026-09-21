package listener

import (
	"context"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"game-hx/internal/repository"
	"game-hx/internal/service"
	"game-hx/pkg/database"

	"crypto/sha256"
	"github.com/btcsuite/btcutil/base58"
	"github.com/shopspring/decimal"
)

// ==================== 数据结构定义 ====================

// Block represents the structure of a block
type Block struct {
	BlockID     string `json:"blockID"`
	BlockHeader struct {
		RawData struct {
			Number int64 `json:"number"`
		} `json:"raw_data"`
	} `json:"block_header"`
	Transactions []Transaction `json:"transactions"`
}

// Transaction represents the structure of a transaction
type Transaction struct {
	TxID        string `json:"txID"`
	BlockNumber int64  `json:"blockNumber"`
	BlockHash   string `json:"blockHash"`
	RawData     struct {
		Contract  []Contract `json:"contract"`
		Timestamp int64      `json:"timestamp"`
	} `json:"raw_data"`
}

// Contract represents the structure of a contract
type Contract struct {
	Type      string    `json:"type"`
	Parameter Parameter `json:"parameter"`
}

// Parameter represents the contract parameters
type Parameter struct {
	Value ContractValue `json:"value"`
}

// ContractValue represents the contract value structure
type ContractValue struct {
	Amount              int64  `json:"amount"`
	OwnerAddress        string `json:"owner_address"`
	ToAddress           string `json:"to_address"`
	ContractAddress     string `json:"contract_address"`
	UsdtContractAddress string `json:"usdtcontract_address"`
	Data                string `json:"data"`
}

// ==================== 全局变量 ====================

var (
	betService     = service.NewBetService()
	shareholderSvc = service.NewShareholderService()
	betLimitSvc    = service.NewBetLimitService()
	gameRepo       = repository.NewGameRepository()
	settingRepo    = repository.NewSettingRepository()

	// HTTP 客户端
	tronHTTPClient *http.Client
	tronClientOnce sync.Once
)

// ==================== HTTP 客户端优化 ====================

// getTronHTTPClient 获取单例 HTTP 客户端
func getTronHTTPClient() *http.Client {
	tronClientOnce.Do(func() {
		transport := &http.Transport{
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			MaxIdleConnsPerHost:   20,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			ResponseHeaderTimeout: 30 * time.Second,
			ReadBufferSize:        8192,
			WriteBufferSize:       8192,
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: false,
				MinVersion:         tls.VersionTLS12,
			},
		}

		tronHTTPClient = &http.Client{
			Transport: transport,
			Timeout:   60 * time.Second,
		}
	})
	return tronHTTPClient
}

// resetTronHTTPClient 重置 HTTP 客户端
func resetTronHTTPClient() {
	tronClientOnce = sync.Once{}
	tronHTTPClient = nil
	log.Println("🔄 HTTP 客户端已重置")
}

// FetchLatestBlock 获取区块数据（带重试）
func FetchLatestBlock(idOrNum string) (*Block, error) {
	return FetchLatestBlockWithRetry(idOrNum, 5)
}

// FetchLatestBlockWithRetry 带重试的版本
func FetchLatestBlockWithRetry(idOrNum string, maxRetries int) (*Block, error) {
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		if i > 0 {
			// 指数退避
			backoff := time.Duration(min(1<<uint(i), 30)) * time.Second
			log.Printf("🔄 重试获取区块 %s (%d/%d)，等待 %v", idOrNum, i+1, maxRetries, backoff)
			time.Sleep(backoff)
		}

		// 每次重试使用带超时的 context
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		block, err := fetchBlockWithContext(ctx, idOrNum)
		cancel()

		if err == nil {
			return block, nil
		}
		lastErr = err

		// 如果是网络相关错误，重置客户端
		errStr := err.Error()
		if strings.Contains(errStr, "http2") ||
			strings.Contains(errStr, "frame") ||
			strings.Contains(errStr, "EOF") ||
			strings.Contains(errStr, "connection reset") ||
			strings.Contains(errStr, "i/o timeout") ||
			strings.Contains(errStr, "lookup") {
			log.Printf("⚠️ 检测到网络错误，重置客户端: %v", err)
			resetTronHTTPClient()

			// 网络错误等待更长时间
			time.Sleep(3 * time.Second)
		}
	}
	return nil, fmt.Errorf("重试 %d 次后仍失败: %w", maxRetries, lastErr)
}

// fetchBlockWithContext 带 context 的区块获取
func fetchBlockWithContext(ctx context.Context, idOrNum string) (*Block, error) {
	url := "https://api.trongrid.io/wallet/getblock"
	payload := strings.NewReader(fmt.Sprintf(`{"id_or_num":"%s","detail":true}`, idOrNum))

	req, err := http.NewRequestWithContext(ctx, "POST", url, payload)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("accept", "application/json")
	req.Header.Set("content-type", "application/json")
	req.Header.Set("Connection", "keep-alive")

	res, err := getTronHTTPClient().Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP请求失败: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("API返回错误状态 %d: %s", res.StatusCode, string(body))
	}

	body, err := io.ReadAll(io.LimitReader(res.Body, 10*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("读取响应体失败: %w", err)
	}

	var block Block
	if err := json.Unmarshal(body, &block); err != nil {
		return nil, fmt.Errorf("解析JSON失败: %w", err)
	}

	if block.BlockHeader.RawData.Number == 0 && idOrNum != "0" {
		return nil, fmt.Errorf("收到无效区块数据")
	}

	return &block, nil
}

// fetchBlockOnce 单次获取区块（保留用于兼容）
func fetchBlockOnce(idOrNum string) (*Block, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	return fetchBlockWithContext(ctx, idOrNum)
}

// ==================== 地址缓存 ====================

var (
	gameAddressCache   map[string]string
	gameAddressCacheMu sync.RWMutex
	lastLoadTime       time.Time
)

// loadGameAddressesFromDB 从数据库加载游戏地址
func loadGameAddressesFromDB() error {
	addresses, err := gameRepo.GetAllAddresses()
	if err != nil {
		return fmt.Errorf("从数据库获取地址配置失败: %w", err)
	}

	newCache := make(map[string]string)
	for _, addr := range addresses {
		addrLower := strings.ToLower(addr.Address)
		newCache[addrLower] = addr.Name
	}

	gameAddressCacheMu.Lock()
	gameAddressCache = newCache
	gameAddressCacheMu.Unlock()
	lastLoadTime = time.Now()

	log.Printf("✅ 从数据库加载了 %d 个游戏地址", len(newCache))
	for addr, name := range newCache {
		log.Printf("   📍 %s -> %s", addr, name)
	}

	return nil
}

// startAddressUpdate 定时更新地址配置
func startAddressUpdate(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			log.Println("🔄 定时更新 TRON 游戏地址配置...")
			if err := loadGameAddressesFromDB(); err != nil {
				log.Printf("❌ 更新地址配置失败: %v", err)
			}
		case <-ctx.Done():
			log.Println("地址配置更新协程已停止")
			return
		}
	}
}

// IsMonitoredAddress 检查地址是否被监控
func IsMonitoredAddress(address string) (bool, string) {
	gameAddressCacheMu.RLock()
	defer gameAddressCacheMu.RUnlock()

	if gameAddressCache == nil {
		return false, ""
	}

	addrLower := strings.ToLower(address)
	name, exists := gameAddressCache[addrLower]
	return exists, name
}

// ==================== 交易处理 ====================

// HandleTrxTransfer processes TRX transfer transactions
func HandleTrxTransfer(tx Transaction, blockNumber int64, blockHash string, wg *sync.WaitGroup) {
	if wg != nil {
		defer wg.Done()
	}

	// 添加 panic 恢复
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 HandleTrxTransfer panic 恢复: %v, tx: %s", r, tx.TxID)
		}
	}()

	// 检查是否有合约
	if len(tx.RawData.Contract) == 0 {
		return
	}

	contract := tx.RawData.Contract[0]
	ownerAddress := GenerateAddress(contract.Parameter.Value.OwnerAddress)
	toAddress := GenerateAddress(contract.Parameter.Value.ToAddress)
	amount := decimal.NewFromInt(contract.Parameter.Value.Amount).Mul(decimal.NewFromFloat(0.000001))
	timestamp := time.Unix(tx.RawData.Timestamp/1000, 0).Format("2006-01-02 15:04:05")

	if settingRepo.IsShareholderRechargeAddress(toAddress) {
		if err := shareholderSvc.ProcessRecharge(ownerAddress, toAddress, amount, "TRX", tx.TxID); err != nil {
			log.Printf("❌ 处理股东 TRX 充值失败: %v", err)
		}
		return
	}
	if exists, name := IsMonitoredAddress(toAddress); exists &&
		betLimitSvc.AmountAllowed(ownerAddress, "TRX", service.BetNetworkTRON, amount) {
		log.Printf("🎲 [TRX投注] 游戏: %s, 玩家: %s, 金额: %s TRX, 交易: %s\n", name, ownerAddress, amount, tx.TxID)

		// 直接处理投注
		betService.ProcessBet(timestamp, blockNumber, blockHash, ownerAddress, toAddress, name, amount, "TRX", tx.TxID)
	}
}

// HandleTrc20Transfer processes TRC20 token transfer transactions
func HandleTrc20Transfer(tx Transaction, blockNumber int64, blockHash string, wg *sync.WaitGroup) {
	if wg != nil {
		defer wg.Done()
	}

	// 添加 panic 恢复
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 HandleTrc20Transfer panic 恢复: %v, tx: %s", r, tx.TxID)
		}
	}()

	// 检查是否有合约
	if len(tx.RawData.Contract) == 0 {
		return
	}

	contract := tx.RawData.Contract[0]
	contractAddress := contract.Parameter.Value.ContractAddress
	usdtContractAddress := "41a614f803b6fd780986a42c78ec9c7f77e6ded13c"
	data := contract.Parameter.Value.Data

	if len(data) == 0 {
		return
	}

	if len(data) < 72 {
		return
	}

	if contractAddress == usdtContractAddress {
		methodId := data[:8]
		if methodId != "a9059cbb" {
			return
		}

		toAddressHex := "41" + data[32:72]
		toAddress := GenerateAddress(toAddressHex)
		amountHex := data[72:]
		amount := HexToAmount(amountHex)
		timestamp := time.Unix(tx.RawData.Timestamp/1000, 0).Format("2006-01-02 15:04:05")

		if amount == nil {
			return
		}
		amountDecimal := decimal.NewFromBigInt(amount, -6)
		ownerAddress := GenerateAddress(contract.Parameter.Value.OwnerAddress)
		if strings.EqualFold(toAddress, settingRepo.ShareholderRechargeAddress()) {
			if err := shareholderSvc.ProcessRecharge(ownerAddress, toAddress, amountDecimal, "USDT", tx.TxID); err != nil {
				log.Printf("❌ 处理股东 USDT 充值失败: %v", err)
			}
			return
		}
		if exists, name := IsMonitoredAddress(toAddress); exists &&
			betLimitSvc.AmountAllowed(ownerAddress, "USDT", service.BetNetworkTRON, amountDecimal) {
			log.Printf("🎲 [USDT投注] 游戏: %s, 玩家: %s, 金额: %s USDT, 交易: %s\n", name, ownerAddress, amountDecimal, tx.TxID)

			// 直接处理投注
			betService.ProcessBet(timestamp, blockNumber, blockHash, ownerAddress, toAddress, name, amountDecimal, "USDT", tx.TxID)
		}
	}
}

// ==================== 辅助函数 ====================

// GenerateAddress generates a TRON address from raw address bytes
func GenerateAddress(address string) string {
	addressBytes, err := hex.DecodeString(address)
	if err != nil {
		log.Println("Invalid address:", err)
		return ""
	}
	sha256_0 := Sha256Hash(addressBytes)
	sha256_1 := Sha256Hash(sha256_0)
	checksum := sha256_1[:4]
	addressWithChecksum := append(addressBytes, checksum...)
	return base58.Encode(addressWithChecksum)
}

// HexToAmount returns the integer token units from a hexadecimal ABI value.
func HexToAmount(hexAmount string) *big.Int {
	amount, success := new(big.Int).SetString(hexAmount, 16)
	if !success {
		log.Println("Error parsing hex amount")
		return nil
	}
	return amount
}

// Sha256Hash computes the SHA-256 hash of the input data
func Sha256Hash(data []byte) []byte {
	hash := sha256.New()
	hash.Write(data)
	return hash.Sum(nil)
}

// ==================== 主监听循环 ====================

// StartMonitoring 优化后的监听循环
func StartMonitoring() {
	log.Println("🚀 TRON 监听器启动...")

	// 添加全局 panic 恢复
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 TRON 监听器主程序 panic 恢复: %v", r)
			// 重启监听器
			time.Sleep(5 * time.Second)
			go StartMonitoring()
		}
	}()

	// 确保数据库已初始化
	if database.GetDB() == nil {
		database.InitDB()
	}

	// 初始化地址缓存
	if err := loadGameAddressesFromDB(); err != nil {
		log.Printf("⚠️ 初始化地址缓存失败: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 启动定时更新地址配置
	go startAddressUpdate(ctx)

	// 监听退出信号
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigs
		log.Println("收到退出信号，TRON 监听器正在关闭...")
		cancel()
	}()

	var lastProcessedBlock int64 = -1
	var consecutiveErrors int

	log.Printf("📊 开始监听 TRON 链交易...")

	for {
		select {
		case <-ctx.Done():
			log.Println("TRON 监听器已停止")
			return
		default:
		}

		// 主循环带 panic 恢复
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("🔥 TRON 主循环迭代 panic 恢复: %v", r)
				}
			}()

			// 获取最新区块
			block, err := FetchLatestBlock("")
			if err != nil {
				consecutiveErrors++
				log.Printf("❌ 获取最新区块失败 (连续错误: %d): %v", consecutiveErrors, err)

				// 指数退避
				sleepTime := time.Duration(min(consecutiveErrors, 30)) * time.Second
				time.Sleep(sleepTime)
				return
			}

			consecutiveErrors = 0

			currentBlock := block.BlockHeader.RawData.Number

			// 首次运行，记录最新区块号
			if lastProcessedBlock == -1 {
				lastProcessedBlock = currentBlock
				log.Printf("📦 当前最新区块: %d", currentBlock)
				time.Sleep(3 * time.Second)
				return
			}

			// 处理新区块
			if currentBlock > lastProcessedBlock {
				for blockNum := lastProcessedBlock + 1; blockNum <= currentBlock; blockNum++ {
					select {
					case <-ctx.Done():
						return
					default:
					}

					if err := processBlockByNumber(ctx, blockNum); err != nil {
						log.Printf("❌ 处理区块 %d 失败: %v", blockNum, err)
					} else {
						lastProcessedBlock = blockNum
						log.Printf("✅ 区块 %d 处理完成", blockNum)
					}

					// 区块间延迟
					time.Sleep(500 * time.Millisecond)
				}
			}

			// 动态调整轮询间隔
			sleepTime := 1 * time.Second
			if currentBlock == lastProcessedBlock {
				sleepTime = 3 * time.Second
			}

			select {
			case <-ctx.Done():
				return
			case <-time.After(sleepTime):
			}
		}()
	}
}

// processBlockByNumber 处理指定区块
func processBlockByNumber(ctx context.Context, blockNumber int64) error {
	// 添加 panic 恢复
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 processBlockByNumber panic 恢复: %v, 区块: %d", r, blockNumber)
		}
	}()

	block, err := FetchLatestBlock(strconv.FormatInt(blockNumber, 10))
	if err != nil {
		return fmt.Errorf("获取区块失败: %w", err)
	}

	if block.BlockHeader.RawData.Number != blockNumber {
		return fmt.Errorf("区块号不匹配: 期望 %d, 实际 %d", blockNumber, block.BlockHeader.RawData.Number)
	}

	// 使用 worker pool 处理交易
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 30) // 限制并发数

	for _, tx := range block.Transactions {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		wg.Add(1)
		go func(tx Transaction) {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					log.Printf("🔥 处理交易 panic 恢复: %v, tx: %s", r, tx.TxID)
				}
			}()

			// 获取信号量
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			case <-ctx.Done():
				return
			}

			if len(tx.RawData.Contract) == 0 {
				return
			}

			contractType := tx.RawData.Contract[0].Type
			if contractType == "TriggerSmartContract" {
				HandleTrc20Transfer(tx, blockNumber, block.BlockID, nil)
			} else {
				HandleTrxTransfer(tx, blockNumber, block.BlockID, nil)
			}
		}(tx)
	}

	wg.Wait()
	log.Printf("✅ 区块 %d 处理完成，包含 %d 笔交易", blockNumber, len(block.Transactions))

	return nil
}

// min 返回两个整数中的较小值
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

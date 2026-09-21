// internal/service/bet_service.go
package service

import (
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"game-hx/game"
	"game-hx/internal/model"
	"game-hx/internal/repository"
	"game-hx/pkg/tools"
	"game-hx/pkg/websocket"
	"github.com/shopspring/decimal"
)

type BetService struct {
	betRepo        *repository.BetRepository
	userRepo       *repository.UserRepository
	commissionSvc  *CommissionService
	userSvc        *UserService
	shareholderSvc *ShareholderService
	settingRepo    *repository.SettingRepository
}

func NewBetService() *BetService {
	return &BetService{
		betRepo:        repository.NewBetRepository(),
		userRepo:       repository.NewUserRepository(),
		commissionSvc:  NewCommissionService(),
		userSvc:        NewUserService(),
		shareholderSvc: NewShareholderService(),
		settingRepo:    repository.NewSettingRepository(),
	}
}

var gameNameMapping = map[string]string{
	"lucky_banker":   "庄闲",
	"hash_lucky":     "幸运",
	"hash_baccarat":  "百家乐",
	"single_double":  "单双",
	"big_small":      "大小",
	"tenfold_bull":   "十倍牛",
	"pingbei_niuniu": "平倍牛",
	"vip_odd_even":   "VIP单双",
	"vip_big_small":  "VIP大小",
}

// 游戏赔率映射（用于股东积分计算）
var gameOddsMapping = map[string]float64{
	"hash_baccarat":  2.0,
	"hash_lucky":     2.0,
	"lucky_banker":   1.98,
	"single_double":  1.95,
	"big_small":      1.95,
	"pingbei_niuniu": 1.95,
	"tenfold_bull":   10.0, // 动态赔率，实际会根据点数变化
	"vip_odd_even":   1.95,
	"vip_big_small":  1.95,
}

func getGameName(gameKey string) string {
	if name, exists := gameNameMapping[gameKey]; exists {
		return name
	}
	return ""
}

func isKnownGame(name string) bool {
	_, ok := gameNameMapping[name]
	return ok
}

// ProcessBet 处理投注
func (s *BetService) ProcessBet(timestamp string, blockNumber int64, blockHash string, ownerAddress string, toAddress string, name string, transactionAmount decimal.Decimal, tokenSymbol string, txID string) (string, string, decimal.Decimal) {
	ownerAddress = repository.NormalizeAddress(ownerAddress)
	toAddress = repository.NormalizeAddress(toAddress)
	tokenSymbol = strings.ToUpper(strings.TrimSpace(tokenSymbol))

	if ownerAddress == "" {
		log.Printf("⚠️ 跳过投注：玩家地址为空, tx=%s", txID)
		return "invalid", "N/A", decimal.Zero
	}

	txID = strings.TrimSpace(txID)
	if txID == "" {
		log.Printf("⚠️ 跳过投注：tx_id 为空, 地址=%s", ownerAddress)
		return "invalid", "N/A", decimal.Zero
	}

	user, err := s.userSvc.GetUserByOwnerAddress(ownerAddress)
	if err != nil {
		log.Printf("⚠️ 查询用户失败: %v, 地址: %s", err, ownerAddress)
	}
	if user == nil {
		newUser, createErr := s.userSvc.CreateNewUser(ownerAddress, nil, "system")
		if createErr != nil {
			log.Printf("❌ 创建用户失败: %v", createErr)
		} else {
			user = newUser
			log.Printf("✅ 自动开户: %s, 推荐码: %s", user.OwnerAddress, user.ReferralCode)
		}
	}

	var gameResult, userResult string
	var finalAmount decimal.Decimal

	switch name {
	case "single_double":
		gameResult, userResult, finalAmount = game.CheckHashSingleDouble(transactionAmount, blockHash)
	case "big_small":
		gameResult, userResult, finalAmount = game.CheckHashBigSmall(transactionAmount, blockHash)
	case "hash_baccarat":
		gameResult, userResult, finalAmount = game.CheckBaccaratResult(transactionAmount, blockHash)
	case "hash_lucky":
		gameResult, userResult, finalAmount = game.CheckHashLucky(transactionAmount, blockHash)
	case "lucky_banker":
		gameResult, userResult, finalAmount = game.CheckLuckyBanker(transactionAmount, blockHash)
	case "pingbei_niuniu":
		gameResult, userResult, finalAmount = game.CheckPingbeiNiuNiu(transactionAmount, blockHash)
	case "tenfold_bull":
		gameResult, userResult, finalAmount = game.CheckTenfoldBull(transactionAmount, blockHash)
	case "vip_odd_even":
		gameResult, userResult, finalAmount = game.VipOddEven(transactionAmount, blockHash)
	case "vip_big_small":
		gameResult, userResult, finalAmount = game.VipBigSmall(transactionAmount, blockHash)
	default:
		gameResult, userResult, finalAmount = "Invalid bet type", "N/A", decimal.Zero
	}

	betResult := &model.BetResult{
		BlockNumber:       blockNumber,
		BlockHash:         blockHash,
		OwnerAddress:      ownerAddress,
		ToAddress:         toAddress,
		GameName:          name,
		TransactionAmount: transactionAmount,
		TokenSymbol:       tokenSymbol,
		TxID:              txID,
		GameResult:        gameResult,
		UserResult:        userResult,
		FinalAmount:       finalAmount,
	}
	if err := s.betRepo.SaveBetResult(betResult); err != nil {
		if errors.Is(err, repository.ErrDuplicateTx) {
			log.Printf("⏭️ 交易已结算，跳过重复处理: %s", txID)
			return "duplicate", "N/A", decimal.Zero
		}
		log.Printf("❌ 投注结果存入数据库失败: %v, tx=%s, 地址=%s", err, txID, ownerAddress)
		return gameResult, userResult, finalAmount
	}

	if isKnownGame(name) && finalAmount.GreaterThan(decimal.Zero) {
		s.dispatchPayout(ownerAddress, tokenSymbol, finalAmount, txID)
	}

	// ============================================
	// 🆕 处理股东积分（在保存投注结果之后）
	// ============================================
	if user != nil && user.ID > 0 && isKnownGame(name) {
		s.processShareholderPoints(user, name, transactionAmount, finalAmount, userResult, txID)
	}

	if user != nil && user.ID > 0 && isKnownGame(name) {
		var betTRX, betUSDT, winTRX, winUSDT decimal.Decimal
		switch tokenSymbol {
		case "TRX":
			betTRX = transactionAmount
			winTRX = finalAmount
		case "USDT":
			betUSDT = transactionAmount
			winUSDT = finalAmount
		}
		if err := s.userRepo.UpdateUserStats(user.ID, betTRX, betUSDT, winTRX, winUSDT); err != nil {
			log.Printf("❌ 更新用户投注统计失败: %v, user=%d", err, user.ID)
		}
	}

	trend := &model.GameTrend{
		GameType: name,
		Result:   gameResult,
	}
	if err := s.betRepo.SaveGameTrend(trend); err != nil {
		log.Printf("⚠️ 保存游戏走势失败: %v", err)
	}

	wsBetResult := websocket.BetResult{
		OwnerAddress:      ownerAddress,
		BlockNumber:       blockNumber,
		BlockHash:         blockHash,
		GameName:          name,
		TransactionAmount: transactionAmount,
		TokenSymbol:       tokenSymbol,
		TxID:              txID,
		GameResult:        gameResult,
		UserResult:        userResult,
		FinalAmount:       finalAmount,
		Timestamp:         time.Now().Unix(),
	}
	websocket.BroadcastBetResult(wsBetResult)

	if user != nil && user.ID > 0 && isKnownGame(name) {
		s.commissionSvc.DistributeCommission(user, transactionAmount, name, tokenSymbol)
	} else if !isKnownGame(name) {
		log.Printf("⚠️ 未知玩法，跳过佣金: %s", name)
	} else {
		fmt.Printf("⚠️ 用户不存在，跳过佣金分配: %s\n", ownerAddress)
	}

	return gameResult, userResult, finalAmount
}

func (s *BetService) RetryPayout(txID string, force bool) (string, error) {
	if !s.settingRepo.PayoutEnabled() {
		return "", errors.New("返奖已关闭")
	}
	bet, err := s.betRepo.ClaimPayoutRetry(txID, force)
	if err != nil {
		return "", err
	}
	payoutTx, err := tools.Payout(bet.OwnerAddress, bet.TokenSymbol, bet.FinalAmount)
	if err != nil {
		_ = s.betRepo.UpdatePayout(txID, "", "failed", err.Error())
		return "", err
	}
	if err := s.betRepo.UpdatePayout(txID, payoutTx, "success", ""); err != nil {
		log.Printf("⚠️ 更新返奖交易哈希失败: %v, bet=%s, payout=%s", err, txID, payoutTx)
	}
	return payoutTx, nil
}

func (s *BetService) ListPayouts(status string, limit int) ([]model.BetResult, error) {
	return s.betRepo.ListByPayoutStatus(status, limit)
}

func (s *BetService) dispatchPayout(ownerAddress, tokenSymbol string, amount decimal.Decimal, betTxID string) {
	if !s.settingRepo.PayoutEnabled() {
		log.Printf("⏸️ 返奖已关闭，跳过链上打款: 地址=%s, 币种=%s, 金额=%s, bet=%s", ownerAddress, tokenSymbol, amount, betTxID)
		return
	}
	if err := s.betRepo.UpdatePayout(betTxID, "", "pending", ""); err != nil {
		log.Printf("⚠️ 标记返奖待发送失败: %v, tx=%s", err, betTxID)
	}

	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("❌ 返奖 goroutine panic: %v, tx=%s", rec, betTxID)
				_ = s.betRepo.UpdatePayout(betTxID, "", "failed", fmt.Sprintf("panic: %v", rec))
			}
		}()

		payoutTx, err := tools.Payout(ownerAddress, tokenSymbol, amount)
		if err != nil {
			log.Printf("❌ 返奖转账失败: %v, 地址=%s, 币种=%s, 金额=%s, bet=%s", err, ownerAddress, tokenSymbol, amount, betTxID)
			_ = s.betRepo.UpdatePayout(betTxID, "", "failed", err.Error())
			return
		}
		log.Printf("✅ 返奖已发送: 地址=%s, 币种=%s, 金额=%s, bet=%s, payout=%s", ownerAddress, tokenSymbol, amount, betTxID, payoutTx)
		if err := s.betRepo.UpdatePayout(betTxID, payoutTx, "success", ""); err != nil {
			log.Printf("⚠️ 更新返奖交易哈希失败: %v, bet=%s, payout=%s", err, betTxID, payoutTx)
		}
	}()
}

// processShareholderPoints 处理股东积分
func (s *BetService) processShareholderPoints(user *model.User, gameName string, betAmount decimal.Decimal, finalAmount decimal.Decimal, userResult string, txID string) {
	// 判断玩家是否赢了
	isWin := userResult == "win"

	// 获取该游戏的赔率
	odds := s.getGameOdds(gameName, betAmount, finalAmount, isWin)

	log.Printf("📊 开始处理股东积分 - 用户: %d, 游戏: %s, 投注: %s, 赔率: %.4f, 结果: %v",
		user.ID, gameName, betAmount, odds, isWin)

	// 调用股东积分服务
	if err := s.shareholderSvc.ProcessBetForShareholders(
		user.ID,
		betAmount,
		odds,
		gameName,
		txID,
		isWin,
	); err != nil {
		log.Printf("⚠️ 处理股东积分失败: %v, tx=%s, user=%d", err, txID, user.ID)
		// 不阻塞主流程，只记录日志
	} else {
		log.Printf("✅ 股东积分处理完成 - tx=%s, user=%d", txID, user.ID)
	}
}

// getGameOdds 获取游戏赔率
// 参数:
//   - gameName: 游戏名称
//   - betAmount: 投注金额
//   - finalAmount: 最终返奖金额
//   - isWin: 是否赢
//
// 返回: 赔率
func (s *BetService) getGameOdds(gameName string, betAmount decimal.Decimal, finalAmount decimal.Decimal, isWin bool) float64 {
	// 如果玩家输了，赔率没有意义，返回默认值
	if !isWin {
		return 2.0
	}

	// 如果投注金额为0，避免除零
	if !betAmount.GreaterThan(decimal.Zero) {
		return 2.0
	}

	// 1. 先查固定赔率
	if odds, exists := gameOddsMapping[gameName]; exists {
		// 对于十倍牛牛，赔率是动态的
		if gameName == "tenfold_bull" {
			// 十倍牛牛的赔率 = finalAmount / betAmount
			// 但实际上最终金额已经包含了本金和盈利
			// 需要还原赔率: 赔率 = (finalAmount / betAmount)
			// 例如: 投注100，最终返奖200，赔率=2.0
			// 但十倍牛牛的finalAmount是扣除佣金后的结果
			// 使用公式: odds = finalAmount / betAmount + 1
			// 更准确的是从游戏逻辑中获取实际赔率
			// 这里简化处理
			if finalAmount.GreaterThan(betAmount) {
				// 盈利部分 / betAmount + 1
				return finalAmount.Sub(betAmount).Div(betAmount).Add(decimal.NewFromInt(1)).InexactFloat64()
			}
			return odds
		}
		return odds
	}

	// 2. 根据最终金额反算赔率
	// 注意：finalAmount 是返奖金额，包含了本金
	// 赔率 = finalAmount / betAmount
	if finalAmount.GreaterThan(decimal.Zero) {
		calculatedOdds := finalAmount.Div(betAmount).InexactFloat64()
		if calculatedOdds >= 1 {
			return calculatedOdds
		}
	}

	// 3. 默认赔率
	return 2.0
}

// GetGameOdds 导出方法供外部调用
func (s *BetService) GetGameOdds(gameName string) float64 {
	if odds, exists := gameOddsMapping[gameName]; exists {
		return odds
	}
	return 2.0
}

package service

import (
	"errors"
	"fmt"
	"log"
	"time"

	"game-hx/internal/model"
	"game-hx/internal/repository"
	"game-hx/pkg/tools"
	"github.com/shopspring/decimal"
)

type CommissionService struct {
	commissionRepo *repository.CommissionRepository
	userRepo       *repository.UserRepository
	gameRepo       *repository.GameRepository
}

func NewCommissionService() *CommissionService {
	return &CommissionService{
		commissionRepo: repository.NewCommissionRepository(),
		userRepo:       repository.NewUserRepository(),
		gameRepo:       repository.NewGameRepository(),
	}
}

// RecordCommission 记录佣金
func (s *CommissionService) RecordCommission(receiverCode string, receiverAddr *string, senderCode string, senderAddr *string,
	betAmount decimal.Decimal, commission decimal.Decimal, commissionRate float64, gameType string, tokenSymbol string) error {

	record := &model.CommissionRecord{
		ReceiverCode:   receiverCode,
		ReceiverAddr:   receiverAddr,
		SenderCode:     senderCode,
		SenderAddr:     senderAddr,
		BetAmount:      betAmount,
		Commission:     commission,
		CommissionRate: commissionRate,
		GameType:       gameType,
		TokenSymbol:    tokenSymbol,
		CreatedAt:      time.Now(),
	}

	return s.commissionRepo.Create(record)
}

// Withdraw 扣减佣金余额并链上转账；转账失败则退回余额。
func (s *CommissionService) Withdraw(receiverCode, tokenSymbol string, amount decimal.Decimal) (*model.User, string, error) {
	user, err := s.commissionRepo.Withdraw(receiverCode, tokenSymbol, amount)
	if err != nil {
		return nil, "", err
	}
	if user.OwnerAddress == "" {
		_ = s.commissionRepo.Refund(receiverCode, tokenSymbol, amount)
		return nil, "", errors.New("用户未绑定钱包地址，无法链上提现")
	}

	payoutTx, err := tools.Payout(user.OwnerAddress, tokenSymbol, amount)
	if err != nil {
		if refundErr := s.commissionRepo.Refund(receiverCode, tokenSymbol, amount); refundErr != nil {
			log.Printf("❌ 佣金提现转账失败且退回失败: pay=%v, refund=%v, user=%s", err, refundErr, receiverCode)
			return nil, "", fmt.Errorf("链上转账失败且退回佣金失败: %v / %v", err, refundErr)
		}
		return nil, "", fmt.Errorf("链上转账失败，佣金已退回: %w", err)
	}
	return user, payoutTx, nil
}

// DistributeCommission 分配佣金（使用 CTE 优化版）
func (s *CommissionService) DistributeCommission(user *model.User, betAmount decimal.Decimal, gameType string, tokenSymbol string) {
	startTime := time.Now()

	// 获取游戏佣金比例
	commissionRate, err := s.gameRepo.GetCommissionRateByGame(gameType)
	if err != nil {
		log.Printf("获取游戏佣金比例失败: %v", err)
		return
	}

	totalCommission := betAmount.Mul(decimal.NewFromFloat(commissionRate))
	if !totalCommission.GreaterThan(decimal.Zero) {
		return
	}

	log.Printf("===== 开始分配佣金 =====")
	log.Printf("用户: %s (ID: %d)", user.ReferralCode, user.ID)
	log.Printf("下注金额: %s %s", betAmount, tokenSymbol)
	log.Printf("游戏佣金率: %f%%", commissionRate*100)
	log.Printf("总佣金: %s", totalCommission)

	// 🚀 使用 CTE 一次性获取推荐链和佣金率
	nodes, err := s.userRepo.GetFullReferralInfoByCTE(user.ID)
	if err != nil {
		log.Printf("获取推荐链失败: %v, 回退到传统方式", err)
		s.distributeCommissionFallback(user, betAmount, totalCommission, gameType, tokenSymbol)
		return
	}

	if len(nodes) == 0 {
		log.Printf("用户 %d 没有推荐链", user.ID)
		return
	}

	// 添加 system 节点
	nodes = append(nodes, repository.ReferralChainNode{
		ReferralCode:   "system",
		CommissionRate: 1.0,
		Depth:          len(nodes) + 1,
	})

	log.Printf("推荐链（%d层）: %v", len(nodes), getChainCodes(nodes))

	distributed := decimal.Zero
	lastRate := 0.0

	// 分配佣金
	for i, node := range nodes {
		rate := node.CommissionRate
		diff := rate - lastRate

		if diff > 0 {
			reward := totalCommission.Mul(decimal.NewFromFloat(diff))
			distributed = distributed.Add(reward)

			log.Printf("✓ 第%d层 %s: 佣金率=%.2f%%, diff=%.2f%%, 金额=%s",
				i+1, node.ReferralCode, rate*100, diff*100, reward)

			// 获取用户地址
			var userAddr *string
			if u, _ := s.userRepo.GetByReferralCode(node.ReferralCode); u != nil {
				userAddr = &u.OwnerAddress
			}

			err := s.RecordCommission(
				node.ReferralCode, userAddr,
				user.ReferralCode, &user.OwnerAddress,
				betAmount, reward, rate, gameType, tokenSymbol,
			)
			if err != nil {
				log.Printf("记录佣金失败: %v", err)
			}
		} else if diff < 0 {
			log.Printf("⚠ 用户 %s 的佣金率(%.2f%%)低于下级(%.2f%%)，跳过",
				node.ReferralCode, rate*100, lastRate*100)
		}
		if rate > lastRate {
			lastRate = rate
		}
	}

	elapsed := time.Since(startTime)
	log.Printf("===== 佣金分配完成，总计: %s，耗时: %v =====", distributed, elapsed)

	if totalCommission.Sub(distributed).GreaterThan(decimal.NewFromFloat(0.0001)) {
		log.Printf("⚠ 警告: 佣金未全部分配，差额: %s", totalCommission.Sub(distributed))
	}
}

// distributeCommissionFallback 传统方式分配佣金（回退方案）
func (s *CommissionService) distributeCommissionFallback(user *model.User, betAmount, totalCommission decimal.Decimal, gameType, tokenSymbol string) {
	log.Printf("使用传统方式分配佣金...")

	fullChain, err := s.getFullReferrerChainFallback(user.ID)
	if err != nil || len(fullChain) == 0 {
		log.Printf("获取推荐链失败: %v", err)
		return
	}

	// 批量获取佣金率
	rateMap := make(map[string]float64)
	for _, code := range fullChain {
		if code == "system" {
			rateMap[code] = 1.0
			continue
		}
		if u, err := s.userRepo.GetByReferralCode(code); err == nil && u != nil {
			rateMap[code] = u.CommissionRate
		}
	}

	distributed := decimal.Zero
	lastRate := 0.0

	for _, code := range fullChain {
		rate, exists := rateMap[code]
		if !exists {
			continue
		}
		diff := rate - lastRate
		if diff > 0 {
			reward := totalCommission.Mul(decimal.NewFromFloat(diff))
			distributed = distributed.Add(reward)

			// 获取用户地址
			var userAddr *string
			if u, _ := s.userRepo.GetByReferralCode(code); u != nil {
				userAddr = &u.OwnerAddress
			}

			// 记录佣金
			err := s.RecordCommission(
				code, userAddr,
				user.ReferralCode, &user.OwnerAddress,
				betAmount, reward, rate, gameType, tokenSymbol,
			)
			if err != nil {
				log.Printf("记录佣金失败: %v", err)
			}

			log.Printf("✓ 回退分配: %s, 佣金率=%.2f%%, 金额=%s", code, rate*100, reward)
		}
		if rate > lastRate {
			lastRate = rate
		}
	}

	log.Printf("回退方式分配完成，总计: %s", distributed)
}

// getFullReferrerChainFallback 传统方式获取推荐链（回退用）
func (s *CommissionService) getFullReferrerChainFallback(userID int64) ([]string, error) {
	var chain []string
	currentUserID := userID
	visited := make(map[int64]bool)

	user, err := s.userRepo.GetByID(currentUserID)
	if err != nil || user == nil {
		return chain, err
	}
	chain = append(chain, user.ReferralCode)

	for {
		if visited[currentUserID] || len(chain) >= 20 {
			break
		}
		visited[currentUserID] = true

		currentUser, err := s.userRepo.GetByID(currentUserID)
		if err != nil || currentUser == nil {
			break
		}

		if currentUser.Referrer == "" {
			break
		}
		if currentUser.Referrer == "system" {
			chain = append(chain, "system")
			break
		}

		referrer, err := s.userRepo.GetByReferralCode(currentUser.Referrer)
		if err != nil || referrer == nil {
			break
		}

		chain = append(chain, referrer.ReferralCode)
		currentUserID = referrer.ID
	}

	return chain, nil
}

// GetReferralTree 获取用户的所有下级（用于推荐链展示）
func (s *CommissionService) GetReferralTree(referralCode string) ([]string, error) {
	return s.userRepo.GetReferralTreeByCTE(referralCode)
}

// 辅助函数
func getChainCodes(nodes []repository.ReferralChainNode) []string {
	codes := make([]string, len(nodes))
	for i, node := range nodes {
		codes[i] = node.ReferralCode
	}
	return codes
}

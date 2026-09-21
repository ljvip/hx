// internal/service/shareholder_service.go
package service

import (
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"game-hx/internal/model"
	"game-hx/internal/repository"
	"game-hx/pkg/tools"
	"github.com/shopspring/decimal"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ShareholderService struct {
	shareholderRepo *repository.ShareholderRepository
	transactionRepo *repository.ShareholderTransactionRepository
	gameRepo        *repository.GameRepository
	userRepo        *repository.UserRepository
	settingRepo     *repository.SettingRepository
	rechargeRepo    *repository.ShareholderRechargeRepository
	commissionRepo  *repository.CommissionRepository
}

func NewShareholderService() *ShareholderService {
	return &ShareholderService{
		shareholderRepo: repository.NewShareholderRepository(),
		transactionRepo: repository.NewShareholderTransactionRepository(),
		gameRepo:        repository.NewGameRepository(),
		userRepo:        repository.NewUserRepository(),
		settingRepo:     repository.NewSettingRepository(),
		rechargeRepo:    repository.NewShareholderRechargeRepository(),
		commissionRepo:  repository.NewCommissionRepository(),
	}
}

// ProcessRecharge credits a shareholder once when their wallet sends enough
// supported-token value to the configured recharge address.
func (s *ShareholderService) ProcessRecharge(fromAddress, toAddress string, amount decimal.Decimal, tokenSymbol, txID string) error {
	tokenSymbol = strings.ToUpper(strings.TrimSpace(tokenSymbol))
	if !amount.GreaterThanOrEqual(s.settingRepo.ShareholderRechargeMin()) ||
		!s.settingRepo.IsShareholderRechargeAddress(toAddress) ||
		(tokenSymbol != "TRX" && tokenSymbol != "USDT") ||
		strings.TrimSpace(txID) == "" {
		return nil
	}

	user, err := s.userRepo.GetByOwnerAddress(repository.NormalizeAddress(fromAddress))
	if err != nil {
		return fmt.Errorf("查询充值用户失败: %w", err)
	}
	if user == nil {
		return nil
	}
	shareholder, err := s.shareholderRepo.GetByUserIDAny(user.ID)
	if err != nil {
		return fmt.Errorf("查询充值股东失败: %w", err)
	}
	if shareholder == nil {
		return nil
	}

	return s.rechargeRepo.GetDB().Transaction(func(tx *gorm.DB) error {
		var locked model.Shareholder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", shareholder.ID).First(&locked).Error; err != nil {
			return err
		}
		recharge := &model.ShareholderRecharge{
			TxID:          strings.TrimSpace(txID),
			ShareholderID: shareholder.ID,
			FromAddress:   fromAddress,
			TokenSymbol:   tokenSymbol,
			Amount:        amount,
			CreatedAt:     time.Now(),
		}
		if err := s.rechargeRepo.Create(tx, recharge); err != nil {
			if errors.Is(err, repository.ErrDuplicateRecharge) {
				return nil
			}
			return err
		}
		if err := tx.Model(&model.Shareholder{}).Where("id = ?", shareholder.ID).
			Updates(map[string]interface{}{
				"balance":      gorm.Expr("balance + ?", amount),
				"total_income": gorm.Expr("total_income + ?", amount),
			}).Error; err != nil {
			return err
		}
		if err := tx.Create(&model.ShareholderTransaction{
			TradeNo:        strings.TrimSpace(txID),
			UserID:         user.ID,
			ShareholderID:  shareholder.ID,
			GameName:       "Recharge",
			BetAmount:      decimal.Zero,
			ShareRatio:     0,
			CommissionRate: 0,
			Result:         1,
			ProfitLoss:     amount,
			Commission:     decimal.Zero,
			ChangeAmount:   amount,
			BalanceAfter:   locked.Balance.Add(amount),
			Remark:         "链上积分充值",
			CreatedAt:      time.Now(),
		}).Error; err != nil {
			return err
		}
		log.Printf("股东 %s 充值到账: %s %s, tx=%s", shareholder.Code, amount, tokenSymbol, txID)
		return nil
	})
}

// CalculateShareholderChange 计算股东的积分变动
func (s *ShareholderService) CalculateShareholderChange(
	betAmount decimal.Decimal,
	odds float64,
	shareRatio float64,
	commissionRate float64,
	isWin bool,
) decimal.Decimal {
	if shareRatio <= 0 {
		return decimal.Zero
	}

	if !isWin {
		// 玩家输了: 投注额 × 占成比例 × (1 - 游戏分佣比例)
		return betAmount.Mul(decimal.NewFromFloat(shareRatio)).Mul(decimal.NewFromFloat(1 - commissionRate))
	}

	// 玩家赢了: -投注额 × 占成比例 × [(赔率-1) + 游戏分佣比例]
	return betAmount.Mul(decimal.NewFromFloat(-shareRatio * ((odds - 1) + commissionRate)))
}

func (s *ShareholderService) effectiveShareRatio(shareholder *model.Shareholder) float64 {
	if shareholder == nil {
		return 0
	}
	threshold := s.settingRepo.GetShareholderMinBalance()
	if shareholder.Balance.LessThan(threshold) {
		return 0
	}
	required := s.requiredShareholderBalance(shareholder.DefaultShareRatio)
	if shareholder.DefaultShareRatio > 0 && !shareholder.Balance.GreaterThan(required) {
		return 0
	}
	return shareholder.DefaultShareRatio
}

func (s *ShareholderService) requiredShareholderBalance(shareRatio float64) decimal.Decimal {
	return s.settingRepo.ShareholderPointsPerPercent().
		Mul(decimal.NewFromFloat(shareRatio)).
		Mul(decimal.NewFromInt(100))
}

func (s *ShareholderService) GetShareholderMinBalance() decimal.Decimal {
	return s.settingRepo.GetShareholderMinBalance()
}

func (s *ShareholderService) SetShareholderMinBalance(value decimal.Decimal) error {
	if value.IsNegative() {
		return errors.New("判断值不能小于 0")
	}
	return s.settingRepo.SetShareholderMinBalance(value)
}

// ProcessBetForShareholders 处理投注的股东积分变动
func (s *ShareholderService) ProcessBetForShareholders(
	userID int64,
	betAmount decimal.Decimal,
	odds float64,
	gameName string,
	txID string,
	isWin bool,
) error {
	if userID <= 0 || !betAmount.GreaterThan(decimal.Zero) {
		return errors.New("无效的投注参数")
	}

	// 1. 获取用户的股东代码
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return fmt.Errorf("获取用户信息失败: %w", err)
	}
	if user == nil {
		return errors.New("用户不存在")
	}

	if user.ShareholderCode == "" {
		log.Printf("用户 %d 没有关联的股东，跳过积分处理", userID)
		return nil
	}

	// 2. 获取股东信息
	shareholder, err := s.shareholderRepo.GetByCode(user.ShareholderCode)
	if err != nil {
		return fmt.Errorf("获取股东信息失败: %w", err)
	}
	if shareholder == nil {
		log.Printf("股东 %s 不存在", user.ShareholderCode)
		return nil
	}

	// 3. 获取游戏佣金率
	commissionRate, err := s.gameRepo.GetCommissionRateByGame(gameName)
	if err != nil {
		log.Printf("获取游戏 %s 佣金率失败，使用默认值 2.5%%: %v", gameName, err)
		commissionRate = 0.025
	}

	if odds < 1 {
		odds = 1
	}

	shareRatio := s.effectiveShareRatio(shareholder)
	if shareRatio == 0 && shareholder.DefaultShareRatio > 0 {
		log.Printf("⚠️ 股东 %s 余额 %s 小于判断值 %s，占成设为 0",
			shareholder.Code, shareholder.Balance, s.settingRepo.GetShareholderMinBalance())
	}

	// 5. 计算积分变动
	resultCode := 0
	if isWin {
		resultCode = 1
	}

	changeAmount := s.CalculateShareholderChange(
		betAmount,
		odds,
		shareRatio,
		commissionRate,
		isWin,
	)

	var profitLoss, commission decimal.Decimal
	if !isWin {
		profitLoss = betAmount.Mul(decimal.NewFromFloat(shareRatio))
		commission = betAmount.Mul(decimal.NewFromFloat(-shareRatio * commissionRate))
	} else {
		profitLoss = betAmount.Mul(decimal.NewFromFloat(-shareRatio * (odds - 1)))
		commission = betAmount.Mul(decimal.NewFromFloat(-shareRatio * commissionRate))
	}

	// 6. 更新股东余额（带锁）
	if err := s.shareholderRepo.UpdateBalance(shareholder.ID, changeAmount); err != nil {
		log.Printf("更新股东 %d 余额失败: %v", shareholder.ID, err)
		return err
	}

	newBalance := shareholder.Balance.Add(changeAmount)

	// 7. 记录交易
	tx := &model.ShareholderTransaction{
		TradeNo:        txID,
		UserID:         userID,
		ShareholderID:  shareholder.ID,
		GameName:       gameName,
		BetAmount:      betAmount,
		Odds:           odds,
		ShareRatio:     shareRatio,
		CommissionRate: commissionRate,
		Result:         resultCode,
		ProfitLoss:     profitLoss,
		Commission:     commission,
		ChangeAmount:   changeAmount,
		BalanceAfter:   newBalance,
		CreatedAt:      time.Now(),
	}

	if err := s.transactionRepo.Create(tx); err != nil {
		log.Printf("保存股东交易记录失败: %v", err)
		return fmt.Errorf("保存股东交易记录失败: %w", err)
	}

	log.Printf("股东 %s (ID:%d) 积分变动: %s (盈亏: %s, 佣金: %s), 余额: %s, 占成: %.2f%%",
		shareholder.Code, shareholder.ID, changeAmount, profitLoss, commission, newBalance, shareRatio*100)

	return nil
}

// GetShareholderBalance 获取股东余额（:id 为股东表 ID）
func (s *ShareholderService) GetShareholderBalance(id int64) (decimal.Decimal, error) {
	shareholder, err := s.resolveShareholder(id)
	if err != nil {
		return decimal.Zero, err
	}
	return shareholder.Balance, nil
}

// GetShareholderTransactions 获取股东交易记录
func (s *ShareholderService) GetShareholderTransactions(id int64, limit int) ([]model.ShareholderTransaction, error) {
	shareholder, err := s.resolveShareholder(id)
	if err != nil {
		return nil, err
	}
	return s.transactionRepo.GetByShareholderID(shareholder.ID, limit)
}

// GetShareholderTransactionsWithFilter 获取股东交易记录（带过滤）
func (s *ShareholderService) GetShareholderTransactionsWithFilter(
	id int64,
	limit int,
	gameName, tradeNo, startDate, endDate string,
) ([]model.ShareholderTransaction, error) {
	shareholder, err := s.resolveShareholder(id)
	if err != nil {
		return nil, err
	}
	return s.transactionRepo.GetByShareholderIDWithFilter(
		shareholder.ID, limit, gameName, tradeNo, startDate, endDate,
	)
}

func (s *ShareholderService) resolveShareholder(id int64) (*model.Shareholder, error) {
	shareholder, err := s.shareholderRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if shareholder == nil {
		return nil, errors.New("股东不存在")
	}
	return shareholder, nil
}

// GetShareholderStats 获取股东统计信息
func (s *ShareholderService) GetShareholderStats(id int64) (map[string]interface{}, error) {
	shareholder, err := s.resolveShareholder(id)
	if err != nil {
		return nil, err
	}

	// 获取伞下用户数量（通过 users.shareholder_code）
	var userCount int64
	s.userRepo.GetDB().Model(&model.User{}).Where("shareholder_code = ?", shareholder.Code).Count(&userCount)

	// 获取股东用户信息
	user, _ := s.userRepo.GetByID(shareholder.UserID)
	userName := ""
	if user != nil {
		userName = user.Name
	}

	// 计算有效占成比例
	isActive := shareholder.Balance.GreaterThanOrEqual(s.settingRepo.GetShareholderMinBalance())
	effectiveRatio := shareholder.DefaultShareRatio
	if !isActive {
		effectiveRatio = 0
	}

	return map[string]interface{}{
		"id":              shareholder.ID,
		"code":            shareholder.Code,
		"name":            shareholder.Name,
		"user_name":       userName,
		"balance":         shareholder.Balance,
		"total_income":    shareholder.TotalIncome,
		"total_cost":      shareholder.TotalCost,
		"user_count":      userCount,
		"level":           shareholder.Level,
		"status":          shareholder.Status,
		"is_active":       isActive,
		"min_balance":     s.settingRepo.GetShareholderMinBalance(),
		"default_ratio":   shareholder.DefaultShareRatio,
		"effective_ratio": effectiveRatio,
	}, nil
}

// ListShareholders 获取所有股东列表 - 直接从股东表
func (s *ShareholderService) ListShareholders() ([]map[string]interface{}, error) {
	shareholders, err := s.shareholderRepo.GetAll()
	if err != nil {
		return nil, err
	}

	result := make([]map[string]interface{}, 0, len(shareholders))
	for _, sh := range shareholders {
		// 获取伞下用户数量（通过 users.shareholder_code）
		var userCount int64
		s.userRepo.GetDB().Model(&model.User{}).Where("shareholder_code = ?", sh.Code).Count(&userCount)

		// 获取股东对应的用户信息
		user, _ := s.userRepo.GetByID(sh.UserID)
		userName := ""
		ownerAddress := ""
		if user != nil {
			userName = user.Name
			ownerAddress = user.OwnerAddress
		}

		// 计算有效占成比例：余额不足时保留设置值，但投注按 0% 生效。
		minBalance := s.settingRepo.GetShareholderMinBalance()
		requiredBalance := s.requiredShareholderBalance(sh.DefaultShareRatio)
		isActive := sh.Balance.GreaterThanOrEqual(minBalance) &&
			(sh.DefaultShareRatio <= 0 || sh.Balance.GreaterThan(requiredBalance))
		effectiveRatio := sh.DefaultShareRatio
		if !isActive {
			effectiveRatio = 0
		}

		result = append(result, map[string]interface{}{
			"id":                    sh.ID,
			"user_id":               sh.UserID,
			"user_name":             userName,
			"owner_address":         ownerAddress,
			"code":                  sh.Code,
			"name":                  sh.Name,
			"level":                 sh.Level,
			"parent_id":             sh.ParentID,
			"balance":               sh.Balance,
			"total_income":          sh.TotalIncome,
			"total_cost":            sh.TotalCost,
			"user_count":            userCount,
			"default_share_ratio":   sh.DefaultShareRatio,
			"effective_share_ratio": effectiveRatio,
			"required_balance":      requiredBalance,
			"min_bet_trx":           sh.MinBetTRX,
			"min_bet_usdt":          sh.MinBetUSDT,
			"min_bet_usdt_bsc":      sh.MinBetUSDTBsc,
			"max_bet":               sh.MaxBet,
			"effective_bet_limits":  s.EffectiveBetLimits(&sh),
			"is_active":             isActive,
			"status":                sh.Status,
			"created_at":            sh.CreatedAt,
			"updated_at":            sh.UpdatedAt,
		})
	}

	return result, nil
}

// GetShareholderUsers 获取股东伞下用户列表
func (s *ShareholderService) GetShareholderUsers(shareholderID int64) ([]map[string]interface{}, error) {
	shareholder, err := s.shareholderRepo.GetByID(shareholderID)
	if err != nil {
		return nil, err
	}
	if shareholder == nil {
		return nil, errors.New("股东不存在")
	}

	// 查询所有 shareholder_code = 该股东代码的用户
	var users []model.User
	err = s.userRepo.GetDB().Where("shareholder_code = ?", shareholder.Code).Find(&users).Error
	if err != nil {
		return nil, err
	}

	result := make([]map[string]interface{}, 0, len(users))
	for _, u := range users {
		result = append(result, map[string]interface{}{
			"user_id":          u.ID,
			"user_name":        u.Name,
			"owner_address":    u.OwnerAddress,
			"telegram_id":      u.TelegramID,
			"shareholder_code": u.ShareholderCode,
			"is_shareholder":   u.IsShareholder,
		})
	}

	return result, nil
}

// AssignUserToShareholder 分配用户给股东
func (s *ShareholderService) AssignUserToShareholder(userID int64, shareholderCode string) error {
	if userID <= 0 {
		return errors.New("无效的用户ID")
	}
	if shareholderCode == "" {
		return errors.New("股东代码不能为空")
	}

	// 检查股东是否存在
	shareholder, err := s.shareholderRepo.GetByCode(shareholderCode)
	if err != nil {
		return fmt.Errorf("获取股东信息失败: %w", err)
	}
	if shareholder == nil {
		return errors.New("股东不存在")
	}

	// 检查用户是否存在
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.New("用户不存在")
	}
	if strings.TrimSpace(user.ShareholderCode) != "" {
		return errors.New("该用户已分配股东，不能重复分配")
	}
	return s.userRepo.GetDB().Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&model.User{}).
			Where("id = ? AND (shareholder_code IS NULL OR shareholder_code = '')", userID).
			Update("shareholder_code", shareholderCode)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("该用户已分配股东，不能重复分配")
		}
		return tx.Exec(`
			WITH RECURSIVE subtree AS (
				SELECT referral_code FROM users WHERE id = ?
				UNION ALL
				SELECT u.referral_code FROM users u JOIN subtree s ON u.referrer = s.referral_code
			)
			UPDATE users SET shareholder_code = ?
			WHERE referral_code IN (SELECT referral_code FROM subtree)`, userID, shareholderCode).Error
	})
}

// CreateShareholder 创建股东（保留旧调用方；新调用方应提供密码）。
func (s *ShareholderService) CreateShareholder(userID int64, code, name string, level int, parentCode string, defaultShareRatio float64) (*model.Shareholder, error) {
	return s.CreateShareholderWithPassword(userID, code, name, level, parentCode, defaultShareRatio, "")
}

// CreateShareholderWithPassword promotes an unassigned user and assigns the
// complete referral subtree in one database transaction.
func (s *ShareholderService) CreateShareholderWithPassword(userID int64, code, name string, level int, parentCode string, defaultShareRatio float64, password string) (*model.Shareholder, error) {
	if userID <= 0 {
		return nil, errors.New("无效的用户ID")
	}
	if code == "" {
		return nil, errors.New("股东代码不能为空")
	}

	// 检查用户是否存在
	user, err := s.userRepo.GetByID(userID)
	if err != nil || user == nil {
		return nil, errors.New("用户不存在")
	}
	if strings.TrimSpace(user.ShareholderCode) != "" {
		return nil, errors.New("该用户已分配股东，不能重复晋升")
	}

	// 检查用户是否已经是股东
	existingShareholder, err := s.shareholderRepo.GetByUserIDAny(userID)
	if err != nil {
		return nil, err
	}
	if existingShareholder != nil {
		return nil, errors.New("该用户已经是股东")
	}

	// 检查代码是否已存在
	existing, err := s.shareholderRepo.GetByCodeAny(code)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("股东代码已存在")
	}

	var parentID *int64
	if parentCode != "" {
		parent, err := s.shareholderRepo.GetByCode(parentCode)
		if err != nil {
			return nil, err
		}
		if parent == nil {
			return nil, errors.New("上级股东不存在")
		}
		parentID = &parent.ID
	}

	if level == 0 {
		level = 1
	}
	if defaultShareRatio < 0 {
		defaultShareRatio = 0
	}
	if defaultShareRatio > 1 {
		defaultShareRatio = 1
	}

	shareholder := &model.Shareholder{
		UserID:            userID,
		Code:              code,
		Name:              name,
		Level:             level,
		ParentID:          parentID,
		Balance:           decimal.Zero,
		DefaultShareRatio: defaultShareRatio,
		Status:            1,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	if strings.TrimSpace(password) != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("密码加密失败: %w", err)
		}
		shareholder.PasswordHash = string(hash)
	}

	err = s.userRepo.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(shareholder).Error; err != nil {
			return err
		}
		result := tx.Model(&model.User{}).
			Where("id = ? AND (shareholder_code IS NULL OR shareholder_code = '')", userID).
			Updates(map[string]interface{}{"is_shareholder": true, "shareholder_code": code})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("目标用户已分配股东，不能重复晋升")
		}
		if err := tx.Exec(`
			WITH RECURSIVE subtree AS (
				SELECT referral_code FROM users WHERE id = ?
				UNION ALL
				SELECT u.referral_code FROM users u JOIN subtree s ON u.referrer = s.referral_code
			)
			UPDATE users SET shareholder_code = ?
			WHERE referral_code IN (SELECT referral_code FROM subtree)`, userID, code).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return shareholder, nil
}

// UpdateShareholderStatus 更新股东状态
func (s *ShareholderService) UpdateShareholderStatus(shareholderID int64, status int) error {
	shareholder, err := s.shareholderRepo.GetByID(shareholderID)
	if err != nil {
		return err
	}
	if shareholder == nil {
		return errors.New("股东不存在")
	}

	shareholder.Status = status
	shareholder.UpdatedAt = time.Now()

	if err := s.shareholderRepo.Update(shareholder); err != nil {
		return err
	}

	isShareholder := status == 1
	code := ""
	if isShareholder {
		code = shareholder.Code
	}
	return s.userRepo.UpdateShareholderInfo(shareholder.UserID, isShareholder, code)
}

// UpdateShareholderBalance 更新股东积分余额
func (s *ShareholderService) UpdateShareholderBalance(shareholderID int64, balance decimal.Decimal) error {
	shareholder, err := s.shareholderRepo.GetByID(shareholderID)
	if err != nil {
		return err
	}
	if shareholder == nil {
		return errors.New("股东不存在")
	}

	shareholder.Balance = balance
	shareholder.UpdatedAt = time.Now()

	return s.shareholderRepo.Update(shareholder)
}

// UpdateShareholderShareRatio 更新股东的默认占成比例
func (s *ShareholderService) UpdateShareholderShareRatio(shareholderID int64, shareRatio float64) error {
	if shareRatio < 0 || shareRatio > 1 {
		return errors.New("占成比例必须在 0 到 1 之间")
	}

	shareholder, err := s.shareholderRepo.GetByID(shareholderID)
	if err != nil {
		return err
	}
	if shareholder == nil {
		return errors.New("股东不存在")
	}
	required := s.requiredShareholderBalance(shareRatio)
	if shareRatio > 0 && !shareholder.Balance.GreaterThan(required) {
		return fmt.Errorf("积分余额不足，设置 %.2f%% 占成需要积分大于 %s", shareRatio*100, required.String())
	}

	shareholder.DefaultShareRatio = shareRatio
	shareholder.UpdatedAt = time.Now()

	return s.shareholderRepo.Update(shareholder)
}

// GetShareholderByCode 根据代码获取股东
func (s *ShareholderService) GetShareholderByCode(code string) (*model.Shareholder, error) {
	return s.shareholderRepo.GetByCodeAny(code)
}

// GetShareholderByUserID 根据用户ID获取股东
func (s *ShareholderService) GetShareholderByUserID(userID int64) (*model.Shareholder, error) {
	return s.shareholderRepo.GetByUserID(userID)
}

// GetShareholderByUserIDAny 根据用户ID获取股东（不限状态）
func (s *ShareholderService) GetShareholderByUserIDAny(userID int64) (*model.Shareholder, error) {
	return s.shareholderRepo.GetByUserIDAny(userID)
}

// GetShareholderByID 根据ID获取股东
func (s *ShareholderService) GetShareholderByID(id int64) (*model.Shareholder, error) {
	return s.shareholderRepo.GetByID(id)
}

func (s *ShareholderService) UpdateShareholderBetLimits(id int64, minTRX, minUSDT, minBSC, maxBet *decimal.Decimal) error {
	if _, err := s.resolveShareholder(id); err != nil {
		return err
	}
	if err := validateBetLimitValue("TRX 最小投注", minTRX); err != nil {
		return err
	}
	if err := validateBetLimitValue("TRON USDT 最小投注", minUSDT); err != nil {
		return err
	}
	if err := validateBetLimitValue("BSC USDT 最小投注", minBSC); err != nil {
		return err
	}
	if err := validateBetLimitValue("单笔投注上限", maxBet); err != nil {
		return err
	}
	if maxBet != nil && maxBet.LessThanOrEqual(decimal.Zero) {
		return errors.New("单笔投注上限必须大于 0")
	}

	sh := &model.Shareholder{
		MinBetTRX:     minTRX,
		MinBetUSDT:    minUSDT,
		MinBetUSDTBsc: minBSC,
		MaxBet:        maxBet,
	}
	effective := s.EffectiveBetLimits(sh)
	if effective.MaxBet.LessThan(effective.MinBetTRX) {
		return errors.New("单笔上限不能小于 TRX 最小投注")
	}
	if effective.MaxBet.LessThan(effective.MinBetUSDT) {
		return errors.New("单笔上限不能小于 TRON USDT 最小投注")
	}
	if effective.MaxBet.LessThan(effective.MinBetUSDTBsc) {
		return errors.New("单笔上限不能小于 BSC USDT 最小投注")
	}
	return s.shareholderRepo.UpdateBetLimits(id, minTRX, minUSDT, minBSC, maxBet)
}

func (s *ShareholderService) EffectiveBetLimits(sh *model.Shareholder) BetLimitSet {
	system := NewBetLimitService().SystemLimits()
	if sh == nil {
		return system
	}
	limits := system
	limits.MinBetTRX, _ = pickLimit(sh.MinBetTRX, system.MinBetTRX)
	limits.MinBetUSDT, _ = pickLimit(sh.MinBetUSDT, system.MinBetUSDT)
	limits.MinBetUSDTBsc, _ = pickLimit(sh.MinBetUSDTBsc, system.MinBetUSDTBsc)
	limits.MaxBet, _ = pickLimit(sh.MaxBet, system.MaxBet)
	return limits
}

func validateBetLimitValue(label string, value *decimal.Decimal) error {
	if value == nil {
		return nil
	}
	if value.LessThan(decimal.Zero) {
		return fmt.Errorf("%s不能小于 0", label)
	}
	return nil
}

func (s *ShareholderService) DeleteShareholder(id int64) error {
	shareholder, err := s.resolveShareholder(id)
	if err != nil {
		return err
	}
	if err := s.userRepo.GetDB().Model(&model.User{}).
		Where("shareholder_code = ?", shareholder.Code).
		Updates(map[string]interface{}{
			"shareholder_code": "",
			"is_shareholder":   false,
		}).Error; err != nil {
		return err
	}

	if err := s.userRepo.UpdateShareholderInfo(shareholder.UserID, false, ""); err != nil {
		log.Printf("⚠️ 清除用户股东标识失败: %v", err)
	}

	return s.shareholderRepo.Delete(id)
}

// AuthenticateShareholder verifies the active shareholder code/password.
func (s *ShareholderService) AuthenticateShareholder(code, password string) (*model.Shareholder, error) {
	shareholder, err := s.shareholderRepo.GetByCodeForLogin(code)
	if err != nil {
		return nil, err
	}
	if shareholder == nil || shareholder.PasswordHash == "" ||
		bcrypt.CompareHashAndPassword([]byte(shareholder.PasswordHash), []byte(password)) != nil {
		return nil, errors.New("股东代码或密码错误")
	}
	return shareholder, nil
}

func (s *ShareholderService) ChangeShareholderPassword(id int64, current, next string) error {
	if strings.TrimSpace(next) == "" {
		return errors.New("新密码不能为空")
	}
	shareholder, err := s.shareholderRepo.GetByID(id)
	if err != nil || shareholder == nil {
		return errors.New("股东不存在")
	}
	if shareholder.PasswordHash == "" ||
		bcrypt.CompareHashAndPassword([]byte(shareholder.PasswordHash), []byte(current)) != nil {
		return errors.New("当前密码错误")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(next), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.userRepo.GetDB().Model(&model.Shareholder{}).Where("id = ?", id).
		Updates(map[string]interface{}{"password_hash": string(hash), "updated_at": time.Now()}).Error
}

// SetShareholderPassword allows an administrator to set or reset a shareholder password.
func (s *ShareholderService) SetShareholderPassword(id int64, password string) error {
	if strings.TrimSpace(password) == "" {
		return errors.New("密码不能为空")
	}
	if len([]rune(password)) < 6 {
		return errors.New("密码至少需要 6 位")
	}
	shareholder, err := s.shareholderRepo.GetByID(id)
	if err != nil || shareholder == nil {
		return errors.New("股东不存在")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.userRepo.GetDB().Model(&model.Shareholder{}).Where("id = ?", id).
		Updates(map[string]interface{}{"password_hash": string(hash), "updated_at": time.Now()}).Error
}

func (s *ShareholderService) GetShareholderProfile(id int64) (map[string]interface{}, error) {
	shareholder, err := s.resolveShareholder(id)
	if err != nil {
		return nil, err
	}
	user, err := s.userRepo.GetByID(shareholder.UserID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"shareholder":                    shareholder,
		"user":                           user,
		"shareholder_points_per_percent": s.settingRepo.ShareholderPointsPerPercent(),
		"effective_share_ratio":          s.effectiveShareRatio(shareholder),
		"required_balance":               s.requiredShareholderBalance(shareholder.DefaultShareRatio),
		"system_bet_limits":              NewBetLimitService().SystemLimits(),
		"effective_bet_limits":           s.EffectiveBetLimits(shareholder),
	}, nil
}

func (s *ShareholderService) WithdrawShareholder(id int64, tokenSymbol string, amount decimal.Decimal) (string, error) {
	shareholder, err := s.shareholderRepo.GetByID(id)
	if err != nil || shareholder == nil {
		return "", errors.New("股东不存在")
	}
	user, err := s.userRepo.GetByID(shareholder.UserID)
	if err != nil || user == nil {
		return "", errors.New("股东用户不存在")
	}
	if strings.TrimSpace(user.OwnerAddress) == "" {
		return "", errors.New("股东未绑定钱包地址，无法提现")
	}
	debited, err := s.shareholderRepo.Withdraw(id, amount, tokenSymbol)
	if err != nil {
		return "", err
	}
	payoutTx, err := tools.Payout(user.OwnerAddress, tokenSymbol, amount)
	if err != nil {
		if refundErr := s.shareholderRepo.Refund(id, amount); refundErr != nil {
			return "", fmt.Errorf("链上转账失败且余额退回失败: %v / %v", err, refundErr)
		}
		return "", fmt.Errorf("链上转账失败，余额已退回: %w", err)
	}
	// Keep a local audit record for successful shareholder payouts.
	recordErr := s.transactionRepo.Create(&model.ShareholderTransaction{
		TradeNo:       payoutTx,
		UserID:        user.ID,
		ShareholderID: id,
		GameName:      "Withdrawal",
		ShareRatio:    debited.DefaultShareRatio,
		Result:        1,
		ProfitLoss:    amount.Neg(),
		ChangeAmount:  amount.Neg(),
		BalanceAfter:  debited.Balance.Sub(amount),
		Remark:        "股东余额提现",
		CreatedAt:     time.Now(),
	})
	if recordErr != nil {
		log.Printf("股东提现审计记录失败: %v", recordErr)
	}
	return payoutTx, nil
}

func (s *ShareholderService) GetShareholderCommissions(id, limit int) ([]model.CommissionRecord, int64, error) {
	shareholder, err := s.resolveShareholder(int64(id))
	if err != nil {
		return nil, 0, err
	}
	var users []model.User
	if err := s.userRepo.GetDB().Where("shareholder_code = ?", shareholder.Code).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	codes := make([]string, 0, len(users))
	for _, user := range users {
		codes = append(codes, user.ReferralCode)
	}
	return s.commissionRepo.GetBySenderCodes(codes, limit)
}

package repository

import (
	"errors"
	"strings"
	"time"

	"game-hx/internal/model"
	"game-hx/pkg/database"
	"github.com/shopspring/decimal"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrInvalidAmount          = errors.New("commission amount must be greater than 0")
	ErrInvalidToken           = errors.New("invalid token symbol")
	ErrInsufficientCommission = errors.New("insufficient commission")
)

type CommissionRepository struct{}

func NewCommissionRepository() *CommissionRepository {
	return &CommissionRepository{}
}

func (r *CommissionRepository) GetDB() *gorm.DB {
	return database.GetDB()
}

// Create 创建佣金记录并更新用户累计佣金
func (r *CommissionRepository) Create(record *model.CommissionRecord) error {
	// 使用事务确保佣金记录和用户更新同时成功或失败
	return r.GetDB().Transaction(func(tx *gorm.DB) error {
		// 1. 创建佣金记录
		if err := tx.Create(record).Error; err != nil {
			return err
		}

		// 2. 更新用户的累计佣金
		var user model.User
		if err := tx.Where("referral_code = ?", record.ReceiverCode).First(&user).Error; err != nil {
			// 如果是 system 用户，尝试另一种方式
			if record.ReceiverCode == "system" {
				if err := tx.Where("referral_code = ?", "system").First(&user).Error; err != nil {
					// system 用户不存在，跳过累加（正常情况下应该存在）
					return nil
				}
			} else {
				return err
			}
		}

		if record.TokenSymbol == "TRX" {
			if err := tx.Model(&user).Update("total_commission_trx", gorm.Expr("total_commission_trx + ?", record.Commission)).Error; err != nil {
				return err
			}
		} else if record.TokenSymbol == "USDT" {
			if err := tx.Model(&user).Update("total_commission_usdt", gorm.Expr("total_commission_usdt + ?", record.Commission)).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

// Withdraw 事务内锁定用户并原子扣减佣金，避免负数刷余额和并发双花
func (r *CommissionRepository) Withdraw(receiverCode, tokenSymbol string, amount decimal.Decimal) (*model.User, error) {
	if !amount.GreaterThan(decimal.Zero) {
		return nil, ErrInvalidAmount
	}

	tokenSymbol = strings.ToUpper(strings.TrimSpace(tokenSymbol))
	var col string
	switch tokenSymbol {
	case "TRX":
		col = "total_commission_trx"
	case "USDT":
		col = "total_commission_usdt"
	default:
		return nil, ErrInvalidToken
	}

	var user model.User
	err := r.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("referral_code = ?", receiverCode).
			First(&user).Error; err != nil {
			return err
		}

		result := tx.Model(&model.User{}).
			Where("id = ? AND "+col+" >= ?", user.ID, amount).
			Update(col, gorm.Expr(col+" - ?", amount))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrInsufficientCommission
		}

		record := &model.CommissionRecord{
			ReceiverCode:   receiverCode,
			ReceiverAddr:   &user.OwnerAddress,
			SenderCode:     "system",
			BetAmount:      decimal.Zero,
			Commission:     decimal.Zero,
			WithdrawAmount: amount,
			TokenSymbol:    tokenSymbol,
			GameType:       "Withdraw",
			CommissionRate: 0,
			CreatedAt:      time.Now(),
		}
		if err := tx.Create(record).Error; err != nil {
			return err
		}

		return tx.Where("id = ?", user.ID).First(&user).Error
	})
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *CommissionRepository) Refund(receiverCode, tokenSymbol string, amount decimal.Decimal) error {
	if !amount.GreaterThan(decimal.Zero) {
		return ErrInvalidAmount
	}
	tokenSymbol = strings.ToUpper(strings.TrimSpace(tokenSymbol))
	var col string
	switch tokenSymbol {
	case "TRX":
		col = "total_commission_trx"
	case "USDT":
		col = "total_commission_usdt"
	default:
		return ErrInvalidToken
	}
	return r.GetDB().Model(&model.User{}).
		Where("referral_code = ?", receiverCode).
		Update(col, gorm.Expr(col+" + ?", amount)).Error
}

// CreateOnly 仅创建佣金记录（不更新用户累计佣金）
func (r *CommissionRepository) CreateOnly(record *model.CommissionRecord) error {
	return r.GetDB().Create(record).Error
}

// GetByUser 查询用户的佣金记录
func (r *CommissionRepository) GetByUser(receiverCode, tokenSymbol string, limit int) ([]model.CommissionRecord, int64, error) {
	var records []model.CommissionRecord
	var totalCount int64

	query := r.GetDB().Model(&model.CommissionRecord{}).Where("receiver_code = ?", receiverCode)
	if tokenSymbol != "" {
		query = query.Where("token_symbol = ?", tokenSymbol)
	}

	err := query.Order("created_at DESC").Limit(limit).Find(&records).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Count(&totalCount).Error
	if err != nil {
		return nil, 0, err
	}

	return records, totalCount, nil
}

func (r *CommissionRepository) GetBySenderCodes(codes []string, limit int) ([]model.CommissionRecord, int64, error) {
	var records []model.CommissionRecord
	if len(codes) == 0 {
		return records, 0, nil
	}
	query := r.GetDB().Model(&model.CommissionRecord{}).Where("sender_code IN ?", codes)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("created_at DESC").Limit(limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	return records, total, nil
}

// GetTotalByUser 查询用户总佣金
func (r *CommissionRepository) GetTotalByUser(receiverCode, tokenSymbol string) (decimal.Decimal, error) {
	var total decimal.Decimal
	err := r.GetDB().Model(&model.CommissionRecord{}).
		Where("receiver_code = ? AND token_symbol = ?", receiverCode, tokenSymbol).
		Select("SUM(commission)").
		Scan(&total).Error
	return total, err
}

// UpdateUserCommissionTotal 手动更新用户的累计佣金总额（根据佣金记录重新计算）
func (r *CommissionRepository) UpdateUserCommissionTotal(receiverCode string) error {
	// 计算 TRX 总佣金
	var totalTRX decimal.Decimal
	if err := r.GetDB().Model(&model.CommissionRecord{}).
		Where("receiver_code = ? AND token_symbol = ?", receiverCode, "TRX").
		Select("COALESCE(SUM(commission), 0)").
		Scan(&totalTRX).Error; err != nil {
		return err
	}

	// 计算 USDT 总佣金
	var totalUSDT decimal.Decimal
	if err := r.GetDB().Model(&model.CommissionRecord{}).
		Where("receiver_code = ? AND token_symbol = ?", receiverCode, "USDT").
		Select("COALESCE(SUM(commission), 0)").
		Scan(&totalUSDT).Error; err != nil {
		return err
	}

	// 更新用户
	return r.GetDB().Model(&model.User{}).
		Where("referral_code = ?", receiverCode).
		Updates(map[string]interface{}{
			"total_commission_trx":  totalTRX,
			"total_commission_usdt": totalUSDT,
		}).Error
}

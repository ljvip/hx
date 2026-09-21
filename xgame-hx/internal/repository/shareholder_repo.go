// internal/repository/shareholder_repo.go
package repository

import (
	"errors"
	"game-hx/internal/model"
	"game-hx/pkg/database"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"strings"
	"time"
)

var (
	ErrInvalidShareholderAmount       = errors.New("shareholder amount must be greater than 0")
	ErrInsufficientShareholderBalance = errors.New("insufficient shareholder balance")
)

type ShareholderRepository struct{}

func NewShareholderRepository() *ShareholderRepository {
	return &ShareholderRepository{}
}

func (r *ShareholderRepository) GetDB() *gorm.DB {
	return database.GetDB()
}

// GetByUserID 根据用户ID获取股东信息
func (r *ShareholderRepository) GetByUserID(userID int64) (*model.Shareholder, error) {
	var shareholder model.Shareholder
	err := r.GetDB().Where("user_id = ? AND status = 1", userID).First(&shareholder).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &shareholder, err
}

func (r *ShareholderRepository) GetByUserIDAny(userID int64) (*model.Shareholder, error) {
	var shareholder model.Shareholder
	err := r.GetDB().Where("user_id = ?", userID).First(&shareholder).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &shareholder, err
}

// GetByCode 根据股东代码获取
func (r *ShareholderRepository) GetByCode(code string) (*model.Shareholder, error) {
	var shareholder model.Shareholder
	err := r.GetDB().Where("code = ? AND status = 1", code).First(&shareholder).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &shareholder, err
}

func (r *ShareholderRepository) GetByCodeAny(code string) (*model.Shareholder, error) {
	var shareholder model.Shareholder
	err := r.GetDB().Where("code = ?", code).First(&shareholder).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &shareholder, err
}

func (r *ShareholderRepository) GetByCodeForLogin(code string) (*model.Shareholder, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, nil
	}
	var shareholder model.Shareholder
	err := r.GetDB().Where("code = ? AND status = 1", code).First(&shareholder).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &shareholder, err
}

// Withdraw atomically debits a shareholder.
func (r *ShareholderRepository) Withdraw(id int64, amount decimal.Decimal, tokenSymbol string) (*model.Shareholder, error) {
	_ = tokenSymbol
	if !amount.GreaterThan(decimal.Zero) {
		return nil, ErrInvalidShareholderAmount
	}
	var shareholder model.Shareholder
	err := r.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", id).First(&shareholder).Error; err != nil {
			return err
		}
		result := tx.Model(&model.Shareholder{}).
			Where("id = ? AND balance >= ?", id, amount).
			Update("balance", gorm.Expr("balance - ?", amount))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrInsufficientShareholderBalance
		}
		return tx.Where("id = ?", id).First(&shareholder).Error
	})
	if err != nil {
		return nil, err
	}
	return &shareholder, nil
}

func (r *ShareholderRepository) Refund(id int64, amount decimal.Decimal) error {
	if !amount.GreaterThan(decimal.Zero) {
		return ErrInvalidShareholderAmount
	}
	return r.GetDB().Model(&model.Shareholder{}).Where("id = ?", id).
		Update("balance", gorm.Expr("balance + ?", amount)).Error
}

// GetByID 根据ID获取股东
func (r *ShareholderRepository) GetByID(id int64) (*model.Shareholder, error) {
	var shareholder model.Shareholder
	err := r.GetDB().Where("id = ?", id).First(&shareholder).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &shareholder, err
}

// 🆕 GetAll 获取所有股东（包括已停用的）
func (r *ShareholderRepository) GetAll() ([]model.Shareholder, error) {
	var shareholders []model.Shareholder
	err := r.GetDB().Order("id ASC").Find(&shareholders).Error
	return shareholders, err
}

// 🆕 GetAllActive 获取所有正常状态的股东
func (r *ShareholderRepository) GetAllActive() ([]model.Shareholder, error) {
	var shareholders []model.Shareholder
	err := r.GetDB().Where("status = 1").Order("id ASC").Find(&shareholders).Error
	return shareholders, err
}

// GetWithLock 获取股东信息并加锁（用于积分更新）
func (r *ShareholderRepository) GetWithLock(id int64) (*model.Shareholder, error) {
	var shareholder model.Shareholder
	err := r.GetDB().Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", id).First(&shareholder).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &shareholder, err
}

// UpdateBalance 原子更新股东余额
func (r *ShareholderRepository) UpdateBalance(id int64, changeAmount decimal.Decimal) error {
	return r.GetDB().Model(&model.Shareholder{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"balance":      gorm.Expr("balance + ?", changeAmount),
			"total_income": gorm.Expr("total_income + GREATEST(?, 0)", changeAmount),
			"total_cost":   gorm.Expr("total_cost + LEAST(?, 0)", changeAmount),
		}).Error
}

// GetByUserIDs 批量获取股东信息
func (r *ShareholderRepository) GetByUserIDs(userIDs []int64) ([]model.Shareholder, error) {
	var shareholders []model.Shareholder
	err := r.GetDB().Where("user_id IN ? AND status = 1", userIDs).Find(&shareholders).Error
	return shareholders, err
}

// Create 创建股东
func (r *ShareholderRepository) Create(shareholder *model.Shareholder) error {
	return r.GetDB().Create(shareholder).Error
}

// Update 更新股东
func (r *ShareholderRepository) Update(shareholder *model.Shareholder) error {
	return r.GetDB().Save(shareholder).Error
}

func (r *ShareholderRepository) UpdateBetLimits(id int64, minTRX, minUSDT, minBSC, maxBet *decimal.Decimal) error {
	return r.GetDB().Model(&model.Shareholder{}).
		Where("id = ?", id).
		Select("min_bet_trx", "min_bet_usdt", "min_bet_usdt_bsc", "max_bet", "updated_at").
		Updates(map[string]interface{}{
			"min_bet_trx":      nullableDecimal(minTRX),
			"min_bet_usdt":     nullableDecimal(minUSDT),
			"min_bet_usdt_bsc": nullableDecimal(minBSC),
			"max_bet":          nullableDecimal(maxBet),
			"updated_at":       time.Now(),
		}).Error
}

func nullableDecimal(value *decimal.Decimal) interface{} {
	if value == nil {
		return nil
	}
	return *value
}

func (r *ShareholderRepository) Delete(id int64) error {
	return r.GetDB().Delete(&model.Shareholder{}, id).Error
}

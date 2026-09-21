package repository

import (
	"errors"

	"game-hx/internal/model"
	"game-hx/pkg/database"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrDuplicateRecharge = errors.New("duplicate shareholder recharge")

type ShareholderRechargeRepository struct{}

func NewShareholderRechargeRepository() *ShareholderRechargeRepository {
	return &ShareholderRechargeRepository{}
}

func (r *ShareholderRechargeRepository) Create(tx *gorm.DB, recharge *model.ShareholderRecharge) error {
	result := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_id"}},
		DoNothing: true,
	}).Create(recharge)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrDuplicateRecharge
	}
	return nil
}

func (r *ShareholderRechargeRepository) GetDB() *gorm.DB {
	return database.GetDB()
}

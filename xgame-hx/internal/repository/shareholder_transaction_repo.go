// internal/repository/shareholder_transaction_repo.go
package repository

import (
	"game-hx/internal/model"
	"game-hx/pkg/database"
	"gorm.io/gorm"
	"time"
)

type ShareholderTransactionRepository struct{}

func NewShareholderTransactionRepository() *ShareholderTransactionRepository {
	return &ShareholderTransactionRepository{}
}

func (r *ShareholderTransactionRepository) GetDB() *gorm.DB {
	return database.GetDB()
}

// Create 创建交易记录
func (r *ShareholderTransactionRepository) Create(tx *model.ShareholderTransaction) error {
	return r.GetDB().Create(tx).Error
}

// CreateBatch 批量创建交易记录
func (r *ShareholderTransactionRepository) CreateBatch(txs []*model.ShareholderTransaction) error {
	if len(txs) == 0 {
		return nil
	}
	return r.GetDB().Create(txs).Error
}

// GetByTradeNo 根据交易号获取记录
func (r *ShareholderTransactionRepository) GetByTradeNo(tradeNo string) ([]model.ShareholderTransaction, error) {
	var txs []model.ShareholderTransaction
	err := r.GetDB().Where("trade_no = ?", tradeNo).Find(&txs).Error
	return txs, err
}

// GetByShareholderID 获取股东的积分变动记录
func (r *ShareholderTransactionRepository) GetByShareholderID(shareholderID int64, limit int) ([]model.ShareholderTransaction, error) {
	var txs []model.ShareholderTransaction
	err := r.GetDB().Where("shareholder_id = ?", shareholderID).
		Order("created_at DESC").Limit(limit).Find(&txs).Error
	return txs, err
}

// GetByTimeRange 按时间范围查询
func (r *ShareholderTransactionRepository) GetByTimeRange(shareholderID int64, start, end time.Time) ([]model.ShareholderTransaction, error) {
	var txs []model.ShareholderTransaction
	err := r.GetDB().Where("shareholder_id = ? AND created_at >= ? AND created_at <= ?",
		shareholderID, start, end).Find(&txs).Error
	return txs, err
}

// internal/repository/shareholder_transaction_repo.go

// GetByShareholderIDWithFilter 带过滤条件的查询
func (r *ShareholderTransactionRepository) GetByShareholderIDWithFilter(
	shareholderID int64,
	limit int,
	gameName, tradeNo, startDate, endDate string,
) ([]model.ShareholderTransaction, error) {
	query := r.GetDB().Where("shareholder_id = ?", shareholderID)

	if gameName != "" {
		query = query.Where("game_name = ?", gameName)
	}
	if tradeNo != "" {
		query = query.Where("trade_no LIKE ?", "%"+tradeNo+"%")
	}
	if startDate != "" {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("created_at <= ?", endDate+" 23:59:59")
	}

	var txs []model.ShareholderTransaction
	err := query.Order("created_at DESC").Limit(limit).Find(&txs).Error
	return txs, err
}

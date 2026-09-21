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
	ErrDuplicateTx      = errors.New("duplicate tx_id")
	ErrEmptyTxID        = errors.New("tx_id is required")
	ErrCannotRetry      = errors.New("cannot retry payout")
	ErrAlreadyPaid      = errors.New("payout already succeeded")
	ErrBetNotFound      = errors.New("bet not found")
	ErrPayoutInProgress = errors.New("payout in progress")
)

type BetRepository struct{}

func NewBetRepository() *BetRepository {
	return &BetRepository{}
}

func (r *BetRepository) GetDB() *gorm.DB {
	return database.GetDB()
}

// SaveBetResult 保存投注结果。依赖 tx_id 唯一索引，冲突视为已结算。
func (r *BetRepository) SaveBetResult(bet *model.BetResult) error {
	bet.OwnerAddress = NormalizeAddress(bet.OwnerAddress)
	bet.ToAddress = NormalizeAddress(bet.ToAddress)
	bet.TxID = strings.TrimSpace(bet.TxID)
	if bet.TxID == "" {
		return ErrEmptyTxID
	}

	result := r.GetDB().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tx_id"}},
		DoNothing: true,
	}).Create(bet)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrDuplicateTx
	}
	return nil
}

// UpdatePayout 更新返奖交易结果
func (r *BetRepository) UpdatePayout(txID, payoutTxID, status, errMsg string) error {
	txID = strings.TrimSpace(txID)
	if txID == "" {
		return ErrEmptyTxID
	}
	if len(errMsg) > 512 {
		errMsg = errMsg[:512]
	}
	return r.GetDB().Model(&model.BetResult{}).
		Where("tx_id = ?", txID).
		Updates(map[string]interface{}{
			"payout_tx_id":  payoutTxID,
			"payout_status": status,
			"payout_error":  errMsg,
		}).Error
}

func (r *BetRepository) GetByTxID(txID string) (*model.BetResult, error) {
	txID = strings.TrimSpace(txID)
	if txID == "" {
		return nil, ErrEmptyTxID
	}
	var bet model.BetResult
	err := r.GetDB().Where("tx_id = ?", txID).First(&bet).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrBetNotFound
	}
	if err != nil {
		return nil, err
	}
	return &bet, nil
}

func (r *BetRepository) ListByPayoutStatus(status string, limit int) ([]model.BetResult, error) {
	if limit <= 0 {
		limit = 100
	}
	query := r.GetDB().Model(&model.BetResult{})
	if status != "" {
		query = query.Where("payout_status = ?", status)
	}
	var list []model.BetResult
	err := query.Order("created_at DESC").Limit(limit).Find(&list).Error
	return list, err
}

// ClaimPayoutRetry 锁定注单并标记 pending。
// 默认只允许 failed / 空状态重试，避免与进行中的打款并发双花。
// force=true 时允许重试卡住的 pending（进程崩溃后）。
func (r *BetRepository) ClaimPayoutRetry(txID string, force bool) (*model.BetResult, error) {
	txID = strings.TrimSpace(txID)
	if txID == "" {
		return nil, ErrEmptyTxID
	}

	var bet model.BetResult
	err := r.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("tx_id = ?", txID).
			First(&bet).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrBetNotFound
			}
			return err
		}
		if !bet.FinalAmount.GreaterThan(decimal.Zero) {
			return ErrCannotRetry
		}
		if bet.PayoutStatus == "success" {
			return ErrAlreadyPaid
		}
		if bet.PayoutStatus == "pending" && !force {
			return ErrPayoutInProgress
		}
		return tx.Model(&model.BetResult{}).Where("id = ?", bet.ID).Updates(map[string]interface{}{
			"payout_status": "pending",
			"payout_error":  "",
		}).Error
	})
	if err != nil {
		return nil, err
	}
	bet.PayoutStatus = "pending"
	bet.PayoutError = ""
	return &bet, nil
}

// ExistsByTxID 判断交易是否已结算，避免重复入账
func (r *BetRepository) ExistsByTxID(txID string) (bool, error) {
	if txID == "" {
		return false, nil
	}
	var id int64
	err := r.GetDB().Model(&model.BetResult{}).Select("id").Where("tx_id = ?", txID).Limit(1).Scan(&id).Error
	return id > 0, err
}

// GetRecentByOwner 按地址查最近投注，EVM 地址忽略大小写
func (r *BetRepository) GetRecentByOwner(ownerAddress string, limit int) ([]model.BetResult, error) {
	ownerAddress = NormalizeAddress(ownerAddress)
	if limit <= 0 {
		limit = 100
	}

	query := r.GetDB().Model(&model.BetResult{})
	if isEVMAddress(ownerAddress) {
		query = query.Where("LOWER(owner_address) = ?", ownerAddress)
	} else {
		query = query.Where("owner_address = ?", ownerAddress)
	}

	var results []model.BetResult
	err := query.Order("created_at DESC").Limit(limit).Find(&results).Error
	return results, err
}

// GetBetResults 获取投注结果
func (r *BetRepository) GetBetResults(params map[string]interface{}, startDate, endDate time.Time) ([]model.BetResult, decimal.Decimal, decimal.Decimal, error) {
	query := r.GetDB().Model(&model.BetResult{})

	if !startDate.IsZero() && !endDate.IsZero() {
		query = query.Where("created_at >= ? AND created_at <= ?", startDate, endDate)
	}

	for key, value := range params {
		if value == nil {
			continue
		}

		// 处理空字符串
		if str, ok := value.(string); ok && str == "" {
			continue
		}

		// 处理空切片
		if slice, ok := value.([]string); ok && len(slice) == 0 {
			continue
		}

		if key == "owner_address IN ?" {
			addrs, ok := value.([]string)
			if ok {
				normalized := make([]string, 0, len(addrs))
				hasEVM := false
				for _, addr := range addrs {
					n := NormalizeAddress(addr)
					if n == "" {
						continue
					}
					normalized = append(normalized, n)
					if isEVMAddress(n) {
						hasEVM = true
					}
				}
				if hasEVM {
					query = query.Where("owner_address IN ? OR LOWER(owner_address) IN ?", normalized, normalized)
				} else {
					query = query.Where("owner_address IN ?", normalized)
				}
			} else {
				query = query.Where("owner_address IN ?", value)
			}
		} else if key == "owner_address" {
			addr, _ := value.(string)
			addr = NormalizeAddress(addr)
			if isEVMAddress(addr) {
				query = query.Where("LOWER(owner_address) = ?", addr)
			} else {
				query = query.Where("owner_address = ?", addr)
			}
		} else {
			query = query.Where(key, value)
		}
	}

	var results []model.BetResult
	if err := query.Order("created_at DESC").Find(&results).Error; err != nil {
		return nil, decimal.Zero, decimal.Zero, err
	}

	totalTx, totalFinal := decimal.Zero, decimal.Zero
	for _, r := range results {
		totalTx = totalTx.Add(r.TransactionAmount)
		totalFinal = totalFinal.Add(r.FinalAmount)
	}

	return results, totalTx, totalFinal, nil
}

// GetRecent returns the newest bets without loading the entire table.
func (r *BetRepository) GetRecent(limit int) ([]model.BetResult, error) {
	if limit <= 0 {
		limit = 100
	}
	var results []model.BetResult
	err := r.GetDB().Order("created_at DESC").Limit(limit).Find(&results).Error
	return results, err
}

// SaveGameTrend 保存游戏走势
func (r *BetRepository) SaveGameTrend(trend *model.GameTrend) error {
	return r.GetDB().Create(trend).Error
}

// FetchGameTrends 获取游戏走势
func (r *BetRepository) FetchGameTrends(gameName string, limit int) ([]model.GameTrend, error) {
	var trends []model.GameTrend
	err := r.GetDB().Where("game_type = ?", gameName).
		Order("created_at DESC").
		Limit(limit).
		Find(&trends).Error
	return trends, err
}

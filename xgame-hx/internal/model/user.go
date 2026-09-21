package model

import (
	"github.com/shopspring/decimal"
	"time"
)

// User 用户模型
type User struct {
	ID           int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	TelegramID   *int64 `json:"telegram_id" gorm:"unique"`
	OwnerAddress string `json:"owner_address" gorm:"unique"`
	Name         string `json:"name"`
	Referrer     string `json:"referrer"`
	ReferralCode string `json:"referral_code"`
	// 🆕 新增字段：标识用户是否为股东
	IsShareholder   bool   `gorm:"default:false" json:"is_shareholder"`   // 是否为股东
	ShareholderCode string `gorm:"size:50;index" json:"shareholder_code"` // 所属股东代码，普通用户与推荐人相同

	TotalBetTRX         decimal.Decimal `json:"total_bet_trx" gorm:"type:numeric;default:0"`
	TotalBetUSDT        decimal.Decimal `json:"total_bet_usdt" gorm:"type:numeric;default:0"`
	TotalWinTRX         decimal.Decimal `json:"total_win_trx" gorm:"type:numeric;default:0"`
	TotalWinUSDT        decimal.Decimal `json:"total_win_usdt" gorm:"type:numeric;default:0"`
	UseTRX              decimal.Decimal `json:"use_trx" gorm:"type:numeric;default:0"`
	UseUSDT             decimal.Decimal `json:"use_usdt" gorm:"type:numeric;default:0"`
	CommissionRate      float64         `json:"commission_rate" gorm:"default:0"`
	TotalCommissionTRX  decimal.Decimal `json:"total_commission_trx" gorm:"type:numeric;default:0"`
	TotalCommissionUSDT decimal.Decimal `json:"total_commission_usdt" gorm:"type:numeric;default:0"`
	JoinTime            time.Time       `json:"join_time"`
}

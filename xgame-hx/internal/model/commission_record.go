package model

import (
	"time"

	"github.com/shopspring/decimal"
)

// CommissionRecord 佣金记录
type CommissionRecord struct {
	ID             int64           `gorm:"primaryKey;autoIncrement" json:"id"`
	ReceiverCode   string          `json:"receiver_code" gorm:"not null"`
	ReceiverAddr   *string         `json:"receiver_addr"`
	SenderCode     string          `json:"sender_code" gorm:"not null"`
	SenderAddr     *string         `json:"sender_addr"`
	BetAmount      decimal.Decimal `json:"bet_amount" gorm:"type:numeric;not null"`
	Commission     decimal.Decimal `json:"commission" gorm:"type:numeric;not null"`
	CommissionRate float64         `json:"commission_rate" gorm:"not null"`
	GameType       string          `json:"game_type" gorm:"not null"`
	TokenSymbol    string          `json:"token_symbol" gorm:"not null"`
	WithdrawAmount decimal.Decimal `json:"withdraw_amount" gorm:"type:numeric"`
	Remark         string          `json:"remark"`
	CreatedAt      time.Time       `json:"created_at"`
}

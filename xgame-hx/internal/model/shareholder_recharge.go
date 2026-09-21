package model

import (
	"time"

	"github.com/shopspring/decimal"
)

// ShareholderRecharge records an idempotently processed on-chain recharge.
type ShareholderRecharge struct {
	ID            int64           `gorm:"primaryKey;autoIncrement" json:"id"`
	TxID          string          `gorm:"size:128;not null;uniqueIndex" json:"tx_id"`
	ShareholderID int64           `gorm:"not null;index" json:"shareholder_id"`
	FromAddress   string          `gorm:"size:255;not null" json:"from_address"`
	TokenSymbol   string          `gorm:"size:16;not null" json:"token_symbol"`
	Amount        decimal.Decimal `gorm:"type:numeric;not null" json:"amount"`
	CreatedAt     time.Time       `json:"created_at"`
}

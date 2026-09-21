package model

import (
	"time"

	"github.com/shopspring/decimal"
)

// BetResult 投注结果
type BetResult struct {
	ID                int64           `gorm:"primaryKey;autoIncrement" json:"id"`
	BlockNumber       int64           `gorm:"not null" json:"block_number"`
	BlockHash         string          `json:"block_hash"`
	OwnerAddress      string          `gorm:"size:255;not null;index" json:"owner_address"`
	ToAddress         string          `gorm:"size:255;not null" json:"to_address"`
	GameName          string          `json:"game_name"`
	TransactionAmount decimal.Decimal `json:"transaction_amount" gorm:"type:numeric"`
	TokenSymbol       string          `json:"token_symbol"`
	TxID              string          `gorm:"size:128;not null" json:"tx_id"`
	GameResult        string          `json:"game_result"`
	UserResult        string          `json:"user_result"`
	FinalAmount       decimal.Decimal `json:"final_amount" gorm:"type:numeric"`
	PayoutTxID        string          `gorm:"size:128" json:"payout_tx_id"`
	PayoutStatus      string          `gorm:"size:32" json:"payout_status"`
	PayoutError       string          `gorm:"size:512" json:"payout_error"`
	CreatedAt         time.Time       `json:"created_at"`
}

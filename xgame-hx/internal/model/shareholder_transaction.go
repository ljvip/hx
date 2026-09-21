// internal/model/shareholder_transaction.go
package model

import (
	"time"

	"github.com/shopspring/decimal"
)

// ShareholderTransaction 股东积分交易记录
type ShareholderTransaction struct {
	ID             int64           `gorm:"primaryKey;autoIncrement" json:"id"`
	TradeNo        string          `gorm:"size:128;not null;index" json:"trade_no"`    // 关联投注订单号 (tx_id)
	UserID         int64           `gorm:"not null;index" json:"user_id"`              // 玩家ID
	ShareholderID  int64           `gorm:"not null;index" json:"shareholder_id"`       // 股东ID
	GameName       string          `gorm:"size:100" json:"game_name"`                  // 游戏名称
	BetAmount      decimal.Decimal `gorm:"type:numeric;not null" json:"bet_amount"`    // 投注金额
	Odds           float64         `gorm:"default:0" json:"odds"`                      // 赔率
	ShareRatio     float64         `gorm:"not null" json:"share_ratio"`                // 股东占成比例
	CommissionRate float64         `gorm:"not null" json:"commission_rate"`            // 游戏分佣比例
	Result         int             `gorm:"not null" json:"result"`                     // 投注结果: 0-输 1-赢
	ProfitLoss     decimal.Decimal `gorm:"type:numeric;not null" json:"profit_loss"`   // 股东盈亏部分 (输为正，赢为负)
	Commission     decimal.Decimal `gorm:"type:numeric;not null" json:"commission"`    // 股东承担佣金 (始终为负)
	ChangeAmount   decimal.Decimal `gorm:"type:numeric;not null" json:"change_amount"` // 净变动 = profit_loss + commission
	BalanceAfter   decimal.Decimal `gorm:"type:numeric;not null" json:"balance_after"` // 变动后股东积分余额
	Remark         string          `gorm:"size:500" json:"remark"`                     // 备注
	CreatedAt      time.Time       `json:"created_at"`
}

// TableName 指定表名
func (ShareholderTransaction) TableName() string {
	return "shareholder_transactions"
}

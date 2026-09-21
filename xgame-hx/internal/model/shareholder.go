// internal/model/shareholder.go
package model

import (
	"time"

	"github.com/shopspring/decimal"
)

// Shareholder 股东模型
type Shareholder struct {
	ID                int64           `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID            int64           `gorm:"not null;uniqueIndex" json:"user_id"`        // 关联用户ID
	Code              string          `gorm:"size:50;uniqueIndex;not null" json:"code"`   // 股东代码
	Name              string          `gorm:"size:100" json:"name"`                       // 股东名称
	PasswordHash      string          `gorm:"column:password_hash;size:255" json:"-"`     // 登录密码 bcrypt 哈希
	Level             int             `gorm:"default:1" json:"level"`                     // 股东层级
	ParentID          *int64          `json:"parent_id"`                                  // 上级股东ID
	DefaultShareRatio float64          `gorm:"default:0" json:"default_share_ratio"`       // 默认占成比例
	MinBetTRX         *decimal.Decimal `gorm:"type:numeric(20,8)" json:"min_bet_trx"`      // 伞下 TRX 最小投注，空则用系统
	MinBetUSDT        *decimal.Decimal `gorm:"type:numeric(20,8)" json:"min_bet_usdt"`     // 伞下 TRON USDT 最小投注，空则用系统
	MinBetUSDTBsc     *decimal.Decimal `gorm:"type:numeric(20,8)" json:"min_bet_usdt_bsc"` // 伞下 BSC USDT 最小投注，空则用系统
	MaxBet            *decimal.Decimal `gorm:"type:numeric(20,8)" json:"max_bet"`          // 伞下单笔上限，空则用系统
	Balance           decimal.Decimal  `gorm:"type:numeric;default:0" json:"balance"`      // 当前积分余额
	TotalIncome       decimal.Decimal `gorm:"type:numeric;default:0" json:"total_income"` // 累计收入
	TotalCost         decimal.Decimal `gorm:"type:numeric;default:0" json:"total_cost"`   // 累计支出
	Status            int             `gorm:"default:1" json:"status"`                    // 状态: 1-正常 0-停用
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}

// TableName 指定表名
func (Shareholder) TableName() string {
	return "shareholders"
}

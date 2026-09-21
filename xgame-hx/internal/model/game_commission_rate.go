package model

import "time"

// GameCommissionRate 游戏佣金比例表
type GameCommissionRate struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	GameType       string    `gorm:"unique;not null" json:"game_type"`
	CommissionRate float64   `json:"commission_rate" gorm:"default:0"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

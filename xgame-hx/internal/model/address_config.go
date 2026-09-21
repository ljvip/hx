package model

import "time"

// AddressConfig 代理游戏投注地址表
type AddressConfig struct {
	ID        int       `gorm:"primaryKey" json:"id"`
	Address   string    `json:"address"`
	Name      string    `json:"name"`
	Odds      float64   `json:"odds"`
	Remark    string    `json:"remark"`
	CreatedAt time.Time `json:"created_at"`
}

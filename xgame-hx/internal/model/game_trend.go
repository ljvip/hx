package model

import "time"

// GameTrend 游戏走势表
type GameTrend struct {
	ID        int       `gorm:"primaryKey;autoIncrement" json:"id"`
	GameType  string    `gorm:"size:100" json:"game_type"`
	Result    string    `gorm:"size:255" json:"result"`
	CreatedAt time.Time `json:"created_at"`
}

package model

import (
	"time"
)

// Admin 管理员模型
type Admin struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"unique;not null" json:"username"`
	PasswordHash string    `gorm:"not null" json:"-"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// SetPassword 设置密码（纯方法，不依赖数据库）
func (a *Admin) SetPassword(password string, bcryptHash func(string) (string, error)) error {
	hash, err := bcryptHash(password)
	if err != nil {
		return err
	}
	a.PasswordHash = hash
	return nil
}

// CheckPassword 验证密码（纯方法，不依赖数据库）
func (a *Admin) CheckPassword(password string, bcryptCompare func(hash, password string) bool) bool {
	return bcryptCompare(a.PasswordHash, password)
}

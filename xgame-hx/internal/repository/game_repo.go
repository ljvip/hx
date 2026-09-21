package repository

import (
	"strings"

	"game-hx/internal/model"
	"game-hx/pkg/database"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type GameRepository struct{}

func NewGameRepository() *GameRepository {
	return &GameRepository{}
}

func (r *GameRepository) GetDB() *gorm.DB {
	return database.GetDB()
}

// GetCommissionRateByGame 获取游戏佣金比例
func (r *GameRepository) GetCommissionRateByGame(gameType string) (float64, error) {
	var rate model.GameCommissionRate
	err := r.GetDB().Where("game_type = ?", gameType).First(&rate).Error
	if err != nil {
		return 0, err
	}
	return rate.CommissionRate, nil
}

// SetCommissionRateByGame 设置游戏佣金比例
func (r *GameRepository) SetCommissionRateByGame(gameType string, commissionRate float64) error {
	var rate model.GameCommissionRate
	err := r.GetDB().Where("game_type = ?", gameType).First(&rate).Error
	if err != nil {
		rate = model.GameCommissionRate{
			GameType:       gameType,
			CommissionRate: commissionRate,
		}
		return r.GetDB().Create(&rate).Error
	}
	return r.GetDB().Model(&rate).Update("commission_rate", commissionRate).Error
}

// GetAllGameRates 获取所有游戏佣金比例
func (r *GameRepository) GetAllGameRates() ([]model.GameCommissionRate, error) {
	var rates []model.GameCommissionRate
	err := r.GetDB().Find(&rates).Error
	return rates, err
}

// UpsertGameRate 添加或更新游戏佣金比例
func (r *GameRepository) UpsertGameRate(rate model.GameCommissionRate) error {
	return r.GetDB().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "game_type"}},
		DoUpdates: clause.AssignmentColumns([]string{"commission_rate", "updated_at"}),
	}).Create(&rate).Error
}

// GetAllAddresses 获取所有地址配置
func (r *GameRepository) GetAllAddresses() ([]model.AddressConfig, error) {
	var addresses []model.AddressConfig
	err := r.GetDB().Find(&addresses).Error
	return addresses, err
}

// CreateAddress 创建地址配置
func (r *GameRepository) CreateAddress(address *model.AddressConfig) error {
	return r.GetDB().Create(address).Error
}

// UpdateAddress 更新地址配置
func (r *GameRepository) UpdateAddress(id int, address, name string, odds float64, remark string) error {
	updates := map[string]interface{}{
		"name":   name,
		"odds":   odds,
		"remark": remark,
	}
	if strings.TrimSpace(address) != "" {
		updates["address"] = strings.TrimSpace(address)
	}
	return r.GetDB().Model(&model.AddressConfig{}).Where("id = ?", id).Updates(updates).Error
}

// GetAddressByID 根据ID获取地址
func (r *GameRepository) GetAddressByID(id int) (*model.AddressConfig, error) {
	var address model.AddressConfig
	err := r.GetDB().Where("id = ?", id).First(&address).Error
	return &address, err
}

// DeleteAddress 删除地址配置
func (r *GameRepository) DeleteAddress(id int) error {
	return r.GetDB().Delete(&model.AddressConfig{}, id).Error
}

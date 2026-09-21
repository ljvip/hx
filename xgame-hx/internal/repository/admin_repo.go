package repository

import (
	"game-hx/internal/model"
	"game-hx/pkg/database"

	"gorm.io/gorm"
)

type AdminRepository struct{}

func NewAdminRepository() *AdminRepository {
	return &AdminRepository{}
}

func (r *AdminRepository) GetDB() *gorm.DB {
	return database.GetDB()
}

func (r *AdminRepository) GetByUsername(username string) (*model.Admin, error) {
	var admin model.Admin
	err := r.GetDB().Where("username = ?", username).First(&admin).Error
	if err != nil {
		return nil, err
	}
	return &admin, nil
}

func (r *AdminRepository) GetAll() ([]model.Admin, error) {
	var admins []model.Admin
	err := r.GetDB().Find(&admins).Error
	return admins, err
}

func (r *AdminRepository) Create(admin *model.Admin) error {
	return r.GetDB().Create(admin).Error
}

func (r *AdminRepository) Update(admin *model.Admin) error {
	return r.GetDB().Save(admin).Error
}

func (r *AdminRepository) ExistsByUsername(username string) bool {
	var count int64
	r.GetDB().Model(&model.Admin{}).Where("username = ?", username).Count(&count)
	return count > 0
}

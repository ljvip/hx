package repository

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"game-hx/internal/model"
	"game-hx/pkg/database"
	"github.com/shopspring/decimal"

	"gorm.io/gorm"
)

// NormalizeAddress 统一钱包地址格式：EVM 地址转小写，TRON 保持原样。
func NormalizeAddress(addr string) string {
	addr = strings.TrimSpace(addr)
	if len(addr) >= 2 && addr[0] == '0' && (addr[1] == 'x' || addr[1] == 'X') {
		return strings.ToLower(addr)
	}
	return addr
}

func isEVMAddress(addr string) bool {
	return len(addr) >= 2 && (strings.HasPrefix(addr, "0x") || strings.HasPrefix(addr, "0X"))
}

type UserRepository struct{}

var ErrProtectedUser = errors.New("system user cannot be modified or deleted")

func NewUserRepository() *UserRepository {
	return &UserRepository{}
}

func (r *UserRepository) GetDB() *gorm.DB {
	return database.GetDB()
}

func (r *UserRepository) Create(user *model.User) error {
	user.OwnerAddress = NormalizeAddress(user.OwnerAddress)
	return r.GetDB().Create(user).Error
}

func (r *UserRepository) GetByTelegramID(telegramID int64) (*model.User, error) {
	var user model.User
	err := r.GetDB().Where("telegram_id = ?", telegramID).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &user, err
}

func (r *UserRepository) GetByOwnerAddress(ownerAddress string) (*model.User, error) {
	ownerAddress = NormalizeAddress(ownerAddress)
	if ownerAddress == "" {
		return nil, nil
	}

	var user model.User
	err := r.GetDB().Where("owner_address = ?", ownerAddress).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) && isEVMAddress(ownerAddress) {
		err = r.GetDB().Where("LOWER(owner_address) = ?", ownerAddress).First(&user).Error
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &user, err
}

func (r *UserRepository) GetByOwnerAddressOrTelegram(ownerAddress, telegramID string) (*model.User, error) {
	ownerAddress = strings.TrimSpace(ownerAddress)
	telegramID = strings.TrimSpace(telegramID)
	if ownerAddress != "" {
		return r.GetByOwnerAddress(ownerAddress)
	}
	if telegramID == "" {
		return nil, nil
	}
	tid, err := strconv.ParseInt(telegramID, 10, 64)
	if err != nil || tid == 0 {
		return nil, fmt.Errorf("invalid telegram_id")
	}
	return r.GetByTelegramID(tid)
}

func (r *UserRepository) GetByReferralCode(referralCode string) (*model.User, error) {
	var user model.User
	err := r.GetDB().Where("referral_code = ?", referralCode).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &user, err
}

func (r *UserRepository) GetByID(id int64) (*model.User, error) {
	var user model.User
	err := r.GetDB().Where("id = ?", id).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &user, err
}

func (r *UserRepository) GetAll() ([]model.User, error) {
	var users []model.User
	err := r.GetDB().Find(&users).Error
	return users, err
}

func (r *UserRepository) Update(user *model.User) error {
	return r.GetDB().Save(user).Error
}

func (r *UserRepository) UpdateAdmin(userID int64, updates map[string]interface{}) (*model.User, error) {
	var user model.User
	err := r.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
			return err
		}
		if user.ReferralCode == "system" || user.OwnerAddress == "888888888888888888" {
			return ErrProtectedUser
		}
		oldReferralCode := user.ReferralCode
		if err := tx.Model(&model.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
			return err
		}
		if newCode, ok := updates["referral_code"].(string); ok && newCode != oldReferralCode {
			if err := tx.Model(&model.User{}).Where("referrer = ?", oldReferralCode).Update("referrer", newCode).Error; err != nil {
				return err
			}
			if err := tx.Model(&model.CommissionRecord{}).Where("receiver_code = ?", oldReferralCode).Update("receiver_code", newCode).Error; err != nil {
				return err
			}
			if err := tx.Model(&model.CommissionRecord{}).Where("sender_code = ?", oldReferralCode).Update("sender_code", newCode).Error; err != nil {
				return err
			}
		}
		return tx.Where("id = ?", userID).First(&user).Error
	})
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) DeleteWithRelatedData(userID int64) error {
	return r.GetDB().Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
			return err
		}
		if user.ReferralCode == "system" || user.OwnerAddress == "888888888888888888" {
			return ErrProtectedUser
		}

		var shareholder model.Shareholder
		shareholderErr := tx.Where("user_id = ?", userID).First(&shareholder).Error
		if shareholderErr == nil {
			if err := tx.Where("shareholder_id = ?", shareholder.ID).Delete(&model.ShareholderRecharge{}).Error; err != nil {
				return err
			}
			if err := tx.Where("shareholder_id = ?", shareholder.ID).Delete(&model.ShareholderTransaction{}).Error; err != nil {
				return err
			}
			if err := tx.Delete(&shareholder).Error; err != nil {
				return err
			}
		} else if !errors.Is(shareholderErr, gorm.ErrRecordNotFound) {
			return shareholderErr
		}

		if err := tx.Where("owner_address = ?", user.OwnerAddress).Delete(&model.BetResult{}).Error; err != nil {
			return err
		}
		if err := tx.Where("receiver_code = ? OR sender_code = ?", user.ReferralCode, user.ReferralCode).
			Delete(&model.CommissionRecord{}).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", userID).Delete(&model.User{}).Error; err != nil {
			return err
		}
		return nil
	})
}

func (r *UserRepository) GetDirectReferrals(referralCode string) ([]model.User, error) {
	var referrals []model.User
	err := r.GetDB().Where("referrer = ?", referralCode).Find(&referrals).Error
	return referrals, err
}

func (r *UserRepository) GetCommissionBounds(user *model.User) (float64, float64, error) {
	minRate := 0.0
	maxRate := 1.0
	if user.Referrer != "" && user.Referrer != "system" {
		referrer, err := r.GetByReferralCode(user.Referrer)
		if err != nil {
			return 0, 0, err
		}
		if referrer == nil {
			return 0, 0, errors.New("referrer not found")
		}
		maxRate = referrer.CommissionRate
	}
	children, err := r.GetDirectReferrals(user.ReferralCode)
	if err != nil {
		return 0, 0, err
	}
	for _, child := range children {
		if child.CommissionRate > minRate {
			minRate = child.CommissionRate
		}
	}
	return minRate, maxRate, nil
}

// UpdateUserStats 更新用户统计
func (r *UserRepository) UpdateUserStats(userID int64, betTRX, betUSDT, winTRX, winUSDT decimal.Decimal) error {
	return r.GetDB().Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"total_bet_trx":  gorm.Expr("total_bet_trx + ?", betTRX),
		"total_bet_usdt": gorm.Expr("total_bet_usdt + ?", betUSDT),
		"total_win_trx":  gorm.Expr("total_win_trx + ?", winTRX),
		"total_win_usdt": gorm.Expr("total_win_usdt + ?", winUSDT),
	}).Error
}

// GetReferralChainByCTE 使用递归CTE获取完整推荐链（向上查找）
// 返回从自己到 system 的完整推荐码链
func (r *UserRepository) GetReferralChainByCTE(userID int64) ([]string, error) {
	sql := `
        WITH RECURSIVE referral_chain AS (
            -- 起始：查询自己
            SELECT 
                id,
                referral_code,
                referrer,
                1 as depth,
                ARRAY[referral_code] as path,
                false as is_cycle
            FROM users 
            WHERE id = ?
            
            UNION ALL
            
            -- 递归：向上查找推荐人
            SELECT 
                u.id,
                u.referral_code,
                u.referrer,
                rc.depth + 1,
                rc.path || u.referral_code,
                u.referral_code = ANY(rc.path) as is_cycle
            FROM referral_chain rc
            JOIN users u ON rc.referrer = u.referral_code
            WHERE 
                rc.depth < 20 
                AND rc.referrer IS NOT NULL 
                AND rc.referrer != ''
                AND rc.referrer != 'system'
                AND NOT rc.is_cycle
                AND u.id IS NOT NULL
        )
        SELECT referral_code FROM referral_chain ORDER BY depth
    `

	var chain []string
	err := r.GetDB().Raw(sql, userID).Pluck("referral_code", &chain).Error
	if err != nil {
		return nil, fmt.Errorf("CTE查询推荐链失败: %w", err)
	}

	// 确保最后有 system
	if len(chain) > 0 && chain[len(chain)-1] != "system" {
		chain = append(chain, "system")
	}

	return chain, nil
}

// GetReferralTreeByCTE 获取用户的所有下级（向下查找）
// 返回所有直接和间接下级的推荐码列表
func (r *UserRepository) GetReferralTreeByCTE(referralCode string) ([]string, error) {
	sql := `
        WITH RECURSIVE referral_tree AS (
            -- 起始：查询直接下级
            SELECT 
                referral_code,
                referrer,
                1 as depth,
                ARRAY[referral_code] as path
            FROM users 
            WHERE referrer = ?
            
            UNION ALL
            
            -- 递归：向下查找下级的下级
            SELECT 
                u.referral_code,
                u.referrer,
                rt.depth + 1,
                rt.path || u.referral_code
            FROM referral_tree rt
            JOIN users u ON rt.referral_code = u.referrer
            WHERE rt.depth < 20
        )
        SELECT DISTINCT referral_code FROM referral_tree
    `

	var chain []string
	err := r.GetDB().Raw(sql, referralCode).Pluck("referral_code", &chain).Error
	if err != nil {
		return nil, fmt.Errorf("CTE查询下级树失败: %w", err)
	}

	return chain, nil
}

func (r *UserRepository) GetOwnerAddressesByReferralCodes(codes []string) ([]string, error) {
	if len(codes) == 0 {
		return []string{}, nil
	}
	var addresses []string
	err := r.GetDB().Model(&model.User{}).
		Where("referral_code IN ?", codes).
		Pluck("owner_address", &addresses).Error
	return addresses, err
}

// GetFullReferralInfoByCTE 一次性获取推荐链和佣金率（优化版）
func (r *UserRepository) GetFullReferralInfoByCTE(userID int64) ([]ReferralChainNode, error) {
	sql := `
        WITH RECURSIVE referral_chain AS (
            SELECT 
                id,
                referral_code,
                referrer,
                commission_rate,
                1 as depth,
                ARRAY[referral_code] as path
            FROM users 
            WHERE id = ?
            
            UNION ALL
            
            SELECT 
                u.id,
                u.referral_code,
                u.referrer,
                u.commission_rate,
                rc.depth + 1,
                rc.path || u.referral_code
            FROM referral_chain rc
            JOIN users u ON rc.referrer = u.referral_code
            WHERE 
                rc.depth < 20 
                AND rc.referrer IS NOT NULL 
                AND rc.referrer != ''
                AND rc.referrer != 'system'
                AND NOT u.referral_code = ANY(rc.path)
        )
        SELECT 
            referral_code,
            commission_rate,
            depth
        FROM referral_chain 
        ORDER BY depth
    `

	var nodes []ReferralChainNode
	err := r.GetDB().Raw(sql, userID).Scan(&nodes).Error
	if err != nil {
		return nil, fmt.Errorf("CTE查询推荐链信息失败: %w", err)
	}

	return nodes, nil
}

// ReferralChainNode 推荐链节点
type ReferralChainNode struct {
	ReferralCode   string  `json:"referral_code"`
	CommissionRate float64 `json:"commission_rate"`
	Depth          int     `json:"depth"`
}

// internal/repository/user_repo.go

// UpdateShareholderInfo 更新用户的股东信息
func (r *UserRepository) UpdateShareholderInfo(userID int64, isShareholder bool, shareholderCode string) error {
	updates := map[string]interface{}{
		"is_shareholder": isShareholder,
	}
	if isShareholder {
		updates["shareholder_code"] = shareholderCode
	} else {
		updates["shareholder_code"] = ""
	}
	return r.GetDB().Model(&model.User{}).Where("id = ?", userID).Updates(updates).Error
}

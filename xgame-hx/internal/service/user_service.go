package service

import (
	"crypto/rand"
	"errors"
	"strconv"
	"strings"
	"time"

	"game-hx/internal/model"
	"game-hx/internal/repository"
)

type UserService struct {
	userRepo       *repository.UserRepository
	shareholderSvc *ShareholderService
}

func NewUserService() *UserService {
	return &UserService{
		userRepo:       repository.NewUserRepository(),
		shareholderSvc: NewShareholderService(),
	}
}

func GenerateReferralCode() string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = charset[b[i]%byte(len(charset))]
	}
	return string(b)
}

func (s *UserService) uniqueReferralCode() (string, error) {
	for i := 0; i < 20; i++ {
		code := GenerateReferralCode()
		existing, err := s.userRepo.GetByReferralCode(code)
		if err != nil {
			return "", err
		}
		if existing == nil {
			return code, nil
		}
	}
	return "", errors.New("生成推荐码失败，请重试")
}

func canBindReferrer(user *model.User) bool {
	return user.Referrer == "" || user.Referrer == "system"
}

func (s *UserService) resolveReferrer(referrer string, selfCode string) string {
	referrer = strings.TrimSpace(referrer)
	if referrer == "" || referrer == "system" {
		return "system"
	}
	if selfCode != "" && referrer == selfCode {
		return "system"
	}
	referrerUser, err := s.userRepo.GetByReferralCode(referrer)
	if err != nil || referrerUser == nil {
		return ""
	}
	if selfCode != "" && referrerUser.ReferralCode == selfCode {
		return "system"
	}
	return referrerUser.ReferralCode
}

// shareholderCodeForReferrer only follows an explicitly assigned shareholder.
// Users without one deliberately remain unassigned; there is no system
// shareholder fallback.
func (s *UserService) shareholderCodeForReferrer(referrerCode string) string {
	if referrerCode == "" || referrerCode == "system" {
		return ""
	}

	referrerUser, err := s.userRepo.GetByReferralCode(referrerCode)
	if err != nil || referrerUser == nil {
		return ""
	}

	if referrerUser.ShareholderCode != "" {
		return referrerUser.ShareholderCode
	}

	return ""
}

func (s *UserService) bindInviteAndProfile(user *model.User, ownerAddress string, telegramID *int64, referrer, name string) (*model.User, error) {
	changed := false

	if ownerAddress != "" && user.OwnerAddress == "" {
		user.OwnerAddress = ownerAddress
		changed = true
	}
	if telegramID != nil && *telegramID != 0 && (user.TelegramID == nil || *user.TelegramID == 0) {
		user.TelegramID = telegramID
		changed = true
	}
	if name != "" && (user.Name == "" || user.Name == "New User") {
		user.Name = name
		changed = true
	}

	if canBindReferrer(user) && referrer != "" {
		boundReferrer := s.resolveReferrer(referrer, user.ReferralCode)
		if boundReferrer == "" {
			return nil, errors.New("邀请码无效")
		}
		if boundReferrer != user.Referrer {
			user.Referrer = boundReferrer
			user.ShareholderCode = s.shareholderCodeForReferrer(boundReferrer)
			changed = true
		}
	}

	if user.Referrer == "" {
		user.Referrer = "system"
		changed = true
	}
	if changed {
		if err := s.userRepo.Update(user); err != nil {
			return nil, err
		}
	}

	return user, nil
}

func (s *UserService) findExisting(ownerAddress string, telegramID *int64) (*model.User, error) {
	if ownerAddress != "" {
		user, err := s.userRepo.GetByOwnerAddress(ownerAddress)
		if err != nil {
			return nil, err
		}
		if user != nil {
			return user, nil
		}
	}
	if telegramID != nil && *telegramID != 0 {
		user, err := s.userRepo.GetByTelegramID(*telegramID)
		if err != nil {
			return nil, err
		}
		if user != nil {
			return user, nil
		}
	}
	return nil, nil
}

func (s *UserService) CreateNewUser(ownerAddress string, telegramID *int64, referrer string) (*model.User, error) {
	return s.RegisterUser(ownerAddress, telegramID, referrer, "")
}

func (s *UserService) RegisterUser(ownerAddress string, telegramID *int64, referrer, name string) (*model.User, error) {
	ownerAddress = repository.NormalizeAddress(ownerAddress)
	if ownerAddress == "" && (telegramID == nil || *telegramID == 0) {
		return nil, errors.New("必须提供 OwnerAddress 或 TelegramID 其中之一")
	}

	existing, err := s.findExisting(ownerAddress, telegramID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return s.bindInviteAndProfile(existing, ownerAddress, telegramID, referrer, name)
	}

	referralCode, err := s.uniqueReferralCode()
	if err != nil {
		return nil, err
	}

	bound := s.resolveReferrer(referrer, referralCode)
	if bound == "" {
		return nil, errors.New("邀请码无效")
	}

	if name == "" {
		name = "New User"
	}

	user := &model.User{
		OwnerAddress:    ownerAddress,
		TelegramID:      telegramID,
		Name:            name,
		Referrer:        bound,
		ReferralCode:    referralCode,
		CommissionRate:  0,
		JoinTime:        time.Now(),
		IsShareholder:   false,
		ShareholderCode: s.shareholderCodeForReferrer(bound),
	}

	if err := s.userRepo.Create(user); err != nil {
		existed, findErr := s.findExisting(ownerAddress, telegramID)
		if findErr == nil && existed != nil {
			return s.bindInviteAndProfile(existed, ownerAddress, telegramID, referrer, name)
		}
		return nil, err
	}

	return user, nil
}

func (s *UserService) GetUserByOwnerAddress(ownerAddress string) (*model.User, error) {
	return s.userRepo.GetByOwnerAddress(ownerAddress)
}

func (s *UserService) GetUserByTelegramID(telegramID int64) (*model.User, error) {
	return s.userRepo.GetByTelegramID(telegramID)
}

func (s *UserService) GetUserByReferralCode(referralCode string) (*model.User, error) {
	return s.userRepo.GetByReferralCode(referralCode)
}

func (s *UserService) LoginWithWallet(walletAddr string, referrer string) (*model.User, error) {
	walletAddr = repository.NormalizeAddress(walletAddr)
	if walletAddr == "" {
		return nil, errors.New("钱包地址不能为空")
	}

	user, err := s.userRepo.GetByOwnerAddress(walletAddr)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return s.RegisterUser(walletAddr, nil, referrer, "")
	}
	if referrer != "" && canBindReferrer(user) {
		return s.bindInviteAndProfile(user, walletAddr, nil, referrer, "")
	}
	if user.ShareholderCode == "" {
		return s.bindInviteAndProfile(user, walletAddr, nil, "", "")
	}
	return user, nil
}

func (s *UserService) LoginWithTelegram(telegramID *int64, referrer string) (*model.User, error) {
	if telegramID == nil || *telegramID == 0 {
		return nil, errors.New("Telegram ID 不能为空")
	}
	user, err := s.userRepo.GetByTelegramID(*telegramID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return s.RegisterUser("", telegramID, referrer, "")
	}
	if referrer != "" && canBindReferrer(user) {
		return s.bindInviteAndProfile(user, "", telegramID, referrer, "")
	}
	if user.ShareholderCode == "" {
		return s.bindInviteAndProfile(user, "", telegramID, "", "")
	}
	return user, nil
}

func (s *UserService) GetAllUsers() ([]model.User, error) {
	return s.userRepo.GetAll()
}

func (s *UserService) GetUserByID(id int64) (*model.User, error) {
	return s.userRepo.GetByID(id)
}

func (s *UserService) UpdateUser(user *model.User) error {
	return s.userRepo.Update(user)
}

func (s *UserService) UpdateUserAdmin(userID int64, updates map[string]interface{}) (*model.User, error) {
	return s.userRepo.UpdateAdmin(userID, updates)
}

func (s *UserService) DeleteUserAdmin(userID int64) error {
	return s.userRepo.DeleteWithRelatedData(userID)
}

func (s *UserService) GetDirectReferrals(referralCode string) ([]model.User, error) {
	return s.userRepo.GetDirectReferrals(referralCode)
}

func FormatTelegramID(id int64) string {
	return strconv.FormatInt(id, 10)
}

func (s *UserService) GetUserShareholder(userID int64) (*model.Shareholder, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}
	if user == nil || user.ShareholderCode == "" {
		return nil, nil
	}
	return s.shareholderSvc.GetShareholderByCode(user.ShareholderCode)
}

func (s *UserService) GetUserShareholderWithChain(userID int64) (map[string]interface{}, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil || user == nil {
		return nil, errors.New("用户不存在")
	}

	shareholder, err := s.GetUserShareholder(userID)
	if err != nil {
		return nil, err
	}

	chain, err := s.GetReferralChain(userID)
	if err != nil {
		return nil, err
	}

	chainWithShareholder := make([]map[string]interface{}, 0)
	for _, code := range chain {
		u, err := s.userRepo.GetByReferralCode(code)
		if err != nil || u == nil {
			continue
		}
		chainWithShareholder = append(chainWithShareholder, map[string]interface{}{
			"referral_code":    code,
			"is_shareholder":   u.IsShareholder,
			"shareholder_code": u.ShareholderCode,
		})
	}

	return map[string]interface{}{
		"user_id":            userID,
		"user_referral_code": user.ReferralCode,
		"is_shareholder":     user.IsShareholder,
		"shareholder":        shareholder,
		"referral_chain":     chainWithShareholder,
	}, nil
}

func (s *UserService) GetReferralChain(userID int64) ([]string, error) {
	return s.userRepo.GetReferralChainByCTE(userID)
}

package service

import (
	"errors"
	"strings"

	"game-hx/internal/model"
	"game-hx/internal/repository"
	"github.com/shopspring/decimal"
)

type SettingService struct {
	settingRepo *repository.SettingRepository
}

func NewSettingService() *SettingService {
	return &SettingService{
		settingRepo: repository.NewSettingRepository(),
	}
}

type AppSettings struct {
	ShareholderMinBalance       decimal.Decimal `json:"shareholder_min_balance"`
	ShareholderPointsPerPercent decimal.Decimal `json:"shareholder_points_per_percent"`
	MinBetTRX                   decimal.Decimal `json:"min_bet_trx"`
	MinBetUSDT                  decimal.Decimal `json:"min_bet_usdt"`
	MinBetUSDTBsc               decimal.Decimal `json:"min_bet_usdt_bsc"`
	MaxBet                      decimal.Decimal `json:"max_bet"`
	BscConfirmations            uint64          `json:"bsc_confirmations"`
	ShareholderRechargeAddress  string          `json:"shareholder_recharge_address"`
	ShareholderRechargeMin      decimal.Decimal `json:"shareholder_recharge_min"`
	CustomerService             string          `json:"customer_service"`
	PayoutEnabled               decimal.Decimal `json:"payout_enabled"`
}

func (s *SettingService) GetAll() AppSettings {
	return AppSettings{
		ShareholderMinBalance:       s.settingRepo.GetShareholderMinBalance(),
		ShareholderPointsPerPercent: s.settingRepo.ShareholderPointsPerPercent(),
		MinBetTRX:                   s.settingRepo.MinBetTRX(),
		MinBetUSDT:                  s.settingRepo.MinBetUSDT(),
		MinBetUSDTBsc:               s.settingRepo.MinBetUSDTBsc(),
		MaxBet:                      s.settingRepo.MaxBet(),
		BscConfirmations:            s.settingRepo.BscConfirmations(),
		ShareholderRechargeAddress:  s.settingRepo.ShareholderRechargeAddress(),
		ShareholderRechargeMin:      s.settingRepo.ShareholderRechargeMin(),
		CustomerService:             s.settingRepo.CustomerService(),
		PayoutEnabled:               s.settingRepo.GetDecimal(model.SettingPayoutEnabled),
	}
}

type UpdateAppSettingsRequest struct {
	ShareholderMinBalance       *decimal.Decimal `json:"shareholder_min_balance"`
	ShareholderPointsPerPercent *decimal.Decimal `json:"shareholder_points_per_percent"`
	MinBetTRX                   *decimal.Decimal `json:"min_bet_trx"`
	MinBetUSDT                  *decimal.Decimal `json:"min_bet_usdt"`
	MinBetUSDTBsc               *decimal.Decimal `json:"min_bet_usdt_bsc"`
	MaxBet                      *decimal.Decimal `json:"max_bet"`
	BscConfirmations            *float64         `json:"bsc_confirmations"`
	ShareholderRechargeAddress  *string          `json:"shareholder_recharge_address"`
	ShareholderRechargeMin      *decimal.Decimal `json:"shareholder_recharge_min"`
	CustomerService             *string          `json:"customer_service"`
	PayoutEnabled               *decimal.Decimal `json:"payout_enabled"`
}

func (s *SettingService) Update(req UpdateAppSettingsRequest) (AppSettings, error) {
	type item struct {
		key string
		val *decimal.Decimal
	}
	updates := []item{
		{model.SettingShareholderMinBalance, req.ShareholderMinBalance},
		{model.SettingShareholderPointsPerPercent, req.ShareholderPointsPerPercent},
		{model.SettingMinBetTRX, req.MinBetTRX},
		{model.SettingMinBetUSDT, req.MinBetUSDT},
		{model.SettingMinBetUSDTBsc, req.MinBetUSDTBsc},
		{model.SettingMaxBet, req.MaxBet},
		{model.SettingShareholderRechargeMin, req.ShareholderRechargeMin},
		{model.SettingPayoutEnabled, req.PayoutEnabled},
	}
	hasUpdate := false
	if req.ShareholderRechargeAddress != nil {
		if strings.TrimSpace(*req.ShareholderRechargeAddress) == "" {
			return AppSettings{}, errors.New("充值地址不能为空")
		}
		if err := s.settingRepo.Upsert(model.SettingShareholderRechargeAddress, strings.TrimSpace(*req.ShareholderRechargeAddress), "股东积分充值地址"); err != nil {
			return AppSettings{}, err
		}
		hasUpdate = true
	}
	if req.CustomerService != nil {
		value := strings.TrimSpace(*req.CustomerService)
		value = strings.TrimPrefix(value, "@")
		if value == "" {
			return AppSettings{}, errors.New("客服账号不能为空")
		}
		if err := s.settingRepo.Upsert(model.SettingCustomerService, value, "客服 Telegram 账号"); err != nil {
			return AppSettings{}, err
		}
		hasUpdate = true
	}

	for _, u := range updates {
		if u.val == nil {
			continue
		}
		if req.BscConfirmations != nil {
			hasUpdate = true
			if err := s.settingRepo.SetFloat(model.SettingBscConfirmations, *req.BscConfirmations); err != nil {
				return AppSettings{}, err
			}
		}
		hasUpdate = true
		if err := s.settingRepo.SetDecimal(u.key, *u.val); err != nil {
			return AppSettings{}, err
		}
	}
	if !hasUpdate {
		return AppSettings{}, errors.New("没有要更新的配置")
	}
	return s.GetAll(), nil
}

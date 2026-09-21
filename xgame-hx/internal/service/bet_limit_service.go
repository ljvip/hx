package service

import (
	"strings"

	"game-hx/internal/model"
	"game-hx/internal/repository"
	"github.com/shopspring/decimal"
)

const (
	BetLimitSourceSystem      = "system"
	BetLimitSourceShareholder = "shareholder"
	BetNetworkTRON            = "tron"
	BetNetworkBSC             = "bsc"
)

type BetLimitSet struct {
	MinBetTRX     decimal.Decimal `json:"min_bet_trx"`
	MinBetUSDT    decimal.Decimal `json:"min_bet_usdt"`
	MinBetUSDTBsc decimal.Decimal `json:"min_bet_usdt_bsc"`
	MaxBet        decimal.Decimal `json:"max_bet"`
}

type BetLimitSources struct {
	MinBetTRX     string `json:"min_bet_trx"`
	MinBetUSDT    string `json:"min_bet_usdt"`
	MinBetUSDTBsc string `json:"min_bet_usdt_bsc"`
	MaxBet        string `json:"max_bet"`
}

type ShareholderBetLimitConfig struct {
	MinBetTRX     *decimal.Decimal `json:"min_bet_trx"`
	MinBetUSDT    *decimal.Decimal `json:"min_bet_usdt"`
	MinBetUSDTBsc *decimal.Decimal `json:"min_bet_usdt_bsc"`
	MaxBet        *decimal.Decimal `json:"max_bet"`
}

type ResolvedBetLimits struct {
	OwnerAddress    string                    `json:"owner_address"`
	ShareholderCode string                    `json:"shareholder_code"`
	Limits          BetLimitSet               `json:"limits"`
	Sources         BetLimitSources           `json:"sources"`
	System          BetLimitSet               `json:"system"`
	Shareholder     *ShareholderBetLimitConfig `json:"shareholder"`
}

type BetLimitService struct {
	settingRepo     *repository.SettingRepository
	userRepo        *repository.UserRepository
	shareholderRepo *repository.ShareholderRepository
}

func NewBetLimitService() *BetLimitService {
	return &BetLimitService{
		settingRepo:     repository.NewSettingRepository(),
		userRepo:        repository.NewUserRepository(),
		shareholderRepo: repository.NewShareholderRepository(),
	}
}

func (s *BetLimitService) SystemLimits() BetLimitSet {
	return BetLimitSet{
		MinBetTRX:     s.settingRepo.MinBetTRX(),
		MinBetUSDT:    s.settingRepo.MinBetUSDT(),
		MinBetUSDTBsc: s.settingRepo.MinBetUSDTBsc(),
		MaxBet:        s.settingRepo.MaxBet(),
	}
}

func (s *BetLimitService) ResolveForAddress(ownerAddress string) ResolvedBetLimits {
	system := s.SystemLimits()
	resolved := ResolvedBetLimits{
		OwnerAddress: repository.NormalizeAddress(ownerAddress),
		Limits:       system,
		Sources: BetLimitSources{
			MinBetTRX:     BetLimitSourceSystem,
			MinBetUSDT:    BetLimitSourceSystem,
			MinBetUSDTBsc: BetLimitSourceSystem,
			MaxBet:        BetLimitSourceSystem,
		},
		System: system,
	}
	if resolved.OwnerAddress == "" {
		return resolved
	}

	user, err := s.userRepo.GetByOwnerAddress(resolved.OwnerAddress)
	if err != nil || user == nil || strings.TrimSpace(user.ShareholderCode) == "" {
		return resolved
	}

	shareholder, err := s.shareholderRepo.GetByCode(user.ShareholderCode)
	if err != nil || shareholder == nil || shareholder.Status != 1 {
		return resolved
	}

	resolved.ShareholderCode = shareholder.Code
	resolved.Shareholder = configFromShareholder(shareholder)
	resolved.Limits.MinBetTRX, resolved.Sources.MinBetTRX = pickLimit(shareholder.MinBetTRX, system.MinBetTRX)
	resolved.Limits.MinBetUSDT, resolved.Sources.MinBetUSDT = pickLimit(shareholder.MinBetUSDT, system.MinBetUSDT)
	resolved.Limits.MinBetUSDTBsc, resolved.Sources.MinBetUSDTBsc = pickLimit(shareholder.MinBetUSDTBsc, system.MinBetUSDTBsc)
	resolved.Limits.MaxBet, resolved.Sources.MaxBet = pickLimit(shareholder.MaxBet, system.MaxBet)
	return resolved
}

func (s *BetLimitService) MinMax(ownerAddress, tokenSymbol, network string) (decimal.Decimal, decimal.Decimal) {
	limits := s.ResolveForAddress(ownerAddress).Limits
	return minForToken(limits, tokenSymbol, network), limits.MaxBet
}

func (s *BetLimitService) AmountAllowed(ownerAddress, tokenSymbol, network string, amount decimal.Decimal) bool {
	min, max := s.MinMax(ownerAddress, tokenSymbol, network)
	return amount.GreaterThanOrEqual(min) && amount.LessThanOrEqual(max)
}

func configFromShareholder(sh *model.Shareholder) *ShareholderBetLimitConfig {
	if sh == nil {
		return nil
	}
	return &ShareholderBetLimitConfig{
		MinBetTRX:     sh.MinBetTRX,
		MinBetUSDT:    sh.MinBetUSDT,
		MinBetUSDTBsc: sh.MinBetUSDTBsc,
		MaxBet:        sh.MaxBet,
	}
}

func pickLimit(override *decimal.Decimal, fallback decimal.Decimal) (decimal.Decimal, string) {
	if override != nil {
		return *override, BetLimitSourceShareholder
	}
	return fallback, BetLimitSourceSystem
}

func minForToken(limits BetLimitSet, tokenSymbol, network string) decimal.Decimal {
	symbol := strings.ToUpper(strings.TrimSpace(tokenSymbol))
	net := strings.ToLower(strings.TrimSpace(network))
	if symbol == "TRX" {
		return limits.MinBetTRX
	}
	if net == BetNetworkBSC {
		return limits.MinBetUSDTBsc
	}
	return limits.MinBetUSDT
}

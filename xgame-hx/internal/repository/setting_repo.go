package repository

import (
	"errors"
	"strconv"
	"strings"
	"sync"
	"time"

	"game-hx/internal/model"
	"game-hx/pkg/database"
	"github.com/shopspring/decimal"

	"gorm.io/gorm"
)

type settingDef struct {
	Default decimal.Decimal
	Remark  string
}

var settingDefs = map[string]settingDef{
	model.SettingShareholderMinBalance:       {decimal.NewFromInt(1), "股东积分判断值：余额小于该值时占成为 0"},
	model.SettingShareholderPointsPerPercent: {decimal.NewFromInt(10), "股东每 1% 占成所需的最小积分"},
	model.SettingMinBetTRX:                   {decimal.NewFromInt(1), "TRX 最小投注金额"},
	model.SettingMinBetUSDT:                  {decimal.NewFromInt(9), "TRON USDT 最小投注金额"},
	model.SettingMinBetUSDTBsc:               {decimal.NewFromInt(1), "BSC USDT 最小投注金额"},
	model.SettingMaxBet:                      {decimal.NewFromInt(1000), "单笔投注金额上限"},
	model.SettingShareholderRechargeMin:      {decimal.NewFromInt(10000), "股东积分充值最低金额"},
	model.SettingBscConfirmations:            {decimal.NewFromInt(5), "BSC 区块确认数"},
	model.SettingPayoutEnabled:               {decimal.NewFromInt(1), "是否开启返奖：1 开启，0 关闭"},
}

type SettingRepository struct{}

func NewSettingRepository() *SettingRepository {
	return &SettingRepository{}
}

var (
	cacheMu      sync.RWMutex
	floatCache   = map[string]float64{}
	decimalCache = map[string]decimal.Decimal{}
)

func (r *SettingRepository) GetDB() *gorm.DB {
	return database.GetDB()
}

func (r *SettingRepository) Get(key string) (*model.SystemSetting, error) {
	var setting model.SystemSetting
	err := r.GetDB().Where("key = ?", key).First(&setting).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &setting, err
}

func (r *SettingRepository) List() ([]model.SystemSetting, error) {
	var list []model.SystemSetting
	err := r.GetDB().Order("key ASC").Find(&list).Error
	return list, err
}

func (r *SettingRepository) Upsert(key, value, remark string) error {
	now := time.Now()
	if remark == "" {
		if def, ok := settingDefs[key]; ok {
			remark = def.Remark
		}
	}
	setting := model.SystemSetting{
		Key:       key,
		Value:     value,
		Remark:    remark,
		UpdatedAt: now,
	}
	err := r.GetDB().Save(&setting).Error
	if err == nil {
		if v, parseErr := strconv.ParseFloat(value, 64); parseErr == nil {
			cacheMu.Lock()
			floatCache[key] = v
			cacheMu.Unlock()
		}
		if v, parseErr := decimal.NewFromString(value); parseErr == nil {
			cacheMu.Lock()
			decimalCache[key] = v
			cacheMu.Unlock()
		}
	}
	return err
}

func (r *SettingRepository) GetFloat(key string) float64 {
	cacheMu.RLock()
	if v, ok := floatCache[key]; ok {
		cacheMu.RUnlock()
		return v
	}

	cacheMu.RUnlock()

	def := 0.0
	if meta, ok := settingDefs[key]; ok {
		def = meta.Default.InexactFloat64()
	}

	setting, err := r.Get(key)
	if err != nil || setting == nil {
		return def
	}
	v, err := strconv.ParseFloat(setting.Value, 64)
	if err != nil {
		return def
	}

	cacheMu.Lock()
	floatCache[key] = v
	cacheMu.Unlock()
	return v
}

func (r *SettingRepository) SetFloat(key string, value float64) error {
	if value < 0 {
		return errors.New("配置值不能小于 0")
	}

	if key == model.SettingBscConfirmations && value < 1 {
		return errors.New("BSC 确认数不能小于 1")
	}

	return r.Upsert(key, strconv.FormatFloat(value, 'f', -1, 64), "")
}

func (r *SettingRepository) GetDecimal(key string) decimal.Decimal {
	cacheMu.RLock()
	if v, ok := decimalCache[key]; ok {
		cacheMu.RUnlock()
		return v
	}
	cacheMu.RUnlock()
	def := decimal.Zero
	if meta, ok := settingDefs[key]; ok {
		def = meta.Default
	}
	setting, err := r.Get(key)
	if err != nil || setting == nil {
		return def
	}
	v, err := decimal.NewFromString(setting.Value)
	if err != nil {
		return def
	}
	cacheMu.Lock()
	decimalCache[key] = v
	cacheMu.Unlock()
	return v
}

func (r *SettingRepository) SetDecimal(key string, value decimal.Decimal) error {
	if value.IsNegative() {
		return errors.New("配置值不能小于 0")
	}
	if key == model.SettingShareholderPointsPerPercent && !value.GreaterThan(decimal.Zero) {
		return errors.New("每 1% 占成所需积分必须大于 0")
	}
	return r.Upsert(key, value.String(), "")
}

func (r *SettingRepository) GetShareholderMinBalance() decimal.Decimal {
	return r.GetDecimal(model.SettingShareholderMinBalance)
}

func (r *SettingRepository) ShareholderPointsPerPercent() decimal.Decimal {
	return r.GetDecimal(model.SettingShareholderPointsPerPercent)
}

func (r *SettingRepository) SetShareholderMinBalance(value decimal.Decimal) error {
	return r.SetDecimal(model.SettingShareholderMinBalance, value)
}

func (r *SettingRepository) MinBetTRX() decimal.Decimal {
	return r.GetDecimal(model.SettingMinBetTRX)
}

func (r *SettingRepository) MinBetUSDT() decimal.Decimal {
	return r.GetDecimal(model.SettingMinBetUSDT)
}

func (r *SettingRepository) MinBetUSDTBsc() decimal.Decimal {
	return r.GetDecimal(model.SettingMinBetUSDTBsc)
}

func (r *SettingRepository) MaxBet() decimal.Decimal {
	return r.GetDecimal(model.SettingMaxBet)
}

func (r *SettingRepository) ShareholderRechargeMin() decimal.Decimal {
	return r.GetDecimal(model.SettingShareholderRechargeMin)
}

func (r *SettingRepository) ShareholderRechargeAddress() string {
	setting, err := r.Get(model.SettingShareholderRechargeAddress)
	if err != nil || setting == nil {
		return "xxxxx"
	}
	return strings.TrimSpace(setting.Value)
}

func (r *SettingRepository) CustomerService() string {
	setting, err := r.Get(model.SettingCustomerService)
	if err != nil || setting == nil {
		return "tikgommm"
	}
	value := strings.TrimSpace(setting.Value)
	if value == "" {
		return "tikgommm"
	}
	return value
}

// IsShareholderRechargeAddress accepts comma, semicolon, or newline-separated
// addresses so deployments can use more than one recharge wallet.
func (r *SettingRepository) IsShareholderRechargeAddress(address string) bool {
	address = strings.TrimSpace(address)
	if address == "" {
		return false
	}
	for _, configured := range strings.FieldsFunc(r.ShareholderRechargeAddress(), func(r rune) bool {
		return r == ',' || r == ';' || r == '\n' || r == '\r'
	}) {
		if strings.EqualFold(strings.TrimSpace(configured), address) {
			return true
		}
	}
	return false
}

func (r *SettingRepository) BscConfirmations() uint64 {
	n := r.GetFloat(model.SettingBscConfirmations)
	if n < 1 {
		return 5
	}
	return uint64(n)
}

func (r *SettingRepository) PayoutEnabled() bool {
	setting, err := r.Get(model.SettingPayoutEnabled)
	if err != nil || setting == nil {
		return true
	}
	value := strings.ToLower(strings.TrimSpace(setting.Value))
	return value != "0" && value != "false" && value != "off" && value != "no"
}

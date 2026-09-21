package model

import "time"

const (
	SettingShareholderMinBalance       = "shareholder_min_balance"
	SettingShareholderPointsPerPercent = "shareholder_points_per_percent"
	SettingMinBetTRX                   = "min_bet_trx"
	SettingMinBetUSDT                  = "min_bet_usdt"
	SettingMinBetUSDTBsc               = "min_bet_usdt_bsc"
	SettingMaxBet                      = "max_bet"
	SettingBscConfirmations            = "bsc_confirmations"
	SettingShareholderRechargeAddress  = "shareholder_recharge_address"
	SettingShareholderRechargeMin      = "shareholder_recharge_min"
	SettingCustomerService             = "customer_service"
	SettingPayoutEnabled               = "payout_enabled"
)

type SettingDef struct {
	Key     string
	Default string
	Remark  string
}

func DefaultSystemSettings() []SettingDef {
	return []SettingDef{
		{SettingShareholderMinBalance, "1", "股东积分判断值：余额小于该值时占成为 0"},
		{SettingShareholderPointsPerPercent, "10", "股东每 1% 占成所需的最小积分"},
		{SettingMinBetTRX, "1", "TRX 最小投注金额"},
		{SettingMinBetUSDT, "10", "TRON USDT 最小投注金额"},
		{SettingMinBetUSDTBsc, "1", "BSC USDT 最小投注金额"},
		{SettingMaxBet, "1000", "单笔投注金额上限"},
		{SettingBscConfirmations, "5", "BSC 区块确认数"},
		{SettingShareholderRechargeAddress, "xxxxx", "股东积分充值地址"},
		{SettingShareholderRechargeMin, "10000", "股东积分充值最低金额"},
		{SettingCustomerService, "tikgommm", "客服 Telegram 账号"},
		{SettingPayoutEnabled, "1", "是否开启返奖：1 开启，0 关闭"},
	}
}

// SystemSetting 系统配置键值
type SystemSetting struct {
	Key       string    `gorm:"primaryKey;size:64" json:"key"`
	Value     string    `gorm:"not null" json:"value"`
	Remark    string    `gorm:"size:255" json:"remark"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (SystemSetting) TableName() string {
	return "system_settings"
}

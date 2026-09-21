package settings

import (
	"net/http"

	"game-hx/internal/service"

	"github.com/gin-gonic/gin"
)

var settingSvc = service.NewSettingService()
var betLimitSvc = service.NewBetLimitService()

func GetSettings(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"settings": settingSvc.GetAll(),
		"remarks": map[string]string{
			"shareholder_min_balance":        "股东积分小于该值时占成为 0",
			"shareholder_points_per_percent": "股东每 1% 占成所需的最小积分",
			"min_bet_trx":                    "TRX 最小投注金额（含）",
			"min_bet_usdt":                   "TRON USDT 最小投注金额（含）",
			"min_bet_usdt_bsc":               "BSC USDT 最小投注金额（含）",
			"max_bet":                        "单笔投注金额上限",
			"bsc_confirmations":              "BSC 区块确认数",
			"shareholder_recharge_address":   "股东积分充值地址",
			"shareholder_recharge_min":       "股东积分充值最低金额",
			"customer_service":               "客服 Telegram 账号",
			"payout_enabled":                 "是否开启返奖：1 开启，0 关闭",
		},
	})
}

func GetBetLimits(c *gin.Context) {
	ownerAddress := c.Query("owner_address")
	c.JSON(http.StatusOK, betLimitSvc.ResolveForAddress(ownerAddress))
}

func UpdateSettings(c *gin.Context) {
	var req service.UpdateAppSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data", "details": err.Error()})
		return
	}

	settings, err := settingSvc.Update(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "配置已更新",
		"settings": settings,
	})
}

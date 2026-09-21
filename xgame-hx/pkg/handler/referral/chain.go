package referral

import (
	"encoding/json"
	"net/http"

	"game-hx/internal/repository"

	"github.com/gin-gonic/gin"
)

var userRepo = repository.NewUserRepository()

func GetReferralChain(c *gin.Context) {
	ownerAddress := c.Query("owner_address")
	telegramID := c.Query("telegram_id")

	if ownerAddress == "" && telegramID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "owner_address or telegram_id is required"})
		return
	}

	user, err := userRepo.GetByOwnerAddressOrTelegram(ownerAddress, telegramID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// 获取所有下级
	referrals, err := userRepo.GetDirectReferrals(user.ReferralCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var addresses []string
	var referralCodes []string
	for _, ref := range referrals {
		addresses = append(addresses, ref.OwnerAddress)
		referralCodes = append(referralCodes, ref.ReferralCode)
	}

	// 构建推荐映射
	referralMap := make(map[string]string)
	for _, ref := range referrals {
		referralMap[ref.OwnerAddress] = user.ReferralCode
	}

	result := map[string]interface{}{
		"umbrella_addresses": addresses,
		"direct_referrals":   addresses,
		"referral_codes":     referralCodes,
		"referral_map":       referralMap,
	}
	resultJSON, _ := json.Marshal(result)

	c.JSON(http.StatusOK, gin.H{"addresses": string(resultJSON)})
}

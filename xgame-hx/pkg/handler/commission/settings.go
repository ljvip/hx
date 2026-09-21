package commission

import (
	"net/http"

	"game-hx/pkg/database"

	"github.com/gin-gonic/gin"
)

type SetCommissionRateRequest struct {
	ReferralCode  string  `json:"referral_code" binding:"required"`
	NewCommission float64 `json:"new_commission" binding:"required"`
}

func SetUserCommissionRate(c *gin.Context) {
	var req SetCommissionRateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request", "error": err.Error()})
		return
	}

	user, err := userRepo.GetByReferralCode(req.ReferralCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Database error", "error": err.Error()})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "User not found"})
		return
	}
	if req.NewCommission < 0 || req.NewCommission > 1 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Commission rate must be between 0 and 1"})
		return
	}
	if user.ReferralCode == "system" && req.NewCommission != 1 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "System commission rate must remain 100%"})
		return
	}

	_, maxCommission, err := userRepo.GetCommissionBounds(user)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	if req.NewCommission > maxCommission {
		c.JSON(http.StatusBadRequest, gin.H{"message": "New commission rate cannot exceed referrer's commission rate"})
		return
	}

	user.CommissionRate = req.NewCommission
	db := database.GetDB()
	if err := db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update commission rate", "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Commission rate updated successfully",
		"new_commission": req.NewCommission,
		"user":           user,
	})
}

func GetDirectReferrals(c *gin.Context) {
	ownerAddress := c.Param("owner_address")

	user, err := userRepo.GetByOwnerAddress(ownerAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Database error", "error": err.Error()})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "User not found"})
		return
	}

	referrals, err := userRepo.GetDirectReferrals(user.ReferralCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch referrals", "error": err.Error()})
		return
	}

	referralDetails := []gin.H{}
	for _, ref := range referrals {
		referralDetails = append(referralDetails, gin.H{
			"referral_code":   ref.ReferralCode,
			"owner_address":   ref.OwnerAddress,
			"commission_rate": ref.CommissionRate,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Direct referrals retrieved successfully",
		"referrer_code": user.ReferralCode,
		"referrals":     referralDetails,
	})
}

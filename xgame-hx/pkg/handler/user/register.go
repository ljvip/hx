package user

import (
	"net/http"

	"game-hx/pkg/middleware"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

type RegisterRequest struct {
	Name         string `json:"name"`
	OwnerAddress string `json:"owner_address"`
	TelegramID   *int64 `json:"telegram_id"`
	Referrer     string `json:"referrer"`
	ReferralCode string `json:"referral_code"`
}

func inviteCodeFromRequest(req RegisterRequest) string {
	if req.Referrer != "" {
		return req.Referrer
	}
	return req.ReferralCode
}

func Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logrus.Errorf("Invalid request data: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data", "details": err.Error()})
		return
	}

	if req.OwnerAddress == "" && req.TelegramID == nil {
		logrus.Warn("Either owner_address or telegram_id must be provided")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Either owner_address or telegram_id must be provided"})
		return
	}

	inviteCode := inviteCodeFromRequest(req)
	if inviteCode != "" {
		referrerUser, err := userService.GetUserByReferralCode(inviteCode)
		if err != nil || referrerUser == nil {
			logrus.Warnf("Invalid referral code: %s", inviteCode)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid referral code"})
			return
		}
		inviteCode = referrerUser.ReferralCode
	}

	user, err := userService.RegisterUser(req.OwnerAddress, req.TelegramID, inviteCode, req.Name)
	if err != nil {
		logrus.Errorf("Failed to create user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration failed", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Registration successful",
		"user":         user,
		"token":        tokenFromUser(user.ReferralCode, user.OwnerAddress),
		"referralCode": user.ReferralCode,
		"referrer":     user.Referrer,
	})
}

func tokenFromUser(referralCode, ownerAddress string) string {
	token, err := middleware.GenerateUserToken(referralCode, ownerAddress)
	if err != nil {
		return ""
	}
	return token
}

package user

import (
	"net/http"
	"strconv"

	"game-hx/internal/service"
	"game-hx/pkg/middleware"

	"github.com/gin-gonic/gin"
)

var userService = service.NewUserService()

type LoginRequest struct {
	WalletAddress string `json:"wallet_address"`
	TelegramID    *int64 `json:"telegram_id"`
}

func inviteCodeFromQuery(c *gin.Context) string {
	if v := c.Query("referrer"); v != "" {
		return v
	}
	return c.Query("referral_code")
}

func LoginWithWallet(c *gin.Context) {
	walletAddr := c.DefaultQuery("wallet_address", "")
	if walletAddr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Wallet address is required"})
		return
	}

	user, err := userService.LoginWithWallet(walletAddr, inviteCodeFromQuery(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	token, tokenErr := middleware.GenerateUserToken(user.ReferralCode, user.OwnerAddress)
	if tokenErr != nil {
		c.JSON(http.StatusOK, gin.H{"user": user})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user, "token": token})
}

func LoginWithTelegram(c *gin.Context) {
	telegramIDStr := c.DefaultQuery("telegram_id", "")
	if telegramIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Telegram ID is required"})
		return
	}

	telegramID, err := strconv.ParseInt(telegramIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Telegram ID format"})
		return
	}

	user, err := userService.LoginWithTelegram(&telegramID, inviteCodeFromQuery(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	token, tokenErr := middleware.GenerateUserToken(user.ReferralCode, user.OwnerAddress)
	if tokenErr != nil {
		c.JSON(http.StatusOK, gin.H{"user": user})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user, "token": token})
}

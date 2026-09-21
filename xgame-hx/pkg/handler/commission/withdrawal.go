package commission

import (
	"errors"
	"net/http"

	"game-hx/internal/repository"
	"game-hx/internal/service"
	"game-hx/pkg/middleware"
	"github.com/shopspring/decimal"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type WithdrawRequest struct {
	ReceiverCode string          `json:"receiver_code" binding:"required"`
	Commission   decimal.Decimal `json:"commission" binding:"required"`
	TokenSymbol  string          `json:"token_symbol" binding:"required"`
}

var commissionSvc = service.NewCommissionService()

func WithdrawCommission(c *gin.Context) {
	var req WithdrawRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	if !req.Commission.GreaterThan(decimal.Zero) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Commission must be greater than 0"})
		return
	}

	if !middleware.IsAdminRole(middleware.Role(c)) && middleware.ReferralCode(c) != req.ReceiverCode {
		c.JSON(http.StatusForbidden, gin.H{"error": "只能提取自己的佣金"})
		return
	}

	user, payoutTx, err := commissionSvc.Withdraw(req.ReceiverCode, req.TokenSymbol, req.Commission)
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		case errors.Is(err, repository.ErrInvalidAmount):
			c.JSON(http.StatusBadRequest, gin.H{"error": "Commission must be greater than 0"})
		case errors.Is(err, repository.ErrInvalidToken):
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid token symbol"})
		case errors.Is(err, repository.ErrInsufficientCommission):
			c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient commission"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":               "Commission withdrawn successfully",
		"payout_tx_id":          payoutTx,
		"total_commission_trx":  user.TotalCommissionTRX,
		"total_commission_usdt": user.TotalCommissionUSDT,
	})
}

package betting

import (
	"errors"
	"net/http"
	"strconv"

	"game-hx/internal/repository"
	"game-hx/internal/service"

	"github.com/gin-gonic/gin"
)

var payoutBetSvc = service.NewBetService()

func ListPayouts(c *gin.Context) {
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	list, err := payoutBetSvc.ListPayouts(status, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"results": list, "total": len(list)})
}

func RetryPayout(c *gin.Context) {
	var req struct {
		TxID  string `json:"tx_id"`
		Force bool   `json:"force"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.TxID == "" {
		req.TxID = c.Query("tx_id")
		if !req.Force {
			req.Force = c.Query("force") == "true" || c.Query("force") == "1"
		}
	}
	if req.TxID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tx_id 必填"})
		return
	}

	payoutTx, err := payoutBetSvc.RetryPayout(req.TxID, req.Force)
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrBetNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "注单不存在"})
		case errors.Is(err, repository.ErrAlreadyPaid):
			c.JSON(http.StatusConflict, gin.H{"error": "该注单已返奖成功"})
		case errors.Is(err, repository.ErrPayoutInProgress):
			c.JSON(http.StatusConflict, gin.H{"error": "正在打款中，请稍后再试；若进程已挂可用 force=true 强制重试"})
		case errors.Is(err, repository.ErrCannotRetry):
			c.JSON(http.StatusBadRequest, gin.H{"error": "该注单无需返奖"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message":      "返奖重试成功",
		"tx_id":        req.TxID,
		"payout_tx_id": payoutTx,
	})
}

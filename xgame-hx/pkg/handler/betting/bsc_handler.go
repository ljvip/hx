package betting

import (
	"net/http"
	"time"

	"game-hx/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

var webhookBetLimitSvc = service.NewBetLimitService()

type BSCWebhookRequest struct {
	TxHash      string          `json:"tx_hash"`
	BlockNumber uint64          `json:"block_number"`
	BlockHash   string          `json:"block_hash"`
	FromAddr    string          `json:"from_addr"`
	ToAddr      string          `json:"to_addr"`
	GameName    string          `json:"game_name"`
	Amount      decimal.Decimal `json:"amount"`
	TokenSymbol string          `json:"token_symbol"`
	Timestamp   int64           `json:"timestamp"`
}

// HandleBSCTransferWebhook 处理BSC链USDT转账投注Webhook
func HandleBSCTransferWebhook(c *gin.Context) {
	var req BSCWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}

	if !webhookBetLimitSvc.AmountAllowed(req.FromAddr, req.TokenSymbol, service.BetNetworkBSC, req.Amount) {
		min, max := webhookBetLimitSvc.MinMax(req.FromAddr, req.TokenSymbol, service.BetNetworkBSC)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Amount is outside allowed bet limits",
			"min_bet": min,
			"max_bet": max,
		})
		return
	}

	// 转换时间戳
	timestamp := time.Unix(req.Timestamp, 0).Format("2006-01-02 15:04:05")

	// 处理投注
	betService := service.NewBetService()
	gameResult, userResult, finalAmount := betService.ProcessBet(
		timestamp,
		int64(req.BlockNumber),
		req.BlockHash,
		req.FromAddr,
		req.ToAddr,
		req.GameName,
		req.Amount,
		req.TokenSymbol,
		req.TxHash,
	)

	c.JSON(http.StatusOK, gin.H{
		"message":      "Bet processed successfully",
		"game_result":  gameResult,
		"user_result":  userResult,
		"final_amount": finalAmount,
	})
}

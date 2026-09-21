package commission

import (
	"net/http"
	"strconv"

	"game-hx/internal/repository"

	"github.com/gin-gonic/gin"
)

var (
	commissionRepo = repository.NewCommissionRepository()
	userRepo       = repository.NewUserRepository()
	gameRepo       = repository.NewGameRepository()
)

func GetUserCommissionRecords(c *gin.Context) {
	receiverCode := c.Param("receiver_code")
	tokenSymbol := c.DefaultQuery("token_symbol", "TRX")
	limit, err := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if err != nil || limit <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的条数参数"})
		return
	}

	records, totalCount, err := commissionRepo.GetByUser(receiverCode, tokenSymbol, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取佣金记录"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"records":     records,
		"total_count": totalCount,
	})
}

func GetUserTotalCommission(c *gin.Context) {
	receiverCode := c.Param("receiver_code")
	tokenSymbol := c.DefaultQuery("token_symbol", "TRX")

	total, err := commissionRepo.GetTotalByUser(receiverCode, tokenSymbol)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取总佣金"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"total_commission": total})
}

func GetUserCommissionByGame(c *gin.Context) {
	receiverCode := c.Param("receiver_code")
	gameType := c.Query("game_type")
	limit := c.DefaultQuery("limit", "1000")

	limitInt, err := strconv.Atoi(limit)
	if err != nil || limitInt < 0 || limitInt > 1000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 limit 参数"})
		return
	}

	if limitInt == 0 {
		limitInt = 1000
	}

	records, _, err := commissionRepo.GetByUser(receiverCode, "", limitInt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取佣金记录"})
		return
	}

	// 按游戏类型过滤
	var filtered []interface{}
	for _, r := range records {
		if gameType == "" || r.GameType == gameType {
			filtered = append(filtered, r)
		}
	}

	c.JSON(http.StatusOK, gin.H{"records": filtered})
}

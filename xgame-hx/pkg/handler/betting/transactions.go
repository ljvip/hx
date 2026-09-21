package betting

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"strconv"
)

func GetLatestTransactions(c *gin.Context) {
	ownerAddress := c.Param("owner_address")
	limitStr := c.Param("limit")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit value"})
		return
	}

	results, err := betRepo.GetRecentByOwner(ownerAddress, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

func GetAllTransactions(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "100")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit value"})
		return
	}

	results, err := betRepo.GetRecent(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(results) > limit {
		results = results[:limit]
	}

	c.JSON(http.StatusOK, results)
}

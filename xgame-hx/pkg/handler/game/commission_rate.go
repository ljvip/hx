package game

import (
	"net/http"

	"game-hx/internal/model"
	"game-hx/internal/repository"

	"github.com/gin-gonic/gin"
)

var gameRepo = repository.NewGameRepository()

func GetAllGameRate(c *gin.Context) {
	rates, err := gameRepo.GetAllGameRates()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to retrieve game commission rates"})
		return
	}
	c.JSON(http.StatusOK, rates)
}

type UpsertGameRateRequest struct {
	GameType       string   `json:"game_type" binding:"required"`
	CommissionRate *float64 `json:"commission_rate" binding:"required"`
}

func UpsertGameCommissionRate(c *gin.Context) {
	var input UpsertGameRateRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid input"})
		return
	}

	rate := model.GameCommissionRate{
		GameType:       input.GameType,
		CommissionRate: *input.CommissionRate,
	}

	if err := gameRepo.UpsertGameRate(rate); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to upsert record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Upsert successful", "data": input})
}

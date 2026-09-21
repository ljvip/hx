package address

import (
	"net/http"
	"strconv"
	"time"

	"game-hx/internal/model"
	"game-hx/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var gameRepo = repository.NewGameRepository()

type UpdateAddressRequest struct {
	ID      int     `json:"id"`
	Address string  `json:"address"`
	Name    string  `json:"name"`
	Odds    float64 `json:"odds"`
	Remark  string  `json:"remark"`
}

func GetDlAddresses(c *gin.Context) {
	addresses, err := gameRepo.GetAllAddresses()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, addresses)
}

func UpdateAddress(c *gin.Context) {
	var req UpdateAddressRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if req.ID == 0 {
		// 创建新地址
		address := model.AddressConfig{
			Address:   req.Address,
			Name:      req.Name,
			Odds:      req.Odds,
			Remark:    req.Remark,
			CreatedAt: time.Now(),
		}
		if err := gameRepo.CreateAddress(&address); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create address"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Address created successfully", "address": address})
	} else {
		// 更新地址
		if err := gameRepo.UpdateAddress(req.ID, req.Address, req.Name, req.Odds, req.Remark); err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "Address not found"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Address updated successfully"})
	}
}

func DeleteAddress(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的地址 ID"})
		return
	}
	if err := gameRepo.DeleteAddress(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Address deleted successfully"})
}

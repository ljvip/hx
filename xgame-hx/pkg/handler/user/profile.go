package user

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"game-hx/internal/repository"
	"game-hx/pkg/middleware"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

var userRepo = repository.NewUserRepository()

type AdminUpdateUserRequest struct {
	TelegramID          *int64           `json:"telegram_id"`
	Name                *string          `json:"name"`
	OwnerAddress        *string          `json:"owner_address"`
	Referrer            *string          `json:"referrer"`
	ReferralCode        *string          `json:"referral_code"`
	IsShareholder       *bool            `json:"is_shareholder"`
	ShareholderCode     *string          `json:"shareholder_code"`
	TotalBetTRX         *decimal.Decimal `json:"total_bet_trx"`
	TotalBetUSDT        *decimal.Decimal `json:"total_bet_usdt"`
	TotalWinTRX         *decimal.Decimal `json:"total_win_trx"`
	TotalWinUSDT        *decimal.Decimal `json:"total_win_usdt"`
	UseTRX              *decimal.Decimal `json:"use_trx"`
	UseUSDT             *decimal.Decimal `json:"use_usdt"`
	CommissionRate      *float64         `json:"commission_rate"`
	TotalCommissionTRX  *decimal.Decimal `json:"total_commission_trx"`
	TotalCommissionUSDT *decimal.Decimal `json:"total_commission_usdt"`
	JoinTime            *time.Time       `json:"join_time"`
}

func UpdateUserAdmin(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}
	var req AdminUpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request data", "details": err.Error()})
		return
	}
	updates := map[string]interface{}{}
	if req.TelegramID != nil {
		updates["telegram_id"] = *req.TelegramID
	}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.OwnerAddress != nil {
		updates["owner_address"] = repository.NormalizeAddress(*req.OwnerAddress)
	}
	if req.Referrer != nil {
		updates["referrer"] = *req.Referrer
	}
	if req.ReferralCode != nil {
		updates["referral_code"] = *req.ReferralCode
	}
	if req.IsShareholder != nil {
		updates["is_shareholder"] = *req.IsShareholder
	}
	if req.ShareholderCode != nil {
		updates["shareholder_code"] = *req.ShareholderCode
	}
	if req.TotalBetTRX != nil {
		updates["total_bet_trx"] = *req.TotalBetTRX
	}
	if req.TotalBetUSDT != nil {
		updates["total_bet_usdt"] = *req.TotalBetUSDT
	}
	if req.TotalWinTRX != nil {
		updates["total_win_trx"] = *req.TotalWinTRX
	}
	if req.TotalWinUSDT != nil {
		updates["total_win_usdt"] = *req.TotalWinUSDT
	}
	if req.UseTRX != nil {
		updates["use_trx"] = *req.UseTRX
	}
	if req.UseUSDT != nil {
		updates["use_usdt"] = *req.UseUSDT
	}
	if req.CommissionRate != nil {
		user, err := userService.GetUserByID(id)
		if err != nil || user == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		_, maxRate, err := userRepo.GetCommissionBounds(user)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if *req.CommissionRate < 0 || *req.CommissionRate > 1 || *req.CommissionRate > maxRate {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":              "commission rate must be between 0 and referrer rate",
				"maximum_commission": maxRate,
			})
			return
		}
		updates["commission_rate"] = *req.CommissionRate
	}
	if req.TotalCommissionTRX != nil {
		updates["total_commission_trx"] = *req.TotalCommissionTRX
	}
	if req.TotalCommissionUSDT != nil {
		updates["total_commission_usdt"] = *req.TotalCommissionUSDT
	}
	if req.JoinTime != nil {
		updates["join_time"] = *req.JoinTime
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}
	user, err := userService.UpdateUserAdmin(id, updates)
	if errors.Is(err, repository.ErrProtectedUser) {
		c.JSON(http.StatusForbidden, gin.H{"error": "system user cannot be modified"})
		return
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "user updated successfully", "user": user})
}

func DeleteUserAdmin(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}
	if err := userService.DeleteUserAdmin(id); errors.Is(err, repository.ErrProtectedUser) {
		c.JSON(http.StatusForbidden, gin.H{"error": "system user cannot be deleted"})
		return
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "user deleted successfully"})
}

func GetUserByOwnerAddress(c *gin.Context) {
	ownerAddress := c.Param("owner_address")
	referrer := c.Query("referrer")
	if referrer == "" {
		referrer = c.Query("referral_code")
	}

	user, err := userService.GetUserByOwnerAddress(ownerAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Database error", "error": err.Error()})
		return
	}

	if user == nil {
		newUser, err := userService.RegisterUser(ownerAddress, nil, referrer, "")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create new user", "error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"message": "New user created", "user": newUser})
		return
	}

	if referrer != "" {
		user, err = userService.LoginWithWallet(ownerAddress, referrer)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to bind referrer", "error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "User found", "user": user})
}

func GetAllUsers(c *gin.Context) {
	users, err := userService.GetAllUsers() // 使用公开方法
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to retrieve users"})
		return
	}
	c.JSON(http.StatusOK, users)
}

type UpdateExchangeRequest struct {
	UseTRX  *decimal.Decimal `json:"use_trx"`
	UseUSDT *decimal.Decimal `json:"use_usdt"`
}

func UpdateUserExchange(c *gin.Context) {
	ownerAddress := c.Param("owner_address")
	if !middleware.IsAdminRole(middleware.Role(c)) &&
		repository.NormalizeAddress(middleware.OwnerAddress(c)) != repository.NormalizeAddress(ownerAddress) {
		c.JSON(http.StatusForbidden, gin.H{"message": "只能修改自己的兑换额度"})
		return
	}

	var input UpdateExchangeRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid input"})
		return
	}

	user, err := userService.GetUserByOwnerAddress(ownerAddress)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "User not found"})
		return
	}

	if input.UseTRX != nil && input.UseTRX.LessThan(user.UseTRX) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "use_trx cannot be less than current value"})
		return
	}
	if input.UseUSDT != nil && input.UseUSDT.LessThan(user.UseUSDT) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "use_usdt cannot be less than current value"})
		return
	}

	if input.UseTRX != nil {
		user.UseTRX = *input.UseTRX
	}
	if input.UseUSDT != nil {
		user.UseUSDT = *input.UseUSDT
	}

	if err := userService.UpdateUser(user); err != nil { // 使用公开方法
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User updated successfully", "user": user})
}

func GetTeamInfo(c *gin.Context) {
	referrer := c.Param("referrer")

	teamUsers, err := userService.GetDirectReferrals(referrer) // 使用公开方法
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Team not found"})
		return
	}

	teamCount := len(teamUsers)
	totalBetTrx, totalBetUsdt := decimal.Zero, decimal.Zero

	for _, u := range teamUsers {
		totalBetTrx = totalBetTrx.Add(u.TotalBetTRX)
		totalBetUsdt = totalBetUsdt.Add(u.TotalBetUSDT)
	}

	c.JSON(http.StatusOK, gin.H{
		"team_count":     teamCount,
		"total_bet_trx":  totalBetTrx,
		"total_bet_usdt": totalBetUsdt,
	})
}

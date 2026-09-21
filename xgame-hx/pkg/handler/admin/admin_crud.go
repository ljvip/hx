package admin

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetAdmins(c *gin.Context) {
	admins, err := adminRepo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch admins"})
		return
	}

	var response []gin.H
	for _, admin := range admins {
		response = append(response, gin.H{
			"id":         admin.ID,
			"username":   admin.Username,
			"role":       admin.Role,
			"created_at": admin.CreatedAt,
			"updated_at": admin.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, response)
}

type ChangePasswordRequest struct {
	Username    string `json:"username" binding:"required"`
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

func ChangeAdminPassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	admin, err := adminRepo.GetByUsername(req.Username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username"})
		return
	}

	if !admin.CheckPassword(req.OldPassword, bcryptCompare) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid old password"})
		return
	}

	if err := admin.SetPassword(req.NewPassword, bcryptHash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set new password"})
		return
	}

	if err := adminRepo.Update(admin); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}

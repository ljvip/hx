package router

import (
	"game-hx/pkg/handler/address"
	adminHandler "game-hx/pkg/handler/admin"
	bettingHandler "game-hx/pkg/handler/betting"
	commissionHandler "game-hx/pkg/handler/commission"
	gameHandler "game-hx/pkg/handler/game"
	referralHandler "game-hx/pkg/handler/referral"
	settingsHandler "game-hx/pkg/handler/settings"
	"game-hx/pkg/handler/shareholder"
	userHandler "game-hx/pkg/handler/user"
	"game-hx/pkg/middleware"
	"game-hx/pkg/websocket"

	"github.com/gin-gonic/gin"
)

func Setup(r *gin.Engine) {
	r.Use(middleware.CORS())

	r.GET("/health", bettingHandler.Health)
	r.GET("/wss", func(c *gin.Context) {
		websocket.HandleConnections(c.Writer, c.Request)
	})

	r.GET("/login/wallet", userHandler.LoginWithWallet)
	r.GET("/login/telegram", userHandler.LoginWithTelegram)
	r.POST("/register", userHandler.Register)

	r.GET("/user/allusers", middleware.AdminAuth(), userHandler.GetAllUsers)
	r.PUT("/api/users/:id", middleware.AdminAuth(), userHandler.UpdateUserAdmin)
	r.DELETE("/api/users/:id", middleware.AdminAuth(), userHandler.DeleteUserAdmin)
	r.GET("/user/referral-chain", referralHandler.GetReferralChain)
	r.GET("/user/:owner_address", userHandler.GetUserByOwnerAddress)
	r.GET("/user/:owner_address/referrals", commissionHandler.GetDirectReferrals)
	r.PUT("/update-user-exchange/:owner_address", middleware.Auth(), userHandler.UpdateUserExchange)
	r.GET("/team/:referrer", userHandler.GetTeamInfo)

	r.GET("/user/alltransactions", bettingHandler.GetAllTransactions)
	// r.GET("/user/alltransactions", middleware.AdminAuth(), bettingHandler.GetAllTransactions)
	r.GET("/api/transactions/:owner_address/:limit", bettingHandler.GetLatestTransactions)

	r.GET("/game-commission", gameHandler.GetAllGameRate)
	r.PUT("/game-rate", middleware.AdminAuth(), gameHandler.UpsertGameCommissionRate)
	r.POST("/user/set-commission", middleware.AdminAuth(), commissionHandler.SetUserCommissionRate)
	r.POST("/api/commission/withdraw", commissionHandler.WithdrawCommission)
	// r.POST("/api/commission/withdraw", middleware.Auth(), commissionHandler.WithdrawCommission)
	r.GET("/api/commission-records", bettingHandler.CommissionRecords)
	r.GET("/api/referral-commission-results", bettingHandler.ReferralAndCommissionResults)

	commissionGroup := r.Group("/commission")
	{
		commissionGroup.GET("/:receiver_code/records", commissionHandler.GetUserCommissionRecords)
		commissionGroup.GET("/:receiver_code/total", commissionHandler.GetUserTotalCommission)
		commissionGroup.GET("/:receiver_code/game", commissionHandler.GetUserCommissionByGame)
	}

	r.GET("/game-trends", bettingHandler.GetGameTrends)
	r.GET("/api/bet-results", bettingHandler.GetBetResults)
	r.GET("/api/referral-bet-results", bettingHandler.GetReferralBetResults)

	r.GET("/api/payouts", middleware.AdminAuth(), bettingHandler.ListPayouts)
	r.POST("/api/payout/retry", middleware.AdminAuth(), bettingHandler.RetryPayout)

	r.GET("/addresses", address.GetDlAddresses)
	r.PUT("/address", middleware.AdminAuth(), address.UpdateAddress)
	r.POST("/address", middleware.AdminAuth(), address.UpdateAddress)
	r.DELETE("/address/:id", middleware.AdminAuth(), address.DeleteAddress)

	r.POST("/api/bet/bsc-transfer", middleware.WebhookAuth(), bettingHandler.HandleBSCTransferWebhook)

	r.GET("/admins", middleware.AdminAuth(), adminHandler.GetAdmins)
	adminGroup := r.Group("/api/admins")
	{
		adminGroup.POST("/login", adminHandler.LoginAdmin)
		adminGroup.POST("/create-admin", middleware.AdminAuth(), adminHandler.CreateAdmin)
		adminGroup.PUT("/change-password", middleware.AdminAuth(), adminHandler.ChangeAdminPassword)
	}

	r.GET("/settings", settingsHandler.GetSettings)
	r.GET("/settings/bet-limits", settingsHandler.GetBetLimits)
	r.PUT("/settings", middleware.AdminAuth(), settingsHandler.UpdateSettings)

	r.POST("/shareholder/login", shareholder.ShareholderLogin)
	r.POST("/api/shareholder/login", shareholder.ShareholderLogin)
	shareholderSelf := r.Group("/shareholder/self", middleware.ShareholderAuth())
	{
		shareholderSelf.GET("/profile", shareholder.GetSelfProfile)
		shareholderSelf.GET("/balance", shareholder.GetSelfBalance)
		shareholderSelf.GET("/transactions", shareholder.GetSelfTransactions)
		shareholderSelf.GET("/downline/users", shareholder.GetSelfDownlineUsers)
		shareholderSelf.GET("/downline/transactions", shareholder.GetSelfDownlineTransactions)
		shareholderSelf.GET("/downline/commissions", shareholder.GetSelfDownlineCommissions)
		shareholderSelf.PUT("/share-ratio", shareholder.UpdateSelfShareRatio)
		shareholderSelf.PUT("/password", shareholder.ChangeSelfPassword)
		shareholderSelf.GET("/recharge", shareholder.GetSelfRechargeInfo)
		shareholderSelf.POST("/withdraw", shareholder.WithdrawSelf)
		shareholderSelf.PUT("/bet-limits", shareholder.UpdateSelfBetLimits)
	}
	// Short aliases retained for clients that use the portal root paths.
	shareholderPortal := r.Group("/shareholder", middleware.ShareholderAuth())
	{
		shareholderPortal.GET("/profile", shareholder.GetSelfProfile)
		shareholderPortal.GET("/balance", shareholder.GetSelfBalance)
		shareholderPortal.GET("/transactions", shareholder.GetSelfTransactions)
		shareholderPortal.GET("/users", shareholder.GetSelfDownlineUsers)
		shareholderPortal.GET("/downline/transactions", shareholder.GetSelfDownlineTransactions)
		shareholderPortal.GET("/commissions", shareholder.GetSelfDownlineCommissions)
		shareholderPortal.PUT("/share-ratio", shareholder.UpdateSelfShareRatio)
		shareholderPortal.PUT("/password", shareholder.ChangeSelfPassword)
		shareholderPortal.GET("/recharge", shareholder.GetSelfRechargeInfo)
		shareholderPortal.POST("/withdraw", shareholder.WithdrawSelf)
		shareholderPortal.PUT("/bet-limits", shareholder.UpdateSelfBetLimits)
	}

	shareholderGroup := r.Group("/shareholder", middleware.AdminAuth())
	{
		shareholderGroup.GET("/settings", shareholder.GetShareholderSettings)
		shareholderGroup.PUT("/settings/min-balance", shareholder.UpdateShareholderMinBalance)
		shareholderGroup.GET("/list", shareholder.ListShareholders)
		shareholderGroup.POST("/assign", shareholder.AssignUserToShareholder)
		shareholderGroup.POST("/create", shareholder.CreateShareholder)
		shareholderGroup.GET("/code/:code", shareholder.GetShareholderByCode)
		shareholderGroup.GET("/:id/balance", shareholder.GetShareholderBalance)
		shareholderGroup.GET("/:id/transactions", shareholder.GetShareholderTransactions)
		shareholderGroup.GET("/:id/stats", shareholder.GetShareholderStats)
		shareholderGroup.GET("/:id/users", shareholder.GetShareholderUsers)
		shareholderGroup.PUT("/:id/status", shareholder.UpdateShareholderStatus)
		shareholderGroup.PUT("/:id/balance", shareholder.UpdateShareholderBalance)
		shareholderGroup.PUT("/:id/share-ratio", shareholder.UpdateShareholderShareRatio)
		shareholderGroup.PUT("/:id/bet-limits", shareholder.UpdateShareholderBetLimits)
		shareholderGroup.PUT("/:id/password", shareholder.ResetShareholderPassword)
		shareholderGroup.DELETE("/:id", shareholder.DeleteShareholder)
	}
}

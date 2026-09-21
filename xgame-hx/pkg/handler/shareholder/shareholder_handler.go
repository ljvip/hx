// pkg/handler/shareholder/shareholder_handler.go
package shareholder

import (
	"net/http"
	"strconv"
	"strings"

	"game-hx/internal/service"
	"game-hx/pkg/middleware"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

var shareholderSvc = service.NewShareholderService()
var shareholderSettingsSvc = service.NewSettingService()

func ShareholderLogin(c *gin.Context) {
	var req struct {
		Code     string `json:"code" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sh, err := shareholderSvc.AuthenticateShareholder(req.Code, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	token, err := middleware.GenerateShareholderToken(sh.ID, sh.Code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成登录令牌失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "shareholder": sh})
}

func selfShareholder(c *gin.Context) (int64, bool) {
	id, ok := middleware.ShareholderID(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "无效的股东令牌"})
		return 0, false
	}
	sh, err := shareholderSvc.GetShareholderByID(id)
	if err != nil || sh == nil || sh.Status != 1 {
		c.JSON(http.StatusForbidden, gin.H{"error": "股东不存在或已停用"})
		return 0, false
	}
	if code := middleware.ShareholderCode(c); code != "" && code != sh.Code {
		c.JSON(http.StatusForbidden, gin.H{"error": "股东令牌与账户不匹配"})
		return 0, false
	}
	return id, true
}

func GetSelfProfile(c *gin.Context) {
	id, ok := selfShareholder(c)
	if !ok {
		return
	}
	profile, err := shareholderSvc.GetShareholderProfile(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, profile)
}

func GetSelfBalance(c *gin.Context) {
	id, ok := selfShareholder(c)
	if !ok {
		return
	}
	balance, err := shareholderSvc.GetShareholderBalance(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"balance": balance})
}

func selfLimit(c *gin.Context) int {
	limit, err := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if err != nil || limit <= 0 {
		return 50
	}
	if limit > 500 {
		return 500
	}
	return limit
}

func GetSelfTransactions(c *gin.Context) {
	id, ok := selfShareholder(c)
	if !ok {
		return
	}
	items, err := shareholderSvc.GetShareholderTransactionsWithFilter(id, selfLimit(c),
		c.Query("game_name"), c.Query("trade_no"), c.Query("start_date"), c.Query("end_date"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"transactions": items, "total": len(items)})
}

func GetSelfDownlineUsers(c *gin.Context) {
	id, ok := selfShareholder(c)
	if !ok {
		return
	}
	users, err := shareholderSvc.GetShareholderUsers(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}

func GetSelfDownlineTransactions(c *gin.Context) {
	// Shareholder transactions are keyed by the authenticated shareholder,
	// and each row includes the downline user_id.
	GetSelfTransactions(c)
}

func GetSelfDownlineCommissions(c *gin.Context) {
	id, ok := selfShareholder(c)
	if !ok {
		return
	}
	items, total, err := shareholderSvc.GetShareholderCommissions(int(id), selfLimit(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"commissions": items, "total": total})
}

func UpdateSelfShareRatio(c *gin.Context) {
	id, ok := selfShareholder(c)
	if !ok {
		return
	}
	var req struct {
		ShareRatio *float64 `json:"share_ratio"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.ShareRatio == nil ||
		*req.ShareRatio < 0 || *req.ShareRatio > 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "占成比例必须在 0 到 1 之间"})
		return
	}
	if err := shareholderSvc.UpdateShareholderShareRatio(id, *req.ShareRatio); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "占成比例更新成功", "share_ratio": *req.ShareRatio})
}

type updateBetLimitsRequest struct {
	MinBetTRX     *decimal.Decimal `json:"min_bet_trx"`
	MinBetUSDT    *decimal.Decimal `json:"min_bet_usdt"`
	MinBetUSDTBsc *decimal.Decimal `json:"min_bet_usdt_bsc"`
	MaxBet        *decimal.Decimal `json:"max_bet"`
}

func UpdateSelfBetLimits(c *gin.Context) {
	id, ok := selfShareholder(c)
	if !ok {
		return
	}
	updateShareholderBetLimitsByID(c, id)
}

func UpdateShareholderBetLimits(c *gin.Context) {
	id, ok := parseShareholderID(c)
	if !ok {
		return
	}
	updateShareholderBetLimitsByID(c, id)
}

func updateShareholderBetLimitsByID(c *gin.Context, id int64) {
	var req updateBetLimitsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := shareholderSvc.UpdateShareholderBetLimits(id, req.MinBetTRX, req.MinBetUSDT, req.MinBetUSDTBsc, req.MaxBet); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sh, err := shareholderSvc.GetShareholderByID(id)
	if err != nil || sh == nil {
		c.JSON(http.StatusOK, gin.H{"message": "投注限额已更新"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message":               "投注限额已更新",
		"min_bet_trx":           sh.MinBetTRX,
		"min_bet_usdt":          sh.MinBetUSDT,
		"min_bet_usdt_bsc":      sh.MinBetUSDTBsc,
		"max_bet":               sh.MaxBet,
		"effective_bet_limits": shareholderSvc.EffectiveBetLimits(sh),
	})
}

func ChangeSelfPassword(c *gin.Context) {
	id, ok := selfShareholder(c)
	if !ok {
		return
	}
	var req struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := shareholderSvc.ChangeShareholderPassword(id, req.CurrentPassword, req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "密码修改成功"})
}

func ResetShareholderPassword(c *gin.Context) {
	id, ok := parseShareholderID(c)
	if !ok {
		return
	}
	var req struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := shareholderSvc.SetShareholderPassword(id, req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "股东密码设置成功"})
}

func GetSelfRechargeInfo(c *gin.Context) {
	settings := shareholderSettingsSvc.GetAll()
	c.JSON(http.StatusOK, gin.H{
		"recharge_address": settings.ShareholderRechargeAddress,
		"min_amount":       settings.ShareholderRechargeMin,
		"token_symbols":    []string{"TRX", "USDT"},
	})
}

func WithdrawSelf(c *gin.Context) {
	id, ok := selfShareholder(c)
	if !ok {
		return
	}
	var req struct {
		Amount      decimal.Decimal `json:"amount"`
		TokenSymbol string          `json:"token_symbol"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || !req.Amount.GreaterThan(decimal.Zero) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "amount 必须大于 0"})
		return
	}
	if strings.TrimSpace(req.TokenSymbol) == "" {
		req.TokenSymbol = "TRX"
	}
	txID, err := shareholderSvc.WithdrawShareholder(id, req.TokenSymbol, req.Amount)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "提现成功", "payout_tx_id": txID})
}

func parseShareholderID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的股东ID"})
		return 0, false
	}
	return id, true
}

// GetShareholderBalance 获取股东余额
func GetShareholderBalance(c *gin.Context) {
	id, ok := parseShareholderID(c)
	if !ok {
		return
	}

	balance, err := shareholderSvc.GetShareholderBalance(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":      id,
		"balance": balance,
	})
}

// GetShareholderTransactions 获取股东交易记录
// GetShareholderTransactions 获取股东交易记录
// 支持两种定位方式：
//  1. ?user_id=2   -> 按用户ID查股东（推荐）
//  2. /shareholder/:id/transactions -> 按股东ID查（兼容旧调用）
func GetShareholderTransactions(c *gin.Context) {
	var shareholderID int64

	if userIDStr := c.Query("user_id"); userIDStr != "" {
		userID, err := strconv.ParseInt(userIDStr, 10, 64)
		if err != nil || userID <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 user_id"})
			return
		}

		sh, err := shareholderSvc.GetShareholderByUserID(userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		// status != 1 时兜底查一次，避免被停用的股东完全查不到
		if sh == nil {
			sh, err = shareholderSvc.GetShareholderByUserIDAny(userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}
		if sh == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "股东不存在"})
			return
		}
		shareholderID = sh.ID
	} else {
		id, ok := parseShareholderID(c)
		if !ok {
			return
		}
		shareholderID = id
	}

	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	transactions, err := shareholderSvc.GetShareholderTransactionsWithFilter(
		shareholderID, limit,
		c.Query("game_name"), c.Query("trade_no"),
		c.Query("start_date"), c.Query("end_date"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":           shareholderID,
		"transactions": transactions,
		"total":        len(transactions),
	})
}

// GetShareholderStats 获取股东统计信息
func GetShareholderStats(c *gin.Context) {
	id, ok := parseShareholderID(c)
	if !ok {
		return
	}

	stats, err := shareholderSvc.GetShareholderStats(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// AssignUserToShareholder 分配用户给股东
type AssignRequest struct {
	UserID      int64  `json:"user_id" binding:"required"`
	Shareholder string `json:"shareholder" binding:"required"`
}

func AssignUserToShareholder(c *gin.Context) {
	var req AssignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := shareholderSvc.AssignUserToShareholder(req.UserID, req.Shareholder); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "分配成功"})
}

// CreateShareholder 创建股东
type CreateShareholderRequest struct {
	UserID            int64            `json:"user_id" binding:"required"`
	Code              string           `json:"code" binding:"required"`
	Name              string           `json:"name"`
	Level             int              `json:"level"`
	ParentCode        string           `json:"parent_code"`
	DefaultShareRatio float64          `json:"default_share_ratio"`
	Password          string           `json:"password"`
	MinBetTRX         *decimal.Decimal `json:"min_bet_trx"`
	MinBetUSDT        *decimal.Decimal `json:"min_bet_usdt"`
	MinBetUSDTBsc     *decimal.Decimal `json:"min_bet_usdt_bsc"`
	MaxBet            *decimal.Decimal `json:"max_bet"`
}

func CreateShareholder(c *gin.Context) {
	var req CreateShareholderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.Password) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password 必填"})
		return
	}

	shareholder, err := shareholderSvc.CreateShareholderWithPassword(
		req.UserID, req.Code, req.Name, req.Level, req.ParentCode, req.DefaultShareRatio, req.Password,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := shareholderSvc.UpdateShareholderBetLimits(shareholder.ID, req.MinBetTRX, req.MinBetUSDT, req.MinBetUSDTBsc, req.MaxBet); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "股东已创建，但投注限额未保存: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "股东创建成功",
		"shareholder": shareholder,
	})
}

// ListShareholders 获取所有股东列表
func ListShareholders(c *gin.Context) {
	shareholders, err := shareholderSvc.ListShareholders()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, shareholders)
}

// GetShareholderUsers 获取股东伞下用户列表
func GetShareholderUsers(c *gin.Context) {
	shareholderIDStr := c.Param("id")
	shareholderID, err := strconv.ParseInt(shareholderIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的股东ID"})
		return
	}

	users, err := shareholderSvc.GetShareholderUsers(shareholderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

// UpdateShareholderStatus 更新股东状态
func UpdateShareholderStatus(c *gin.Context) {
	shareholderIDStr := c.Param("id")
	shareholderID, err := strconv.ParseInt(shareholderIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的股东ID"})
		return
	}

	var req struct {
		Status *int `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Status == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status 必填"})
		return
	}

	if err := shareholderSvc.UpdateShareholderStatus(shareholderID, *req.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// UpdateShareholderBalance 更新股东积分余额
func UpdateShareholderBalance(c *gin.Context) {
	shareholderIDStr := c.Param("id")
	shareholderID, err := strconv.ParseInt(shareholderIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的股东ID"})
		return
	}

	var req struct {
		Balance *decimal.Decimal `json:"balance"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Balance == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "balance 必填"})
		return
	}

	if err := shareholderSvc.UpdateShareholderBalance(shareholderID, *req.Balance); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "积分余额更新成功"})
}

// UpdateShareholderShareRatio 更新股东的默认占成比例
func UpdateShareholderShareRatio(c *gin.Context) {
	shareholderIDStr := c.Param("id")
	shareholderID, err := strconv.ParseInt(shareholderIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的股东ID"})
		return
	}

	var req struct {
		ShareRatio *float64 `json:"share_ratio"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.ShareRatio == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "share_ratio 必填"})
		return
	}

	if *req.ShareRatio < 0 || *req.ShareRatio > 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "占成比例必须在 0 到 1 之间"})
		return
	}

	if err := shareholderSvc.UpdateShareholderShareRatio(shareholderID, *req.ShareRatio); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "占成比例更新成功"})
}

func GetShareholderSettings(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"min_balance":        shareholderSvc.GetShareholderMinBalance(),
		"points_per_percent": shareholderSettingsSvc.GetAll().ShareholderPointsPerPercent,
		"remark":             "每 1% 占成需要对应积分，设置占成时股东余额必须严格大于所需积分",
	})
}

func UpdateShareholderMinBalance(c *gin.Context) {
	var req struct {
		MinBalance decimal.Decimal `json:"min_balance"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := shareholderSvc.SetShareholderMinBalance(req.MinBalance); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "股东积分判断值已更新",
		"min_balance": shareholderSvc.GetShareholderMinBalance(),
	})
}

func GetShareholderByCode(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "股东代码不能为空"})
		return
	}
	shareholder, err := shareholderSvc.GetShareholderByCode(code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if shareholder == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "股东不存在"})
		return
	}
	c.JSON(http.StatusOK, shareholder)
}

func DeleteShareholder(c *gin.Context) {
	id, ok := parseShareholderID(c)
	if !ok {
		return
	}
	if err := shareholderSvc.DeleteShareholder(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "股东已删除"})
}

package betting

import (
	"net/http"
	"strings"

	"game-hx/internal/model"
	"game-hx/internal/repository"
	"game-hx/pkg/database"
	"github.com/shopspring/decimal"

	"github.com/gin-gonic/gin"
)

var commissionRepo = repository.NewCommissionRepository()

type CommissionFilterParams struct {
	ReceiverCodes []string
	SenderCodes   []string
	ReceiverAddr  string
	SenderAddr    string
	GameType      string
	TokenSymbol   string
}

func CommissionRecords(c *gin.Context) {
	rawReceiverCodes := c.Query("receiver_code")
	rawSenderCodes := c.Query("sender_code")

	var receiverCodes, senderCodes []string
	if rawReceiverCodes != "" {
		receiverCodes = strings.Split(rawReceiverCodes, ",")
	}
	if rawSenderCodes != "" {
		senderCodes = strings.Split(rawSenderCodes, ",")
	}

	startDate, endDate := parseTimePeriod(c.DefaultQuery("time_period", "today"))

	query := database.GetDB().Model(&model.CommissionRecord{})

	if !startDate.IsZero() && !endDate.IsZero() {
		query = query.Where("created_at >= ? AND created_at <= ?", startDate, endDate)
	}
	if len(receiverCodes) > 0 {
		query = query.Where("receiver_code IN ?", receiverCodes)
	}
	if len(senderCodes) > 0 {
		query = query.Where("sender_code IN ?", senderCodes)
	}
	if addr := c.Query("receiver_addr"); addr != "" {
		query = query.Where("receiver_addr = ?", addr)
	}
	if addr := c.Query("sender_addr"); addr != "" {
		query = query.Where("sender_addr = ?", addr)
	}
	if gameType := c.Query("game_type"); gameType != "" {
		query = query.Where("game_type = ?", gameType)
	}
	if token := c.Query("token_symbol"); token != "" {
		query = query.Where("token_symbol = ?", token)
	}

	var records []model.CommissionRecord
	if err := query.Order("created_at DESC").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch commission records"})
		return
	}

	totalCommission, totalBetAmount := decimal.Zero, decimal.Zero
	for _, r := range records {
		totalCommission = totalCommission.Add(r.Commission)
		totalBetAmount = totalBetAmount.Add(r.BetAmount)
	}

	c.JSON(http.StatusOK, gin.H{
		"results":          records,
		"total_commission": totalCommission,
		"total_bet_amount": totalBetAmount,
	})
}

func ReferralAndCommissionResults(c *gin.Context) {
	ownerAddress := c.Query("owner_address")
	telegramID := c.Query("telegram_id")

	if ownerAddress == "" && telegramID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "owner_address or telegram_id is required"})
		return
	}

	params := make(map[string]interface{})
	if gameType := firstNonEmptyQuery(c, "game_type", "game_name"); gameType != "" {
		params["game_type"] = gameType
	}
	if tokenSymbol := c.Query("token_symbol"); tokenSymbol != "" {
		params["token_symbol"] = tokenSymbol
	}
	if status := c.Query("status"); status != "" {
		params["status"] = status
	}

	user, err := userRepo.GetByOwnerAddressOrTelegram(ownerAddress, telegramID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	referrals, err := userRepo.GetDirectReferrals(user.ReferralCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	referralCodes := make([]string, 0, len(referrals))
	umbrellaAddresses := make([]string, 0, len(referrals))
	for _, ref := range referrals {
		if ref.ReferralCode != "" {
			referralCodes = append(referralCodes, ref.ReferralCode)
		}
		if ref.OwnerAddress != "" {
			umbrellaAddresses = append(umbrellaAddresses, ref.OwnerAddress)
		}
	}
	if treeCodes, treeErr := userRepo.GetReferralTreeByCTE(user.ReferralCode); treeErr == nil && len(treeCodes) > 0 {
		referralCodes = treeCodes
		if addrs, addrErr := userRepo.GetOwnerAddressesByReferralCodes(treeCodes); addrErr == nil {
			umbrellaAddresses = uniqueNonEmptyAddresses(addrs, "")
		}
	}

	if len(referralCodes) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"referral_codes":              []string{},
			"umbrella_addresses":          []string{},
			"commission_records":          []model.CommissionRecord{},
			"total_commission":            decimal.Zero,
			"total_commission_bet_amount": decimal.Zero,
		})
		return
	}

	startDate, endDate := parseTimePeriod(c.DefaultQuery("time_period", "today"))

	query := database.GetDB().Model(&model.CommissionRecord{}).
		Where("receiver_code IN ?", referralCodes)

	for key, value := range params {
		if value != nil && value != "" {
			query = query.Where(key+" = ?", value)
		}
	}

	if !startDate.IsZero() && !endDate.IsZero() {
		query = query.Where("created_at >= ? AND created_at <= ?", startDate, endDate)
	}

	var records []model.CommissionRecord
	if err := query.Order("created_at DESC").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch records"})
		return
	}

	totalCommission, totalBetAmount := decimal.Zero, decimal.Zero
	for _, r := range records {
		totalCommission = totalCommission.Add(r.Commission)
		totalBetAmount = totalBetAmount.Add(r.BetAmount)
	}

	c.JSON(http.StatusOK, gin.H{
		"referral_codes":              referralCodes,
		"umbrella_addresses":          uniqueNonEmptyAddresses(umbrellaAddresses, ""),
		"commission_records":          records,
		"total_commission":            totalCommission,
		"total_commission_bet_amount": totalBetAmount,
	})
}

func firstNonEmptyQuery(c *gin.Context, keys ...string) string {
	for _, key := range keys {
		if v := strings.TrimSpace(c.Query(key)); v != "" {
			return v
		}
	}
	return ""
}

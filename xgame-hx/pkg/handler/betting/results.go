package betting

import (
	"net/http"
	"strconv"
	"time"

	"game-hx/internal/model"
	"game-hx/internal/repository"
	// "game-hx/pkg/database"

	"github.com/gin-gonic/gin"
)

var (
	betRepo  = repository.NewBetRepository()
	userRepo = repository.NewUserRepository()
)

func GetGameTrends(c *gin.Context) {
	gameName := c.DefaultQuery("game", "")
	limit := c.DefaultQuery("limit", "60")

	limitInt, err := strconv.Atoi(limit)
	if err != nil || limitInt <= 0 || limitInt > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit value"})
		return
	}

	trends, err := betRepo.FetchGameTrends(gameName, limitInt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch game trends"})
		return
	}

	// 反转数据顺序
	for i := 0; i < len(trends)/2; i++ {
		j := len(trends) - i - 1
		trends[i], trends[j] = trends[j], trends[i]
	}

	c.JSON(http.StatusOK, gin.H{"data": trends})
}

func GetBetResults(c *gin.Context) {
	startDate, endDate := parseTimePeriod(c.DefaultQuery("time_period", "today"))

	params := make(map[string]interface{})

	if ownerAddress := c.Query("owner_address"); ownerAddress != "" {
		params["owner_address"] = ownerAddress
	}
	if toAddress := c.Query("to_address"); toAddress != "" {
		params["to_address"] = toAddress
	}
	if gameName := c.Query("game_name"); gameName != "" {
		params["game_name"] = gameName
	}
	if tokenSymbol := c.Query("token_symbol"); tokenSymbol != "" {
		params["token_symbol"] = tokenSymbol
	}
	if payoutStatus := c.Query("payout_status"); payoutStatus != "" {
		params["payout_status"] = payoutStatus
	}

	results, totalTx, totalFinal, err := betRepo.GetBetResults(params, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results":                  results,
		"total_transaction_amount": totalTx,
		"total_final_amount":       totalFinal,
	})
}

func GetReferralBetResults(c *gin.Context) {
	ownerAddress := c.Query("owner_address")
	telegramID := c.Query("telegram_id")

	if ownerAddress == "" && telegramID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "owner_address or telegram_id is required"})
		return
	}

	var user *model.User
	var err error

	user, err = userRepo.GetByOwnerAddressOrTelegram(ownerAddress, telegramID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	referrals, err := userRepo.GetDirectReferrals(user.ReferralCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get referrals"})
		return
	}

	directAddresses := make([]string, 0, len(referrals))
	for _, ref := range referrals {
		if ref.OwnerAddress != "" && ref.OwnerAddress != user.OwnerAddress {
			directAddresses = append(directAddresses, ref.OwnerAddress)
		}
	}

	umbrellaAddresses := append([]string{}, directAddresses...)
	if treeCodes, treeErr := userRepo.GetReferralTreeByCTE(user.ReferralCode); treeErr == nil {
		if addrs, addrErr := userRepo.GetOwnerAddressesByReferralCodes(treeCodes); addrErr == nil && len(addrs) > 0 {
			umbrellaAddresses = uniqueNonEmptyAddresses(addrs, user.OwnerAddress)
		}
	}

	startDate, endDate := parseTimePeriod(c.DefaultQuery("time_period", "today"))

	params := make(map[string]interface{})

	finalAddresses := uniqueNonEmptyAddresses(append([]string{user.OwnerAddress}, umbrellaAddresses...), "")
	if len(finalAddresses) > 0 {
		params["owner_address IN ?"] = finalAddresses
	}

	// 处理其他参数
	if toAddress := c.Query("to_address"); toAddress != "" {
		params["to_address"] = toAddress
	}
	if gameName := c.Query("game_name"); gameName != "" {
		params["game_name"] = gameName
	}
	if tokenSymbol := c.Query("token_symbol"); tokenSymbol != "" {
		params["token_symbol"] = tokenSymbol
	}

	results, totalTx, totalFinal, err := betRepo.GetBetResults(params, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results":                  results,
		"direct_referrals":         directAddresses,
		"umbrella_addresses":       umbrellaAddresses,
		"total_transaction_amount": totalTx,
		"total_final_amount":       totalFinal,
	})
}

func uniqueNonEmptyAddresses(addresses []string, skip string) []string {
	seen := make(map[string]bool, len(addresses))
	out := make([]string, 0, len(addresses))
	for _, addr := range addresses {
		if addr == "" || addr == skip || seen[addr] {
			continue
		}
		seen[addr] = true
		out = append(out, addr)
	}
	return out
}

func parseTimePeriod(period string) (time.Time, time.Time) {
	now := time.Now()
	var start, end time.Time

	switch period {
	case "today":
		start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		end = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location())
	case "yesterday":
		yesterday := now.AddDate(0, 0, -1)
		start = time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 0, 0, 0, 0, now.Location())
		end = time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 23, 59, 59, 0, now.Location())
	case "this_week":
		weekday := now.Weekday()
		daysToMonday := (int(weekday) + 6) % 7
		start = now.AddDate(0, 0, -daysToMonday).Truncate(24 * time.Hour)
		end = start.AddDate(0, 0, 6).Truncate(24 * time.Hour).Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	case "last_week":
		// 上周一
		weekday := now.Weekday()
		daysToMonday := (int(weekday) + 6) % 7
		thisMonday := now.AddDate(0, 0, -daysToMonday).Truncate(24 * time.Hour)
		lastMonday := thisMonday.AddDate(0, 0, -7)
		start = lastMonday
		end = lastMonday.AddDate(0, 0, 6).Truncate(24 * time.Hour).Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	case "this_month":
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		end = start.AddDate(0, 1, -1).Truncate(24 * time.Hour).Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	case "last_month":
		// 上个月第一天
		firstDayThisMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		firstDayLastMonth := firstDayThisMonth.AddDate(0, -1, 0)
		start = firstDayLastMonth
		end = firstDayLastMonth.AddDate(0, 1, -1).Truncate(24 * time.Hour).Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	default:
		start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		end = start.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	}

	return start, end
}

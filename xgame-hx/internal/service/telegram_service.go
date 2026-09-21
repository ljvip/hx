package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"unicode"
)

const (
	botToken  = "7706205563:AAFDS2z7iMliRfoCutGRCXgg5APfimFIt7E"
	channelID = "-1002317026413"
)

type TelegramService struct{}

func NewTelegramService() *TelegramService {
	return &TelegramService{}
}

// SendMessageWithButtons 发送带按钮的Telegram消息
func (s *TelegramService) SendMessageWithButtons(telegramMessage string, telegramtoAddress string, blockNumber int64) error {
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)

	buttons := [][]map[string]interface{}{
		{
			{"text": "🎰 游戏", "url": "https://t.me/btc_gambling_bot"},
			{"text": "📌 验证", "url": fmt.Sprintf("https://tronscan.org/#/block/%d", blockNumber)},
			{"text": "💬 客服", "url": "https://t.me/gametohx"},
		},
	}

	combinedText := telegramMessage
	if telegramtoAddress != "" {
		combinedText += fmt.Sprintf("\n\n`%s`", telegramtoAddress)
	}

	payload := map[string]interface{}{
		"chat_id":      channelID,
		"text":         combinedText,
		"parse_mode":   "Markdown",
		"reply_markup": map[string]interface{}{"inline_keyboard": buttons},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("发送消息失败，状态码: %d, 响应: %s", resp.StatusCode, string(body))
	}
	return nil
}

// FormatGameTrends 格式化游戏走势（优化版）
func (s *TelegramService) FormatGameTrends(trends []string) string {
	const maxItemsPerColumn = 10
	const totalColumns = 6

	symbols := make([]string, 0, len(trends))
	for _, result := range trends {
		symbols = append(symbols, s.mapGameResultToSymbol(result))
	}

	// 填充空白
	for len(symbols) < totalColumns*maxItemsPerColumn {
		symbols = append(symbols, " ")
	}

	// 使用 strings.Builder 优化拼接
	var builder strings.Builder
	// 预分配大约的容量
	builder.Grow(totalColumns * maxItemsPerColumn * 2)

	for columnIndex := 0; columnIndex < totalColumns; columnIndex++ {
		for rowIndex := 0; rowIndex < maxItemsPerColumn; rowIndex++ {
			index := rowIndex*totalColumns + columnIndex
			builder.WriteString(symbols[index])
			builder.WriteString(" ")
		}
		builder.WriteString("\n")
	}

	return builder.String()
}

// mapGameResultToSymbol 映射游戏结果到符号
func (s *TelegramService) mapGameResultToSymbol(gameResult string) string {
	switch gameResult {
	case "未中奖":
		return "🔵"
	case "中奖":
		return "🔴"
	case "闲":
		return "🔵"
	case "庄":
		return "🔴"
	case "和":
		return "🟢"
	case "小":
		return "🔵"
	case "大":
		return "🔴"
	case "单":
		return "🔵"
	case "双":
		return "🔴"
	default:
		hasLetter := false
		hasDigit := false

		for _, char := range gameResult {
			if unicode.IsLetter(char) {
				hasLetter = true
			}
			if unicode.IsDigit(char) {
				hasDigit = true
			}
		}

		if hasLetter && hasDigit {
			return "🔴"
		}
		if (hasLetter && !hasDigit) || (hasDigit && !hasLetter) {
			return "🔵"
		}
		return "❓"
	}
}

// TruncateString 截取字符串
func (s *TelegramService) TruncateString(str string, length int) string {
	if len(str) < length {
		return str
	}
	return str[len(str)-length:]
}

package tools

import (
	"fmt"
	"strings"

	"github.com/shopspring/decimal"
)

func IsBSCAddress(addr string) bool {
	a := strings.TrimSpace(addr)
	if len(a) != 42 {
		return false
	}
	return strings.HasPrefix(strings.ToLower(a), "0x")
}

func IsTRONAddress(addr string) bool {
	a := strings.TrimSpace(addr)
	return strings.HasPrefix(a, "T") && len(a) >= 30
}

func formatAmount(amount decimal.Decimal, decimals int) string {
	if amount.IsNegative() {
		amount = decimal.Zero
	}
	return amount.StringFixed(int32(decimals))
}

// Payout 按用户地址链和币种发送返奖。amount 为对应币种的人类可读数量（TRX / USDT）。
func Payout(toAddress, tokenSymbol string, amount decimal.Decimal) (string, error) {
	toAddress = strings.TrimSpace(toAddress)
	tokenSymbol = strings.ToUpper(strings.TrimSpace(tokenSymbol))
	if toAddress == "" {
		return "", fmt.Errorf("接收地址为空")
	}
	if !amount.GreaterThan(decimal.Zero) {
		return "", fmt.Errorf("返奖金额必须大于 0")
	}

	switch {
	case IsBSCAddress(toAddress):
		if tokenSymbol != "USDT" {
			return "", fmt.Errorf("BSC 地址仅支持 USDT 返奖，当前币种: %s", tokenSymbol)
		}
		bscSendMu.Lock()
		defer bscSendMu.Unlock()
		return TransferUSDT(toAddress, formatAmount(amount, 8))

	case IsTRONAddress(toAddress):
		tronSendMu.Lock()
		defer tronSendMu.Unlock()
		if tokenSymbol == "TRX" {
			sun := amount.Mul(decimal.NewFromInt(1_000_000)).Round(0).IntPart()
			if sun <= 0 {
				return "", fmt.Errorf("TRX 返奖金额过小: %s", amount)
			}
			return SendTrx(toAddress, sun)
		}
		if tokenSymbol == "USDT" {
			return SendTRC20Token(toAddress, formatAmount(amount, 6))
		}
		return "", fmt.Errorf("TRON 不支持的返奖币种: %s", tokenSymbol)

	default:
		return "", fmt.Errorf("无法识别地址所属链: %s", toAddress)
	}
}

package game

import (
	"github.com/shopspring/decimal"
	"unicode"
)

// CheckHashLucky 判断哈希幸运游戏的输赢
func CheckHashLucky(transactionAmount decimal.Decimal, blockHash string) (string, string, decimal.Decimal) {
	n := len(blockHash)
	if n < 2 {
		return "invalid", "lose", decimal.Zero
	}

	// 获取哈希最后两个字符
	lastChar := rune(blockHash[n-1])
	secondLastChar := rune(blockHash[n-2])

	// 判断是否为“数字+字母”或“字母+数字”
	isLastDigit := unicode.IsDigit(lastChar)
	isSecondLastDigit := unicode.IsDigit(secondLastChar)

	gameResult := string(secondLastChar) + string(lastChar) // 游戏开奖结果

	if isLastDigit != isSecondLastDigit { // 一字母一数字
		return gameResult, "win", transactionAmount.Mul(decimal.NewFromInt(2)) // 赔率 1:2
	}

	return gameResult, "lose", decimal.Zero
}

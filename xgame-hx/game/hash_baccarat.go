package game

import (
	"github.com/shopspring/decimal"
	// "fmt"
	// "unicode"
)

// 计算投注赔率
func calculateWinnings(transactionAmount decimal.Decimal, betType string, result string, bankerPoints int, playerPoints int) (decimal.Decimal, string) {
	odds := map[string]float64{
		"庄": 2.0, // 1:2 赔率
		"闲": 2.0, // 1:2 赔率
		"和": 7.5, // 1:7.5 赔率
	}

	// 判断用户是否中奖
	if (betType == "庄" && result == "庄") ||
		(betType == "闲" && result == "闲") ||
		(betType == "和" && result == "和") {
		winnings := transactionAmount.Mul(decimal.NewFromFloat(odds[betType]))
		return winnings, "win"
	}

	// 如果押庄或押闲，且游戏结果是 "和"
	if result == "和" && (betType == "庄" || betType == "闲") {
		if bankerPoints == 0 && playerPoints == 0 {
			return transactionAmount.Mul(decimal.NewFromFloat(0.5)), "和局,退回50%本金"
		}
		return transactionAmount.Mul(decimal.NewFromFloat(0.99)), "和局,退回99%本金"
	}

	// 用户输了，输掉全部投注金额
	return decimal.Zero, "lose"
}

// 根据区块哈希和投注金额计算百家乐的结果
func CheckBaccaratResult(transactionAmount decimal.Decimal, blockHash string) (string, string, decimal.Decimal) {
	// 根据转账金额的个位数确定投注类型
	betType := determineBetType(int(transactionAmount.IntPart()) % 10)

	blockHashTail, ok := hashTail(blockHash, 5)
	if !ok {
		return "invalid", "lose", decimal.Zero
	}
	// fmt.Printf("区块哈希最后五位: %s\n", blockHashTail)

	// 从区块哈希获取庄家和闲家的点数
	bankerPoints := calculatePoints(blockHashTail[:2]) // 前两位为庄家的点数
	playerPoints := calculatePoints(blockHashTail[3:]) // 后两位为闲家的点数

	// 确定游戏开奖结果
	var gameResult string
	if bankerPoints > playerPoints {
		gameResult = "庄"
	} else if bankerPoints < playerPoints {
		gameResult = "闲"
	} else {
		gameResult = "和"
	}

	// 计算用户输赢和金额
	finalAmount, userResult := calculateWinnings(transactionAmount, betType, gameResult, bankerPoints, playerPoints)

	// 返回顺序：
	// 1. 游戏开奖结果（"庄胜"、"闲胜"、"和"）
	// 2. 用户输赢结果（"用户赢"、"用户输"、"和局退回本金"）
	// 3. 用户输赢后的金额
	return gameResult, userResult, finalAmount
}

// 根据金额个位数判定押注类型(百家乐,幸运庄闲)
func determineBetType(lastDigit int) string {
	if lastDigit == 8 || lastDigit == 9 {
		return "和"
	} else if lastDigit%2 == 0 {
		return "庄"
	}
	return "闲"
}

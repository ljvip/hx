package game

import "github.com/shopspring/decimal"

// 幸运庄闲游戏判定
func CheckLuckyBanker(transactionAmount decimal.Decimal, blockHash string) (string, string, decimal.Decimal) {
	blockHashTail, ok := hashTail(blockHash, 5)
	if !ok {
		return "invalid", "lose", decimal.Zero
	}

	// 提取庄家、闲家字符
	banker := blockHashTail[:2] // 前两位为庄家
	player := blockHashTail[3:] // 后两位为闲家

	// 计算点数
	bankerPoints := calculatePoints(banker)
	playerPoints := calculatePoints(player)

	// 判断用户押注类型
	betType := determineBetType(int(transactionAmount.IntPart()) % 10)

	// 计算胜负
	var winner string
	if bankerPoints > playerPoints {
		winner = "庄"
	} else if bankerPoints < playerPoints {
		winner = "闲"
	} else {
		winner = "和"
	}

	// 计算用户输赢
	var payout decimal.Decimal
	var userResult string

	if betType == winner {
		switch betType {
		case "庄", "闲":
			payout = transactionAmount.Mul(decimal.NewFromFloat(1.98))
		case "和":
			payout = transactionAmount.Mul(decimal.NewFromFloat(7.5))
		}
		userResult = "win"
	} else {
		userResult = "lose"
		payout = decimal.Zero
	}

	// 如果押庄或闲且是同点情况
	if (betType == "庄" || betType == "闲") && winner == "和" {
		if (playerPoints)%2 == 1 {
			userResult = "win"
			payout = transactionAmount.Mul(decimal.NewFromFloat(1.98))
		} else {
			userResult = "lose"
			payout = decimal.Zero
		}
	}

	return winner, userResult, payout
}

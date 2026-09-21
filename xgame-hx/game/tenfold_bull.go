package game

import "github.com/shopspring/decimal"

import (
// "fmt"
)

// 判断十倍牛牛的结果
func CheckTenfoldBull(transactionAmount decimal.Decimal, blockHash string) (string, string, decimal.Decimal) {
	blockHashTail, ok := hashTail(blockHash, 5)
	if !ok {
		return "invalid", "lose", decimal.Zero
	}
	// fmt.Printf("区块哈希最后五位: %s\n", blockHashTail)

	// 分别获取庄、闲的字符
	banker := blockHashTail[:3]
	player := blockHashTail[2:]

	// 计算庄和闲的点数
	bankerPoints := calculateNiuNiuPoints(banker)
	playerPoints := calculateNiuNiuPoints(player)

	// fmt.Println("庄家bankerTotal :", bankerPoints)
	// fmt.Println("闲家playerTotal :", playerPoints)

	// 计算点数比大小
	var winner string
	if bankerPoints > playerPoints {
		winner = "庄"
	} else if bankerPoints < playerPoints {
		winner = "闲"
	} else {
		// 点数相等，判断单双
		if (bankerPoints)%2 == 1 {
			winner = "闲"
		} else {
			winner = "庄"
		}
	}

	// 计算用户实际参与游戏的金额（1/10）
	gameAmount := transactionAmount.Div(decimal.NewFromInt(10))

	// 计算倍数
	var multiplier decimal.Decimal
	if playerPoints == 10 {
		multiplier = decimal.NewFromInt(10)
	} else {
		multiplier = decimal.NewFromInt(int64(playerPoints))
	}

	// 计算最终用户输赢金额
	var finalAmount decimal.Decimal
	var userResult string

	if winner == "闲" {
		// 用户赢，赢取 gameAmount * 闲家点数，并扣除 2% 手续费
		userResult = "win"
		finalAmount = transactionAmount.Add(gameAmount.Mul(multiplier).Mul(decimal.NewFromFloat(0.98)))
	} else {
		// 用户输，损失 gameAmount * 庄家点数
		userResult = "lose"
		finalAmount = transactionAmount.Sub(gameAmount.Mul(decimal.NewFromInt(int64(bankerPoints))))
		if finalAmount.IsNegative() {
			finalAmount = decimal.Zero // 避免负数
		}
	}

	// 结果返回
	return winner, userResult, finalAmount
}

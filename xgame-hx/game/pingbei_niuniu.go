package game

import "github.com/shopspring/decimal"

// import "fmt"

// "unicode"

// 根据区块哈希和投注金额计算平倍牛牛的结果
func CheckPingbeiNiuNiu(transactionAmount decimal.Decimal, blockHash string) (string, string, decimal.Decimal) {
	blockHashTail, ok := hashTail(blockHash, 5)
	if !ok {
		return "invalid", "lose", decimal.Zero
	}

	// 分别获取庄、闲的字符
	bankerPoints := blockHashTail[:3]
	playerPoints := blockHashTail[2:]

	// // 计算总点数
	bankerTotal := calculateNiuNiuPoints(bankerPoints)
	playerTotal := calculateNiuNiuPoints(playerPoints)

	// fmt.Println("庄家bankerTotal :", bankerTotal)
	// fmt.Println("闲家playerTotal :", playerTotal)
	// 确定游戏开奖结果
	var gameResult string
	if bankerTotal > playerTotal {
		gameResult = "庄"
	} else if bankerTotal < playerTotal {
		gameResult = "闲"
	} else {
		// 同点情况：单数闲赢，双数庄赢
		if (playerTotal)%2 == 1 {
			gameResult = "闲"
		} else {
			gameResult = "庄"
		}
	}

	// 赔率 1:1.95
	odds := 1.95
	var finalAmount decimal.Decimal
	var userResult string

	if gameResult == "闲" {
		finalAmount = transactionAmount.Mul(decimal.NewFromFloat(odds))
		userResult = "win"
	} else {
		finalAmount = decimal.Zero
		userResult = "lose"
	}

	// 返回游戏结果，用户输赢情况，用户最终金额
	return gameResult, userResult, finalAmount
}

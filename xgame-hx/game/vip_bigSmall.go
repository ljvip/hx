package game

import (
	"github.com/shopspring/decimal"
)

// 判断哈希VIP大小游戏结果
func VipBigSmall(transactionAmount decimal.Decimal, blockHash string) (string, string, decimal.Decimal) {
	// 获取转账金额的个位数
	lastDigit := int(transactionAmount.IntPart() % 10)

	// 获取区块哈希的最后一个有效数字
	hashDigit, isSpecialFormat := getHashtree(blockHash)

	// 确定游戏开奖结果（大/小）
	var gameResult string
	if hashDigit >= 5 {
		gameResult = "大"
	} else {
		gameResult = "小"
	}

	// 判断用户输赢
	userResult := "lose"
	finalAmount := decimal.Zero
	if (lastDigit <= 4 && hashDigit <= 4) || (lastDigit >= 5 && hashDigit >= 5) {
		userResult = "win"
		if isSpecialFormat {
			finalAmount = transactionAmount.Mul(decimal.NewFromFloat(0.85)) // 特殊格式，赔率为 0.8
		} else {
			finalAmount = transactionAmount.Mul(decimal.NewFromFloat(1.95)) // 正常赔率
		}
	}

	return gameResult, userResult, finalAmount
}

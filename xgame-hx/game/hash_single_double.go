package game

import "github.com/shopspring/decimal"

// 判断哈希单双游戏结果
func CheckHashSingleDouble(transactionAmount decimal.Decimal, blockHash string) (string, string, decimal.Decimal) {
	// 获取转账金额的个位数
	lastDigit := int(transactionAmount.IntPart() % 10)

	// 获取区块哈希的最后一个有效数字
	hashDigit := getHashLastDigit(blockHash)

	// 确定游戏开奖结果（单/双）
	var gameResult string
	if hashDigit%2 == 0 {
		gameResult = "双"
	} else {
		gameResult = "单"
	}

	// 判断用户输赢
	userResult := "lose"
	finalAmount := decimal.Zero
	if lastDigit%2 == hashDigit%2 {
		userResult = "win"
		finalAmount = transactionAmount.Mul(decimal.NewFromFloat(1.95)) // 假设赔率 1:1.95
	}

	// 返回 1. 游戏结果（"单"/"双"） 2. 用户输赢（"win"/"lose"） 3. 用户输赢后的金额
	return gameResult, userResult, finalAmount
}

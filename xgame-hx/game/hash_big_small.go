package game

import (
	"github.com/shopspring/decimal"
)

// 判断哈希大小游戏结果
func CheckHashBigSmall(transactionAmount decimal.Decimal, blockHash string) (string, string, decimal.Decimal) {
	// 获取转账金额的个位数
	lastDigit := int(transactionAmount.IntPart() % 10)

	// 获取区块哈希的最后一个有效数字
	hashDigit := getHashLastDigit(blockHash)

	// 确定游戏开奖结果
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
		finalAmount = transactionAmount.Mul(decimal.NewFromFloat(1.95)) // 假设赔率 1:1.95
	}

	// 返回 1. 游戏结果（"大"/"小"） 2. 用户输赢（"win"/"lose"） 3. 用户输赢后的金额
	return gameResult, userResult, finalAmount
}

// 获取区块哈希的最后一个数字（如果是字母，继续往前查找）
func getHashLastDigit(hash string) int {
	for i := len(hash) - 1; i >= 0; i-- {
		ch := hash[i]
		if ch >= '0' && ch <= '9' {
			return int(ch - '0')
		}
	}
	return 0
}

package game

import "unicode"

func hashTail(blockHash string, n int) (string, bool) {
	if n <= 0 || len(blockHash) < n {
		return "", false
	}
	return blockHash[len(blockHash)-n:], true
}

// 计算(百家乐,幸运庄闲)的点数（字母按0计算）（字符相加，9 点最大，0 点最小）
func calculatePoints(value string) int {
	points := 0
	for _, char := range value {
		if unicode.IsDigit(char) {
			points += int(char - '0')
		}
	}
	// 只取个位数
	return points % 10
}

// 计算牛牛的点数（字母按0计算）（字符相加，0 (10)点最大，1 点最小）
func calculateNiuNiuPoints(value string) int {
	points := 0
	for _, char := range value {
		if unicode.IsDigit(char) {
			points += int(char - '0')
		}
	}
	// 只取个位数，0 点最大（10）
	if points%10 == 0 {
		return 10
	}
	return points % 10
}

// 获取区块哈希VIP游戏结果判断是否为特殊格式（数字+字母+字母）
func getHashtree(blockHash string) (int, bool) {
	n := len(blockHash)
	if n < 3 {
		return 0, false
	}

	thirdLast := rune(blockHash[n-3])  // 数字
	secondLast := rune(blockHash[n-2]) // 字母
	last := rune(blockHash[n-1])       // 字母

	isSpecial := unicode.IsDigit(thirdLast) && unicode.IsLetter(secondLast) && unicode.IsLetter(last)

	// 获取尾部的数字字符（无论是否特殊格式，都返回这个数字）
	for i := n - 1; i >= 0; i-- {
		if unicode.IsDigit(rune(blockHash[i])) {
			return int(blockHash[i] - '0'), isSpecial
		}
	}

	return 0, isSpecial
}

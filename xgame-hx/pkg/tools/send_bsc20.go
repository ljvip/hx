package tools

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// TransferUSDT 转账 USDT（使用全局配置）
// 参数：
//
//	toAddress: 接收方地址（十六进制字符串）
//	amountStr: 金额字符串，例如 "1.95", "10", "0.5"
//
// 返回：交易哈希和错误
func TransferUSDT(toAddress, amountStr string) (string, error) {
	if err := ensureBscConfig(); err != nil {
		return "", err
	}

	privateKey, err := crypto.HexToECDSA(bscPrivateKey)
	if err != nil {
		return "", fmt.Errorf("解析私钥失败: %v", err)
	}

	// 2. 连接到 BSC 节点
	client, err := ethclient.Dial(bscRPCURL)
	if err != nil {
		return "", fmt.Errorf("连接 RPC 节点失败: %v", err)
	}
	defer client.Close()

	// 3. 获取发送方地址
	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return "", fmt.Errorf("获取公钥失败")
	}
	fromAddress := crypto.PubkeyToAddress(*publicKeyECDSA)
	fmt.Printf("发送方地址: %s\n", fromAddress.Hex())

	// 4. 转换地址格式
	toAddr := common.HexToAddress(toAddress)
	contractAddr := common.HexToAddress(bscUSDTAddress)

	// 5. 将金额字符串转换为 Wei
	amountWei, err := amountToWei(amountStr, 18)
	if err != nil {
		return "", fmt.Errorf("金额转换失败: %v", err)
	}
	fmt.Printf("转账金额: %s Wei\n", amountWei.String())

	// 6. 获取 Nonce
	nonce, err := client.PendingNonceAt(context.Background(), fromAddress)
	if err != nil {
		return "", fmt.Errorf("获取 Nonce 失败: %v", err)
	}
	fmt.Printf("当前 Nonce: %d\n", nonce)

	// 7. 构造 transfer 方法的调用数据
	callData, err := packTransferData(toAddr, amountWei)
	if err != nil {
		return "", fmt.Errorf("打包调用数据失败: %v", err)
	}

	// 8. 估算 Gas 限制
	gasLimit, err := client.EstimateGas(context.Background(), ethereum.CallMsg{
		From:  fromAddress,
		To:    &contractAddr,
		Data:  callData,
		Value: big.NewInt(0),
	})
	if err != nil {
		return "", fmt.Errorf("估算 Gas 失败: %v", err)
	}
	// 增加 10% 的 Gas 余量
	gasLimit = uint64(float64(gasLimit) * 1.1)
	fmt.Printf("估算 Gas 限制: %d\n", gasLimit)

	// 9. 获取建议 Gas 价格
	gasPrice, err := client.SuggestGasPrice(context.Background())
	if err != nil {
		return "", fmt.Errorf("获取 Gas 价格失败: %v", err)
	}
	fmt.Printf("当前 Gas 价格: %d Wei\n", gasPrice)

	// 10. 构造交易
	tx := types.NewTransaction(
		nonce,
		contractAddr,
		big.NewInt(0),
		gasLimit,
		gasPrice,
		callData,
	)

	// 11. 获取链 ID
	chainID, err := client.ChainID(context.Background())
	if err != nil {
		return "", fmt.Errorf("获取 Chain ID 失败: %v", err)
	}
	fmt.Printf("Chain ID: %s\n", chainID.String())

	// 12. 签名交易
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), privateKey)
	if err != nil {
		return "", fmt.Errorf("签名交易失败: %v", err)
	}

	// 13. 发送交易
	err = client.SendTransaction(context.Background(), signedTx)
	if err != nil {
		return "", fmt.Errorf("发送交易失败: %v", err)
	}

	txHash := signedTx.Hash().Hex()
	fmt.Printf("交易已发送! 交易哈希: %s\n", txHash)

	return txHash, nil
}

// packTransferData 打包 ERC-20 transfer 方法调用数据
func packTransferData(toAddress common.Address, amount *big.Int) ([]byte, error) {
	erc20ABI, err := abi.JSON(strings.NewReader(`[{"constant":false,"inputs":[{"name":"recipient","type":"address"},{"name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]`))
	if err != nil {
		return nil, err
	}
	return erc20ABI.Pack("transfer", toAddress, amount)
}

// amountToWei 将金额字符串转换为 Wei（支持小数）
// 例如: "1.95" -> 1950000000000000000
func amountToWei(amountStr string, decimals int) (*big.Int, error) {
	parts := strings.Split(amountStr, ".")
	if len(parts) > 2 {
		return nil, fmt.Errorf("无效的金额格式: %s", amountStr)
	}

	integerPart := parts[0]
	decimalPart := ""
	if len(parts) == 2 {
		decimalPart = parts[1]
	}

	// 补齐或截断小数部分到指定精度
	if len(decimalPart) > decimals {
		decimalPart = decimalPart[:decimals]
	} else {
		decimalPart = decimalPart + strings.Repeat("0", decimals-len(decimalPart))
	}

	fullNumberStr := integerPart + decimalPart
	if fullNumberStr == "" || fullNumberStr == "0" {
		return big.NewInt(0), nil
	}

	result := new(big.Int)
	_, ok := result.SetString(fullNumberStr, 10)
	if !ok {
		return nil, fmt.Errorf("解析金额失败: %s", fullNumberStr)
	}
	return result, nil
}

// // main 示例调用
// func main() {
// 	// 只传递接收方地址和金额即可
// 	toAddress := "0xRecipientAddressHere"
// 	amount := "1.95" // 转账 1.95 个 USDT

// 	txHash, err := TransferUSDT(toAddress, amount)
// 	if err != nil {
// 		log.Fatalf("转账失败: %v", err)
// 	}
// 	fmt.Printf("转账成功！交易哈希: %s\n", txHash)
// }

// .evn
// # BSC 节点 RPC 地址
// BSC_RPC_URL=https://bsc-dataseed.binance.org/

// # 发送方私钥（不带 0x 前缀）
// BSC_PRIVATE_KEY=your_private_key_hex_without_0x_prefix

// # USDT 合约地址（BSC 主网）
// BSC_USDT_CONTRACT=0x55d398326f99059fF775485246999027B3197955

// # 可选：链 ID（BSC 主网为 56）
// BSC_CHAIN_ID=56

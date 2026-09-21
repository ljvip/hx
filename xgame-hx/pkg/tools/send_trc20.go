package tools

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/fbsobreira/gotron-sdk/pkg/address"
)

// Base58 地址 → 64位 Hex 字符串（带前缀41，填充至32字节）
func Base58ToPaddedHex(base58Addr string) (string, error) {
	addr, err := address.Base58ToAddress(base58Addr)
	if err != nil {
		return "", fmt.Errorf("地址转换失败: %v", err)
	}
	hexStr := addr.Hex() // 0x41xxxx...

	// 去掉 0x 前缀
	hexStr = strings.TrimPrefix(hexStr, "0x")

	// 左侧补0，使长度为64
	if len(hexStr) > 64 {
		return "", fmt.Errorf("地址Hex长度超出64字符: %d", len(hexStr))
	}
	padded := strings.Repeat("0", 64-len(hexStr)) + hexStr
	return padded, nil
}

// 将金额（单位USDT）转换为64位十六进制（TRC20使用6位精度）
func AmountToHex(amount string) (string, error) {
	val, ok := new(big.Float).SetString(amount)
	if !ok {
		return "", fmt.Errorf("无效金额: %s", amount)
	}
	// 乘以 10^6 转为整数
	scale := new(big.Float).SetFloat64(1_000_000)
	val.Mul(val, scale)

	// 转为整数再转为16进制
	intVal := new(big.Int)
	val.Int(intVal)
	return fmt.Sprintf("%064x", intVal), nil
}

// SendTRC20Token 发送 TRC20 USDT 转账
// 参数：
//
//	toAddress: 接收方地址（Base58 格式）
//	amount: 转账金额（字符串，如 "10.5"）
//
// 返回：交易ID和错误
func SendTRC20Token(toAddress, amount string) (string, error) {
	if err := ensureTronUSDTConfig(); err != nil {
		return "", err
	}

	if toAddress == "" {
		return "", fmt.Errorf("接收方地址不能为空")
	}

	// 检查是否向自己转账
	if toAddress == tronFromAddress {
		return "", fmt.Errorf("❌ 不能向自己转账，请使用不同的接收方地址")
	}

	if amount == "" {
		return "", fmt.Errorf("金额不能为空")
	}

	// 转换地址
	toHex, err := Base58ToPaddedHex(toAddress)
	if err != nil {
		return "", err
	}

	// 转换金额
	amountHex, err := AmountToHex(amount)
	if err != nil {
		return "", err
	}

	// 构造参数
	parameter := toHex + amountHex

	fmt.Println("\n=== 📝 转账信息 ===")
	fmt.Printf("📤 发送方: %s\n", tronFromAddress)
	fmt.Printf("📥 接收方: %s\n", toAddress)
	fmt.Printf("💰 金额: %s USDT\n", amount)
	fmt.Printf("🔗 合约: %s\n", trc20Contract)
	fmt.Println("=== 📦 构造调用参数 ===")
	fmt.Println("toHex:", toHex)
	fmt.Println("amountHex:", amountHex)
	fmt.Println("parameter:", parameter)

	// 构造请求
	url := tronRPCURL + "/wallet/triggersmartcontract"
	body := map[string]interface{}{
		"owner_address":     tronFromAddress,
		"contract_address":  trc20Contract,
		"function_selector": "transfer(address,uint256)",
		"parameter":         parameter,
		"fee_limit":         1000000000, // 10 TRX 手续费上限
		"call_value":        0,
		"visible":           true,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("编码JSON失败: %v", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("创建HTTP请求失败: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("API请求失败: %v", err)
	}
	defer resp.Body.Close()

	resBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %v", err)
	}

	// 解析响应
	var respObj struct {
		Result      map[string]bool `json:"result"`
		Transaction struct {
			TxID       string                 `json:"txID"`
			RawData    map[string]interface{} `json:"raw_data"`
			RawDataHex string                 `json:"raw_data_hex"`
			Visible    bool                   `json:"visible"`
		} `json:"transaction"`
		Error string `json:"Error"`
	}

	if err := json.Unmarshal(resBody, &respObj); err != nil {
		return "", fmt.Errorf("解析返回失败: %v\n原始响应: %s", err, string(resBody))
	}

	if respObj.Error != "" {
		return "", fmt.Errorf("错误响应: %s", respObj.Error)
	}

	if respObj.Transaction.TxID == "" {
		return "", fmt.Errorf("未获取到交易ID, 原始响应: %s", string(resBody))
	}

	// 签名交易
	rawDataBytes, err := hex.DecodeString(respObj.Transaction.RawDataHex)
	if err != nil {
		return "", fmt.Errorf("解码 RawDataHex 失败: %v", err)
	}

	hash := sha256.Sum256(rawDataBytes)
	privateKey, err := crypto.HexToECDSA(tronPrivateKey)
	if err != nil {
		return "", fmt.Errorf("私钥格式错误: %v", err)
	}

	signature, err := crypto.Sign(hash[:], privateKey)
	if err != nil {
		return "", fmt.Errorf("签名失败: %v", err)
	}

	// 广播交易
	broadcastUrl := tronRPCURL + "/wallet/broadcasttransaction"
	txSigned := map[string]interface{}{
		"txID":      respObj.Transaction.TxID,
		"raw_data":  respObj.Transaction.RawData,
		"signature": []string{hex.EncodeToString(signature)},
		"visible":   respObj.Transaction.Visible,
	}

	broadcastBody, err := json.Marshal(txSigned)
	if err != nil {
		return "", fmt.Errorf("构造广播请求体失败: %v", err)
	}

	req2, err := http.NewRequest("POST", broadcastUrl, bytes.NewBuffer(broadcastBody))
	if err != nil {
		return "", fmt.Errorf("创建广播请求失败: %v", err)
	}
	req2.Header.Set("Content-Type", "application/json")

	resp2, err := client.Do(req2)
	if err != nil {
		return "", fmt.Errorf("广播请求失败: %v", err)
	}
	defer resp2.Body.Close()

	broadcastResp, err := ioutil.ReadAll(resp2.Body)
	if err != nil {
		return "", fmt.Errorf("读取广播响应失败: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(broadcastResp, &result); err != nil {
		return "", fmt.Errorf("解析广播响应失败: %v", err)
	}

	if success, ok := result["result"].(bool); !ok || !success {
		return "", fmt.Errorf("广播失败: %s", string(broadcastResp))
	}

	fmt.Printf("\n✅ 交易已广播，交易ID: %s\n", respObj.Transaction.TxID)
	fmt.Printf("🔗 查看交易: https://tronscan.org/#/transaction/%s\n", respObj.Transaction.TxID)
	return respObj.Transaction.TxID, nil
}

// waitForTransactionSuccess 等待交易确认
func waitForTransactionSuccess(txID string) (bool, error) {
	url := fmt.Sprintf("%s/wallet/gettransactioninfobyid?value=%s", tronRPCURL, txID)
	client := &http.Client{Timeout: 10 * time.Second}

	for i := 0; i < 15; i++ { // 最多查15次，每次间隔2秒
		resp, err := client.Get(url)
		if err != nil {
			fmt.Printf("  ⚠️ 查询交易状态失败 (尝试 %d/15): %v\n", i+1, err)
			time.Sleep(2 * time.Second)
			continue
		}

		body, err := ioutil.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			fmt.Printf("  ⚠️ 读取响应失败 (尝试 %d/15): %v\n", i+1, err)
			time.Sleep(2 * time.Second)
			continue
		}

		var result struct {
			Receipt struct {
				Result string `json:"result"`
			} `json:"receipt"`
		}

		if err := json.Unmarshal(body, &result); err != nil {
			fmt.Printf("  ⚠️ 解析响应失败 (尝试 %d/15): %v\n", i+1, err)
			time.Sleep(2 * time.Second)
			continue
		}

		if result.Receipt.Result == "SUCCESS" {
			fmt.Printf("  ✅ 交易确认成功 (尝试 %d/15)\n", i+1)
			return true, nil
		}

		if result.Receipt.Result == "FAILED" {
			fmt.Printf("  ❌ 交易执行失败 (尝试 %d/15)\n", i+1)
			return false, nil
		}

		fmt.Printf("  ⏳ 等待确认中... (尝试 %d/15)\n", i+1)
		time.Sleep(2 * time.Second)
	}

	return false, fmt.Errorf("交易状态查询超时")
}

// // main 示例调用
// func main() {
// 	// 只传递接收方地址和金额
// 	toAddress := "TGLhm7CRjSwCs7uH63T4N8wxyYdW6WSr7s" // 接收方地址
// 	amount := "10.000001"                           // 转账金额（USDT）

// 	// 检查地址是否相同
// 	if toAddress == tronFromAddress {
// 		log.Fatal("❌ 错误：接收方地址不能与发送方地址相同")
// 	}

// 	txID, err := SendTRC20Token(toAddress, amount)
// 	if err != nil {
// 		log.Fatalf("❌ 转账失败: %v", err)
// 	}

// 	fmt.Printf("\n✅ 转账完成！交易ID: %s\n", txID)
// }

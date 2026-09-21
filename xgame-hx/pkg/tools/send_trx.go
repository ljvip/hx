package tools

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/shopspring/decimal"
	"io/ioutil"
	"net/http"

	"github.com/ethereum/go-ethereum/crypto"
)

// SendTrx 发送 TRX 转账
// 参数：
//
//	to: 接收方地址（Base58 格式）
//	amountSun: 转账金额（单位：SUN，1 TRX = 1,000,000 SUN）
//
// 返回：交易ID和错误
func SendTrx(to string, amountSun int64) (string, error) {
	if err := ensureTronConfig(); err != nil {
		return "", err
	}

	if to == "" {
		return "", fmt.Errorf("接收方地址不能为空")
	}
	if amountSun <= 0 {
		return "", fmt.Errorf("转账金额必须大于 0 SUN")
	}

	fmt.Printf("\n📤 发送方地址: %s\n", tronFromAddress)
	fmt.Printf("📥 接收方地址: %s\n", to)
	fmt.Printf("💰 转账金额: %d SUN (%s TRX)\n", amountSun, decimal.NewFromInt(amountSun).Div(decimal.NewFromInt(1_000_000)))

	// 1. 构造转账交易请求
	url := tronRPCURL + "/wallet/createtransaction"
	requestBody := map[string]interface{}{
		"owner_address": tronFromAddress,
		"to_address":    to,
		"amount":        amountSun,
		"visible":       true, // 必须设为 true 才能用 Base58 地址
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("JSON编码失败: %v", err)
	}

	// 2. 发送请求获取未签名交易
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("创建HTTP请求失败: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("API请求失败: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		return "", fmt.Errorf("API返回错误状态码: %d, 响应: %s", resp.StatusCode, string(body))
	}

	resBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应体失败: %v", err)
	}

	// 3. 解析响应
	var tx struct {
		TxID       string                 `json:"txID"`
		RawData    map[string]interface{} `json:"raw_data"`
		RawDataHex string                 `json:"raw_data_hex"`
		Visible    bool                   `json:"visible"`
		Error      string                 `json:"Error"`
	}

	if err := json.Unmarshal(resBody, &tx); err != nil {
		return "", fmt.Errorf("解析响应失败: %v, 原始响应: %s", err, string(resBody))
	}

	if tx.Error != "" {
		return "", fmt.Errorf("TRON节点返回错误: %s", tx.Error)
	}

	if tx.TxID == "" {
		return "", fmt.Errorf("未获取到交易ID, 原始响应: %s", string(resBody))
	}

	fmt.Printf("📝 交易ID: %s\n", tx.TxID)

	// 4. 签名交易
	privateKey, err := crypto.HexToECDSA(tronPrivateKey)
	if err != nil {
		return "", fmt.Errorf("私钥格式错误: %v", err)
	}

	rawDataBytes, err := hex.DecodeString(tx.RawDataHex)
	if err != nil {
		return "", fmt.Errorf("解码raw_data_hex失败: %v", err)
	}

	hash := sha256.Sum256(rawDataBytes)
	signature, err := crypto.Sign(hash[:], privateKey)
	if err != nil {
		return "", fmt.Errorf("签名失败: %v", err)
	}

	// 5. 构造广播请求
	broadcastUrl := tronRPCURL + "/wallet/broadcasttransaction"
	txSigned := map[string]interface{}{
		"txID":      tx.TxID,
		"raw_data":  tx.RawData,
		"signature": []string{hex.EncodeToString(signature)},
		"visible":   tx.Visible,
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

	if resp2.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp2.Body)
		return "", fmt.Errorf("广播API返回错误状态码: %d, 响应: %s", resp2.StatusCode, string(body))
	}

	respData, err := ioutil.ReadAll(resp2.Body)
	if err != nil {
		return "", fmt.Errorf("读取广播响应失败: %v", err)
	}

	// 6. 检查广播结果
	var broadcastResult struct {
		Result  bool   `json:"result"`
		Txid    string `json:"txid"`
		Code    string `json:"code"`
		Message string `json:"message"`
	}

	if err := json.Unmarshal(respData, &broadcastResult); err != nil {
		return "", fmt.Errorf("解析广播响应失败: %v, 原始响应: %s", err, string(respData))
	}

	if !broadcastResult.Result {
		return "", fmt.Errorf("广播失败: code=%s, message=%s", broadcastResult.Code, broadcastResult.Message)
	}

	fmt.Printf("\n✅ TRX 转账交易成功发送!\n")
	fmt.Printf("🔗 查看交易: https://tronscan.org/#/transaction/%s\n", tx.TxID)
	return tx.TxID, nil
}

// // main 示例调用
// func main() {
// 	// 只传递接收方地址和金额
// 	toAddress := "TGLhm7CRjSwCs7uH63T4N8wxyYdW6WSr7s"
// 	amount := int64(1_000_000) // 1 TRX

// 	txID, err := SendTrx(toAddress, amount)
// 	if err != nil {
// 		log.Fatalf("❌ 转账失败: %v", err)
// 	}

// 	fmt.Printf("✅ 转账交易发送成功！交易ID: %s\n", txID)
// }

package websocket

import (
	"encoding/json"
	"github.com/shopspring/decimal"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var (
	clients  = make(map[*Client]bool) // 改为存储 Client
	mu       sync.RWMutex
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}
)

// Client 包装 WebSocket 连接，添加写锁
type Client struct {
	Conn *websocket.Conn
	Mu   sync.Mutex // 保护这个连接的写入操作
}

// WriteMessage 线程安全的写消息
func (c *Client) WriteMessage(messageType int, data []byte) error {
	c.Mu.Lock()
	defer c.Mu.Unlock()

	// 设置写超时
	c.Conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	defer c.Conn.SetWriteDeadline(time.Time{})

	return c.Conn.WriteMessage(messageType, data)
}

// WriteJSON 线程安全的写 JSON
func (c *Client) WriteJSON(v interface{}) error {
	c.Mu.Lock()
	defer c.Mu.Unlock()

	c.Conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	defer c.Conn.SetWriteDeadline(time.Time{})

	return c.Conn.WriteJSON(v)
}

// Close 安全关闭连接
func (c *Client) Close() error {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	return c.Conn.Close()
}

// BetResult 投注结果结构体
type BetResult struct {
	OwnerAddress      string          `json:"owner_address"`
	BlockNumber       int64           `json:"block_number"`
	BlockHash         string          `json:"block_hash"`
	GameName          string          `json:"game_name"`
	TransactionAmount decimal.Decimal `json:"transaction_amount"`
	TokenSymbol       string          `json:"token_symbol"`
	TxID              string          `json:"tx_id"`
	GameResult        string          `json:"game_result"`
	UserResult        string          `json:"user_result"`
	FinalAmount       decimal.Decimal `json:"final_amount"`
	Timestamp         int64           `json:"timestamp"`
}

// HandleConnections 处理 WebSocket 连接
func HandleConnections(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WebSocket] ❌ 升级失败: %v", err)
		return
	}

	client := &Client{Conn: conn}

	// 添加到客户端池
	mu.Lock()
	clients[client] = true
	mu.Unlock()

	log.Printf("[WebSocket] ✅ 新客户端连接，当前连接数: %d", len(clients))

	// 发送欢迎消息（使用线程安全的方法）
	welcomeMsg := map[string]interface{}{
		"type":      "welcome",
		"message":   "连接成功",
		"timestamp": time.Now().Unix(),
	}
	if err := client.WriteJSON(welcomeMsg); err != nil {
		log.Printf("[WebSocket] 发送欢迎消息失败: %v", err)
	}

	// 持续读取客户端消息
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			log.Printf("[WebSocket] 客户端断开: %v", err)
			mu.Lock()
			delete(clients, client)
			mu.Unlock()
			log.Printf("[WebSocket] 当前连接数: %d", len(clients))
			break
		}
	}
}

func tailOrAll(s string, n int) string {
	if n <= 0 || len(s) <= n {
		return s
	}
	return s[len(s)-n:]
}

// BroadcastBetResult 广播投注结果给所有客户端
func BroadcastBetResult(betResult BetResult) {
	mu.RLock()
	clientCount := len(clients)
	// 复制客户端列表，避免长时间持有锁
	clientList := make([]*Client, 0, clientCount)
	for client := range clients {
		clientList = append(clientList, client)
	}
	mu.RUnlock()

	if clientCount == 0 {
		log.Printf("[WebSocket] ⚠️ 没有客户端连接，跳过广播")
		return
	}

	log.Printf("[WebSocket] 🎲 广播投注 - TxID: %s, 用户: %s, 金额: %s %s",
		tailOrAll(betResult.TxID, 8),
		tailOrAll(betResult.OwnerAddress, 8),
		betResult.TransactionAmount,
		betResult.TokenSymbol)

	message := map[string]interface{}{
		"type": "betResults",
		"data": betResult,
	}

	jsonMessage, err := json.Marshal(message)
	if err != nil {
		log.Printf("[WebSocket] ❌ JSON序列化失败: %v", err)
		return
	}

	successCount := 0
	failCount := 0

	// 并发发送（可选，可以提高性能）
	var wg sync.WaitGroup
	for _, client := range clientList {
		wg.Add(1)
		go func(c *Client) {
			defer wg.Done()
			if err := c.WriteMessage(websocket.TextMessage, jsonMessage); err != nil {
				log.Printf("[WebSocket] ⚠️ 发送失败: %v", err)
				// 发送失败，移除客户端
				mu.Lock()
				delete(clients, c)
				mu.Unlock()
				failCount++
			} else {
				successCount++
			}
		}(client)
	}
	wg.Wait()

	log.Printf("[WebSocket] 📊 广播完成 - 成功: %d, 失败: %d, 总计: %d",
		successCount, failCount, clientCount)
}

// GetStats 获取连接统计
func GetStats() map[string]interface{} {
	mu.RLock()
	defer mu.RUnlock()

	return map[string]interface{}{
		"total_connections": len(clients),
		"timestamp":         time.Now().Format("2006-01-02 15:04:05"),
	}
}

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"game-hx/listener"
	// "game-hx/pkg/config"
	"game-hx/pkg/database"
	"game-hx/pkg/router"

	"github.com/gin-gonic/gin"
)

func main() {
	fmt.Println("程序开始执行")

	// 初始化数据库
	database.InitDB()
	fmt.Println("数据库初始化成功")

	// // 初始化配置
	// cfg, err := config.LoadConfig("cmd/config.json")
	// if err != nil {
	// 	log.Fatal("Error loading config:", err)
	// }
	// fmt.Println("配置加载成功")

	// 启动 Tron 区块监听
	go listener.StartMonitoring()
	fmt.Println("Tron 区块监听已启动")

	// 启动 BSC 监听器
	go listener.StartBSCListener()
	fmt.Println("BSC 监听器已启动")

	// 创建 Gin 引擎
	r := gin.Default()

	// 配置路由
	router.Setup(r)
	fmt.Println("路由配置成功")

	fmt.Println("✅ WebSocket 路径: ws://localhost:8088/wss")
	fmt.Println("✅ HTTP API 端口: 8088")

	// 创建 HTTP 服务器
	httpPort := ":8088"
	srv := &http.Server{
		Addr:    httpPort,
		Handler: r,
	}

	// 启动 HTTP 服务器（在 goroutine 中）
	go func() {
		fmt.Println("准备启动 HTTP 服务器，监听端口", httpPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP 服务器启动失败: %v", err)
		}
	}()

	// ========== 优雅关闭 ==========
	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println("\n📢 收到退出信号，正在关闭服务器...")

	// 设置关闭超时时间
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	// 关闭 HTTP 服务器
	fmt.Println("正在关闭 HTTP 服务器...")
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP 服务器关闭失败: %v", err)
	}

	// 给监听器一些时间完成清理
	time.Sleep(1 * time.Second)
	fmt.Println("✅ 程序已安全退出")
}

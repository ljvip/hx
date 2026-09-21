package config

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"game-hx/internal/repository"
	"game-hx/pkg/database"
)

type Config struct {
	UsdtContractAddress string            `json:"usdt_contract_address"`
	TronAPIKey          string            `json:"tron_api_key"`
	MonitorAddresses    map[string]string `json:"-"`
}

func LoadConfig(configPath string) (*Config, error) {
	fmt.Printf("🔵 开始加载配置文件: %s\n", configPath)

	file, err := os.Open(configPath)
	if err != nil {
		return nil, fmt.Errorf("❌ 打开配置文件失败: %w", err)
	}
	defer file.Close()

	var cfg Config
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&cfg); err != nil {
		return nil, fmt.Errorf("❌ 解码配置文件失败: %w", err)
	}

	// 确保数据库已初始化
	if database.GetDB() == nil {
		database.InitDB()
	}

	// 加载地址配置
	if err := cfg.loadMonitorAddresses(); err != nil {
		return nil, fmt.Errorf("❌ 加载地址配置失败: %w", err)
	}

	// 定时更新
	go cfg.startAddressUpdate()

	fmt.Println("✅ 配置文件加载完成")
	return &cfg, nil
}

func (cfg *Config) loadMonitorAddresses() error {
	fmt.Println("🔵 从数据库获取地址配置...")

	gameRepo := repository.NewGameRepository()
	addresses, err := gameRepo.GetAllAddresses()
	if err != nil {
		return fmt.Errorf("获取地址配置失败: %w", err)
	}

	cfg.MonitorAddresses = make(map[string]string)
	for _, addr := range addresses {
		cfg.MonitorAddresses[addr.Address] = addr.Name
	}

	fmt.Printf("✅ 成功加载 %d 个地址配置\n", len(cfg.MonitorAddresses))
	return nil
}

func (cfg *Config) startAddressUpdate() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		if err := cfg.loadMonitorAddresses(); err != nil {
			fmt.Println("❌ 更新地址配置失败:", err)
		} else {
			fmt.Println("✅ 地址配置更新成功")
		}
	}
}

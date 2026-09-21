package tools

import (
	"fmt"
	"log"
	"os"
	"strings"
	"sync"

	"github.com/joho/godotenv"
)

var (
	envOnce sync.Once

	tronRPCURL      string
	tronPrivateKey  string
	tronFromAddress string
	trc20Contract   string
	tronEnvErr      error

	bscRPCURL      string
	bscPrivateKey  string
	bscUSDTAddress string
	bscChainID     int64
	bscEnvErr      error

	tronSendMu sync.Mutex
	bscSendMu  sync.Mutex
)

func loadEnv() {
	envOnce.Do(func() {
		if err := godotenv.Load(); err != nil {
			_ = godotenv.Load("cmd/.env")
			log.Println("⚠️ 未找到 .env 文件，使用系统环境变量")
		}

		tronRPCURL = strings.TrimSpace(os.Getenv("TRON_RPC_URL"))
		tronPrivateKey = strings.TrimPrefix(strings.TrimSpace(os.Getenv("TRON_PRIVATE_KEY")), "0x")
		tronFromAddress = strings.TrimSpace(os.Getenv("TRON_FROM_ADDRESS"))
		trc20Contract = strings.TrimSpace(os.Getenv("TRC20_CONTRACT_ADDRESS"))
		if tronRPCURL == "" || tronPrivateKey == "" || tronFromAddress == "" {
			tronEnvErr = fmt.Errorf("TRON 转账环境变量未配置完整（TRON_RPC_URL / TRON_PRIVATE_KEY / TRON_FROM_ADDRESS）")
		} else if len(tronPrivateKey) != 64 {
			tronEnvErr = fmt.Errorf("TRON_PRIVATE_KEY 长度必须为 64 位十六进制")
		}

		bscRPCURL = strings.TrimSpace(os.Getenv("BSC_RPC_URL"))
		bscPrivateKey = strings.TrimPrefix(strings.TrimSpace(os.Getenv("BSC_PRIVATE_KEY")), "0x")
		bscUSDTAddress = strings.TrimSpace(os.Getenv("BSC_USDT_CONTRACT"))
		bscChainID = 56
		if chainIDStr := os.Getenv("BSC_CHAIN_ID"); chainIDStr != "" {
			fmt.Sscanf(chainIDStr, "%d", &bscChainID)
		}
		if bscRPCURL == "" || bscPrivateKey == "" || bscUSDTAddress == "" {
			bscEnvErr = fmt.Errorf("BSC 转账环境变量未配置完整（BSC_RPC_URL / BSC_PRIVATE_KEY / BSC_USDT_CONTRACT）")
		}
	})
}

func ensureTronConfig() error {
	loadEnv()
	return tronEnvErr
}

func ensureTronUSDTConfig() error {
	if err := ensureTronConfig(); err != nil {
		return err
	}
	if trc20Contract == "" {
		return fmt.Errorf("环境变量 TRC20_CONTRACT_ADDRESS 未设置")
	}
	return nil
}

func ensureBscConfig() error {
	loadEnv()
	return bscEnvErr
}

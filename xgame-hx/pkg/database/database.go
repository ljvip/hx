package database

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"game-hx/internal/model"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

var (
	DB   *gorm.DB
	once sync.Once
)

type Config struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
	TimeZone string
}

func DefaultConfig() *Config {
	return &Config{
		Host:     "localhost",
		Port:     "5432",
		User:     "game_user",
		Password: "game123456",
		DBName:   "game_db",
		SSLMode:  "disable",
		TimeZone: "Asia/Shanghai",
	}
}

func InitDB() {
	InitDBWithConfig(DefaultConfig())
}

func InitDBWithConfig(config *Config) {
	once.Do(func() {
		dsn := buildDSN(config)

		gormConfig := &gorm.Config{
			Logger:                 logger.Default.LogMode(logger.Warn),
			SkipDefaultTransaction: true,
			PrepareStmt:            true,
		}

		db, err := gorm.Open(postgres.Open(dsn), gormConfig)
		if err != nil {
			log.Fatal("❌ 数据库连接失败:", err)
		}

		sqlDB, err := db.DB()
		if err != nil {
			log.Fatal("❌ 获取数据库实例失败:", err)
		}

		sqlDB.SetMaxOpenConns(50)
		sqlDB.SetMaxIdleConns(20)
		sqlDB.SetConnMaxLifetime(30 * time.Minute)
		sqlDB.SetConnMaxIdleTime(10 * time.Minute)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := sqlDB.PingContext(ctx); err != nil {
			log.Printf("⚠️ 数据库连接测试失败: %v", err)
		}

		fmt.Println("✅ 数据库连接成功 (PostgreSQL)")
		DB = db

		// 执行迁移和初始化
		autoMigrate()
		initData()
	})
}

func autoMigrate() {
	if DB.Migrator().HasTable(&model.BetResult{}) {
		if err := dedupeBetTxIDs(); err != nil {
			log.Printf("⚠️ 清理重复 tx_id 失败: %v", err)
		}
	}

	dropShareholderCodeUniqueIndex()

	models := []interface{}{
		&model.User{},
		&model.BetResult{},
		&model.GameTrend{},
		&model.CommissionRecord{},
		&model.GameCommissionRate{},
		&model.AddressConfig{},
		&model.Admin{},
		&model.Shareholder{},
		&model.ShareholderTransaction{},
		&model.ShareholderRecharge{},
		&model.SystemSetting{},
	}

	for _, m := range models {
		if err := DB.AutoMigrate(m); err != nil {
			if isMissingConstraint(err) {
				log.Printf("⚠️ AutoMigrate 忽略缺失约束: %v", err)
				continue
			}
			log.Fatal("❌ 数据库迁移失败:", err)
		}
	}

	ensureIndexes()
	fixNumericColumns() // 👈 新增：把历史遗留的 integer 金额/比例列强制改成 numeric
	// Old installations assigned every user to SYSTEM. Clear that legacy
	// assignment so users without a real shareholder remain unassigned.
	_ = DB.Exec(`UPDATE users SET shareholder_code = '', is_shareholder = false WHERE shareholder_code = 'SYSTEM'`).Error
	fmt.Println("✅ 数据库迁移完成")
}

// fixNumericColumns 修正历史遗留的 integer 金额/比例列。
// GORM 的 AutoMigrate 不会修改已有列的类型，所以这里用 ALTER 幂等地纠正。
// 这些列已经是 numeric 时，重复执行 ALTER 也不会报错。
func fixNumericColumns() {
	stmts := []string{
		`ALTER TABLE shareholders
			ALTER COLUMN balance             TYPE numeric(20,8) USING balance::numeric,
			ALTER COLUMN total_income        TYPE numeric(20,8) USING total_income::numeric,
			ALTER COLUMN total_cost          TYPE numeric(20,8) USING total_cost::numeric,
			ALTER COLUMN default_share_ratio TYPE numeric(10,6) USING default_share_ratio::numeric`,
		`ALTER TABLE shareholders ADD COLUMN IF NOT EXISTS min_bet_trx numeric(20,8)`,
		`ALTER TABLE shareholders ADD COLUMN IF NOT EXISTS min_bet_usdt numeric(20,8)`,
		`ALTER TABLE shareholders ADD COLUMN IF NOT EXISTS min_bet_usdt_bsc numeric(20,8)`,
		`ALTER TABLE shareholders ADD COLUMN IF NOT EXISTS max_bet numeric(20,8)`,

		`ALTER TABLE shareholder_transactions
			ALTER COLUMN bet_amount      TYPE numeric(20,8) USING bet_amount::numeric,
			ALTER COLUMN profit_loss     TYPE numeric(20,8) USING profit_loss::numeric,
			ALTER COLUMN commission      TYPE numeric(20,8) USING commission::numeric,
			ALTER COLUMN change_amount   TYPE numeric(20,8) USING change_amount::numeric,
			ALTER COLUMN balance_after   TYPE numeric(20,8) USING balance_after::numeric,
			ALTER COLUMN share_ratio     TYPE numeric(20,8) USING share_ratio::numeric,
			ALTER COLUMN commission_rate TYPE numeric(20,8) USING commission_rate::numeric,
			ALTER COLUMN odds            TYPE numeric(20,8) USING odds::numeric`,

		`ALTER TABLE shareholder_recharges
			ALTER COLUMN amount TYPE numeric(20,8) USING amount::numeric`,
	}
	for _, stmt := range stmts {
		if err := DB.Exec(stmt).Error; err != nil {
			log.Printf("⚠️ 修正 numeric 列失败: %v", err)
		}
	}
}

func dropShareholderCodeUniqueIndex() {
	stmts := []string{
		`ALTER TABLE users DROP CONSTRAINT IF EXISTS uni_users_shareholder_code`,
		`DROP INDEX IF EXISTS idx_users_shareholder_code`,
		`DROP INDEX IF EXISTS uni_users_shareholder_code`,
	}
	for _, stmt := range stmts {
		_ = DB.Exec(stmt).Error
	}
}

// initData 初始化基础数据
func initData() {
	fmt.Println("📦 开始初始化基础数据...")

	// 1. 初始化 system 用户
	var userCount int64
	DB.Model(&model.User{}).Where("owner_address = ?", "888888888888888888").Count(&userCount)

	var systemUser *model.User

	if userCount == 0 {
		telegramID := int64(88888888)
		systemUser = &model.User{
			TelegramID:      &telegramID,
			OwnerAddress:    "888888888888888888",
			Name:            "system",
			Referrer:        "system",
			ReferralCode:    "system",
			CommissionRate:  1.0,
			IsShareholder:   false,
			ShareholderCode: "",
			JoinTime:        time.Now(),
		}
		if err := DB.Create(systemUser).Error; err != nil {
			log.Printf("⚠️ 创建 system 用户失败: %v", err)
		} else {
			log.Println("✅ system 用户创建成功")
		}
	} else {
		log.Println("ℹ️ system 用户已存在，跳过创建")
		// 查询已存在的 system 用户
		if err := DB.Where("owner_address = ?", "888888888888888888").First(&systemUser).Error; err != nil {
			log.Printf("⚠️ 查询 system 用户失败: %v", err)
		}
	}

	// 2. 初始化管理员
	var adminCount int64
	DB.Model(&model.Admin{}).Where("username = ?", "xgame").Count(&adminCount)
	if adminCount == 0 {
		admin := &model.Admin{
			Username:     "xgame",
			PasswordHash: "$2a$10$oKCe5kRKJ/ZLkz1tH.D4TOcewIl0KxMgwQaDANoQ/helXb/fzSU6O",
			Role:         "super_admin",
			CreatedAt:    time.Date(2025, 2, 3, 6, 14, 38, 0, time.UTC),
			UpdatedAt:    time.Date(2025, 5, 2, 14, 36, 8, 0, time.UTC),
		}
		if err := DB.Create(admin).Error; err != nil {
			log.Printf("⚠️ 创建管理员失败: %v", err)
		} else {
			log.Println("✅ 管理员 xgame 创建成功")
		}
	} else {
		log.Println("ℹ️ 管理员 xgame 已存在，跳过创建")
	}

	// No system shareholder is created. Users without an assigned shareholder
	// are intentionally left with an empty shareholder_code.
	initSystemSettings()
	initGameCommissionRates()

	fmt.Println("✅ 基础数据初始化完成")
}

func initSystemSettings() {
	now := time.Now()
	for _, def := range model.DefaultSystemSettings() {
		setting := model.SystemSetting{
			Key:       def.Key,
			Value:     def.Default,
			Remark:    def.Remark,
			UpdatedAt: now,
		}
		result := DB.Where("key = ?", def.Key).Attrs(model.SystemSetting{
			Value:     def.Default,
			Remark:    def.Remark,
			UpdatedAt: now,
		}).FirstOrCreate(&setting)
		if result.Error != nil {
			log.Printf("⚠️ 初始化系统配置 %s 失败: %v", def.Key, result.Error)
			continue
		}
		if result.RowsAffected > 0 {
			log.Printf("✅ 系统配置已写入默认值 %s = %s", def.Key, def.Default)
		}
	}
}

func initGameCommissionRates() {
	now := time.Now()
	defaults := []model.GameCommissionRate{
		{GameType: "lucky_banker", CommissionRate: 0.025, CreatedAt: now, UpdatedAt: now},
		{GameType: "hash_lucky", CommissionRate: 0.025, CreatedAt: now, UpdatedAt: now},
		{GameType: "hash_baccarat", CommissionRate: 0.025, CreatedAt: now, UpdatedAt: now},
		{GameType: "single_double", CommissionRate: 0.025, CreatedAt: now, UpdatedAt: now},
		{GameType: "big_small", CommissionRate: 0.025, CreatedAt: now, UpdatedAt: now},
		{GameType: "tenfold_bull", CommissionRate: 0.025, CreatedAt: now, UpdatedAt: now},
		{GameType: "pingbei_niuniu", CommissionRate: 0.025, CreatedAt: now, UpdatedAt: now},
		{GameType: "vip_odd_even", CommissionRate: 0.025, CreatedAt: now, UpdatedAt: now},
		{GameType: "vip_big_small", CommissionRate: 0.025, CreatedAt: now, UpdatedAt: now},
	}
	for _, rate := range defaults {
		result := DB.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "game_type"}},
			DoNothing: true,
		}).Create(&rate)
		if result.Error != nil {
			log.Printf("⚠️ 初始化游戏佣金比例 %s 失败: %v", rate.GameType, result.Error)
			continue
		}
		if result.RowsAffected > 0 {
			log.Printf("✅ 游戏佣金比例已写入默认值 %s = %.4f", rate.GameType, rate.CommissionRate)
		}
	}
}

func isMissingConstraint(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "42704") || strings.Contains(msg, "不存在")
}

func ensureIndexes() {
	stmts := []string{
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_bet_results_tx_id ON bet_results (tx_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users (referral_code)`,
		`CREATE INDEX IF NOT EXISTS idx_users_shareholder_code ON users (shareholder_code)`,
	}
	for _, stmt := range stmts {
		if err := DB.Exec(stmt).Error; err != nil {
			log.Printf("⚠️ 创建索引失败: %v", err)
		}
	}
}

func dedupeBetTxIDs() error {
	if err := DB.Exec(`UPDATE bet_results SET tx_id = 'legacy-' || id::text WHERE tx_id IS NULL OR tx_id = ''`).Error; err != nil {
		return err
	}
	if err := DB.Exec(`
		DELETE FROM bet_results a
		USING bet_results b
		WHERE a.tx_id = b.tx_id AND a.id > b.id
	`).Error; err != nil {
		return err
	}
	return DB.Exec(`DROP INDEX IF EXISTS idx_bet_results_tx_id`).Error
}

func buildDSN(config *Config) string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s TimeZone=%s",
		config.Host, config.Port, config.User, config.Password, config.DBName, config.SSLMode, config.TimeZone)
}

func GetDB() *gorm.DB {
	if DB == nil {
		InitDB()
	}
	return DB
}

func Now() time.Time {
	return time.Now()
}

func HealthCheck() error {
	if DB == nil {
		return fmt.Errorf("数据库未初始化")
	}
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}

func WithTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithTimeout(ctx, timeout)
}
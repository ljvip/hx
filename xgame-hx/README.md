# game-hx

链上哈希游戏后端：玩家把 **TRX / USDT** 转到游戏收款地址即下注，程序按**区块哈希**开奖，再把返奖打回玩家地址。

HTTP API 端口 **8088**，WebSocket：`ws://localhost:8088/wss`。

## 运行逻辑（必读）

1. 在后台配置 `address_configs`：每个收款地址对应一个玩法名（如 `single_double`、`hash_baccarat`）。
2. TRON / BSC 监听器扫链，转到监控地址且金额 ≥ 最小投注，才进入结算。
3. `ProcessBet` 用该笔交易的区块哈希开奖，按 `tx_id` 落库；**同一笔链上交易只会结算一次**。
4. `final_amount > 0` 时异步返奖：
   - 玩家地址以 `T` 开头 → TRON：TRX 走 `SendTrx`，USDT 走 `SendTRC20Token`
   - 玩家地址以 `0x` 开头 → BSC：只支持 USDT，走 `TransferUSDT`
5. 同时记推荐佣金、股东占成，并通过 WebSocket 推送结果。

**注意：** 游戏不在 HTTP 里“点下注”。链上转账才是投注。`POST /api/bet/bsc-transfer` 只是备用 webhook，不是主路径。

## 启动

```bash
# 国内代理（可选）
go env -w GOPROXY=https://goproxy.cn,https://goproxy.io,direct

go build -o game-hx cmd/main.go
./game-hx
```

需要 PostgreSQL。默认连接（见 `pkg/database/database.go`）：

- Host `localhost:5432`
- User `game_user` / Password `game123456`
- DB `game_db`

首次启动会自动迁移表，并在库里**没有对应记录时**写入：

- 用户 `system`、管理员 `xgame`（不再创建系统股东）
- `system_settings` 默认值
- 各玩法佣金比例 `0.025`（2.5%）

启动后请马上改管理员密码，并改数据库账号密码。

## 环境变量

可放在项目根目录 `.env`，或系统环境变量。

### 鉴权

| 变量 | 说明 |
|---|---|
| `JWT_SECRET` | JWT 签名密钥。不配则使用代码里的默认值，生产必须改 |
| `WEBHOOK_SECRET` | BSC webhook 密钥。不配则 `/api/bet/bsc-transfer` **一律拒绝** |

### TRON 返奖 / 佣金提现

| 变量 | 说明 |
|---|---|
| `TRON_RPC_URL` | 如 `https://api.trongrid.io` |
| `TRON_PRIVATE_KEY` | 出款私钥，64 位 hex，不要 `0x` 前缀 |
| `TRON_FROM_ADDRESS` | 出款地址（Base58，`T` 开头） |
| `TRC20_CONTRACT_ADDRESS` | TRON USDT 合约，返 USDT 时必填 |

### BSC 返奖 / 佣金提现

| 变量 | 说明 |
|---|---|
| `BSC_RPC_URL` | BSC HTTP RPC |
| `BSC_PRIVATE_KEY` | 出款私钥 |
| `BSC_USDT_CONTRACT` | 主网一般为 `0x55d398326f99059fF775485246999027B3197955` |
| `BSC_CHAIN_ID` | 可选，默认 `56` |

没配齐对应链的变量时：**服务仍能启动**，但该链返奖/提现会失败，注单 `payout_status` 记为 `failed`。可用返奖重试接口补打。

出款地址必须备足：

- TRON：TRX（手续费）+ 要返的 TRX/USDT
- BSC：BNB（gas）+ 要返的 USDT

## 鉴权注意

登录/注册会返回 `token`。写操作要带：

```
Authorization: Bearer <token>
```

| 角色 | 如何拿 token | 能调什么 |
|---|---|---|
| 管理员 | `POST /api/admins/login` | 配置、地址、股东、返奖重试、全量用户/注单 |
| 玩家 | `/login/wallet`、`/login/telegram`、`/register` | 提现、改自己的兑换额度 |
| Webhook | Header `X-Webhook-Secret` | 仅 `POST /api/bet/bsc-transfer` |

**仍可匿名访问：** 查注单、走势、游戏地址列表、`GET /settings`、WebSocket。

前端旧逻辑如果没带 Token 就改配置/提现，会收到 401。

## 系统配置

`GET /settings` 公开可读，`PUT /settings` 需管理员。

| 键 | 默认 | 含义 |
|---|---|---|
| `shareholder_min_balance` | 1 | 股东积分低于该值，占成按 0 |
| `min_bet_trx` | 1 | TRX 最小投注（含） |
| `min_bet_usdt` | 9 | TRON USDT 最小投注（含） |
| `min_bet_usdt_bsc` | 1 | BSC USDT 最小投注（含） |
| `max_bet` | 1000 | 单笔投注金额上限 |
| `bsc_confirmations` | 5 | BSC 确认数 |
| `shareholder_recharge_address` | xxxxx | 股东积分充值地址，多个地址用逗号、分号或换行分隔 |
| `shareholder_recharge_min` | 10000 | 股东积分充值最低金额 |

库里已有的值**不会**被启动时的默认值覆盖。改完立即生效，不用重启（监听器读库）。

股东绑定钱包向 `shareholder_recharge_address` 中任一地址转入 TRX 或 USDT，金额达到
`shareholder_recharge_min` 后会在确认的链上交易中增加对应股东积分；同一交易哈希只会入账一次。

### 股东积分充值

充值地址支持多个值，使用逗号、分号或换行分隔。例如：

```text
TRechargeAddress1,TRechargeAddress2
```

管理员可通过以下接口修改充值地址、充值门槛和下注上限：

```http
PUT /settings
Authorization: Bearer <管理员 token>
Content-Type: application/json
```

```json
{
  "shareholder_recharge_address": "TRechargeAddress1,TRechargeAddress2",
  "shareholder_recharge_min": 10000,
  "max_bet": 1000
}
```

- 只有已绑定股东钱包的用户充值才会入账。
- TRON 支持 TRX 和 USDT；BSC 支持 USDT。
- 充值达到门槛并完成监听器要求的链上确认后，积分增加金额等于实际充值金额。
- 充值交易会写入股东积分流水，同一交易哈希不会重复入账。
- `max_bet` 是所有单笔投注的金额上限；超过上限的转账不会作为投注处理。

## 游戏地址

监听器每 5 分钟从 `address_configs` 刷新监控地址。`name` 必须是结算里的玩法 key：

`lucky_banker`、`hash_lucky`、`hash_baccarat`、`single_double`、`big_small`、`tenfold_bull`、`pingbei_niuniu`、`vip_odd_even`、`vip_big_small`

- 列表：`GET /addresses`（公开，前端展示收款地址用）
- 增改：`POST/PUT /address`（管理员）。`id=0` 为新建；更新时可改地址字段
- 删除：`DELETE /address/:id`（管理员）

新建/修改后最多等 5 分钟才会被监听器加载；急用可重启进程。

## 返奖

结算成功且 `final_amount > 0` 后异步打款。`bet_results` 上会写：

- `payout_status`：`pending` / `success` / `failed`
- `payout_tx_id`：链上返奖哈希
- `payout_error`：失败原因

管理员：

```
GET  /api/payouts?status=failed
POST /api/payout/retry
{"tx_id":"玩家下注的链上交易哈希"}
```

已 `success` 的不能再打，避免双花。`final_amount <= 0` 的（纯输）不会返奖。

查注单也可带 `payout_status`：`GET /api/bet-results?payout_status=failed`

## 佣金提现

`POST /api/commission/withdraw` 需要玩家或管理员 Token。

```json
{
  "receiver_code": "玩家推荐码",
  "commission": 10.5,
  "token_symbol": "USDT"
}
```

会先扣库里的佣金余额，再按用户钱包地址链上转账。转账失败会把佣金退回余额。

玩家只能提自己的 `receiver_code`。用户必须已绑定钱包地址。

## 股东接口

`/shareholder/*` 管理接口要管理员 Token；股东自助接口使用 `/shareholder/login`
获取的 `role=shareholder` JWT，并且只使用令牌中的股东身份。

- `POST /shareholder/login`：股东代码和密码登录
- `GET /shareholder/self/profile`、`/balance`、`/transactions`
- `GET /shareholder/self/downline/users`、`/downline/transactions`、`/downline/commissions`
- `PUT /shareholder/self/password`、`PUT /shareholder/self/share-ratio`
- `GET /shareholder/self/recharge`、`POST /shareholder/self/withdraw`

路径里的 `:id` **一律是股东表 ID**（`GET /shareholder/list` 返回的 `id`），不是用户 ID。

- `status=0` 表示停用，可以提交（不要用 `binding` 把 0 挡掉）
- 晋升股东的目标用户必须尚未分配股东；晋升会将其整个推荐子树分配到新股东

## 用户与邀请

- 无邀请码：`referrer=system`，`shareholder_code` 为空（无系统股东兜底）
- 有邀请码：跟邀请人走股东码
- 链上先下注、后注册：监听器会自动开户，之后仍可补绑邀请码（仅当原推荐人是空或 `system`）

EVM 地址会转成小写存储；TRON 地址保持原样。

## 常用接口

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/health` | 公开 | 数据库探活 |
| GET | `/wss` | 公开 | 实时开奖 |
| GET | `/login/wallet?wallet_address=` | 公开 | 钱包登录，返回 `token` |
| GET | `/login/telegram?telegram_id=` | 公开 | Telegram 登录 |
| POST | `/register` | 公开 | 注册 |
| PUT | `/api/users/:id` | 管理员 | 修改用户全部业务字段 |
| DELETE | `/api/users/:id` | 管理员 | 删除用户及相关投注、佣金、股东流水 |
| GET | `/api/bet-results` | 公开 | 注单；可加 `owner_address`、`game_name`、`payout_status` |
| GET | `/game-trends?game=` | 公开 | 走势 |
| GET | `/settings` | 公开 | 最小投注等 |
| PUT | `/settings` | 管理员 | 改配置 |
| POST | `/api/admins/login` | 公开 | 管理员登录 |
| GET | `/api/payouts` | 管理员 | 返奖列表 |
| POST | `/api/payout/retry` | 管理员 | 失败返奖重试 |

`telegram_id` 查询已支持：`/user/referral-chain`、`/api/referral-bet-results`、`/api/referral-commission-results`。

## 目录

- `cmd/main.go`：入口，启动 DB、TRON/BSC 监听、HTTP
- `listener/`：扫块、匹配游戏地址
- `game/`：各玩法开奖
- `internal/service/bet_service.go`：结算中枢（开奖、落库、返奖、佣金、股东）
- `pkg/tools/`：链上转账
- `pkg/router/router.go`：全部 HTTP 路由

## 运维注意

1. **出款私钥就是热钱包。** 不要提交到 git，权限最小化，余额不要囤太多。
2. 返奖是异步的：监听器不会等链上确认结束才处理下一笔；失败看 `payout_status` 再重试。
3. BSC 监听默认连 NodeReal；节点挂了会重连。TRON 走 TronGrid 拉块。
4. 同一 `tx_id` 重复出现（重组、webhook 重放）不会二次开奖、也不会二次打款。
5. 佣金提现和游戏返奖共用出款地址，并发时 TRON/BSC 各有一把锁，避免 nonce 冲突。





# 安装 PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib -y

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 查看状态
sudo systemctl status postgresql


# 直接在终端执行（不要进入 psql）
sudo -u postgres psql << 'EOF'
-- 创建数据库
CREATE DATABASE game_db;

-- 创建用户（如果已存在则跳过）
CREATE USER game_user WITH PASSWORD 'game123456';

-- 授权
GRANT ALL PRIVILEGES ON DATABASE game_db TO game_user;

-- 连接到 game_db
\c game_db

-- 授予 schema 权限
GRANT ALL ON SCHEMA public TO game_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO game_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO game_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO game_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO game_user;

\q
EOF

# 测试连接
psql -h localhost -p 5432 -U game_user -d game_db -c "SELECT '数据库连接成功!' as status;"




go build -o game-hx cmd/main.go

go run cmd/main.go

sudo lsof -i :8088

nohup ./game-hx > app.log 2>&1 &


# 1. 杀掉进程
pkill -f game-hx
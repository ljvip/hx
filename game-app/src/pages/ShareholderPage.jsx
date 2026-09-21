import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Layout,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  BankOutlined,
  KeyOutlined,
  LogoutOutlined,
  PercentageOutlined,
  ReloadOutlined,
  SendOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useWallet } from "../hooks/useWallet";
import { CHAIN_TYPES } from "../utils/constants";
import { transferBSCUSDT } from "../services/bscService";
import { transferTRX, transferUSDT } from "../services/tronService";
import {
  changeShareholderPassword,
  changeShareholderRatio,
  getShareholderCommissions,
  getShareholderDashboard,
  getShareholderDownline,
  getShareholderDownlineTransactions,
  getShareholderPoints,
  getShareholderRechargeInfo,
  getUserTransactions,
  shareholderLogin,
  transferToShareholderWallet,
  updateShareholderBetLimits,
  withdrawShareholder,
} from "../services/api";
import ReferralBetPanel from "../components/shareholder/ReferralBetPanel";
import ReferralCommissionPanel from "../components/shareholder/ReferralCommissionPanel";

const { Content } = Layout;
const { Text, Title, Paragraph } = Typography;

const payloadOf = (response) => response?.data?.data ?? response?.data ?? {};
const listOf = (response, keys = []) => {
  const payload = payloadOf(response);
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return Array.isArray(payload?.items) ? payload.items : [];
};
const valueOf = (object, keys, fallback = 0) => {
  for (const key of keys) {
    if (object?.[key] !== undefined && object[key] !== null) return object[key];
  }
  return fallback;
};
const dashboardOf = (response) => {
  const payload = payloadOf(response);
  if (!payload?.shareholder) return payload;
  return {
    ...payload.shareholder,
    ...payload.user,
    ...payload,
    wallet_address: payload.user?.owner_address || payload.shareholder.wallet_address,
    shareholder: payload.shareholder,
    user: payload.user,
  };
};
const number = (value) =>
  Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 6 });
const date = (value) => (value ? new Date(value).toLocaleString() : "-");
const sessionFromStorage = () => {
  try {
    return JSON.parse(localStorage.getItem("shareholderSession") || "null");
  } catch {
    return null;
  }
};

const statusColor = (status) => {
  if (["success", "completed", "approved", "成功"].includes(String(status).toLowerCase())) return "success";
  if (["failed", "rejected", "失败"].includes(String(status).toLowerCase())) return "error";
  return "processing";
};

const ShareholderLogin = ({ onLogin, loading }) => {
  const [form] = Form.useForm();
  return (
    <Content style={{ maxWidth: 440, width: "100%", margin: "0 auto", padding: "48px 16px" }}>
      <Card bordered={false} style={{ borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.16)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <BankOutlined style={{ fontSize: 40, color: "#1677ff" }} />
          <Title level={3} style={{ margin: "12px 0 4px" }}>股东自助管理</Title>
          <Text type="secondary">使用股东代码和密码登录</Text>
        </div>
        <Form form={form} layout="vertical" onFinish={onLogin}>
          <Form.Item
            label="股东代码"
            name="shareholder_code"
            rules={[{ required: true, message: "请输入股东代码" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入股东代码" autoComplete="username" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password prefix={<KeyOutlined />} placeholder="请输入密码" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            登录
          </Button>
        </Form>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => window.history.back()}
          block
          style={{ marginTop: 8 }}
        >
          返回游戏
        </Button>
      </Card>
    </Content>
  );
};

const ShareholderPage = () => {
  const navigate = useNavigate();
  const { walletAddress, chainType, connectWallet } = useWallet();
  const [session, setSession] = useState(sessionFromStorage);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [points, setPoints] = useState([]);
  const [downline, setDownline] = useState([]);
  const [downlineTransactions, setDownlineTransactions] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [rechargeInfo, setRechargeInfo] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const results = await Promise.allSettled([
      getShareholderDashboard(),
      getShareholderPoints({ limit: 50 }),
      getShareholderDownline({ limit: 50 }),
      getShareholderDownlineTransactions({ limit: 50 }),
      getShareholderCommissions({ limit: 50 }),
      getShareholderRechargeInfo(),
    ]);
    const [
      dashboardResult,
      pointResult,
      downlineResult,
      downlineTransactionResult,
      commissionResult,
      rechargeResult,
    ] = results;

    if (dashboardResult.status === "rejected") {
      if (dashboardResult.reason?.response?.status === 401) {
        localStorage.removeItem("shareholderToken");
        localStorage.removeItem("shareholderSession");
        setSession(null);
        message.error("登录已过期，请重新登录");
      }
    } else {
      setDashboard(dashboardOf(dashboardResult.value));
    }
    if (pointResult.status === "fulfilled")
      setPoints(listOf(pointResult.value, ["points", "records", "items"]));
    if (downlineResult.status === "fulfilled")
      setDownline(listOf(downlineResult.value, ["users", "downline", "members", "items"]));
    if (downlineTransactionResult.status === "fulfilled")
      setDownlineTransactions(
        listOf(downlineTransactionResult.value, ["transactions", "records", "items"])
      );
    if (commissionResult.status === "fulfilled")
      setCommissions(listOf(commissionResult.value, ["commissions", "records", "items"]));
    if (rechargeResult.status === "fulfilled")
      setRechargeInfo(payloadOf(rechargeResult.value));

    setLoading(false);
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 从 dashboard 中解析出当前股东钱包地址
  const walletAddressFromDashboard =
    dashboard.wallet_address ||
    dashboard.owner_address ||
    dashboard.address ||
    dashboard.user?.owner_address ||
    "";

  // 地址就绪后再加载"我的交易"（含刷新触发）
  useEffect(() => {
    if (!session || !walletAddressFromDashboard) {
      setTransactions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await getUserTransactions(walletAddressFromDashboard, 50);
        if (cancelled) return;
        const payload = response?.data ?? [];
        setTransactions(
          Array.isArray(payload)
            ? payload
            : listOf(response, ["transactions", "records", "items"])
        );
      } catch (error) {
        if (!cancelled) {
          console.error("获取我的交易失败:", error);
          setTransactions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, walletAddressFromDashboard, refreshTick]);

  const handleLogin = async (values) => {
    setLoginLoading(true);
    try {
      const response = await shareholderLogin({
        code: values.shareholder_code,
        password: values.password,
      });
      const body = response?.data || {};
      const token = body.token || body.access_token || body.data?.token;
      if (token) localStorage.setItem("shareholderToken", token);
      const nextSession = {
        code: values.shareholder_code,
        name: body.shareholder?.name || body.name || body.data?.name,
      };
      localStorage.setItem("shareholderSession", JSON.stringify(nextSession));
      setSession(nextSession);
      message.success(body.message || "登录成功");
    } catch (error) {
      message.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "登录失败，请检查股东代码和密码"
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("shareholderToken");
    localStorage.removeItem("shareholderSession");
    setSession(null);
    setDashboard({});
    setTransactions([]);
    message.success("已退出股东中心");
  };

  const runAction = async (action, successText) => {
    setActionLoading(true);
    try {
      const response = await action();
      message.success(response?.data?.message || successText);
      await loadData();
      return true;
    } catch (error) {
      message.error(
        error.response?.data?.message ||
          error.response?.data?.detail ||
          "操作失败，请稍后重试"
      );
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshTick((n) => n + 1);
    setRefreshing(false);
  };

  const handleRecharge = async (values) => {
    const address =
      rechargeInfo.address ||
      rechargeInfo.wallet_address ||
      rechargeInfo.recharge_address ||
      dashboard.recharge_address;
    if (!address) {
      message.error("暂未配置充值地址，请联系管理员");
      return;
    }
    if (!walletAddress) {
      await connectWallet();
      return;
    }
    if (!chainType) {
      message.error("请先连接钱包");
      return;
    }
    setActionLoading(true);
    try {
      let result;
      if (chainType === CHAIN_TYPES.TRON) {
        result =
          values.currency === "TRX"
            ? await transferTRX(address, values.amount)
            : await transferUSDT(address, values.amount);
      } else {
        result = await transferBSCUSDT(address, values.amount);
      }
      const transactionHash =
        result?.txid || result?.txID || result?.transactionHash || result?.hash;
      try {
        await transferToShareholderWallet({
          amount: values.amount,
          currency: values.currency,
          wallet_address: address,
          transaction_hash: transactionHash,
        });
      } catch {
        // 链上转账已完成，关联接口不可用不影响结果
      }
      message.success("充值交易已提交，请等待链上确认");
      await loadData();
    } catch (error) {
      message.error(error.message || "充值失败，请确认钱包余额和网络");
    } finally {
      setActionLoading(false);
    }
  };

  const currencyOptions = useMemo(
    () =>
      chainType === CHAIN_TYPES.BSC
        ? [{ value: "USDT", label: "USDT" }]
        : [
            { value: "USDT", label: "USDT" },
            { value: "TRX", label: "TRX" },
          ],
    [chainType]
  );

  const transactionColumns = [
    {
      title: "游戏名称",
      dataIndex: "game_name",
      render: (value) => value || "-",
    },
    {
      title: "交易金额",
      dataIndex: "transaction_amount",
      render: (value) => number(value),
    },
    {
      title: "结果",
      dataIndex: "user_result",
      render: (value) => {
        const v = String(value || "").toLowerCase();
        const color = v === "win" ? "success" : v === "lose" || v === "lost" ? "error" : "processing";
        const label = v === "win" ? "赢" : v === "lose" || v === "lost" ? "输" : value || "-";
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "最终金额",
      dataIndex: "final_amount",
      render: (value) => number(value),
    },
    {
      title: "时间",
      dataIndex: "created_at",
      render: (value) => date(value),
    },
  ];

  const downlineTransactionColumns = [
    {
      title: "交易号",
      dataIndex: "trade_no",
      ellipsis: true,
      render: (value) => value || "-",
    },
    { title: "游戏名称", dataIndex: "game_name", render: (value) => value || "-" },
    {
      title: "下注金额",
      dataIndex: "bet_amount",
      render: (value) => number(value),
    },
    {
      title: "变动金额",
      dataIndex: "change_amount",
      render: (value) => number(value),
    },
    {
      title: "变动后余额",
      dataIndex: "balance_after",
      render: (value) => number(value),
    },
    {
      title: "时间",
      dataIndex: "created_at",
      render: (value) => date(value),
    },
  ];
  const downlineColumns = [
    {
      title: "用户",
      dataIndex: "name",
      render: (value, row) =>
        value || row.username || row.user_code || row.address || "-",
    },
    {
      title: "钱包地址",
      dataIndex: "wallet_address",
      ellipsis: true,
      render: (value, row) => value || row.owner_address || "-",
    },
    {
      title: "累计交易",
      dataIndex: "total_amount",
      render: (value, row) => number(value ?? row.total_transaction),
    },
    {
      title: "贡献佣金",
      dataIndex: "commission",
      render: (value, row) => number(value ?? row.total_commission),
    },
    {
      title: "加入时间",
      dataIndex: "created_at",
      render: (value, row) => date(value || row.createdAt),
    },
  ];
  const commissionColumns = [
    {
      title: "时间",
      dataIndex: "created_at",
      render: (value, row) => date(value || row.time),
    },
    {
      title: "下级",
      dataIndex: "user_code",
      render: (value, row) => value || row.username || row.owner_address || "-",
    },
    {
      title: "佣金",
      dataIndex: "amount",
      render: (value, row) =>
        `${number(value ?? row.commission)} ${row.currency || row.token_symbol || "USDT"}`,
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (value) => <Tag color={statusColor(value)}>{value || "处理中"}</Tag>,
    },
  ];

  if (!session) {
    return (
      <Layout style={{ minHeight: "100vh", background: "transparent" }}>
        <ShareholderLogin onLogin={handleLogin} loading={loginLoading} />
      </Layout>
    );
  }

  const balance = valueOf(dashboard, ["balance", "available_balance", "wallet_balance"]);
 
  const rechargeAddress =
    rechargeInfo.address ||
    rechargeInfo.wallet_address ||
    rechargeInfo.recharge_address ||
    dashboard.recharge_address;

  // 积分 = dashboard.balance
  const pointBalance = valueOf(dashboard, ["balance", "points", "point_balance", "total_points"]);

  // 股东设置/申请的分成比例（default_share_ratio = 0.05 → 5%）
  const ratio = valueOf(dashboard, ["share_ratio", "default_share_ratio", "ratio"], 0);
  const selectedRatio = Number(ratio) * (Number(ratio) <= 1 ? 100 : 1);

  // 实际生效比例（积分不足时为 0）
  const effectiveRatioValue = Number(
    valueOf(dashboard, ["effective_share_ratio"], ratio)
  );
  const effectiveRatio = effectiveRatioValue * (effectiveRatioValue <= 1 ? 100 : 1);
  const ratioInsufficient = selectedRatio > 0 && effectiveRatio === 0;
  const requiredBalance = valueOf(dashboard, ["required_balance"], 0);

  // 用户佣金率（user.commission_rate）
  const commissionRateRaw = Number(
    valueOf(
      dashboard,
      ["commission_rate"],
      valueOf(dashboard.user || {}, ["commission_rate"], 0)
    )
  );
  const commissionRatePercent =
    commissionRateRaw * (commissionRateRaw <= 1 ? 100 : 1);

  // "修改分成比例"表单提示里仍会用到的每 1% 所需积分
  const pointsPerPercent = Number(
    valueOf(dashboard, ["shareholder_points_per_percent"], 10)
  );  
  return (
    <Layout style={{ minHeight: "100vh", background: "transparent" }}>
      <Content style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "20px 16px 48px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/")}>
              返回游戏
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              股东中心
            </Title>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} loading={refreshing} onClick={handleRefresh}>
              刷新
            </Button>
            <Button icon={<LogoutOutlined />} onClick={logout}>
              退出
            </Button>
          </Space>
        </div>

        <Alert
          type="info"
          showIcon
          message={`已登录：${session.name || session.code}`}
          description="这里只展示和操作您自己的股东账户及下级数据。"
          style={{ marginBottom: 16 }}
        />

        {loading && !dashboard.balance && (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Spin tip="正在加载股东数据..." />
          </div>
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="积分" value={pointBalance} />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="当前分成比例"
                value={selectedRatio}
                suffix="%"
                precision={2}
                styles={{ content: ratioInsufficient ? { color: "#ff4d4f" } : undefined }}
              />
              {ratioInsufficient && (
                <Text type="danger">
                  实际生效 {effectiveRatio}%，积分不足（需 ≥ {number(requiredBalance)}）
                </Text>
              )}
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="用户佣金率"
                value={commissionRatePercent}
                suffix="%"
                precision={2}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="下级人数"
                value={valueOf(dashboard, ["downline_count", "team_count"], downline.length)}
              />
            </Card>
          </Col>
        </Row>

        <Card title="账户信息" style={{ marginTop: 16 }}>
          <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
            <Descriptions.Item label="股东代码">
              {dashboard.code || dashboard.shareholder_code || session.code}
            </Descriptions.Item>
            <Descriptions.Item label="姓名">
              {dashboard.name || session.name || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="钱包地址">
              {dashboard.wallet_address || dashboard.address || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="累计佣金">
              {number(valueOf(dashboard, ["total_commission", "commission"]))}
            </Descriptions.Item>
            <Descriptions.Item label="可提现">
              {number(valueOf(dashboard, ["withdrawable", "withdrawable_balance"], balance))}
            </Descriptions.Item>
            <Descriptions.Item label="最后登录">{date(dashboard.last_login)}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Tabs
            items={[
              {
                key: "transactions",
                label: "我的交易",
                children: (
                  <Table
                    rowKey={(row) => row.id || row.txid || JSON.stringify(row)}
                    columns={transactionColumns}
                    dataSource={transactions}
                    size="small"
                    scroll={{ x: 620 }}
                    locale={{ emptyText: <Empty description="暂无交易记录" /> }}
                  />
                ),
              },
              {
                key: "points",
                label: "积分流水",
                children: (
                  <Table
                    rowKey={(row) => row.id || JSON.stringify(row)}
                    columns={downlineTransactionColumns}
                    dataSource={downlineTransactions}
                    size="small"
                    scroll={{ x: 620 }}
                    locale={{ emptyText: <Empty description="暂无积分记录" /> }}
                  />
                ),
              },
              {
                key: "downline",
                label: `下级用户 (${downline.length})`,
                children: (
                  <Table
                    rowKey={(row) => row.id || row.user_id || row.address || JSON.stringify(row)}
                    columns={downlineColumns}
                    dataSource={downline}
                    size="small"
                    scroll={{ x: 760 }}
                    locale={{ emptyText: <Empty description="暂无下级用户" /> }}
                  />
                ),
              },
              // {
              //   key: "team-activity",
              //   label: "下级交易 / 佣金",
              //   children: (
              //     <Row gutter={[16, 16]}>
              //       <Col xs={24} lg={12}>
              //         <Title level={5}>下级交易</Title>
              //         <Table
              //           rowKey={(row) => row.id || JSON.stringify(row)}
              //           columns={transactionColumns}
              //           dataSource={downlineTransactions}
              //           size="small"
              //           pagination={{ pageSize: 8 }}
              //           scroll={{ x: 560 }}
              //         />
              //       </Col>
              //       <Col xs={24} lg={12}>
              //         <Title level={5}>佣金记录</Title>
              //         <Table
              //           rowKey={(row) => row.id || JSON.stringify(row)}
              //           columns={commissionColumns}
              //           dataSource={commissions}
              //           size="small"
              //           pagination={{ pageSize: 8 }}
              //           scroll={{ x: 560 }}
              //         />
              //       </Col>
              //     </Row>
              //   ),
              // },
              {
                key: "umbrella-bets",
                label: "代理伞下数据",
                children: (
                  <ReferralBetPanel defaultAddress={walletAddressFromDashboard} />
                ),
              },
              {
                key: "umbrella-commission",
                label: "代理伞下佣金",
                children: (
                  <ReferralCommissionPanel defaultAddress={walletAddressFromDashboard} />
                ),
              },
            ]}
          />
        </Card>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title={<><WalletOutlined /> 提现</>}>
              <Form
                layout="vertical"
                onFinish={(values) =>
                  runAction(
                    () =>
                      withdrawShareholder({
                        amount: values.amount,
                        token_symbol: values.currency,
                      }),
                    "提现申请已提交"
                  )
                }
              >
                <Form.Item
                  name="amount"
                  label="提现金额"
                  rules={[{ required: true, message: "请输入提现金额" }]}
                >
                  <InputNumber
                    min={0}
                    precision={6}
                    style={{ width: "100%" }}
                    placeholder="请输入金额"
                  />
                </Form.Item>
                <Form.Item
                  name="currency"
                  label="币种"
                  initialValue={dashboard.currency || "USDT"}
                >
                  <Input placeholder="USDT" />
                </Form.Item>
                <Form.Item name="wallet_address" label="收款钱包地址">
                  <Input placeholder={walletAddress || "留空使用账户地址"} />
                </Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={actionLoading}
                  icon={<SendOutlined />}
                  block
                >
                  提交提现申请
                </Button>
              </Form>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={<><SendOutlined /> 充值到股东钱包</>}>
              {rechargeAddress ? (
                <>
                  <Paragraph type="secondary">
                    请向以下地址充值，到账后系统会自动更新余额。
                  </Paragraph>
                  <Paragraph
                    copyable
                    style={{
                      wordBreak: "break-all",
                      background: "#f5f5f5",
                      padding: 8,
                      borderRadius: 6,
                    }}
                  >
                    {rechargeAddress}
                  </Paragraph>
                </>
              ) : (
                <Alert
                  type="warning"
                  message="充值地址暂未配置"
                  description="请联系管理员获取充值地址。"
                />
              )}
              <Form layout="vertical" onFinish={handleRecharge}>
                <Form.Item
                  name="amount"
                  label="充值金额"
                  rules={[{ required: true, message: "请输入充值金额" }]}
                >
                  <InputNumber min={0} precision={6} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item name="currency" label="币种" initialValue="USDT">
                  <Select options={currencyOptions} />
                </Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={actionLoading}
                  icon={<WalletOutlined />}
                  block
                >
                  {walletAddress ? "使用已连接钱包充值" : "连接钱包并充值"}
                </Button>
              </Form>
              {rechargeInfo.instructions && (
                <>
                  <Divider />
                  <Text type="secondary">{rechargeInfo.instructions}</Text>
                </>
              )}
            </Card>
          </Col>
        </Row>

        <Card title="伞下投注限额" style={{ marginTop: 16 }}>
          <Alert
            type="info"
            showIcon
            message="留空表示使用系统默认。股东设置优先于系统，可以比系统更松或更严。"
            description={
              dashboard.effective_bet_limits
                ? `当前对伞下生效：TRX 最小 ${number(dashboard.effective_bet_limits.min_bet_trx)}，TRON USDT 最小 ${number(dashboard.effective_bet_limits.min_bet_usdt)}，BSC USDT 最小 ${number(dashboard.effective_bet_limits.min_bet_usdt_bsc)}，单笔上限 ${number(dashboard.effective_bet_limits.max_bet)}`
                : null
            }
            style={{ marginBottom: 16 }}
          />
          <Form
            key={`bet-limits-${dashboard.updated_at || session.code}`}
            layout="vertical"
            initialValues={{
              min_bet_trx: dashboard.min_bet_trx,
              min_bet_usdt: dashboard.min_bet_usdt,
              min_bet_usdt_bsc: dashboard.min_bet_usdt_bsc,
              max_bet: dashboard.max_bet,
            }}
            onFinish={(values) =>
              runAction(
                () =>
                  updateShareholderBetLimits({
                    min_bet_trx: values.min_bet_trx ?? null,
                    min_bet_usdt: values.min_bet_usdt ?? null,
                    min_bet_usdt_bsc: values.min_bet_usdt_bsc ?? null,
                    max_bet: values.max_bet ?? null,
                  }),
                "投注限额已更新"
              )
            }
          >
            <Row gutter={16}>
              <Col xs={24} sm={12} md={6}>
                <Form.Item name="min_bet_trx" label="TRX 最小投注">
                  <InputNumber
                    min={0}
                    precision={6}
                    style={{ width: "100%" }}
                    placeholder={`系统 ${number(dashboard.system_bet_limits?.min_bet_trx)}`}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Form.Item name="min_bet_usdt" label="TRON USDT 最小投注">
                  <InputNumber
                    min={0}
                    precision={6}
                    style={{ width: "100%" }}
                    placeholder={`系统 ${number(dashboard.system_bet_limits?.min_bet_usdt)}`}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Form.Item name="min_bet_usdt_bsc" label="BSC USDT 最小投注">
                  <InputNumber
                    min={0}
                    precision={6}
                    style={{ width: "100%" }}
                    placeholder={`系统 ${number(dashboard.system_bet_limits?.min_bet_usdt_bsc)}`}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Form.Item name="max_bet" label="单笔投注上限">
                  <InputNumber
                    min={0}
                    precision={6}
                    style={{ width: "100%" }}
                    placeholder={`系统 ${number(dashboard.system_bet_limits?.max_bet)}`}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" htmlType="submit" loading={actionLoading}>
              保存投注限额
            </Button>
          </Form>
        </Card>

        <Card title="账户设置" style={{ marginTop: 16 }}>
          <Row gutter={[24, 8]}>
            <Col xs={24} md={12}>
              <Title level={5}><KeyOutlined /> 修改密码</Title>
              <Form
                layout="vertical"
                onFinish={(values) =>
                  runAction(
                    () =>
                      changeShareholderPassword({
                        current_password: values.old_password,
                        new_password: values.new_password,
                      }),
                    "密码已修改"
                  )
                }
              >
                <Form.Item
                  name="old_password"
                  label="当前密码"
                  rules={[{ required: true, message: "请输入当前密码" }]}
                >
                  <Input.Password />
                </Form.Item>
                <Form.Item
                  name="new_password"
                  label="新密码"
                  rules={[{ required: true, min: 6, message: "新密码至少 6 位" }]}
                >
                  <Input.Password />
                </Form.Item>
                <Form.Item
                  name="confirm_password"
                  label="确认新密码"
                  dependencies={["new_password"]}
                  rules={[
                    { required: true, message: "请确认新密码" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        return !value || getFieldValue("new_password") === value
                          ? Promise.resolve()
                          : Promise.reject(new Error("两次密码不一致"));
                      },
                    }),
                  ]}
                >
                  <Input.Password />
                </Form.Item>
                <Button htmlType="submit" loading={actionLoading}>
                  保存密码
                </Button>
              </Form>
            </Col>
            <Col xs={24} md={12}>
              <Title level={5}><PercentageOutlined /> 修改分成比例</Title>
              <Form
                layout="vertical"
                onFinish={(values) =>
                  runAction(
                    () => changeShareholderRatio({ share_ratio: Number(values.ratio) / 100 }),
                    "分成比例已提交"
                  )
                }
              >
                <Form.Item
                  name="ratio"
                  label="新比例（百分比）"
                  initialValue={selectedRatio}
                  rules={[
                    { required: true, message: "请输入比例" },
                    { type: "number", min: 0, max: 100, message: "比例应为 0 至 100" },
                  ]}
                >
                  <InputNumber
                    min={0}
                    max={100}
                    precision={2}
                    suffix="%"
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Alert
                  type="info"
                  showIcon
                  message={`占成规则：每 1% 需要 ${number(pointsPerPercent)} 积分`}
                  description={`例如设置 10% 时，积分余额必须严格大于 ${number(
                    pointsPerPercent * 10
                  )}。当前余额为 ${number(balance)}。`}
                  style={{ marginBottom: 16 }}
                />
                <Alert
                  type="warning"
                  showIcon
                  message="比例修改需要管理员审核"
                  style={{ marginBottom: 16 }}
                />
                <Button htmlType="submit" loading={actionLoading}>
                  提交比例申请
                </Button>
              </Form>
            </Col>
          </Row>
        </Card>
      </Content>
    </Layout>
  );
};

export default ShareholderPage;
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { getReferralBetResults, getUserInfo } from "../../services/api";
import { copyText, date, shorten } from "../../utils/format";
import {
  GAME_FILTER_OPTIONS,
  GAME_LABELS,
  TIME_PERIOD_OPTIONS,
  TOKEN_FILTER_OPTIONS,
  formatFilterAmount,
} from "./referralFilters";

const { Title } = Typography;

const copyAddress = async (text) => {
  if (!text) return;
  const ok = await copyText(text);
  if (ok) message.success("已复制到剪贴板");
  else message.error("复制失败");
};

const ReferralBetPanel = ({ defaultAddress = "" }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [subResults, setSubResults] = useState([]);
  const [subTotals, setSubTotals] = useState({
    total_transaction_amount: 0,
    total_final_amount: 0,
  });
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const buildParams = (values) => {
    const params = {};
    if (values.owner_address) params.owner_address = values.owner_address.trim();
    if (values.telegram_id) params.telegram_id = values.telegram_id.trim();
    if (values.game_name) params.game_name = values.game_name;
    if (values.token_symbol) params.token_symbol = values.token_symbol;
    if (values.time_period) params.time_period = values.time_period;
    return params;
  };

  const applyResponse = (payload, replaceRoot = true) => {
    const next = {
      umbrella_addresses: payload?.umbrella_addresses ?? [],
      direct_referrals: payload?.direct_referrals ?? [],
      results: payload?.results ?? [],
      total_final_amount: Number(payload?.total_final_amount ?? 0),
      total_transaction_amount: Number(payload?.total_transaction_amount ?? 0),
    };
    if (replaceRoot) setData(next);
    setSubResults(next.results);
    setSubTotals({
      total_transaction_amount: next.total_transaction_amount,
      total_final_amount: next.total_final_amount,
    });
  };

  const fetchResults = useCallback(async (values, replaceRoot = true) => {
    const params = buildParams(values);
    if (!params.owner_address && !params.telegram_id) {
      message.warning("请输入钱包地址或 Telegram ID");
      return;
    }
    setLoading(true);
    try {
      const response = await getReferralBetResults(params);
      if (!response.success) {
        message.error(response.message || "无法获取数据");
        if (replaceRoot) {
          setData(null);
          setSubResults([]);
          setSubTotals({ total_transaction_amount: 0, total_final_amount: 0 });
        }
        return;
      }
      applyResponse(response.data, replaceRoot);
    } catch {
      message.error("无法获取数据");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!defaultAddress) return;
    form.setFieldValue("owner_address", defaultAddress);
    fetchResults({
      owner_address: defaultAddress,
      time_period: form.getFieldValue("time_period") || "today",
    });
  }, [defaultAddress, fetchResults, form]);

  const fetchUserInfo = async (address) => {
    try {
      const response = await getUserInfo(address);
      setSelectedUser(response?.data?.user ?? null);
      setUserModalVisible(true);
    } catch {
      message.error("获取用户信息失败");
    }
  };

  const addressColumn = (onClick, tooltip) => ({
    dataIndex: "address",
    key: "address",
    ellipsis: true,
    render: (text) =>
      text ? (
        <Tooltip title={tooltip}>
          <span
            style={{ cursor: "pointer", color: "#1677ff", wordBreak: "break-all" }}
            onClick={() => onClick(text)}
          >
            {text}
          </span>
        </Tooltip>
      ) : (
        "-"
      ),
  });

  const resultColumns = [
    {
      title: "时间",
      dataIndex: "created_at",
      render: (text) => date(text),
    },
    {
      title: "游戏名称",
      dataIndex: "game_name",
      render: (value) => GAME_LABELS[value] || value || "-",
    },
    {
      title: "交易金额",
      dataIndex: "transaction_amount",
      render: (value) => formatFilterAmount(value),
    },
    {
      title: "最终金额",
      dataIndex: "final_amount",
      render: (value) => formatFilterAmount(value),
    },
    { title: "币种", dataIndex: "token_symbol" },
    { title: "结果", dataIndex: "user_result" },
    {
      title: "从地址",
      dataIndex: "owner_address",
      render: (text) =>
        text ? (
          <Tooltip title="点击复制完整地址">
            <span
              style={{ cursor: "pointer", color: "#1677ff" }}
              onClick={() => copyAddress(text)}
            >
              {shorten(text)}
            </span>
          </Tooltip>
        ) : (
          "-"
        ),
    },
    {
      title: "到地址",
      dataIndex: "to_address",
      render: (text) =>
        text ? (
          <Tooltip title="点击复制完整地址">
            <span
              style={{ cursor: "pointer", color: "#1677ff" }}
              onClick={() => copyAddress(text)}
            >
              {shorten(text)}
            </span>
          </Tooltip>
        ) : (
          "-"
        ),
    },
    {
      title: "交易哈希",
      dataIndex: "tx_id",
      render: (text) =>
        text ? (
          <Tooltip title="点击复制完整哈希">
            <span
              style={{ cursor: "pointer", color: "#1677ff" }}
              onClick={() => copyAddress(text)}
            >
              {shorten(text)}
            </span>
          </Tooltip>
        ) : (
          "-"
        ),
    },
  ];

  return (
    <>
      <Form
        form={form}
        layout="inline"
        initialValues={{ time_period: "today", owner_address: defaultAddress }}
        onFinish={(values) => fetchResults(values, true)}
        style={{ marginBottom: 16, rowGap: 12 }}
      >
        <Form.Item name="owner_address">
          <Input placeholder="钱包地址" allowClear style={{ width: 280 }} />
        </Form.Item>
        <Form.Item name="telegram_id">
          <Input placeholder="Telegram ID" allowClear style={{ width: 140 }} />
        </Form.Item>
        <Form.Item name="game_name">
          <Select
            placeholder="游戏名称"
            allowClear
            options={GAME_FILTER_OPTIONS}
            style={{ width: 130 }}
          />
        </Form.Item>
        <Form.Item name="token_symbol">
          <Select
            placeholder="币种"
            allowClear
            options={TOKEN_FILTER_OPTIONS}
            style={{ width: 110 }}
          />
        </Form.Item>
        <Form.Item name="time_period" label="时间周期">
          <Select
            placeholder="选择时间周期"
            allowClear
            options={TIME_PERIOD_OPTIONS}
            style={{ width: 130 }}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading}>
            查询
          </Button>
        </Form.Item>
      </Form>

      {data ? (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={12}>
              <Title level={5}>直推列表（共 {data.direct_referrals?.length || 0} 个）</Title>
              <Table
                size="small"
                rowKey="address"
                pagination={{ pageSize: 5 }}
                dataSource={(data.direct_referrals || []).map((address) => ({ address }))}
                columns={[
                  addressColumn(
                    (address) =>
                      fetchResults({ ...form.getFieldsValue(), owner_address: address }, false),
                    "点击查看此地址的伞下交易"
                  ),
                ]}
                locale={{ emptyText: <Empty description="暂无直推" /> }}
              />
            </Col>
            <Col xs={24} lg={12}>
              <Title level={5}>伞下列表（共 {data.umbrella_addresses?.length || 0} 个）</Title>
              <Table
                size="small"
                rowKey="address"
                pagination={{ pageSize: 5 }}
                dataSource={(data.umbrella_addresses || []).map((address) => ({ address }))}
                columns={[addressColumn(fetchUserInfo, "点击查看用户信息")]}
                locale={{ emptyText: <Empty description="暂无伞下用户" /> }}
              />
            </Col>
          </Row>

          <Title level={5}>
            伞下交易列表（总交易: {formatFilterAmount(subTotals.total_transaction_amount)}，总返还:{" "}
            {formatFilterAmount(subTotals.total_final_amount)}）
          </Title>
          <Table
            rowKey={(row) => row.id || row.tx_id || JSON.stringify(row)}
            loading={loading}
            size="small"
            dataSource={subResults}
            columns={resultColumns}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 980 }}
            locale={{ emptyText: <Empty description="暂无交易记录" /> }}
          />
        </>
      ) : (
        <Empty description="请输入地址后查询伞下投注数据" />
      )}

      <Modal
        title="用户信息"
        open={userModalVisible}
        footer={null}
        onCancel={() => setUserModalVisible(false)}
        width={600}
      >
        {selectedUser ? (
          <Descriptions bordered column={1} size="small" labelStyle={{ fontWeight: "bold" }}>
            <Descriptions.Item label="Telegram ID">
              {selectedUser.telegram_id ?? "无"}
            </Descriptions.Item>
            <Descriptions.Item label="用户地址">
              <Tag
                color="blue"
                style={{ cursor: "pointer" }}
                onClick={() => copyAddress(selectedUser.owner_address)}
              >
                {selectedUser.owner_address
                  ? `${selectedUser.owner_address.slice(0, 8)}...${selectedUser.owner_address.slice(-8)}`
                  : "无"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="推荐人">
              {selectedUser.referrer || "无"}
            </Descriptions.Item>
            <Descriptions.Item label="推荐码">
              {selectedUser.referral_code || "无"}
            </Descriptions.Item>
            <Descriptions.Item label="总下注 (TRX)">
              {formatFilterAmount(selectedUser.total_bet_trx)} TRX
            </Descriptions.Item>
            <Descriptions.Item label="总下注 (USDT)">
              {formatFilterAmount(selectedUser.total_bet_usdt)} USDT
            </Descriptions.Item>
            <Descriptions.Item label="总赢取 (TRX)">
              {formatFilterAmount(selectedUser.total_win_trx)} TRX
            </Descriptions.Item>
            <Descriptions.Item label="总赢取 (USDT)">
              {formatFilterAmount(selectedUser.total_win_usdt)} USDT
            </Descriptions.Item>
            <Descriptions.Item label="佣金率">
              {selectedUser.commission_rate !== null && selectedUser.commission_rate !== undefined
                ? `${selectedUser.commission_rate}`
                : "无"}
            </Descriptions.Item>
            <Descriptions.Item label="总佣金 (TRX)">
              {formatFilterAmount(selectedUser.total_commission_trx)} TRX
            </Descriptions.Item>
            <Descriptions.Item label="总佣金 (USDT)">
              {formatFilterAmount(selectedUser.total_commission_usdt)} USDT
            </Descriptions.Item>
            <Descriptions.Item label="加入时间">
              {date(selectedUser.join_time)}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="未找到用户" />
        )}
      </Modal>
    </>
  );
};

export default ReferralBetPanel;

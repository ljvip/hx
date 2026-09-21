import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Empty,
  Form,
  Input,
  Select,
  Table,
  Tooltip,
  Typography,
  message,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { getReferralCommissionResults } from "../../services/api";
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
  if (ok) message.success("地址已复制到剪贴板");
  else message.error("复制失败");
};

const ReferralCommissionPanel = ({ defaultAddress = "" }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchResults = useCallback(async (values) => {
    const params = {};
    if (values.owner_address) params.owner_address = values.owner_address.trim();
    if (values.telegram_id) params.telegram_id = values.telegram_id.trim();
    if (values.game_name) params.game_name = values.game_name;
    if (values.token_symbol) params.token_symbol = values.token_symbol;
    if (values.time_period) params.time_period = values.time_period;
    if (!params.owner_address && !params.telegram_id) {
      message.warning("请输入钱包地址或 Telegram ID");
      return;
    }

    setLoading(true);
    try {
      const response = await getReferralCommissionResults(params);
      if (!response.success) {
        message.error(response.message || "无法获取数据");
        setData(null);
        return;
      }
      setData(response.data);
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

  const resultColumns = [
    {
      title: "时间",
      dataIndex: "created_at",
      render: (text) => date(text),
    },
    {
      title: "游戏名称",
      dataIndex: "game_type",
      render: (value) => GAME_LABELS[value] || value || "-",
    },
    {
      title: "贡献地址",
      dataIndex: "sender_addr",
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
    { title: "贡献者", dataIndex: "sender_code" },
    {
      title: "受益人地址",
      dataIndex: "receiver_addr",
      render: (text) =>
        text ? (
          <Tooltip title="点击复制完整地址">
            <span
              style={{ cursor: "pointer", color: "#1677ff" }}
              onClick={() => copyAddress(text)}
            >
              {text === "888888888888888888" ? "系统" : shorten(text)}
            </span>
          </Tooltip>
        ) : (
          "-"
        ),
    },
    { title: "受益人", dataIndex: "receiver_code" },
    {
      title: "下注金额",
      dataIndex: "bet_amount",
      render: (value) => formatFilterAmount(value),
    },
    {
      title: "佣金",
      dataIndex: "commission",
      render: (value) => formatFilterAmount(value),
    },
    {
      title: "佣金提取",
      dataIndex: "withdraw_amount",
      render: (value) => formatFilterAmount(value),
    },
    { title: "币种", dataIndex: "token_symbol" },
    {
      title: "佣金比例",
      dataIndex: "commission_rate",
      render: (rate) => `${(Number(rate || 0) * 100).toFixed(0)}%`,
    },
    { title: "备注", dataIndex: "remark" },
  ];

  return (
    <>
      <Form
        form={form}
        layout="inline"
        initialValues={{ time_period: "today", owner_address: defaultAddress }}
        onFinish={fetchResults}
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
          <Title level={5}>
            伞下会员列表（共 {data.umbrella_addresses?.length || 0} 个）
          </Title>
          <Table
            size="small"
            rowKey="address"
            pagination={{ pageSize: 5 }}
            style={{ marginBottom: 16 }}
            dataSource={(data.umbrella_addresses || []).map((address) => ({ address }))}
            columns={[{ dataIndex: "address", key: "address", ellipsis: true }]}
            locale={{ emptyText: <Empty description="暂无伞下会员" /> }}
          />

          <Title level={5}>
            佣金记录（总下注: {formatFilterAmount(data.total_commission_bet_amount)}，总佣金:{" "}
            {formatFilterAmount(data.total_commission)}）
          </Title>
          <Table
            rowKey={(row) => row.id || JSON.stringify(row)}
            loading={loading}
            size="small"
            dataSource={data.commission_records || []}
            columns={resultColumns}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1100 }}
            locale={{ emptyText: <Empty description="暂无佣金记录" /> }}
          />
        </>
      ) : (
        <Empty description="请输入地址后查询伞下佣金数据" />
      )}
    </>
  );
};

export default ReferralCommissionPanel;

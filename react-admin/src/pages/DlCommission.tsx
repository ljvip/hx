// src/pages/DlCommission.tsx
import React, { useState } from 'react';
import { apiClient } from '../api/request';
import {
  Table,
  Input,
  Button,
  message,
  Select,
  Form,
  Tooltip,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const { Option } = Select;

interface BetResult {
  id: number;
  receiver_code: string | null;
  receiver_addr: string | null;
  sender_code: string;
  sender_addr: string;
  bet_amount: number | string;
  commission: number | string;
  commission_rate: number | string;
  game_type: string;
  token_symbol: string;
  remark: string;
  withdraw_amount: number | string;
  created_at: string;
}

interface ApiResponse {
  umbrella_addresses: string[];
  commission_records: BetResult[];
  total_commission_bet_amount: number | string;
  total_commission: number | string;
  referral_codes?: string[];
  referrer_addresses?: string[];
  addresses?: string[];
  results?: BetResult[];
}

interface CommissionFilterValues {
  owner_address?: string;
  game_name?: string;
  token_symbol?: string;
  time_period?: string;
}

const DlCommission: React.FC = () => {
  const [form] = Form.useForm();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchResults = async (values: CommissionFilterValues) => {
    setLoading(true);
    try {
      const params: CommissionFilterValues = {};

      if (values.owner_address) params.owner_address = values.owner_address;
      if (values.game_name) params.game_name = values.game_name;
      if (values.token_symbol) params.token_symbol = values.token_symbol;
      if (values.time_period) params.time_period = values.time_period;

      const response = await apiClient.get<ApiResponse>('/api/referral-commission-results', { params });
      setData(response);
    } catch {
      message.error('无法获取数据');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = (values: CommissionFilterValues) => {
    fetchResults(values);
  };

  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('地址已复制到剪贴板');
    } catch {
      message.error('复制失败');
    }
  };

  const resultColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      render: (text: string) => text ? new Date(text).toLocaleString() : '-'
    },
    { title: '游戏名称', dataIndex: 'game_type' },
    {
      title: '贡献地址',
      dataIndex: 'sender_addr',
      render: (text: string | null) =>
        text ? (
          <Tooltip title="点击复制完整地址">
            <span
              style={{ cursor: 'pointer', color: '#1890ff' }}
              onClick={() => copyToClipboard(text)}
            >
              {`${text.slice(0, 4)}...${text.slice(-7)}`}
            </span>
          </Tooltip>
        ) : '-',
    },
    { title: '贡献者', dataIndex: 'sender_code' },
    {
      title: '受益人地址',
      dataIndex: 'receiver_addr',
      render: (text: string | null) =>
        text ? (
          <Tooltip title="点击复制完整地址">
            <span
              style={{ cursor: 'pointer', color: '#1890ff' }}
              onClick={() => copyToClipboard(text)}
            >
              {text === '888888888888888888' ? '系统' : `${text.slice(0, 4)}...${text.slice(-7)}`}
            </span>
          </Tooltip>
        ) : '-',
    },
    { title: '受益人', dataIndex: 'receiver_code' },
    {
      title: '下注金额',
      dataIndex: 'bet_amount',
      render: (value: number | string) => Number(value || 0).toFixed(2),
    },
    {
      title: '佣金',
      dataIndex: 'commission',
      render: (value: number | string) => Number(value || 0).toFixed(2),
    },
    {
      title: '佣金提取',
      dataIndex: 'withdraw_amount',
      render: (value: number | string) => Number(value || 0).toFixed(2),
    },
    { title: '币种', dataIndex: 'token_symbol' },
    {
      title: '佣金比例',
      dataIndex: 'commission_rate',
      render: (rate: number | string) => `${(Number(rate || 0) * 100).toFixed(0)}%`
    },
    { title: '备注', dataIndex: 'remark' },
  ];

  return (
    <div>
      <Form
        form={form}
        layout="inline"
        onFinish={onFinish}
        style={{ marginBottom: 16, flexWrap: 'wrap' }}
      >
        <Form.Item name="owner_address">
          <Input
            placeholder="Owner Address"
            allowClear
            style={{ width: 280 }}
          />
        </Form.Item>
        <Form.Item name="game_name">
          <Select placeholder="游戏名称" allowClear style={{ width: 120 }}>
            <Option value="tenfold_bull">十倍牛</Option>
            <Option value="single_double">单双</Option>
            <Option value="pingbei_niuniu">平倍牛</Option>
            <Option value="big_small">大小</Option>
            <Option value="hash_baccarat">百家乐</Option>
            <Option value="hash_lucky">幸运</Option>
            <Option value="lucky_banker">庄闲</Option>
          </Select>
        </Form.Item>
        <Form.Item name="token_symbol">
          <Select placeholder="币种" allowClear style={{ width: 100 }}>
            <Option value="USDT">USDT</Option>
            <Option value="TRX">TRX</Option>
          </Select>
        </Form.Item>
        <Form.Item name="time_period" label="时间周期">
          <Select
            placeholder="选择时间周期"
            allowClear
            style={{ width: 100 }}
          >
            <Option value="today">今天</Option>
            <Option value="yesterday">昨天</Option>
            <Option value="this_week">本周</Option>
            <Option value="last_week">上周</Option>
            <Option value="this_month">本月</Option>
            <Option value="last_month">上月</Option>
          </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" icon={<SearchOutlined />} htmlType="submit">
            查询
          </Button>
        </Form.Item>
      </Form>

      {data && (
        <>
          <div style={{ display: 'flex', gap: '20px', marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <h4>伞下会员列表（共 {data.umbrella_addresses?.length || 0} 个）</h4>
              <Table
                dataSource={(data.umbrella_addresses || []).map((addr, index) => ({
                  key: index,
                  address: addr
                }))}
                columns={[{ dataIndex: 'address', key: 'address' }]}
                pagination={{ pageSize: 5 }}
                size="small"
              />
            </div>
          </div>

          <h4>
            佣金记录（总下注: {Number(data.total_commission_bet_amount || 0).toFixed(2)},
            总佣金: {Number(data.total_commission || 0).toFixed(2)}）
          </h4>

          <Table
            rowKey="id"
            loading={loading}
            dataSource={data.commission_records || []}
            columns={resultColumns}
            pagination={{ pageSize: 10 }}
          />
        </>
      )}
    </div>
  );
};

export default DlCommission;
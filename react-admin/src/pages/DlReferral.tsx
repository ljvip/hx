// src/pages/DlReferral.tsx
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
  Modal,
  Descriptions,
  Tag,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const { Option } = Select;

type Numeric = number | string | null | undefined;

interface BetResult {
  id: number;
  block_number: number;
  block_hash: string;
  owner_address: string;
  to_address: string;
  game_name: string;
  transaction_amount: Numeric;
  token_symbol: string;
  tx_id: string;
  game_result: string;
  user_result: string;
  final_amount: Numeric;
  created_at: string;
}

interface ApiResponse {
  umbrella_addresses: string[];
  direct_referrals: string[];
  results: BetResult[];
  total_final_amount: Numeric;
  total_transaction_amount: Numeric;
}

interface UserInfo {
  id: number;
  telegram_id: number | string | null;
  owner_address: string;
  name: string;
  referrer: string;
  referral_code: string;
  ReferrerChain?: string;
  total_bet_trx: Numeric;
  total_bet_usdt: Numeric;
  total_win_trx: Numeric;
  total_win_usdt: Numeric;
  use_trx: Numeric;
  use_usdt: Numeric;
  commission_rate: Numeric;
  total_commission_trx: Numeric;
  total_commission_usdt: Numeric;
  join_time: string;
}

interface ReferralFilterValues {
  owner_address?: string;
  telegram_id?: string;
  game_name?: string;
  token_symbol?: string;
  time_period?: string;
}

// 统一把后端返回的 number | string 转成 number，保证 toFixed 可用
const toNumber = (value: Numeric): number => {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatAmount = (value: Numeric, digits = 2): string =>
  toNumber(value).toFixed(digits);

// 地址/哈希缩写
const shorten = (text: string) =>
  text.length > 12 ? `${text.slice(0, 4)}...${text.slice(-7)}` : text;

const DlReferral: React.FC = () => {
  const [form] = Form.useForm();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [subResults, setSubResults] = useState<BetResult[]>([]);
  const [subTotals, setSubTotals] = useState({
    total_transaction_amount: 0,
    total_final_amount: 0,
  });
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // 降级方案
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      message.success('已复制到剪贴板');
    } catch {
      message.error('复制失败');
    }
  };

  const buildParams = (values: ReferralFilterValues): ReferralFilterValues => {
    const params: ReferralFilterValues = {};
    if (values.owner_address) params.owner_address = values.owner_address;
    if (values.telegram_id) params.telegram_id = values.telegram_id;
    if (values.game_name) params.game_name = values.game_name;
    if (values.token_symbol) params.token_symbol = values.token_symbol;
    if (values.time_period) params.time_period = values.time_period;
    return params;
  };

  const fetchResults = async (values: ReferralFilterValues) => {
    setLoading(true);
    try {
      const params = buildParams(values);

      const response = await apiClient.get<ApiResponse>(
        '/api/referral-bet-results',
        { params }
      );

      setData({
        umbrella_addresses: response?.umbrella_addresses ?? [],
        direct_referrals: response?.direct_referrals ?? [],
        results: response?.results ?? [],
        total_final_amount: response?.total_final_amount ?? 0,
        total_transaction_amount: response?.total_transaction_amount ?? 0,
      });
      setSubResults(response?.results ?? []);
      setSubTotals({
        total_transaction_amount: toNumber(response?.total_transaction_amount),
        total_final_amount: toNumber(response?.total_final_amount),
      });
    } catch {
      message.error('无法获取数据');
      setData(null);
      setSubResults([]);
      setSubTotals({ total_transaction_amount: 0, total_final_amount: 0 });
    } finally {
      setLoading(false);
    }
  };

  // 点击直推地址：查看该地址伞下交易，保留当前表单其他筛选条件
  const fetchSubTransactions = async (owner_address: string) => {
    setLoading(true);
    try {
      const current = form.getFieldsValue() as ReferralFilterValues;
      const params = buildParams({ ...current, owner_address });

      const response = await apiClient.get<ApiResponse>(
        '/api/referral-bet-results',
        { params }
      );

      setSubResults(response?.results ?? []);
      setSubTotals({
        total_transaction_amount: toNumber(response?.total_transaction_amount),
        total_final_amount: toNumber(response?.total_final_amount),
      });
    } catch {
      message.error('获取伞下交易数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserInfo = async (address: string) => {
    try {
      const response = await apiClient.get<{ message: string; user: UserInfo }>(
        `/user/${address}`
      );
      setSelectedUser(response?.user ?? null);
      setUserModalVisible(true);
    } catch {
      message.error('获取用户信息失败');
    }
  };

  const onFinish = (values: ReferralFilterValues) => {
    fetchResults(values);
  };

  const resultColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      render: (text: string) => (text ? new Date(text).toLocaleString() : '-'),
    },
    { title: '游戏名称', dataIndex: 'game_name' },
    {
      title: '交易金额',
      dataIndex: 'transaction_amount',
      render: (value: Numeric) => formatAmount(value),
    },
    {
      title: '最终金额',
      dataIndex: 'final_amount',
      render: (value: Numeric) => formatAmount(value),
    },
    { title: '币种', dataIndex: 'token_symbol' },
    { title: '结果', dataIndex: 'user_result' },
    {
      title: '从地址',
      dataIndex: 'owner_address',
      render: (text: string | null) =>
        text ? (
          <Tooltip title="点击复制完整地址">
            <span
              style={{ cursor: 'pointer', color: '#1890ff' }}
              onClick={() => copyToClipboard(text)}
            >
              {shorten(text)}
            </span>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: '到地址',
      dataIndex: 'to_address',
      render: (text: string | null) =>
        text ? (
          <Tooltip title="点击复制完整地址">
            <span
              style={{ cursor: 'pointer', color: '#1890ff' }}
              onClick={() => copyToClipboard(text)}
            >
              {shorten(text)}
            </span>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: '交易哈希',
      dataIndex: 'tx_id',
      render: (text: string | null) =>
        text ? (
          <Tooltip title="点击复制完整地址">
            <span
              style={{ cursor: 'pointer', color: '#1890ff' }}
              onClick={() => copyToClipboard(text)}
            >
              {shorten(text)}
            </span>
          </Tooltip>
        ) : (
          '-'
        ),
    },
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
          <Input placeholder="Owner Address" allowClear style={{ width: 280 }} />
        </Form.Item>
        <Form.Item name="telegram_id">
          <Input placeholder="Telegram ID" allowClear style={{ width: 120 }} />
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
          <Select placeholder="选择时间周期" allowClear style={{ width: 120 }}>
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
              <h4>直推列表（共 {data.direct_referrals?.length || 0} 个）</h4>
              <Table
                dataSource={(data.direct_referrals || []).map((addr) => ({
                  key: addr,
                  address: addr,
                }))}
                columns={[
                  {
                    dataIndex: 'address',
                    key: 'address',
                    render: (text: string) => (
                      <Tooltip title="点击查看此地址的伞下交易">
                        <span
                          style={{ cursor: 'pointer', color: '#1890ff' }}
                          onClick={() => fetchSubTransactions(text)}
                        >
                          {text}
                        </span>
                      </Tooltip>
                    ),
                  },
                ]}
                pagination={{ pageSize: 5 }}
                size="small"
              />
            </div>

            <div style={{ flex: 1 }}>
              <h4>伞下列表（共 {data.umbrella_addresses?.length || 0} 个）</h4>
              <Table
                dataSource={(data.umbrella_addresses || []).map((addr) => ({
                  key: addr,
                  address: addr,
                }))}
                columns={[
                  {
                    dataIndex: 'address',
                    key: 'address',
                    render: (text: string) => (
                      <Tooltip title="点击查看用户信息">
                        <span
                          style={{ cursor: 'pointer', color: '#1890ff' }}
                          onClick={() => fetchUserInfo(text)}
                        >
                          {text}
                        </span>
                      </Tooltip>
                    ),
                  },
                ]}
                pagination={{ pageSize: 5 }}
                size="small"
              />
            </div>
          </div>

          <h4>
            伞下交易列表（总交易:{' '}
            {subTotals.total_transaction_amount.toFixed(2)}, 总返还:{' '}
            {subTotals.total_final_amount.toFixed(2)}）
          </h4>

          <Table
            rowKey="id"
            loading={loading}
            dataSource={subResults}
            columns={resultColumns}
            pagination={{ pageSize: 10 }}
          />
        </>
      )}

      <Modal
        title="用户信息"
        open={userModalVisible}
        footer={null}
        onCancel={() => setUserModalVisible(false)}
        width={600}
      >
        {selectedUser ? (
          <div>
            <Descriptions
              bordered
              column={1}
              size="small"
              labelStyle={{ fontWeight: 'bold' }}
            >
              <Descriptions.Item label="Telegram ID">
                {selectedUser.telegram_id ?? '无'}
              </Descriptions.Item>
              <Descriptions.Item label="用户地址">
                <Tag
                  color="blue"
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    copyToClipboard(selectedUser.owner_address || '')
                  }
                >
                  {selectedUser.owner_address
                    ? `${selectedUser.owner_address.slice(0, 8)}...${selectedUser.owner_address.slice(-8)}`
                    : '无'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="推荐人">
                {selectedUser.referrer || '无'}
              </Descriptions.Item>
              <Descriptions.Item label="推荐码">
                {selectedUser.referral_code || '无'}
              </Descriptions.Item>
              <Descriptions.Item label="推荐链">
                {selectedUser.ReferrerChain || '无'}
              </Descriptions.Item>
              <Descriptions.Item label="总下注 (TRX)">
                {formatAmount(selectedUser.total_bet_trx)} TRX
              </Descriptions.Item>
              <Descriptions.Item label="总下注 (USDT)">
                {formatAmount(selectedUser.total_bet_usdt)} USDT
              </Descriptions.Item>
              <Descriptions.Item label="总赢取 (TRX)">
                {formatAmount(selectedUser.total_win_trx)} TRX
              </Descriptions.Item>
              <Descriptions.Item label="总赢取 (USDT)">
                {formatAmount(selectedUser.total_win_usdt)} USDT
              </Descriptions.Item>
              <Descriptions.Item label="已兑换 (TRX)">
                {formatAmount(selectedUser.use_trx)} TRX
              </Descriptions.Item>
              <Descriptions.Item label="已兑换 (USDT)">
                {formatAmount(selectedUser.use_usdt)} USDT
              </Descriptions.Item>
              <Descriptions.Item label="佣金率">
                {selectedUser.commission_rate !== null &&
                selectedUser.commission_rate !== undefined &&
                selectedUser.commission_rate !== ''
                  ? `${selectedUser.commission_rate}%`
                  : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="总佣金 (TRX)">
                {formatAmount(selectedUser.total_commission_trx)} TRX
              </Descriptions.Item>
              <Descriptions.Item label="总佣金 (USDT)">
                {formatAmount(selectedUser.total_commission_usdt)} USDT
              </Descriptions.Item>
              <Descriptions.Item label="加入时间">
                {selectedUser.join_time
                  ? new Date(selectedUser.join_time).toLocaleString()
                  : '-'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        ) : (
          <div>加载中...</div>
        )}
      </Modal>
    </div>
  );
};

export default DlReferral;
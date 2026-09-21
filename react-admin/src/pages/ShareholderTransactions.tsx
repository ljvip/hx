// src/pages/ShareholderTransactions.tsx
import React, { useState, useEffect } from 'react';
import {
  Table,
  Input,
  Button,
  Select,
  DatePicker,
  Form,
  Card,
  Statistic,
  Row,
  Col,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import {
  shareholderApi,
  ShareholderTransaction,
  Shareholder,
  ShareholderTransactionFilters,
} from '../api/shareholder';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface TransactionWithUser extends ShareholderTransaction {
  user_name?: string;
  shareholder_code?: string;
}

interface TransactionFormValues extends ShareholderTransactionFilters {
  date_range?: [dayjs.Dayjs, dayjs.Dayjs];
}

const ShareholderTransactions: React.FC = () => {
  const [form] = Form.useForm();
  const [transactions, setTransactions] = useState<TransactionWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total_change: 0,
    total_profit: 0,
    total_loss: 0,
    total_commission: 0,
  });
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [selectedShareholder, setSelectedShareholder] = useState<number | null>(null);

  useEffect(() => {
    fetchShareholders();
  }, []);

  const fetchShareholders = async () => {
    try {
      const data = await shareholderApi.getAllShareholders();
      setShareholders(data);
    } catch (error: unknown) {
      console.error('获取股东列表失败', error);
    }
  };

  const fetchTransactions = async (values: TransactionFormValues = {}) => {
    setLoading(true);
    try {
      const { date_range, ...filterValues } = values;
      const params: ShareholderTransactionFilters = {
        limit: 100,
        ...filterValues,
      };

      if (date_range) {
        params.start_date = date_range[0].format('YYYY-MM-DD');
        params.end_date = date_range[1].format('YYYY-MM-DD');
      }

      const userId = params.user_id || selectedShareholder;
      if (!userId) {
        message.warning('请选择股东');
        setLoading(false);
        return;
      }

      const response = await shareholderApi.getTransactions(userId, params);
      setTransactions(response.transactions || []);
      setTotal(response.total || 0);

      const txs = response.transactions || [];
      const totalChange = txs.reduce((sum, t) => sum + (Number(t.change_amount) || 0), 0);
      const totalProfit = txs.reduce(
        (sum, t) => sum + (Number(t.change_amount) > 0 ? Number(t.change_amount) : 0),
        0
      );
      const totalLoss = txs.reduce(
        (sum, t) => sum + (Number(t.change_amount) < 0 ? Number(t.change_amount) : 0),
        0
      );
      const totalCommission = txs.reduce((sum, t) => sum + (Number(t.commission) || 0), 0);

      setStats({
        total_change: totalChange,
        total_profit: totalProfit,
        total_loss: totalLoss,
        total_commission: totalCommission,
      });
    } catch {
      message.error('获取交易记录失败');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = (values: TransactionFormValues) => {
    fetchTransactions(values);
  };

  const handleShareholderChange = (value: number) => {
    setSelectedShareholder(value);
    form.setFieldsValue({ user_id: value });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制');
    } catch {
      message.error('复制失败');
    }
  };

  const columns = [
    {
      title: '交易ID',
      dataIndex: 'trade_no',
      render: (text: string) => (
        <Tooltip title="点击复制">
          <span
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => copyToClipboard(text)}
          >
            {text.slice(0, 8)}...
          </span>
        </Tooltip>
      ),
    },
    {
      title: '股东',
      dataIndex: 'shareholder_code',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '游戏',
      dataIndex: 'game_name',
      render: (text: string) => text || '-',
    },
    {
      title: '投注金额',
      dataIndex: 'bet_amount',
      render: (val: number | string) => Number(val || 0).toFixed(2),
    },
    {
      title: '赔率',
      dataIndex: 'odds',
      render: (val: number | string) => Number(val || 0).toFixed(2),
    },
    {
      title: '占成比例',
      dataIndex: 'share_ratio',
      render: (val: number | string) => `${(Number(val || 0) * 100).toFixed(1)}%`,
    },
    {
      title: '盈亏',
      dataIndex: 'profit_loss',
      render: (val: number | string) => (
        <span style={{ color: Number(val) >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {Number(val || 0).toFixed(4)}
        </span>
      ),
    },
    {
      title: '佣金',
      dataIndex: 'commission',
      render: (val: number | string) => (
        <span style={{ color: '#ff4d4f' }}>{Number(val || 0).toFixed(4)}</span>
      ),
    },
    {
      title: '净变动',
      dataIndex: 'change_amount',
      render: (val: number | string) => (
        <span
          style={{
            color: Number(val) > 0 ? '#52c41a' : Number(val) < 0 ? '#ff4d4f' : '#888',
            fontWeight: 'bold',
          }}
        >
          {Number(val) > 0 ? '+' : ''}{Number(val || 0).toFixed(4)}
        </span>
      ),
      sorter: (a: TransactionWithUser, b: TransactionWithUser) =>
        Number(a.change_amount) - Number(b.change_amount),
    },
    {
      title: '余额',
      dataIndex: 'balance_after',
      render: (val: number | string) => Number(val || 0).toFixed(4),
    },
    {
      title: '结果',
      dataIndex: 'result',
      render: (val: number) => (
        <Tag color={val === 1 ? 'green' : 'red'}>
          {val === 1 ? '赢' : '输'}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div>
      <Card title="股东积分查询" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={onFinish} style={{ flexWrap: 'wrap', gap: 8 }}>
          <Form.Item name="user_id" label="选择股东">
            <Select
              placeholder="请选择股东"
              style={{ width: 200 }}
              allowClear
              onChange={handleShareholderChange}
              showSearch
              optionFilterProp="children"
            >
              {shareholders.map((s) => (
                <Option key={s.id} value={s.user_id}>
                  {s.code} - {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="game_name" label="游戏">
            <Select placeholder="全部游戏" style={{ width: 120 }} allowClear>
              <Option value="hash_baccarat">百家乐</Option>
              <Option value="hash_lucky">幸运</Option>
              <Option value="lucky_banker">庄闲</Option>
              <Option value="single_double">单双</Option>
              <Option value="big_small">大小</Option>
              <Option value="tenfold_bull">十倍牛</Option>
              <Option value="pingbei_niuniu">平倍牛</Option>
            </Select>
          </Form.Item>

          <Form.Item name="date_range" label="时间范围">
            <RangePicker />
          </Form.Item>

          <Form.Item name="trade_no">
            <Input placeholder="交易ID" style={{ width: 180 }} allowClear />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              查询
            </Button>
          </Form.Item>

          <Form.Item>
            <Button onClick={() => { form.resetFields(); fetchTransactions(); }} icon={<ReloadOutlined />}>
              重置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {selectedShareholder && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="净变动"
                value={stats.total_change}
                precision={4}
                valueStyle={{ color: stats.total_change >= 0 ? '#52c41a' : '#ff4d4f' }}
                prefix={stats.total_change >= 0 ? <RiseOutlined /> : <FallOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="总盈利"
                value={stats.total_profit}
                precision={4}
                valueStyle={{ color: '#52c41a' }}
                prefix={<RiseOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="总亏损"
                value={stats.total_loss}
                precision={4}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<FallOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="总佣金"
                value={stats.total_commission}
                precision={4}
                prefix={<DollarOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={transactions}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          scroll={{ x: 1400 }}
        />
      </Card>
    </div>
  );
};

export default ShareholderTransactions;
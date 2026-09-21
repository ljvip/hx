// src/pages/BetResults.tsx
import { Input, Button, Form, Select, Tooltip, message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { betApi, BetFilters, BetResult } from '../api';
import dayjs from 'dayjs';
import ResponsiveCard from '../components/ResponsiveCard';
import ResponsiveTable from '../components/ResponsiveTable';
import { useResponsive } from '../hooks/useResponsive';

const BetResults = () => {
  const [data, setData] = useState<BetResult[]>([]);
  const [totalTransactionAmount, setTotalTransactionAmount] = useState<number>(0);
  const [totalFinalAmount, setTotalFinalAmount] = useState<number>(0);
  const [totalWinLoss, setTotalWinLoss] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const { isMobile } = useResponsive();

  const [filters, setFilters] = useState<BetFilters>({
    owner_address: '',
    to_address: '',
    game_name: '',
    token_symbol: '',
    time_period: 'today',
  });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchBetResults = useCallback(async () => {
    setLoading(true);
    try {
      const response = await betApi.getResults(filtersRef.current);
      const results = response.results || [];
      setData(results);

      const totalTrans = Number(response.total_transaction_amount) || 0;
      const totalFinal = Number(response.total_final_amount) || 0;
      setTotalTransactionAmount(totalTrans);
      setTotalFinalAmount(totalFinal);
      setTotalWinLoss(totalFinal - totalTrans);
    } catch (error) {
      console.error('Error fetching bet results:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('地址已复制到剪贴板');
    } catch {
      message.error('复制失败');
    }
  };

  useEffect(() => {
    fetchBetResults();
  }, [fetchBetResults]);

  const handleFilterChange = (value: string, key: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const columns = [
    {
      title: '转账地址',
      dataIndex: 'owner_address',
      render: (text: string) => (
        <Tooltip title="点击复制完整地址">
          <span
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => copyToClipboard(text)}
          >
            {text ? `${text.slice(0, 4)}...${text.slice(-7)}` : '-'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '接收地址',
      dataIndex: 'to_address',
      render: (text: string) => (
        <Tooltip title="点击复制完整地址">
          <span
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => copyToClipboard(text)}
          >
            {text ? `${text.slice(0, 4)}...${text.slice(-7)}` : '-'}
          </span>
        </Tooltip>
      ),
    },
    { title: '游戏名称', dataIndex: 'game_name' },
    { title: '币种', dataIndex: 'token_symbol' },
    {
      title: '投注金额',
      dataIndex: 'transaction_amount',
      render: (value: number | string) => Number(value || 0).toFixed(2),
    },
    {
      title: '返奖金额',
      dataIndex: 'final_amount',
      render: (value: number | string) => Number(value || 0).toFixed(2),
    },
    {
      title: '输赢',
      dataIndex: 'final_amount',
      render: (_value: unknown, record: BetResult) => {
        const winLoss =
          (Number(record.final_amount) || 0) - (Number(record.transaction_amount) || 0);
        return (
          <span style={{ color: winLoss >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {winLoss.toFixed(2)}
          </span>
        );
      },
    },
    { title: '游戏结果', dataIndex: 'game_result' },
    { title: '用户结果', dataIndex: 'user_result' },
    {
      title: '交易时间',
      dataIndex: 'created_at',
      render: (text: string | number | Date | dayjs.Dayjs | null | undefined) => {
        return text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-';
      },
    },
  ];

  const cardRender = (record: BetResult) => {
    const winLoss =
      (Number(record.final_amount) || 0) - (Number(record.transaction_amount) || 0);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
          <span style={{ color: '#666', fontSize: 12 }}>游戏</span>
          <span style={{ fontWeight: 500 }}>{record.game_name || '-'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
          <span style={{ color: '#666', fontSize: 12 }}>币种</span>
          <span>{record.token_symbol || '-'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
          <span style={{ color: '#666', fontSize: 12 }}>投注</span>
          <span style={{ color: '#ff4d4f' }}>
            {Number(record.transaction_amount || 0).toFixed(2)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
          <span style={{ color: '#666', fontSize: 12 }}>返奖</span>
          <span style={{ color: '#52c41a' }}>
            {Number(record.final_amount || 0).toFixed(2)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
          <span style={{ color: '#666', fontSize: 12 }}>输赢</span>
          <span style={{ color: winLoss >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
            {winLoss.toFixed(2)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
          <span style={{ color: '#666', fontSize: 12 }}>结果</span>
          <span>{record.user_result || '-'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
          <span style={{ color: '#666', fontSize: 12 }}>时间</span>
          <span style={{ fontSize: 12 }}>{record.created_at ? dayjs(record.created_at).format('MM-DD HH:mm') : '-'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#666', fontSize: 12 }}>转账地址</span>
          <Tooltip title="点击复制完整地址">
            <span
              style={{ cursor: 'pointer', color: '#1890ff', fontSize: 12 }}
              onClick={() => copyToClipboard(record.owner_address)}
            >
              {record.owner_address ? `${record.owner_address.slice(0, 4)}...${record.owner_address.slice(-7)}` : '-'}
            </span>
          </Tooltip>
        </div>
      </div>
    );
  };

  return (
    <ResponsiveCard
      title="投注记录"
      extra={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 4 : 8 }}>
          <span style={{ fontSize: isMobile ? 11 : 14 }}>
            总投注: <strong style={{ color: '#ff4d4f' }}>{totalTransactionAmount.toFixed(2)}</strong>
          </span>
          <span style={{ fontSize: isMobile ? 11 : 14 }}>
            总返奖: <strong style={{ color: '#52c41a' }}>{totalFinalAmount.toFixed(2)}</strong>
          </span>
          <span style={{ fontSize: isMobile ? 11 : 14 }}>
            总输赢: <strong style={{ color: totalWinLoss >= 0 ? '#52c41a' : '#ff4d4f' }}>
              {totalWinLoss.toFixed(2)}
            </strong>
          </span>
        </div>
      }
    >
      <Form layout={isMobile ? 'vertical' : 'inline'} style={{ marginBottom: 20 }}>
        <Form.Item label="转账地址" style={isMobile ? { width: '100%' } : {}}>
          <Input
            placeholder="输入转账地址"
            value={filters.owner_address}
            onChange={(e) => handleFilterChange(e.target.value, 'owner_address')}
            allowClear
            style={{ width: isMobile ? '100%' : 280 }}
          />
        </Form.Item>
        <Form.Item label="接收地址" style={isMobile ? { width: '100%' } : {}}>
          <Input
            placeholder="输入接收地址"
            value={filters.to_address}
            onChange={(e) => handleFilterChange(e.target.value, 'to_address')}
            allowClear
            style={{ width: isMobile ? '100%' : 280 }}
          />
        </Form.Item>
        <Form.Item label="游戏名称" style={isMobile ? { width: '100%' } : {}}>
          <Select
            value={filters.game_name || ''}
            onChange={(value) => handleFilterChange(value, 'game_name')}
            style={{ width: isMobile ? '100%' : 120 }}
            allowClear
          >
            <Select.Option value="tenfold_bull">十倍牛</Select.Option>
            <Select.Option value="single_double">单双</Select.Option>
            <Select.Option value="pingbei_niuniu">平倍牛</Select.Option>
            <Select.Option value="big_small">大小</Select.Option>
            <Select.Option value="hash_baccarat">百家乐</Select.Option>
            <Select.Option value="hash_lucky">幸运</Select.Option>
            <Select.Option value="lucky_banker">庄闲</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="币种" style={isMobile ? { width: '100%' } : {}}>
          <Select
            value={filters.token_symbol || ''}
            onChange={(value) => handleFilterChange(value, 'token_symbol')}
            style={{ width: isMobile ? '100%' : 80 }}
            allowClear
          >
            <Select.Option value="TRX">TRX</Select.Option>
            <Select.Option value="USDT">USDT</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item label="时间周期" style={isMobile ? { width: '100%' } : {}}>
          <Select
            value={filters.time_period || 'today'}
            onChange={(value) => handleFilterChange(value, 'time_period')}
            style={{ width: isMobile ? '100%' : 80 }}
          >
            <Select.Option value="today">今天</Select.Option>
            <Select.Option value="yesterday">昨天</Select.Option>
            <Select.Option value="this_week">本周</Select.Option>
            <Select.Option value="last_week">上周</Select.Option>
            <Select.Option value="this_month">本月</Select.Option>
            <Select.Option value="last_month">上月</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item style={isMobile ? { width: '100%', marginTop: 8 } : {}}>
          <Button type="primary" onClick={fetchBetResults} block={isMobile}>
            筛选
          </Button>
        </Form.Item>
      </Form>

      <ResponsiveTable
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: isMobile ? 10 : 10, size: isMobile ? 'small' : 'default' }}
        cardRender={cardRender}
      />
    </ResponsiveCard>
  );
};

export default BetResults;
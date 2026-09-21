// src/pages/CommissionResults.tsx
import { Table, Input, Button, Form, Select, Tooltip, message, Modal } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/request';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

interface CommissionRecord {
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

interface CommissionResponse {
    results: CommissionRecord[];
}

const CommissionResults = () => {
    const [editingRecord, setEditingRecord] = useState<CommissionRecord | null>(null);
    const [newRemark, setNewRemark] = useState<string>('');
    const [data, setData] = useState<CommissionRecord[]>([]);
    const [totalBetAmount, setTotalBetAmount] = useState<number>(0);
    const [totalCommission, setTotalCommission] = useState<number>(0);
    const [filters, setFilters] = useState({
        sender_code: '',
        receiver_code: 'system',
        game_type: '',
        token_symbol: '',
        time_period: '',
    });

    const fetchCommissionRecords = useCallback(async () => {
        try {
            const response = await apiClient.get<CommissionResponse>('/api/commission-records', {
                params: { ...filters }
            });

            const results = response.results || [];
            setData(results);

            const totalBet = results.reduce((sum: number, record: CommissionRecord) => sum + (Number(record.bet_amount) || 0), 0);
            const totalComm = results.reduce((sum: number, record: CommissionRecord) => sum + (Number(record.commission) || 0), 0);
            setTotalBetAmount(totalBet);
            setTotalCommission(totalComm);
        } catch (error: unknown) {
            console.error('Error fetching commission records:', error);
            message.error('获取数据失败');
        }
    }, [filters]);

    const handleFilterChange = (value: string, key: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const handleEditRemark = (record: CommissionRecord) => {
        setEditingRecord(record);
        setNewRemark(record.remark || '');
    };

    const handleSaveRemark = async () => {
        if (!editingRecord) return;

        try {
            await apiClient.put('/api/game-commission-rate', {
                id: editingRecord.id,
                remark: newRemark,
            });
            message.success('备注更新成功');
            fetchCommissionRecords();
            setEditingRecord(null);
            setNewRemark('');
        } catch (error: unknown) {
            console.error('Error updating remark:', error);
            message.error('更新失败');
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            message.success('地址已复制到剪贴板');
        } catch {
            message.error('复制失败');
        }
    };

    const columns = [
        {
            title: '受益人',
            dataIndex: 'receiver_code',
            ellipsis: true,
            render: (text: string | null) =>
                text ? (
                    <Tooltip title="点击复制完整地址">
                        <span
                            style={{ cursor: 'pointer', color: '#1890ff' }}
                            onClick={() => copyToClipboard(text)}
                        >
                            {text}
                        </span>
                    </Tooltip>
                ) : '-',
        },
        {
            title: '贡献者',
            dataIndex: 'sender_code',
            render: (text: string) =>
                text ? (
                    <Tooltip title="点击复制完整地址">
                        <span
                            style={{ cursor: 'pointer', color: '#1890ff' }}
                            onClick={() => copyToClipboard(text)}
                        >
                            {text}
                        </span>
                    </Tooltip>
                ) : '-',
        },
        {
            title: '投注金额',
            dataIndex: 'bet_amount',
            ellipsis: true,
            sorter: (a: CommissionRecord, b: CommissionRecord) =>
                Number(a.bet_amount) - Number(b.bet_amount),
        },
        {
            title: '佣金',
            dataIndex: 'commission',
            ellipsis: true,
            sorter: (a: CommissionRecord, b: CommissionRecord) =>
                Number(a.commission) - Number(b.commission),
        },
        {
            title: '佣金提取',
            dataIndex: 'withdraw_amount',
            ellipsis: true,
            sorter: (a: CommissionRecord, b: CommissionRecord) =>
                Number(a.withdraw_amount) - Number(b.withdraw_amount),
            render: (text: number | string) => (
                <div style={{ marginLeft: 10 }}>{Number(text || 0)}</div>
            ),
        },
        { title: '币种', dataIndex: 'token_symbol' },
        { title: '游戏类型', dataIndex: 'game_type' },
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
                            {`${text.slice(0, 4)}...${text.slice(-7)}`}
                        </span>
                    </Tooltip>
                ) : '-',
        },
        {
            title: '备注回款哈希',
            dataIndex: 'remark',
            render: (text: string, record: CommissionRecord) => (
                <Tooltip title="点击复制备注并编辑">
                    <span
                        style={{ cursor: 'pointer', color: '#1890ff' }}
                        onClick={() => {
                            if (text) {
                                navigator.clipboard.writeText(text).then(() => {
                                    message.success('备注已复制');
                                }).catch(() => {
                                    message.error('复制失败');
                                });
                            }
                            handleEditRemark(record);
                        }}
                    >
                        {text ? `${text.slice(0, 4)}...${text.slice(-7)}` : '-'}
                    </span>
                </Tooltip>
            ),
        },
        {
            title: '时间',
            dataIndex: 'created_at',
            render: (text: string) =>
                text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
        },
    ];

    useEffect(() => {
        fetchCommissionRecords();
    }, [fetchCommissionRecords]);

    const editRemarkModal = (
        <Modal
            title="编辑备注"
            open={!!editingRecord}
            onCancel={() => setEditingRecord(null)}
            onOk={handleSaveRemark}
        >
            <Input
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
                placeholder="输入新的备注"
            />
        </Modal>
    );

    return (
        <div>
            <h3>佣金记录</h3>

            <Form layout="inline" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                <Form.Item label="贡献者">
                    <Input
                        placeholder="编号"
                        value={filters.sender_code}
                        onChange={(e) => handleFilterChange(e.target.value, 'sender_code')}
                        allowClear                        style={{ width: 80 }}
                    />
                </Form.Item>
                <Form.Item label="受益人">
                    <Input
                        placeholder="编号"
                        value={filters.receiver_code}
                        onChange={(e) => handleFilterChange(e.target.value, 'receiver_code')}
                        allowClear
                        style={{ width: 90 }}
                    />
                </Form.Item>
                <Form.Item label="游戏类型">
                    <Select
                        value={filters.game_type || ''}
                        onChange={(value) => handleFilterChange(value, 'game_type')}
                        style={{ width: 80 }}
                        allowClear
                    >
                        <Select.Option value="tenfold_bull">十倍牛</Select.Option>
                        <Select.Option value="single_double">单双</Select.Option>
                        <Select.Option value="pingbei_niuniu">平倍牛</Select.Option>
                        <Select.Option value="big_small">大小</Select.Option>
                        <Select.Option value="hash_baccarat">百家乐</Select.Option>
                        <Select.Option value="hash_lucky">幸运</Select.Option>
                        <Select.Option value="lucky_banker">庄闲</Select.Option>
                        <Select.Option value=''> </Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item label="币种">
                    <Select
                        value={filters.token_symbol || ''}
                        onChange={(value) => handleFilterChange(value, 'token_symbol')}
                        style={{ width: 80 }}
                    >
                        <Select.Option value="TRX">TRX</Select.Option>
                        <Select.Option value="USDT">USDT</Select.Option>
                        <Select.Option value=''> </Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item label="时间周期">
                    <Select
                        value={filters.time_period || 'today'}
                        onChange={(value) => handleFilterChange(value, 'time_period')}
                        style={{ width: 70 }}
                    >
                        <Select.Option value="today">今天</Select.Option>
                        <Select.Option value="yesterday">昨天</Select.Option>
                        <Select.Option value="this_week">本周</Select.Option>
                        <Select.Option value="last_week">上周</Select.Option>
                        <Select.Option value="this_month">本月</Select.Option>
                        <Select.Option value="last_month">上月</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" onClick={fetchCommissionRecords}>
                        筛选
                    </Button>
                </Form.Item>
            </Form>

            <div style={{ marginBottom: 20 }}>
                <strong>总投注金额: </strong>{totalBetAmount.toFixed(2)}
                <strong style={{ marginLeft: 20 }}>总佣金: </strong>{totalCommission.toFixed(2)}
            </div>

            {editRemarkModal}
            <Table columns={columns} dataSource={data} rowKey="id" scroll={{ x: 'max-content' }} />
        </div>
    );
};

export default CommissionResults;
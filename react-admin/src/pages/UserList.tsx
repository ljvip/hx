// src/pages/UserList.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/request';
import { userApi, User } from '../api/user';
import {
  Table,
  Input,
  Button,
  Tooltip,
  message,
  Space,
  Form,
  Modal,
  Tag,
  Popconfirm,
  InputNumber,
  Switch,
} from 'antd';
import { SearchOutlined, CrownOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { isAxiosError } from 'axios';

const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    message.success('地址已复制到剪贴板');
  } catch {
    message.error('复制失败');
  }
};

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [trxStats, setTrxStats] = useState<string>('0.00');
  const [usdtStats, setUsdtStats] = useState<string>('0.00');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [userForm] = Form.useForm();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userSaving, setUserSaving] = useState(false);

  const calculateStats = useCallback((data: User[]): void => {
    let totalPrizeTrx = 0.0;
    let totalPrizeUsdt = 0.0;

    data.forEach((user) => {
      totalPrizeTrx += (Number(user.total_win_trx) || 0) - (Number(user.total_bet_trx) || 0);
      totalPrizeUsdt += (Number(user.total_win_usdt) || 0) - (Number(user.total_bet_usdt) || 0);
    });

    setTrxStats(totalPrizeTrx.toFixed(2));
    setUsdtStats(totalPrizeUsdt.toFixed(2));
  }, []);

  const fetchUsers = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await userApi.getAllUsers();
      const list = Array.isArray(data) ? data : [];
      setUsers(list);
      setFilteredUsers(list);
      calculateStats(list);
    } catch (error) {
      console.error(error);
      message.error('无法加载用户数据');
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (value: string): void => {
    const trimmedValue = value.trim();
    setSearchTerm(trimmedValue);

    if (!trimmedValue) {
      setFilteredUsers(users);
      calculateStats(users);
      return;
    }

    const keyword = trimmedValue.toLowerCase();

    const filtered = users.filter((user) => {
      const address = (user.owner_address || '').toLowerCase();
      const telegram = String(user.telegram_id || '').toLowerCase();
      const referrer = String(user.ReferrerChain || '').toLowerCase();
      const shareholderCode = (user.shareholder_code || '').toLowerCase();

      const referrerMatch = trimmedValue.split(',').some((term) =>
        referrer
          .split(',')
          .map((id) => id.trim().toLowerCase())
          .includes(term.trim().toLowerCase())
      );

      return (
        address.includes(keyword) ||
        telegram.includes(keyword) ||
        referrerMatch ||
        shareholderCode.includes(keyword)
      );
    });

    setFilteredUsers(filtered);
    calculateStats(filtered);

    if (filtered.length === 0) {
      message.warning('没有找到匹配的数据');
    }
  };

  const [editField, setEditField] = useState<'trx' | 'usdt' | null>(null);

  const openEditTrxModal = (record: User): void => {
    setEditingRecord(record);
    form.setFieldsValue({ use_trx: Number(record.use_trx) || 0 });
    setEditField('trx');
    setIsModalOpen(true);
  };

  const openEditUsdtModal = (record: User): void => {
    setEditingRecord(record);
    form.setFieldsValue({ use_usdt: Number(record.use_usdt) || 0 });
    setEditField('usdt');
    setIsModalOpen(true);
  };

  const isSystemUser = (record: User): boolean =>
    record.is_system === true ||
    record.system_user === true ||
    record.name === 'system';

  const openEditUserModal = (record: User): void => {
    if (isSystemUser(record)) {
      message.warning('系统用户禁止修改');
      return;
    }
    setEditingRecord(record);
    userForm.setFieldsValue({
      ...record,
      total_bet_trx: Number(record.total_bet_trx) || 0,
      total_bet_usdt: Number(record.total_bet_usdt) || 0,
      total_win_trx: Number(record.total_win_trx) || 0,
      total_win_usdt: Number(record.total_win_usdt) || 0,
      use_trx: Number(record.use_trx) || 0,
      use_usdt: Number(record.use_usdt) || 0,
      commission_rate: Number(record.commission_rate) || 0,
      total_commission_trx: Number(record.total_commission_trx) || 0,
      total_commission_usdt: Number(record.total_commission_usdt) || 0,
    });
    setUserModalOpen(true);
  };

  const handleUserUpdate = async (): Promise<void> => {
    if (!editingRecord) return;
    try {
      const values = await userForm.validateFields();
      setUserSaving(true);
      const response = await userApi.updateUser(editingRecord.id, values);
      message.success(response.message || '用户更新成功');
      setUserModalOpen(false);
      setEditingRecord(null);
      await fetchUsers();
    } catch (error: unknown) {
      const errorMessage =
        isAxiosError(error) && typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : '用户更新失败';
      message.error(errorMessage);
    } finally {
      setUserSaving(false);
    }
  };

  const handleUserDelete = async (record: User): Promise<void> => {
    if (isSystemUser(record)) {
      message.warning('系统用户禁止删除');
      return;
    }
    try {
      const response = await userApi.deleteUser(record.id);
      message.success(response.message || '用户删除成功');
      await fetchUsers();
    } catch (error: unknown) {
      const errorMessage =
        isAxiosError(error) && typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : '用户删除失败';
      message.error(errorMessage);
    }
  };

  const textFields: Array<[string, string]> = [
    ['owner_address', '钱包地址'],
    ['telegram_id', 'Telegram ID'],
    ['name', '昵称'],
    ['referral_code', '推荐码'],
    ['referrer', '推荐人'],
    ['ReferrerChain', '推荐关系'],
    ['shareholder_code', '股东代码'],
  ];

  const numberFields: Array<[string, string]> = [
    ['total_bet_trx', '总投注 TRX'],
    ['total_bet_usdt', '总投注 USDT'],
    ['total_win_trx', '总输赢 TRX'],
    ['total_win_usdt', '总输赢 USDT'],
    ['use_trx', '兑换 TRX'],
    ['use_usdt', '兑换 USDT'],
    ['commission_rate', '佣金率'],
    ['total_commission_trx', 'TRX 佣金'],
    ['total_commission_usdt', 'USDT 佣金'],
  ];

  const handleUpdate = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      const payload = {
        use_trx: Number(values.use_trx) || 0,
        use_usdt: Number(values.use_usdt) || 0,
      };

      const response = await apiClient.put<{ message: string }>(
        `/update-user-exchange/${editingRecord?.owner_address}`,
        payload
      );

      if (response.message === 'User updated successfully') {
        message.success('流水更新成功');
        fetchUsers();
        setIsModalOpen(false);
        setEditingRecord(null);
      } else {
        message.error('更新失败');
      }
    } catch (error: unknown) {
      const errorMessage =
        isAxiosError(error) && typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : '更新流水失败';
      message.error(errorMessage);
    }
  };

  const columns = [
    {
      title: '钱包地址',
      dataIndex: 'owner_address',
      key: 'owner_address',
      render: (text: string, record: User) => (
        <Space>
          <Tooltip title="点击复制完整地址">
            <span
              style={{ cursor: 'pointer', color: '#1890ff' }}
              onClick={() => copyToClipboard(text)}
            >
              {`${text.slice(0, 4)}...${text.slice(-7)}`}
            </span>
          </Tooltip>
          {record.is_shareholder && (
            <Tooltip title={`股东: ${record.shareholder_code}`}>
              <Tag color="gold" icon={<CrownOutlined />}>
                股东
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Telegram ID',
      dataIndex: 'telegram_id',
      key: 'telegram_id',
      render: (text: string | number) => text || '无',
    },
    {
      title: '推荐码',
      dataIndex: 'referral_code',
      key: 'referral_code',
      render: (text: string) => text || '无',
    },
    {
      title: '股东代码',
      dataIndex: 'shareholder_code',
      key: 'shareholder_code',
      render: (text: string | null) =>
        text ? <Tag color="blue">{text}</Tag> : <Tag color="default">无</Tag>,
    },
    {
      title: '介绍人',
      dataIndex: 'referrer',
      key: 'referrer',
      render: (text: string) => text || '无',
    },
    {
      title: '总投注 TRX',
      dataIndex: 'total_bet_trx',
      key: 'total_bet_trx',
      render: (value: number | string) => Number(value || 0).toFixed(2),
      sorter: (a: User, b: User) => Number(a.total_bet_trx) - Number(b.total_bet_trx),
    },
    {
      title: '总投注 USDT',
      dataIndex: 'total_bet_usdt',
      key: 'total_bet_usdt',
      render: (value: number | string) => Number(value || 0).toFixed(2),
      sorter: (a: User, b: User) => Number(a.total_bet_usdt) - Number(b.total_bet_usdt),
    },
    {
      title: '总输赢 TRX',
      dataIndex: 'total_win_trx',
      key: 'total_win_trx',
      render: (value: number | string) => Number(value || 0).toFixed(2),
      sorter: (a: User, b: User) => Number(a.total_win_trx) - Number(b.total_win_trx),
    },
    {
      title: '总输赢 USDT',
      dataIndex: 'total_win_usdt',
      key: 'total_win_usdt',
      render: (value: number | string) => Number(value || 0).toFixed(2),
      sorter: (a: User, b: User) => Number(a.total_win_usdt) - Number(b.total_win_usdt),
    },
    {
      title: '兑换 TRX',
      dataIndex: 'use_trx',
      key: 'use_trx',
      sorter: (a: User, b: User) => Number(a.use_trx) - Number(b.use_trx),
      render: (_: unknown, record: User) => (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => openEditTrxModal(record)}
        >
          {Number(record.use_trx || 0)}
        </span>
      ),
    },
    {
      title: '兑换 USDT',
      dataIndex: 'use_usdt',
      key: 'use_usdt',
      sorter: (a: User, b: User) => Number(a.use_usdt) - Number(b.use_usdt),
      render: (_: unknown, record: User) => (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => openEditUsdtModal(record)}
        >
          {Number(record.use_usdt || 0)}
        </span>
      ),
    },
    {
      title: '佣金率',
      dataIndex: 'commission_rate',
      key: 'commission_rate',
      sorter: (a: User, b: User) => Number(a.commission_rate) - Number(b.commission_rate),
      render: (value: number | string) => Number(value || 0),
    },
    {
      title: 'USDT佣金',
      dataIndex: 'total_commission_usdt',
      key: 'total_commission_usdt',
      sorter: (a: User, b: User) =>
        Number(a.total_commission_usdt) - Number(b.total_commission_usdt),
      render: (value: number | string) => Number(value || 0).toFixed(4),
    },
    {
      title: 'TRX佣金',
      dataIndex: 'total_commission_trx',
      key: 'total_commission_trx',
      sorter: (a: User, b: User) =>
        Number(a.total_commission_trx) - Number(b.total_commission_trx),
      render: (value: number | string) => Number(value || 0).toFixed(4),
    },
    {
      title: '加入时间',
      dataIndex: 'join_time',
      key: 'join_time',
      render: (text: string) =>
        text && text !== '0001-01-01T00:00:00Z' ? new Date(text).toLocaleString() : '-',
      sorter: (a: User, b: User) =>
        new Date(a.join_time).getTime() - new Date(b.join_time).getTime(),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right' as const,
      render: (_: unknown, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            disabled={isSystemUser(record)}
            onClick={() => openEditUserModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该用户？"
            description="用户及相关投注、佣金、股东流水、充值记录和股东关系将一并删除。"
            disabled={isSystemUser(record)}
            onConfirm={() => handleUserDelete(record)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} disabled={isSystemUser(record)}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          placeholder="Address 或 TelegramID 或 Referrer 或 股东代码"
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onPressEnter={() => handleSearch(searchTerm)}
          allowClear
          style={{ width: 350 }}
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={() => handleSearch(searchTerm)}
        >
          搜索
        </Button>

        <Space style={{ marginLeft: 20 }}>
          <span>
            <strong>TRX 输赢:</strong> {trxStats}
          </span>
          <span style={{ marginLeft: 30 }}>
            <strong>USDT 输赢:</strong> {usdtStats}
          </span>
        </Space>
      </Space>

      <Table
        columns={columns}
        dataSource={filteredUsers}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1400 }}
      />

      <Modal
        title={`编辑兑换 ${editField === 'trx' ? 'TRX' : 'USDT'} 金额`}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditField(null);
        }}
        onOk={handleUpdate}
      >
        <Form form={form} layout="vertical">
          {editField === 'trx' && (
            <Form.Item
              label="兑换 TRX 金额"
              name="use_trx"
              rules={[{ required: true, message: '请输入兑换 TRX 金额' }]}
            >
              <InputNumber style={{ width: '100%' }} step={0.01} />
            </Form.Item>
          )}

          {editField === 'usdt' && (
            <Form.Item
              label="兑换 USDT 金额"
              name="use_usdt"
              rules={[{ required: true, message: '请输入兑换 USDT 金额' }]}
            >
              <InputNumber style={{ width: '100%' }} step={0.01} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="编辑用户"
        open={userModalOpen}
        onCancel={() => {
          setUserModalOpen(false);
          setEditingRecord(null);
        }}
        onOk={handleUserUpdate}
        confirmLoading={userSaving}
        width={720}
        okText="保存"
        cancelText="取消"
      >
        <Form form={userForm} layout="vertical">
          <Space direction="vertical" style={{ width: '100%' }}>
            {textFields.map(([name, label]) => (
              <Form.Item key={name} name={name} label={label}>
                <Input />
              </Form.Item>
            ))}
            <Form.Item name="is_shareholder" label="是否股东" valuePropName="checked">
              <Switch />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {numberFields.map(([name, label]) => (
                <Form.Item key={name} name={name} label={label}>
                  <InputNumber style={{ width: '100%' }} step={0.01} />
                </Form.Item>
              ))}
            </div>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default UserList;
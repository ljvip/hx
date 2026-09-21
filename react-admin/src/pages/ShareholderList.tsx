// src/pages/ShareholderList.tsx
import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  message,
  Tooltip,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Typography,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  StopOutlined,
  CheckOutlined,
  KeyOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { shareholderApi, Shareholder, CreateShareholderRequest } from '../api/shareholder';
import { userApi } from '../api/user';
import dayjs from 'dayjs';
import { settingsApi, AppSettings } from '../api/settings';
import { getApiErrorMessage } from '../utils/error';

const { Text } = Typography;

type ExtendedShareholder = Shareholder;

const ShareholderList: React.FC = () => {
  const [data, setData] = useState<ExtendedShareholder[]>([]);
  const [loading, setLoading] = useState(false);

  const [balanceModalVisible, setBalanceModalVisible] = useState(false);
  const [balanceForm] = Form.useForm();
  const [editingBalance, setEditingBalance] = useState<{
    id: number;
    code: string;
    name: string;
    currentBalance: number | string;
  } | null>(null);

  const [shareRatioModalVisible, setShareRatioModalVisible] = useState(false);
  const [shareRatioForm] = Form.useForm();
  const [editingShareRatio, setEditingShareRatio] = useState<{
    id: number;
    code: string;
    name: string;
    currentRatio: number | string;
  } | null>(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordForm] = Form.useForm();
  const [editingPassword, setEditingPassword] = useState<ExtendedShareholder | null>(null);
  const [betLimitModalVisible, setBetLimitModalVisible] = useState(false);
  const [betLimitForm] = Form.useForm();
  const [editingBetLimits, setEditingBetLimits] = useState<ExtendedShareholder | null>(null);
  const [systemBetLimits, setSystemBetLimits] = useState<AppSettings | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExtendedShareholder | null>(null);
  const [form] = Form.useForm();
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchShareholders();
    fetchUsers();
    fetchSystemSettings();
  }, []);

  const fetchShareholders = async () => {
    setLoading(true);
    try {
      const response = await shareholderApi.getAllShareholders();
      setData(response);
    } catch (error: unknown) {
      console.error('获取股东列表失败:', error);
      message.error('获取股东列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const users = await userApi.getAllUsers();
      setUserOptions(
        users.map((u) => ({
          label: `${u.name} (${u.owner_address.slice(0, 8)}...)`,
          value: u.id,
        }))
      );
    } catch (error: unknown) {
      console.error('获取用户列表失败', error);
    }
  };

  const fetchSystemSettings = async () => {
    try {
      const response = await settingsApi.getSettings();
      setSystemBetLimits(response.settings);
    } catch (error: unknown) {
      console.error('获取系统配置失败', error);
    }
  };

  const formatLimit = (value: number | string | null | undefined) =>
    value === null || value === undefined || value === '' ? null : Number(value);

  const renderLimitColumn = (
    configured: number | string | null | undefined,
    effective: number | string | undefined,
    record: ExtendedShareholder
  ) => {
    const hasOwn = formatLimit(configured) !== null;
    const display = Number(hasOwn ? configured : effective || 0).toFixed(2);
    return (
      <Space size={4}>
        <Tooltip
          title={
            hasOwn
              ? `股东设置 ${display}`
              : `未单独设置，使用系统 ${display}`
          }
        >
          <span>
            {display}
            {!hasOwn && (
              <Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
                系统
              </Text>
            )}
          </span>
        </Tooltip>
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => openBetLimitModal(record)}
          style={{ padding: 0, height: 20 }}
        />
      </Space>
    );
  };

  const openBetLimitModal = (record: ExtendedShareholder) => {
    setEditingBetLimits(record);
    betLimitForm.setFieldsValue({
      min_bet_trx: record.min_bet_trx === null || record.min_bet_trx === undefined ? undefined : Number(record.min_bet_trx),
      min_bet_usdt: record.min_bet_usdt === null || record.min_bet_usdt === undefined ? undefined : Number(record.min_bet_usdt),
      min_bet_usdt_bsc: record.min_bet_usdt_bsc === null || record.min_bet_usdt_bsc === undefined ? undefined : Number(record.min_bet_usdt_bsc),
      max_bet: record.max_bet === null || record.max_bet === undefined ? undefined : Number(record.max_bet),
    });
    setBetLimitModalVisible(true);
  };

  const handleUpdateBetLimits = async () => {
    try {
      const values = await betLimitForm.validateFields();
      await shareholderApi.updateBetLimits(editingBetLimits!.id, {
        min_bet_trx: values.min_bet_trx ?? null,
        min_bet_usdt: values.min_bet_usdt ?? null,
        min_bet_usdt_bsc: values.min_bet_usdt_bsc ?? null,
        max_bet: values.max_bet ?? null,
      });
      message.success('投注限额更新成功');
      setBetLimitModalVisible(false);
      fetchShareholders();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '更新失败'));
    }
  };

  const openBalanceModal = (record: ExtendedShareholder) => {
    setEditingBalance({
      id: record.id,
      code: record.code,
      name: record.name,
      currentBalance: record.balance,
    });
    balanceForm.setFieldsValue({
      balance: Number(record.balance) || 0,
    });
    setBalanceModalVisible(true);
  };

  const handleUpdateBalance = async () => {
    try {
      const values = await balanceForm.validateFields();
      await shareholderApi.updateBalance(editingBalance!.id, values.balance);
      message.success('积分余额更新成功');
      setBalanceModalVisible(false);
      fetchShareholders();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '更新失败'));
    }
  };

  const openShareRatioModal = (record: ExtendedShareholder) => {
    setEditingShareRatio({
      id: record.id,
      code: record.code,
      name: record.name,
      currentRatio: record.default_share_ratio || 0,
    });
    shareRatioForm.setFieldsValue({
      default_share_ratio: (Number(record.default_share_ratio) || 0) * 100,
    });
    setShareRatioModalVisible(true);
  };

  const handleUpdateShareRatio = async () => {
    try {
      const values = await shareRatioForm.validateFields();
      const shareRatio = values.default_share_ratio / 100;

      await shareholderApi.updateShareholderShareRatio(editingShareRatio!.id, shareRatio);
      message.success('占成比例更新成功');
      setShareRatioModalVisible(false);
      fetchShareholders();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '更新失败'));
    }
  };

  const openPasswordModal = (record: ExtendedShareholder) => {
    setEditingPassword(record);
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };

  const handleSetPassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      await shareholderApi.setPassword(editingPassword!.id, values.password);
      message.success('股东密码设置成功');
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '密码设置失败'));
    }
  };

  const handleCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingRecord) {
        await shareholderApi.updateShareholderStatus(editingRecord.id, values.status || 1);
        message.success('更新成功');
      } else {
        const data: CreateShareholderRequest = {
          user_id: values.user_id,
          code: values.code,
          name: values.name || values.code,
          level: values.level || 1,
          parent_code: values.parent_code,
          password: values.password,
          min_bet_trx: values.min_bet_trx ?? null,
          min_bet_usdt: values.min_bet_usdt ?? null,
          min_bet_usdt_bsc: values.min_bet_usdt_bsc ?? null,
          max_bet: values.max_bet ?? null,
        };
        await shareholderApi.createShareholder(data);
        message.success('股东创建成功');
      }
      setIsModalOpen(false);
      fetchShareholders();
      fetchUsers();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '操作失败'));
    }
  };

  const handleToggleStatus = async (record: ExtendedShareholder) => {
    const newStatus = record.status === 1 ? 0 : 1;
    try {
      await shareholderApi.updateShareholderStatus(record.id, newStatus);
      message.success(`股东已${newStatus === 1 ? '启用' : '停用'}`);
      fetchShareholders();
    } catch {
      message.error('操作失败');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制');
    } catch {
      message.error('复制失败');
    }
  };

  const filteredData = data.filter(
    (item) =>
      (item.code || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.name || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (item.user_name || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '股东代码',
      dataIndex: 'code',
      render: (text: string) => (
        <Tooltip title="点击复制">
          <span
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => copyToClipboard(text)}
          >
            {text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '股东名称',
      dataIndex: 'name',
      render: (text: string) => text || '-',
    },
    {
      title: '用户名称',
      dataIndex: 'user_name',
      render: (text: string) => text || '-',
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
    },
    {
      title: '积分余额',
      dataIndex: 'balance',
      render: (val: number | string, record: ExtendedShareholder) => (
        <Space>
          <span style={{ color: Number(val) >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {Number(val || 0).toFixed(4)}
          </span>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openBalanceModal(record)}
            style={{ padding: 0, height: 20 }}
          />
        </Space>
      ),
      sorter: (a: ExtendedShareholder, b: ExtendedShareholder) => (Number(a.balance) || 0) - (Number(b.balance) || 0),
    },
    {
      title: '占成比例',
      dataIndex: 'default_share_ratio',
      render: (val: number | string, record: ExtendedShareholder) => {
        const percent = val !== undefined && val !== null
          ? (Number(val) * 100).toFixed(1)
          : '-';
        const effectivePercent = (Number(record.effective_share_ratio) || 0) * 100;
        const insufficient = Number(val) > 0 && effectivePercent === 0;
        return (
          <Space>
            <Tooltip title={insufficient
              ? `积分不足，当前按 0% 生效；需要积分大于 ${Number(record.required_balance || 0).toFixed(4)}`
              : `当前有效占成 ${effectivePercent.toFixed(1)}%`}
            >
              <span style={{ color: insufficient ? '#ff4d4f' : undefined, fontWeight: insufficient ? 600 : undefined }}>
                {percent}% {insufficient ? '(积分不足，按 0% 生效)' : ''}
              </span>
            </Tooltip>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openShareRatioModal(record)}
              style={{ padding: 0, height: 20 }}
            />
          </Space>
        );
      },
    },
    {
      title: 'TRX 最小',
      key: 'min_bet_trx',
      width: 140,
      render: (_: unknown, record: ExtendedShareholder) =>
        renderLimitColumn(record.min_bet_trx, record.effective_bet_limits?.min_bet_trx, record),
    },
    {
      title: 'TRON USDT 最小',
      key: 'min_bet_usdt',
      width: 160,
      render: (_: unknown, record: ExtendedShareholder) =>
        renderLimitColumn(record.min_bet_usdt, record.effective_bet_limits?.min_bet_usdt, record),
    },
    {
      title: 'BSC USDT 最小',
      key: 'min_bet_usdt_bsc',
      width: 160,
      render: (_: unknown, record: ExtendedShareholder) =>
        renderLimitColumn(record.min_bet_usdt_bsc, record.effective_bet_limits?.min_bet_usdt_bsc, record),
    },
    {
      title: '单笔上限',
      key: 'max_bet',
      width: 140,
      render: (_: unknown, record: ExtendedShareholder) =>
        renderLimitColumn(record.max_bet, record.effective_bet_limits?.max_bet, record),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: number) => (
        <Tag color={status === 1 ? 'green' : 'red'}>
          {status === 1 ? '正常' : '停用'}
        </Tag>
      ),
    },
    {
      title: '密码',
      key: 'password',
      width: 110,
      render: (_: unknown, record: ExtendedShareholder) => (
        <Button
          type="link"
          size="small"
          icon={<KeyOutlined />}
          onClick={() => openPasswordModal(record)}
        >
          设置密码
        </Button>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (text: string) => {
        if (!text || text === '0001-01-01T00:00:00Z') return '-';
        return dayjs(text).format('YYYY-MM-DD HH:mm');
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: ExtendedShareholder) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => openBetLimitModal(record)}
          >
            修改限额
          </Button>
          <Popconfirm
            title={`确定要${record.status === 1 ? '停用' : '启用'}该股东吗？`}
            onConfirm={() => handleToggleStatus(record)}
          >
            <Button
              type="link"
              size="small"
              icon={record.status === 1 ? <StopOutlined /> : <CheckOutlined />}
              danger={record.status === 1}
            >
              {record.status === 1 ? '停用' : '启用'}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索股东代码/名称/用户"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          创建股东
        </Button>
        <Button onClick={fetchShareholders}>
          刷新
        </Button>
        <span style={{ color: '#888', fontSize: 12 }}>
          共 {filteredData.length} 个股东
        </span>
      </Space>

      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 2000 }}
      />

      <Modal
        title="创建股东"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        onOk={handleSubmit}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="选择用户"
            name="user_id"
            rules={[{ required: true, message: '请选择用户' }]}
          >
            <Select
              placeholder="选择用户"
              showSearch
              optionFilterProp="label"
              options={userOptions}
            />
          </Form.Item>

          <Form.Item
            label="股东代码"
            name="code"
            rules={[
              { required: true, message: '请输入股东代码' },
              { pattern: /^[A-Z0-9_]+$/, message: '只能包含大写字母、数字和下划线' },
            ]}
          >
            <Input placeholder="如: SH001" />
          </Form.Item>

          <Form.Item label="股东名称" name="name">
            <Input placeholder="请输入股东名称" />
          </Form.Item>

          <Form.Item label="层级" name="level" initialValue={1}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="上级股东代码" name="parent_code">
            <Input placeholder="上级股东代码（可选）" />
          </Form.Item>

          <Form.Item
            label="登录密码"
            name="password"
            rules={[
              { required: true, message: '请输入登录密码' },
              { min: 6, message: '密码至少需要 6 位' },
            ]}
          >
            <Input.Password placeholder="设置股东登录密码" autoComplete="new-password" />
          </Form.Item>

          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            伞下投注限额（留空使用系统默认：TRX {Number(systemBetLimits?.min_bet_trx || 0)}，
            TRON USDT {Number(systemBetLimits?.min_bet_usdt || 0)}，
            BSC USDT {Number(systemBetLimits?.min_bet_usdt_bsc || 0)}，
            上限 {Number(systemBetLimits?.max_bet || 0)}）
          </Text>
          <Form.Item name="min_bet_trx" label="TRX 最小投注">
            <InputNumber min={0} precision={6} style={{ width: '100%' }} placeholder="留空使用系统" />
          </Form.Item>
          <Form.Item name="min_bet_usdt" label="TRON USDT 最小投注">
            <InputNumber min={0} precision={6} style={{ width: '100%' }} placeholder="留空使用系统" />
          </Form.Item>
          <Form.Item name="min_bet_usdt_bsc" label="BSC USDT 最小投注">
            <InputNumber min={0} precision={6} style={{ width: '100%' }} placeholder="留空使用系统" />
          </Form.Item>
          <Form.Item name="max_bet" label="单笔投注上限">
            <InputNumber min={0} precision={6} style={{ width: '100%' }} placeholder="留空使用系统" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="设置股东密码"
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        onOk={handleSetPassword}
        width={500}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item label="股东">
            <Text strong>{editingPassword?.code} - {editingPassword?.name}</Text>
          </Form.Item>
          <Form.Item
            label="新密码"
            name="password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少需要 6 位' },
            ]}
          >
            <Input.Password placeholder="请输入至少 6 位密码" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑占成比例"
        open={shareRatioModalVisible}
        onCancel={() => {
          setShareRatioModalVisible(false);
          shareRatioForm.resetFields();
        }}
        onOk={handleUpdateShareRatio}
        width={500}
      >
        <Form form={shareRatioForm} layout="vertical">
          <Form.Item label="股东">
            <Text strong>{editingShareRatio?.code} - {editingShareRatio?.name}</Text>
          </Form.Item>
          <Form.Item label="当前占成比例">
            <Text>{((Number(editingShareRatio?.currentRatio) || 0) * 100).toFixed(1)}%</Text>
          </Form.Item>
          <Form.Item
            label="新占成比例 (%)"
            name="default_share_ratio"
            rules={[
              { required: true, message: '请输入占成比例' },
              { type: 'number', min: 0, max: 100, message: '占成比例必须在 0-100 之间' },
            ]}
          >
            <InputNumber
              placeholder="例如: 10 表示 10%"
              style={{ width: '100%' }}
              min={0}
              max={100}
              step={0.1}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑积分余额"
        open={balanceModalVisible}
        onCancel={() => {
          setBalanceModalVisible(false);
          balanceForm.resetFields();
        }}
        onOk={handleUpdateBalance}
        width={500}
      >
        <Form form={balanceForm} layout="vertical">
          <Form.Item label="股东">
            <Text strong>{editingBalance?.code} - {editingBalance?.name}</Text>
          </Form.Item>
          <Form.Item label="当前余额">
            <Text>{Number(editingBalance?.currentBalance || 0).toFixed(4)}</Text>
          </Form.Item>
          <Form.Item
            label="新余额"
            name="balance"
            rules={[
              { required: true, message: '请输入新余额' },
              { type: 'number', message: '请输入有效数字' },
            ]}
          >
            <InputNumber
              placeholder="请输入新的积分余额"
              style={{ width: '100%' }}
              step={0.0001}
              precision={4}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑伞下投注限额"
        open={betLimitModalVisible}
        onCancel={() => {
          setBetLimitModalVisible(false);
          betLimitForm.resetFields();
        }}
        onOk={handleUpdateBetLimits}
        width={560}
      >
        <Form form={betLimitForm} layout="vertical">
          <Form.Item label="股东">
            <Text strong>{editingBetLimits?.code} - {editingBetLimits?.name}</Text>
          </Form.Item>
          <Form.Item extra="留空表示使用系统默认，股东设置优先于系统。">
            <Text type="secondary">
              系统默认：TRX {Number(systemBetLimits?.min_bet_trx || 0)}，
              TRON USDT {Number(systemBetLimits?.min_bet_usdt || 0)}，
              BSC USDT {Number(systemBetLimits?.min_bet_usdt_bsc || 0)}，
              上限 {Number(systemBetLimits?.max_bet || 0)}
            </Text>
          </Form.Item>
          <Form.Item name="min_bet_trx" label="TRX 最小投注">
            <InputNumber min={0} precision={6} style={{ width: '100%' }} placeholder="留空使用系统" />
          </Form.Item>
          <Form.Item name="min_bet_usdt" label="TRON USDT 最小投注">
            <InputNumber min={0} precision={6} style={{ width: '100%' }} placeholder="留空使用系统" />
          </Form.Item>
          <Form.Item name="min_bet_usdt_bsc" label="BSC USDT 最小投注">
            <InputNumber min={0} precision={6} style={{ width: '100%' }} placeholder="留空使用系统" />
          </Form.Item>
          <Form.Item name="max_bet" label="单笔投注上限">
            <InputNumber min={0} precision={6} style={{ width: '100%' }} placeholder="留空使用系统" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ShareholderList;
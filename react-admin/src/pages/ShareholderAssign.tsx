// src/pages/ShareholderAssign.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Table,
  Tag,
  message,
  Modal,
  Space,
  InputNumber,
  Tooltip,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';  // 移除未使用的图标
import { shareholderApi, Shareholder, UserShareholder } from '../api/shareholder';
import { userApi, User } from '../api/user';
import { getApiErrorMessage } from '../utils/error';

const ShareholderAssign: React.FC = () => {
  const [form] = Form.useForm();
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<UserShareholder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedShareholder, setSelectedShareholder] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedShareholder) {
      fetchAssignments(selectedShareholder);
    }
  }, [selectedShareholder]);

  const fetchData = async () => {
    try {
      const [shareholdersData, usersData] = await Promise.all([
        shareholderApi.getAllShareholders(),
        userApi.getAllUsers(),
      ]);
      setShareholders(shareholdersData);
      setUsers(usersData);
    } catch {
      message.error('获取数据失败');
    }
  };

  const fetchAssignments = async (shareholderId: number) => {
    setLoading(true);
    try {
      const response = await shareholderApi.getShareholderUsers(shareholderId);
      setAssignments(response.users || []);
    } catch {
      message.error('获取分配列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    try {
      const values = await form.validateFields();
      await shareholderApi.assignUser({
        user_id: values.user_id,
        shareholder: values.shareholder_code,
        share_ratio: values.share_ratio / 100,
      });
      message.success('分配成功');
      setIsModalOpen(false);
      form.resetFields();
      if (selectedShareholder) {
        fetchAssignments(selectedShareholder);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '分配失败'));
    }
  };

  const handleShareholderChange = (value: number) => {
    setSelectedShareholder(value);
    const shareholder = shareholders.find((s) => s.id === value);
    if (shareholder) {
      form.setFieldsValue({ shareholder_code: shareholder.code });
    }
  };

  const openAssignModal = () => {
    if (!selectedShareholder) {
      message.warning('请先选择股东');
      return;
    }
    setIsModalOpen(true);
  };

  const columns = [
    {
      title: '用户ID',
      dataIndex: 'user_id',
    },
    {
      title: '用户地址',
      dataIndex: 'user_address',
      render: (_: unknown, record: UserShareholder) => {
        const user = users.find((u) => u.id === record.user_id);
        return user ? (
          <Tooltip title={user.owner_address}>
            <span>
              {user.owner_address.slice(0, 6)}...{user.owner_address.slice(-6)}
            </span>
          </Tooltip>
        ) : '-';
      },
    },
    {
      title: '用户名称',
      dataIndex: 'user_name',
      render: (_: unknown, record: UserShareholder) => {
        const user = users.find((u) => u.id === record.user_id);
        return user?.name || '-';
      },
    },
    {
      title: '占成比例',
      dataIndex: 'share_ratio',
      render: (val: number) => `${(val * 100).toFixed(1)}%`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (val: number) => (
        <Tag color={val === 1 ? 'green' : 'red'}>
          {val === 1 ? '有效' : '无效'}
        </Tag>
      ),
    },
    {
      title: '生效日期',
      dataIndex: 'effective_date',
      render: (text: string) => text ? new Date(text).toLocaleDateString() : '-',
    },
  ];

  return (
    <div>
      <Card title="股东分配管理">
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="请选择股东"
            style={{ width: 250 }}
            onChange={handleShareholderChange}
            showSearch
            optionFilterProp="children"
          >
            {shareholders.map((s) => (
              <Select.Option key={s.id} value={s.id}>
                {s.code} - {s.name} (余额: {s.balance.toFixed(2)})
              </Select.Option>
            ))}
          </Select>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openAssignModal}
            disabled={!selectedShareholder}
          >
            分配用户
          </Button>
        </Space>

        {selectedShareholder && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Tag color="blue">已分配用户数: {assignments.length}</Tag>
            </div>
            <Table
              columns={columns}
              dataSource={assignments}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </>
        )}
      </Card>

      <Modal
        title="分配用户给股东"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        onOk={handleAssign}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="股东代码"
            name="shareholder_code"
            hidden
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="选择用户"
            name="user_id"
            rules={[{ required: true, message: '请选择用户' }]}
          >
            <Select
              placeholder="选择用户"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => {
                const children = option?.children as string | undefined;
                return children?.toLowerCase().includes(input.toLowerCase()) || false;
              }}
            >
              {users
                .filter((u) => !assignments.some((a) => a.user_id === u.id))
                .map((u) => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.name} ({u.owner_address.slice(0, 8)}...)
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="占成比例 (%)"
            name="share_ratio"
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

          <div style={{ color: '#888', fontSize: 12 }}>
            占成比例表示该股东从该用户投注中分享盈亏的比例
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ShareholderAssign;
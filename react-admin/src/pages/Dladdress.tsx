// src/pages/Dladdress.tsx
import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/request';  // 🆕 改用 apiClient
import {
  Table,
  Input,
  Button,
  Tooltip,
  message,
  Space,
  Form,
  Modal,
} from 'antd';
import { EditOutlined, SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { getApiErrorMessage } from '../utils/error';

interface AddressConfig {
  id: number;
  address: string;
  name: string;
  odds: number | string;
  remark: string;
  created_at: string;
}

const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    message.success('地址已复制到剪贴板');
  } catch {
    message.error('复制失败');
  }
};

const Dladdress: React.FC = () => {
  const [addresses, setAddresses] = useState<AddressConfig[]>([]);
  const [filteredAddresses, setFilteredAddresses] = useState<AddressConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<AddressConfig | null>(null);
  const [form] = Form.useForm();
  const [isAddMode, setIsAddMode] = useState<boolean>(false);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async (): Promise<void> => {
    setLoading(true);
    try {
      // 🆕 使用 apiClient
      const response = await apiClient.get<AddressConfig[]>('/addresses');
      setAddresses(response);
      setFilteredAddresses(response);
    } catch {
      message.error('无法加载地址配置数据');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string): void => {
    const trimmedValue = value.trim();
    setSearchTerm(trimmedValue);

    if (!trimmedValue) {
      setFilteredAddresses(addresses);
      return;
    }

    const filtered = addresses.filter((address) =>
      address.address.includes(trimmedValue) ||
      address.name.includes(trimmedValue)
    );

    setFilteredAddresses(filtered);

    if (filtered.length === 0) {
      message.warning('没有找到匹配的数据');
    }
  };

  const openEditModal = (record: AddressConfig): void => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setIsAddMode(false);
    setIsModalOpen(true);
  };

  const openAddModal = (): void => {
    setEditingRecord(null);
    form.resetFields();
    setIsAddMode(true);
    setIsModalOpen(true);
  };

  const handleUpdate = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      const payload = {
        id: editingRecord?.id,
        address: values.address,
        name: values.name,
        odds: Number(values.odds),
        remark: values.remark,
      };

      // 🆕 使用 apiClient
      const response = await apiClient.put<{ message: string }>('/address', payload);

      if (response.message === 'Address updated successfully') {
        message.success('地址配置更新成功');
        fetchAddresses();
        setIsModalOpen(false);
        setEditingRecord(null);
      } else {
        message.error('更新失败');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '更新失败'));
    }
  };

  const handleAdd = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      const payload = {
        id: 0,
        address: values.address,
        name: values.name,
        odds: Number(values.odds),
        remark: values.remark,
      };

      // 🆕 使用 apiClient
      const response = await apiClient.put<{ message: string }>('/address', payload);

      if (response.message === 'Address created successfully') {
        message.success('地址配置添加成功');
        fetchAddresses();
        setIsModalOpen(false);
      } else {
        message.error('添加失败');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '添加失败'));
    }
  };

  const columns = [
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      render: (text: string) => (
        <Tooltip title="点击复制地址">
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
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '占成',
      dataIndex: 'odds',
      key: 'odds',
      render: (value: number) => Number(value || 0).toFixed(4),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: AddressConfig) => (
        <Button icon={<EditOutlined />} onClick={() => openEditModal(record)} />
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
        <Input
          placeholder="地址 或 名称"
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onPressEnter={() => handleSearch(searchTerm)}
          allowClear
          style={{ width: 300 }}
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={() => handleSearch(searchTerm)}
        >
          搜索
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openAddModal}
          style={{ marginLeft: 10 }}
        >
          添加
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={filteredAddresses}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={isAddMode ? "添加地址配置" : "编辑地址配置"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={isAddMode ? handleAdd : handleUpdate}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="地址"
            name="address"
            rules={[{ required: true, message: '请输入地址' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="占成"
            name="odds"
            rules={[{ required: true, message: '请输入占成' }]}
          >
            <Input type="number" step="0.0001" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Dladdress;
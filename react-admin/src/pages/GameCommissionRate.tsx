// src/pages/GameCommissionRate.tsx
import React, { useEffect, useState } from 'react';
import { Table, Input, Button, Modal, Form, message, Space } from 'antd';
import { apiClient } from '../api/request';  // 🆕 改用 apiClient
import { getApiErrorMessage } from '../utils/error';

interface GameCommissionRate {
  id: number;
  game_type: string;
  commission_rate: number;
  created_at: string;
  updated_at: string;
}

interface GameCommissionRateFormValues {
  game_type: string;
  commission_rate: string | number;
}

const GameCommissionRateManager: React.FC = () => {
  const [rates, setRates] = useState<GameCommissionRate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRate, setEditingRate] = useState<GameCommissionRate | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    try {
      // 🆕 使用 apiClient
      const response = await apiClient.get<GameCommissionRate[]>('/game-commission');
      setRates(response);
    } catch {
      message.error('无法获取游戏佣金率数据');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (record: GameCommissionRate) => {
    setEditingRate(record);
    form.setFieldsValue({
      game_type: record.game_type,
      commission_rate: record.commission_rate,
    });
    setIsModalOpen(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields() as GameCommissionRateFormValues;
      const payload = {
        game_type: values.game_type,
        commission_rate: Number(values.commission_rate),
      };

      // 🆕 使用 apiClient
      await apiClient.put('/game-rate', payload);
      message.success('佣金率更新成功');
      setIsModalOpen(false);
      fetchRates();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '更新失败'));
    }
  };

  const handleAddNew = () => {
    setEditingRate(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const columns = [
    {
      title: '游戏类型',
      dataIndex: 'game_type',
      key: 'game_type',
    },
    {
      title: '佣金率',
      dataIndex: 'commission_rate',
      key: 'commission_rate',
      render: (rate: number) => `${(rate * 100).toFixed(2)}%`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: GameCommissionRate) => (
        <Button type="link" onClick={() => openEditModal(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={handleAddNew}>
          新增
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={rates}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingRate ? '编辑佣金率' : '新增佣金率'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleModalOk}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="游戏类型"
            name="game_type"
            rules={[{ required: true, message: '请输入游戏类型' }]}
          >
            <Input disabled={!!editingRate} />
          </Form.Item>

          <Form.Item
            label="佣金率（小数，例：0.01 表示 1%）"
            name="commission_rate"
            rules={[{ required: true, message: '请输入佣金率' }]}
          >
            <Input type="number" step="0.001" min="0" max="1" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GameCommissionRateManager;
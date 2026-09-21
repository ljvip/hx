// src/pages/CreateAdmin.tsx
import React, { useEffect, useState } from 'react';
import { Table, Input, Button, Modal, Form, message, Space, Popconfirm, Select } from 'antd';
import { apiClient } from '../api/request';  // 🆕 改用 apiClient
import { authApi } from '../api/auth';  // 🆕 使用已有的 authApi
import { getApiErrorMessage } from '../utils/error';

interface Admin {
  id: number;
  username: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface CreateAdminFormValues {
  username: string;
  password: string;
  role: string;
}

interface ChangePasswordFormValues {
  username: string;
  old_password: string;
  new_password: string;
  confirmPassword?: string;
  confirm_password?: string;
}

const CreateAdmin: React.FC = () => {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    fetchAdmins();
  }, []);

  // 使用 apiClient 或 authApi
  const fetchAdmins = async () => {
    setLoading(true);
    try {
      // 🆕 使用 authApi（已在 auth.ts 中定义）
      // 或者使用 apiClient
      const response = await apiClient.get<Admin[]>('/admins');
      setAdmins(response);
    } catch {
      message.error('获取管理员列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (values: CreateAdminFormValues) => {
    try {
      // 🆕 使用 authApi
      await authApi.createAdmin(values);
      message.success('管理员创建成功');
      form.resetFields();
      fetchAdmins();
      setIsModalOpen(false);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '创建失败'));
    }
  };

  const handleUpdatePassword = async (values: ChangePasswordFormValues) => {
    try {
      // 🆕 使用 authApi
      await authApi.changePassword(values);
      message.success('密码修改成功');
      passwordForm.resetFields();
      setIsPasswordModalOpen(false);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, '修改密码失败'));
    }
  };

  const openPasswordModal = (admin: Admin) => {
    setEditingAdmin(admin);
    passwordForm.setFieldsValue({
      username: admin.username,
    });
    setIsPasswordModalOpen(true);
  };

  const handleDeleteAdmin = async (id: number) => {
    try {
      // 🆕 如果后端有删除接口
      await apiClient.delete(`/admins/${id}`);
      message.success('删除成功');
      fetchAdmins();
    } catch {
      message.error('删除失败');
    }
  };

  // Columns for admins table
  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Admin) => (
        <Space>
          <Button type="link" onClick={() => openPasswordModal(record)}>
            修改密码
          </Button>
          <Popconfirm
            title="确定要删除此管理员吗?"
            onConfirm={() => handleDeleteAdmin(record.id)}
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => setIsModalOpen(true)}>
          创建管理员
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={admins}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 创建管理员弹窗 */}
      <Modal
        title="创建管理员"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateAdmin}>
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
            hasFeedback
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="角色"
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Select.Option value="admin">admin</Select.Option>
              <Select.Option value="super_admin">super_admin</Select.Option>
              <Select.Option value="editor">editor</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              提交
            </Button>
          </Form.Item>
        </Form>
      </Modal>


      {/* 修改密码弹窗 */}
      <Modal
        title="修改管理员密码"
        open={isPasswordModalOpen}
        onCancel={() => setIsPasswordModalOpen(false)}
        onOk={() => passwordForm.submit()}
      >
        <Form form={passwordForm} layout="vertical" onFinish={handleUpdatePassword}>
          <Form.Item
            label="用户名"
            name="username"
            initialValue={editingAdmin?.username}
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input disabled />
          </Form.Item>

          <Form.Item
            label="旧密码"
            name="old_password"
            rules={[{ required: true, message: '请输入旧密码' }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="新密码"
            name="new_password"
            rules={[{ required: true, message: '请输入新密码' }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="确认密码"
            name="confirm_password"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject('两次输入的密码不匹配');
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CreateAdmin;

// src/pages/Login.tsx
import React from 'react';
import { Button, Form, Input, message, Card } from 'antd';
import { authApi } from '../api';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';
import { LoginParams } from '../api/auth';

const Login: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const { isMobile } = useResponsive();

  const onFinish = async (values: LoginParams) => {
    setLoading(true);
    try {
      const res = await authApi.login(values);
      if (res.success === true) {
        localStorage.setItem('token', res.token);
        message.success('登录成功');
        navigate('/');
      } else {
        message.error(res.message || '登录失败');
      }
    } catch {
      message.error('登录请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#f0f2f5',
      padding: isMobile ? 16 : 0,
    }}>
      <Card
        title="能量管理后台登录"
        style={{
          width: isMobile ? '100%' : 360,
          maxWidth: 400,
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          borderRadius: 8,
        }}
        bodyStyle={{ padding: isMobile ? 16 : 24 }}
      >
        <Form
          form={form}
          name="loginForm"
          onFinish={onFinish}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" size={isMobile ? 'large' : 'middle'} />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" size={isMobile ? 'large' : 'middle'} />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size={isMobile ? 'large' : 'middle'}
              loading={loading}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
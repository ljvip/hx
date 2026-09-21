// Register.jsx - 修复图标导入
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Typography, message, Alert } from "antd";
import {
  UserOutlined,
  WalletOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { useWallet } from "../hooks/useWallet";
import { registerUser } from "../services/api";
import { signMessage } from "../services/tronService";

const { Title, Text } = Typography;

const Register = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { walletAddress, connectWallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [userData, setUserData] = useState(null);
  const [countdown, setCountdown] = useState(5);

  const referrer = searchParams.get("referrer");

  useEffect(() => {
    if (registerSuccess) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate("/");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [registerSuccess, navigate]);

  const handleRegister = async (values) => {
    if (!walletAddress) {
      message.error("请先连接钱包");
      return;
    }

    setLoading(true);
    try {
      const messageToSign = `Register to TRON DApp\nAddress: ${walletAddress}\nTime: ${Date.now()}`;
      const sig = await signMessage(messageToSign);

      const response = await registerUser({
        referrer: referrer || null,
        telegram_id: values.telegram_id || null,
        owner_address: walletAddress,
        name: values.name,
        signature: sig,
      });

      if (response.data.message) {
        message.success(response.data.message);
        setRegisterSuccess(true);
        setUserData(response.data);
      } else {
        message.error(response.data.details || "注册失败");
      }
    } catch (error) {
      console.error("注册失败:", error);
      message.error(error.response?.data?.details || "注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  if (registerSuccess && userData) {
    return (
      <div style={{ maxWidth: 400, margin: "50px auto", padding: 20 }}>
        <Card>
          <Alert
            title="注册成功"
            description={`欢迎 ${userData.user?.name || walletAddress}`}
            type="success"
            showIcon
          />
          <div style={{ marginTop: 20 }}>
            <Text strong>您的推荐码:</Text>
            <div
              style={{
                background: "#f0f0f0",
                padding: 10,
                borderRadius: 5,
                marginTop: 8,
                textAlign: "center",
                fontSize: 18,
                fontWeight: "bold",
              }}
            >
              {userData.referralCode}
            </div>
          </div>
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <Text type="secondary">{countdown} 秒后自动跳转...</Text>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: "50px auto", padding: 20 }}>
      <Card>
        <Title level={3} style={{ textAlign: "center" }}>用户注册</Title>

        {referrer && (
          <Alert
            title="推荐信息"
            description={`推荐人: ${referrer}`}
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
        )}

        {!walletAddress ? (
          <Button
            type="primary"
            icon={<WalletOutlined />}
            onClick={connectWallet}
            block
            size="middle"
          >
            连接钱包
          </Button>
        ) : (
          <Form onFinish={handleRegister} layout="vertical">
            <Form.Item label="钱包地址">
              <Input
                disabled
                prefix={<WalletOutlined />}
                value={
                  walletAddress
                    ? `${walletAddress.slice(0, 15)}...${walletAddress.slice(-15)}`
                    : ""
                }
              />
            </Form.Item>

            <Form.Item
              label="用户名"
              name="name"
              initialValue="自动注册"
              rules={[{ required: true, message: "请输入用户名" }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入用户名"
                maxLength={20}
              />
            </Form.Item>

            <Form.Item label="Telegram ID (可选)" name="telegram_id">
              <Input
                prefix={<MessageOutlined />}
                placeholder="请输入 Telegram ID"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="middle"
              >
                注册
              </Button>
            </Form.Item>
          </Form>
        )}

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Text type="secondary">
            已有账号？ <a onClick={() => navigate("/")}>返回首页</a>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Register;
// src/components/common/WalletConnect.jsx
import { useEffect, useState } from "react";
import { Button, Typography, Avatar, Row, Col, Modal, Dropdown } from "antd";
import { WalletOutlined, CopyOutlined, LogoutOutlined, DownOutlined, ReloadOutlined, CustomerServiceOutlined } from "@ant-design/icons";
import { useWallet } from "../../hooks/useWallet";
import { useNavigate } from "react-router-dom";
import { formatAddress, copyToClipboard } from "../../utils/helpers";
import { CHAIN_TYPES } from "../../utils/constants";
import { getAppSettings } from "../../services/api";

const { Text } = Typography;

const DEFAULT_CUSTOMER_SERVICE = "tikgommm";

const customerServiceUrl = (value) => {
  const raw = String(value || DEFAULT_CUSTOMER_SERVICE).trim();
  if (!raw) return `https://t.me/${DEFAULT_CUSTOMER_SERVICE}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://t.me/${raw.replace(/^@/, "")}`;
};

const WalletConnect = () => {
  const navigate = useNavigate();
  const { walletAddress, chainType, balance, loading, connectWallet, disconnectWallet, updateBalance } = useWallet();
  const [copySuccess, setCopySuccess] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [customerService, setCustomerService] = useState(DEFAULT_CUSTOMER_SERVICE);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      const response = await getAppSettings();
      if (cancelled || !response.success) return;
      const value = response.data?.customer_service;
      if (value) setCustomerService(value);
    };
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = async () => {
    if (!walletAddress) return;
    const result = await copyToClipboard(walletAddress);
    if (result.success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleRefreshBalance = async () => {
    if (!walletAddress || !chainType || refreshingBalance) return;

    setRefreshingBalance(true);
    try {
      await updateBalance(walletAddress, chainType);
    } finally {
      setRefreshingBalance(false);
    }
  };

  const handleDisconnect = () => {
    Modal.confirm({
      title: "确认断开",
      content: "确定要断开钱包连接吗？",
      onOk: disconnectWallet,
    });
  };

  const getChainIcon = () => {
    if (chainType === CHAIN_TYPES.TRON) return "🌐";
    if (chainType === CHAIN_TYPES.BSC) return "🟡";
    return "💼";
  };

  const getChainName = () => {
    if (chainType === CHAIN_TYPES.TRON) return "TRON";
    if (chainType === CHAIN_TYPES.BSC) return "BSC";
    return "";
  };

  const menuItems = [
    // { key: CHAIN_TYPES.TRON, label: "🌐 TRON 网络 (TronLink)" },
    { key: CHAIN_TYPES.BSC, label: "🟡 BSC 网络 (MetaMask)" },
  ];

  const handleMenuClick = ({ key }) => {
    connectWallet(key);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "20px" }}>
        <Text type="secondary">连接中...</Text>
      </div>
    );
  }

  // if (!walletAddress) {
  //   return (
  //     <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} placement="bottom">
  //       <Button 
  //         type="primary" 
  //         icon={<WalletOutlined />}
  //         block 
  //         style={{ maxWidth: 460, margin: "0 auto" }}
  //       >
  //         选择网络并连接钱包 <DownOutlined />
  //       </Button>
  //     </Dropdown>
  //   );
  // }
  if (!walletAddress) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", marginBottom: 12 }}>
        <Row gutter={8}>
          <Col span={12}>
            <Button
              type="primary"
              icon={<WalletOutlined />}
              block
              onClick={() => connectWallet(CHAIN_TYPES.TRON)}
              style={{
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg, #1890ff 0%, #0050b3 100%)",
                border: "none",
                fontWeight: 500,
              }}
            >
              🌐 连接 TRON 钱包
            </Button>
          </Col>
          <Col span={12}>
            <Button
              type="primary"
              icon={<WalletOutlined />}
              block
              onClick={() => connectWallet(CHAIN_TYPES.BSC)}
              style={{
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "none",
                fontWeight: 500,
              }}
            >
              🟡 连接 BSC 钱包
            </Button>
          </Col>
        </Row>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 460, margin: "0 auto", marginBottom: 12 }}>
      <div style={{ 
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        borderRadius: "12px",
        padding: "10px 12px",
        color: "#fff"
      }}>
        {/* 第一行：头像 + 地址 + 按钮 */}
        <Row align="middle" justify="space-between" gutter={8}>
          <Col flex="auto">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Avatar 
                src="/img/boy.jpg" 
                size={32}
                style={{ cursor: "pointer", border: "2px solid #fff", flexShrink: 0 }}
                onClick={() => navigate("/history")}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                  <Text strong style={{ color: "#fff", fontSize: "11px" }}>
                    {getChainIcon()} {getChainName()}
                  </Text>
                  <Text style={{ color: "#fff", fontSize: "10px", wordBreak: "break-all" }}>
                    {formatAddress(walletAddress, 6, 8)}
                  </Text>
                </div>
              </div>
            </div>
          </Col>
          
          <Col>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              <Button 
                size="small" 
                icon={<LogoutOutlined />}
                onClick={handleDisconnect}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: "10px", height: "26px", padding: "0 8px" }}
              >
                断开
              </Button>
              {/* <Button 
                size="small" 
                icon={<CopyOutlined />}
                onClick={handleCopy}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: "10px", height: "26px", padding: "0 8px" }}
              >
                {copySuccess ? "已复制" : "复制"}
              </Button> */}
              <Button 
                size="small" 
                icon={<CustomerServiceOutlined />}
                onClick={() => window.open(customerServiceUrl(customerService), "_blank")}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: "10px", height: "26px", padding: "0 8px" }}
              >
                客服
              </Button>              
            </div>
          </Col>
        </Row>
        
        {/* 第二行：余额信息 */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginTop: "8px",
          paddingTop: "6px",
          borderTop: "1px solid rgba(255,255,255,0.15)"
        }}>
          <div
            onClick={handleRefreshBalance}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              userSelect: "none",
            }}
            title="点击刷新余额"
          >
            <ReloadOutlined spin={refreshingBalance} style={{ fontSize: 11, color: "#fff" }} />
            <Text style={{ color: "#fff", fontSize: "10px" }}>余额</Text>
          </div>

          {chainType === CHAIN_TYPES.TRON && (
            <>
              <div>
                <Text style={{ color: "#fff", fontSize: "10px" }}>TRX</Text>
                <Text strong style={{ color: "#fff", fontSize: "13px", marginLeft: "4px" }}>
                  {balance.trx?.toFixed(2)}
                </Text>
              </div>
              <div>
                <Text style={{ color: "#fff", fontSize: "10px" }}>USDT</Text>
                <Text strong style={{ color: "#fff", fontSize: "13px", marginLeft: "4px" }}>
                  {balance.usdt?.toFixed(2)}
                </Text>
              </div>
            </>
          )}
          {chainType === CHAIN_TYPES.BSC && (
            <>
              <div>
                <Text style={{ color: "#fff", fontSize: "10px" }}>BNB</Text>
                <Text strong style={{ color: "#fff", fontSize: "13px", marginLeft: "4px" }}>
                  {balance.bnb?.toFixed(4)}
                </Text>
              </div>
              <div>
                <Text style={{ color: "#fff", fontSize: "10px" }}>USDT</Text>
                <Text strong style={{ color: "#fff", fontSize: "13px", marginLeft: "4px" }}>
                  {balance.usdt?.toFixed(2)}
                </Text>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletConnect;
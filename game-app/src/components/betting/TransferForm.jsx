// src/components/betting/TransferForm.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { Form, Input, Button, Select, Row, Col, Typography, message, Card, Tooltip, Modal, Alert } from "antd";
import { ThunderboltOutlined, CopyOutlined, QrcodeOutlined } from "@ant-design/icons";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "../../hooks/useWallet";
import { useTransactions } from "../../hooks/useTransactions";
import { useWebSocket } from "../../contexts/WebSocketContext";
import { GAMES, getGamesByChain, CHAIN_TYPES } from "../../utils/constants";
import { transferTRX, transferUSDT } from "../../services/tronService";
import { transferBNB, transferBSCUSDT } from "../../services/bscService";
import { getBackendGameAddresses, getBetLimits } from "../../services/api";
import { formatAmount, copyToClipboard } from "../../utils/helpers";
import GameTrends from "./GameTrends";
import LiveBetsTable from "./LiveBetsTable";

const { Paragraph, Text } = Typography;

const validateAmount = (_, value) => {
  if (!value && value !== 0) return Promise.reject(new Error('请输入投注金额'));
  const num = Number(value);
  if (isNaN(num)) return Promise.reject(new Error('请输入有效的数字'));
  if (num <= 0) return Promise.reject(new Error('金额必须大于 0'));
  if (num > 1000000) return Promise.reject(new Error('金额不能超过 1,000,000'));
  return Promise.resolve();
};

const sourceLabel = (source) => (source === "shareholder" ? "股东" : "系统");

const TransferForm = () => {
  const { walletAddress, chainType, balance, updateBalance } = useWallet();
  const { fetchUserTransactions } = useTransactions(walletAddress, false);
  const { isConnected, on, off } = useWebSocket();
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [transferType, setTransferType] = useState("trx");
  const [copySuccess, setCopySuccess] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [backendGameAddresses, setBackendGameAddresses] = useState([]);
  const [betLimits, setBetLimits] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    const loadBackendGameAddresses = async () => {
      const { data: addresses = [] } = await getBackendGameAddresses();
      setBackendGameAddresses(addresses);
    };

    loadBackendGameAddresses();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadBetLimits = async () => {
      const response = await getBetLimits(walletAddress || "");
      if (!cancelled && response.success) {
        setBetLimits(response.data);
      }
    };
    loadBetLimits();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  const gamesList = useMemo(() => {
    const baseList = chainType ? getGamesByChain(chainType) : GAMES;

    if (backendGameAddresses.length === 0) {
      return baseList;
    }

    return baseList.filter((game) => {
      const gameAddresses = [game.tron_address, game.bsc_address, game.address].filter(Boolean).map((value) => value.toLowerCase());
      return gameAddresses.some((address) => backendGameAddresses.includes(address));
    });
  }, [backendGameAddresses, chainType]);

  // 获取默认游戏（哈希单双 - value 为 "single_double"）
  const getDefaultGame = useCallback(() => {
    const singleDoubleGame = gamesList.find(game => game.value === "single_double");
    return singleDoubleGame || gamesList[0];
  }, [gamesList]);

  // 当链类型变化时，重新设置默认游戏和默认币种
  useEffect(() => {
    if (gamesList.length > 0) {
      const defaultGame = getDefaultGame();
      setSelectedGame(defaultGame);
      form.setFieldValue("toAddress", defaultGame.address);
    } else {
      setSelectedGame(null);
      form.setFieldValue("toAddress", undefined);
    }

    if (chainType === CHAIN_TYPES.TRON) {
      setTransferType("trx");
    } else if (chainType === CHAIN_TYPES.BSC) {
      setTransferType("usdt");
    }
  }, [chainType, gamesList, getDefaultGame, form]);

  // 复制地址
  const handleCopyAddress = async (address) => {
    const result = await copyToClipboard(address);
    if (result.success) {
      setCopySuccess(true);
      message.success("地址已复制");
      setTimeout(() => setCopySuccess(false), 2000);
    } else {
      message.error("复制失败");
    }
  };

  useEffect(() => {
    const loadUserTransactions = async () => {
      if (walletAddress) {
        try {
          await fetchUserTransactions(5);
        } catch {
          console.log('用户交易记录加载失败，可能未注册');
        }
      }
    };

    loadUserTransactions();
  }, [walletAddress, fetchUserTransactions]);

  // 监听 WebSocket 新交易
  useEffect(() => {
    if (!isConnected) return;

    const handleNewBet = (data) => {
      console.log('TransferForm 收到新投注:', data);
      
      const ownerAddress = data.owner_address || data.OwnerAddress;
      
      if (walletAddress && ownerAddress === walletAddress) {
        fetchUserTransactions(5).catch(() => {});
        setTimeout(() => {
          updateBalance(walletAddress, chainType).catch(() => {});
        }, 3000);
      }
    };

    on('bet:new', handleNewBet);

    return () => {
      off('bet:new', handleNewBet);
    };
  }, [isConnected, walletAddress, chainType, fetchUserTransactions, updateBalance, on, off]);

  const handleGameChange = (address) => {
    const game = gamesList.find(g => g.address === address);
    setSelectedGame(game);
    form.setFieldValue("toAddress", address);
  };

  const executeTransfer = async (toAddress, amount) => {
    if (chainType === CHAIN_TYPES.TRON) {
      if (transferType === "trx") {
        return await transferTRX(toAddress, amount);
      } else {
        return await transferUSDT(toAddress, amount);
      }
    } else if (chainType === CHAIN_TYPES.BSC) {
      if (transferType === "bnb") {
        return await transferBNB(toAddress, amount);
      } else {
        return await transferBSCUSDT(toAddress, amount);
      }
    }
    throw new Error("不支持的链类型");
  };

  const getCurrentBalance = () => {
    if (chainType === CHAIN_TYPES.TRON) {
      return transferType === "trx" ? balance?.trx || 0 : balance?.usdt || 0;
    } else {
      return transferType === "bnb" ? balance?.bnb || 0 : balance?.usdt || 0;
    }
  };

  const getCurrentSymbol = () => {
    if (chainType === CHAIN_TYPES.TRON) {
      return transferType === "trx" ? "TRX" : "USDT";
    } else {
      return transferType === "bnb" ? "BNB" : "USDT";
    }
  };

  const currentLimits = useMemo(() => {
    const limits = betLimits?.limits || {};
    const sources = betLimits?.sources || {};
    if (chainType === CHAIN_TYPES.BSC) {
      return {
        min: Number(limits.min_bet_usdt_bsc ?? 0),
        max: Number(limits.max_bet ?? 0),
        minSource: sources.min_bet_usdt_bsc,
        maxSource: sources.max_bet,
        symbol: "USDT",
      };
    }
    if (transferType === "trx") {
      return {
        min: Number(limits.min_bet_trx ?? 0),
        max: Number(limits.max_bet ?? 0),
        minSource: sources.min_bet_trx,
        maxSource: sources.max_bet,
        symbol: "TRX",
      };
    }
    return {
      min: Number(limits.min_bet_usdt ?? 0),
      max: Number(limits.max_bet ?? 0),
      minSource: sources.min_bet_usdt,
      maxSource: sources.max_bet,
      symbol: "USDT",
    };
  }, [betLimits, chainType, transferType]);

  const getCurrencyOptions = () => {
    if (chainType === CHAIN_TYPES.TRON) {
      return [
        { value: "trx", label: `TRX (余额: ${formatAmount(balance?.trx || 0)})` },
        { value: "usdt", label: `USDT (余额: ${formatAmount(balance?.usdt || 0)})` }
      ];
    } else if (chainType === CHAIN_TYPES.BSC) {
      return [
        // { value: "bnb", label: `BNB (余额: ${formatAmount(balance?.bnb || 0, 4)})` },
        { value: "usdt", label: `USDT (余额: ${formatAmount(balance?.usdt || 0)})` }
      ];
    }
    return [];
  };

  const getCurrencyOptionsSimple = () => {
    if (chainType === CHAIN_TYPES.TRON) {
      return [
        { value: "trx", label: "TRX" },
        { value: "usdt", label: "USDT" },
      ];
    }
    if (chainType === CHAIN_TYPES.BSC) {
      return [{ value: "usdt", label: "USDT" }];
    }
    return [];
  };

  const onFinish = async (values) => {
    const amount = parseFloat(values.amount);
    
    if (!walletAddress) {
      message.error("请先连接钱包");
      return;
    }
    
    if (isNaN(amount) || amount <= 0) {
      message.error("请输入有效的金额 (大于 0)");
      return;
    }

    if (Number.isFinite(currentLimits.min) && amount < currentLimits.min) {
      message.error(`低于最小投注 ${formatAmount(currentLimits.min)} ${currentLimits.symbol}`);
      return;
    }
    if (Number.isFinite(currentLimits.max) && currentLimits.max > 0 && amount > currentLimits.max) {
      message.error(`超过单笔上限 ${formatAmount(currentLimits.max)} ${currentLimits.symbol}`);
      return;
    }

    const currentBalance = getCurrentBalance();
    if (amount > currentBalance) {
      const symbol = getCurrentSymbol();
      message.error(`${symbol}余额不足，当前余额: ${currentBalance} ${symbol}`);
      return;
    }

    setLoading(true);
    try {
      const result = await executeTransfer(selectedGame.address, amount);

      if (result?.result) {
        const symbol = getCurrentSymbol();
        message.success(`${symbol} 投注成功！金额: ${amount}`);
        form.resetFields(["amount"]);
        await updateBalance(walletAddress, chainType);
        await fetchUserTransactions(5);
      } else {
        throw new Error("交易失败");
      }
    } catch (error) {
      console.error("投注失败:", error);
      message.error(error.message || "投注失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const limitsAlert = betLimits?.limits ? (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 16, textAlign: "left" }}
      message={
        betLimits.shareholder_code
          ? `当前限额（股东 ${betLimits.shareholder_code} 优先，未设置项用系统）`
          : "当前限额（系统默认）"
      }
      description={
        <div style={{ fontSize: 12, lineHeight: 1.8 }}>
          <div>
            TRX 最小 {formatAmount(betLimits.limits.min_bet_trx)}（{sourceLabel(betLimits.sources?.min_bet_trx)}）
            {" · "}
            TRON USDT 最小 {formatAmount(betLimits.limits.min_bet_usdt)}（{sourceLabel(betLimits.sources?.min_bet_usdt)}）
            {" · "}
            BSC USDT 最小 {formatAmount(betLimits.limits.min_bet_usdt_bsc)}（{sourceLabel(betLimits.sources?.min_bet_usdt_bsc)}）
          </div>
          <div>
            单笔上限 {formatAmount(betLimits.limits.max_bet)}（{sourceLabel(betLimits.sources?.max_bet)}）
            {walletAddress ? (
              <>
                {" · "}
                当前选择：最小 {formatAmount(currentLimits.min)} {currentLimits.symbol}，最大 {formatAmount(currentLimits.max)} {currentLimits.symbol}
              </>
            ) : null}
          </div>
        </div>
      }
    />
  ) : null;

  if (!walletAddress) {
    return (
      // <Card style={{ borderRadius: "12px", marginBottom: "16px", textAlign: "center", padding: "40px" }}>
      //   {/* {limitsAlert} */}
      //   <p>请先连接钱包再进行投注</p>
      // </Card>
      <div></div>
    );
  }

  return (
    <Card style={{ borderRadius: "12px", marginBottom: "16px" }}>
      {/* {limitsAlert} */}
      <Form form={form} onFinish={onFinish} layout="vertical">
        <Form.Item name="toAddress">
          <Select
            placeholder="请选择游戏"
            onChange={handleGameChange}
            size="middle"
            value={selectedGame?.address}
            options={gamesList.map(({ address, label }) => ({ value: address, label }))}
          />
        </Form.Item>

        {/* 投注地址显示区域 - 完整显示 + 二维码 */}
        {selectedGame && (
          <div style={{
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 8px",
            backgroundColor: "#fafafa",
            borderRadius: 6,
            fontSize: 12
          }}>
            <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>投注地址</Text>
            <Tooltip title={selectedGame.address}>
              <Text
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: "monospace",
                  fontSize: 12,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  color: "#1890ff"
                }}
                onClick={() => setQrModalVisible(true)}
              >
                {selectedGame.address
                  ? `${selectedGame.address.slice(0, 8)}...${selectedGame.address.slice(-13)}`
                  : "-"}          
              </Text>
            </Tooltip>
            <Button type="text" size="small" icon={<CopyOutlined />}
              onClick={() => handleCopyAddress(selectedGame.address)}
              style={{ color: "#1890ff", flexShrink: 0 }} />
            <Button type="text" size="small" icon={<QrcodeOutlined />}
              onClick={() => setQrModalVisible(true)}
              style={{ color: "#1890ff", flexShrink: 0 }} />
            {copySuccess && (
              <Text type="success" style={{ fontSize: 11, flexShrink: 0 }}>已复制!</Text>
            )}
          </div>
        )}
        <Row gutter={8}>
          <Col span={18}>
            <Form.Item
              label="投注金额"
              name="amount"
              rules={[{ required: true, message: "请输入投注金额" }, { validator: validateAmount }]}
              validateTrigger={["onChange", "onBlur"]}
            >
              <Input
                type="number"
                step="0.000001"
                placeholder="请输入金额"
                size="middle"
                addonAfter={
                  chainType === CHAIN_TYPES.TRON ? (
                    <Select
                      value={transferType}
                      onChange={setTransferType}
                      variant="borderless"
                      options={getCurrencyOptionsSimple()}
                      style={{ width: 85 }}
                    />
                  ) : (
                    <span>USDT</span>
                  )
                }
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label=" ">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="middle"
                icon={<ThunderboltOutlined />}
                block
              >
                投注
              </Button>
            </Form.Item>
          </Col>
        </Row>
        <GameTrends gameName={selectedGame?.value} compact={true} showTitle={false} />

        {selectedGame && (
          <Paragraph style={{ 
            marginTop: 8, 
            backgroundColor: "#f5f5f5", 
            padding: 8, 
            borderRadius: 5,
            fontSize: "12px",
            color: "#666"
          }}>
            <strong>{selectedGame.label}：</strong> {selectedGame.description}
          </Paragraph>
        )}


      </Form>

      <LiveBetsTable maxRecords={10} />

      {/* 二维码弹窗 */}
      <Modal
        title={`${selectedGame?.label || "游戏"} - 投注地址`}
        open={qrModalVisible}
        onCancel={() => setQrModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setQrModalVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="copy" 
            type="primary" 
            icon={<CopyOutlined />}
            onClick={() => handleCopyAddress(selectedGame?.address)}
          >
            复制地址
          </Button>,
        ]}
        width={360}
        centered
      >
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          {selectedGame && (
            <>
              {/* 游戏名称 */}
              <div style={{ 
                marginBottom: 16,
                padding: "8px 16px",
                backgroundColor: "#f0f0f0",
                borderRadius: 8,
                display: "inline-block"
              }}>
                <Text strong style={{ fontSize: 14, color: "#1890ff" }}>
                  🎮 {selectedGame.label}
                </Text>
              </div>
              
              {/* 二维码 */}
              <div style={{ 
                backgroundColor: "#fff", 
                padding: "16px", 
                borderRadius: 12,
                display: "inline-block",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
              }}>
                <QRCodeSVG 
                  value={selectedGame.address} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              
              {/* 网络标识 */}
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {chainType === CHAIN_TYPES.TRON ? "🌐 TRON 网络" : "🟡 BSC 网络"}
                </Text>
              </div>
              
              {/* 完整地址 */}
              <div style={{ 
                marginTop: 16, 
                padding: "10px 12px", 
                backgroundColor: "#f5f5f5", 
                borderRadius: 8,
                wordBreak: "break-all",
                textAlign: "left"
              }}>
                <Text type="secondary" style={{ fontSize: 11 }}>投注地址：</Text>
                <Text style={{ fontSize: 11, fontFamily: "monospace", wordBreak: "break-all" }}>
                  {selectedGame.address}
                </Text>
              </div>
            </>
          )}
        </div>
      </Modal>
    </Card>
  );
};

export default TransferForm;
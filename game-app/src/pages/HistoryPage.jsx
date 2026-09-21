import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Tabs, message, Spin, Row, Col } from "antd";
import { ArrowLeftOutlined, ReloadOutlined, CopyOutlined, BankOutlined } from "@ant-design/icons";
import { useWallet } from "../hooks/useWallet";
import { useTransactions } from "../hooks/useTransactions";
import HistoryTable from "../components/history/HistoryTable";
import CommissionHistoryTable from "../components/history/CommissionHistoryTable.jsx";
import { getUserInfo, getReferrals, getCommissionHistory, withdrawCommission, updateCommissionRate } from "../services/api";
import { formatAddress, formatAmount } from "../utils/helpers";

// 检测是否为移动设备
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, [matches, query]);
  
  return matches;
};

const HistoryPage = () => {
  const navigate = useNavigate();
  const { walletAddress } = useWallet();
  const { transactions, loading: txLoading, fetchUserTransactions } = useTransactions(walletAddress, false);
  const [userInfo, setUserInfo] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [commissionHistory, setCommissionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("transactions");
  const [refreshing, setRefreshing] = useState(false);
  
  const isMobile = useMediaQuery('(max-width: 768px)');

  const loadData = useCallback(async () => {
    if (!walletAddress) return;
    
    setLoading(true);
    try {
      const [userRes] = await Promise.all([
        getUserInfo(walletAddress),
        fetchUserTransactions(20)
      ]);
      
      setUserInfo(userRes.data);
      
      if (userRes.data.user?.referral_code) {
        const [referralsRes, commissionRes] = await Promise.all([
          getReferrals(walletAddress),
          getCommissionHistory(userRes.data.user.referral_code, 10)
        ]);
        setReferrals(referralsRes.data.referrals || []);
        setCommissionHistory(commissionRes.data.records || []);
      }
    } catch (error) {
      console.error("加载数据失败:", error);
      message.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  }, [walletAddress, fetchUserTransactions]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    message.success("数据已刷新");
  };

  const copyReferralLink = useCallback(() => {
    if (userInfo?.user?.referral_code) {
      const referralLink = `${window.location.origin}/register?referrer=${userInfo.user.referral_code}`;
      navigator.clipboard.writeText(referralLink)
        .then(() => message.success("推荐链接已复制！"))
        .catch(() => message.error("复制失败，请手动复制"));
    }
  }, [userInfo]);

  useEffect(() => {
    if (walletAddress) {
      loadData();
    }
  }, [walletAddress, loadData]);

  const handleWithdraw = async (commission, tokenSymbol) => {
    if (!commission || commission <= 0) {
      message.error("请输入有效的佣金金额");
      return;
    }
    
    try {
      const response = await withdrawCommission({
        receiver_code: userInfo.user.referral_code,
        commission: Number(commission),
        token_symbol: tokenSymbol
      });
      message.success(response.data.message || "提取成功");
      loadData();
    } catch {
      message.error("提取失败，请重试");
    }
  };

  const handleUpdateCommission = async (referralCode, newCommission) => {
    if (newCommission <= 0 || newCommission > 1) {
      message.error("佣金比例应在 0 到 1 之间");
      return;
    }
    
    try {
      const response = await updateCommissionRate({
        referral_code: referralCode,
        new_commission: Number(newCommission)
      });
      message.success(response.data.message || "更新成功");
      loadData();
    } catch {
      message.error("更新失败，请重试");
    }
  };

  if (!walletAddress) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <p>请先连接钱包</p>
        <Button type="primary" onClick={() => navigate("/")}>返回首页</Button>
      </div>
    );
  }

  if (loading && !refreshing) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="small" tip="加载中..." />
      </div>
    );
  }

  const items = [
    {
      key: "transactions",
      label: "交易记录",
      children: (
        <HistoryTable 
          data={transactions} 
          loading={txLoading || refreshing} 
          onRefresh={handleManualRefresh}
        />
      ),
    },
    {
      key: "commission",
      label: "佣金记录",
      children: (
        <Card style={{ borderRadius: 8 }}>
          <CommissionHistoryTable 
            data={commissionHistory}
            loading={refreshing}
            onRefresh={handleManualRefresh}
            title="佣金历史"
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? 10 : 16, maxWidth: 1200, margin: "0 auto" }}>
      {/* 头部按钮 */}
      <div style={{ 
        marginBottom: isMobile ? 12 : 16, 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        gap: 8
      }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate("/")}
          size={isMobile ? "small" : "middle"}
        >
          返回
        </Button>
        <div style={{ display: "flex", gap: 8 }}>
          {/* 股东入口：仅当 is_shareholder === true 时显示 */}
          {userInfo?.user?.is_shareholder === true && (
            <Button 
              type="primary"
              icon={<BankOutlined />} 
              onClick={() => navigate("/shareholder")}
              size={isMobile ? "small" : "middle"}
            >
              {isMobile ? "股东" : "股东中心"}
            </Button>
          )}
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleManualRefresh}
            loading={refreshing}
            size={isMobile ? "small" : "middle"}
          >
            {isMobile ? "刷新" : "刷新数据"}
          </Button>
        </div>
      </div>

      {userInfo?.user && (
        <Card style={{ marginBottom: isMobile ? 12 : 16, borderRadius: 8 }}>
          {/* 推荐链接 - 手机紧凑版 */}
          <div style={{ 
            marginBottom: isMobile ? 12 : 16, 
            padding: isMobile ? 8 : 12, 
            backgroundColor: "#f5f5f5", 
            borderRadius: 8 
          }}>
            <h5 style={{ fontSize: isMobile ? 13 : 16, marginBottom: 6 }}>我的推荐链接</h5>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <p style={{ 
                fontSize: isMobile ? 11 : 14, 
                marginBottom: 0, 
                flex: 1, 
                wordBreak: "break-all",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    copyReferralLink();
                  }}
                  style={{ fontSize: isMobile ? 11 : 14, color: '#1890ff' }}
                >
                  {`${window.location.origin}/register?referrer=${userInfo.user.referral_code}`}
                </a>
              </p>
              <Button 
                size="small" 
                icon={<CopyOutlined />}
                onClick={copyReferralLink}
                style={{ fontSize: isMobile ? 10 : 12 }}
              >
                复制
              </Button>
            </div>
            <div style={{ 
              marginTop: 6, 
              fontSize: isMobile ? 10 : 12, 
              color: "#666",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap"
            }}>
              <span>推广码: {userInfo.user.referral_code}</span>
              <span>介绍人: {userInfo.user.referrer || "-"}</span>
            </div>
          </div>

          {/* 钱包地址 */}
          <div style={{ marginBottom: isMobile ? 8 : 12 }}>
            <div style={{ color: "#666", fontSize: isMobile ? 10 : 12 }}>钱包地址</div>
            <div style={{ 
              fontSize: isMobile ? 12 : 14, 
              fontWeight: "bold",
              wordBreak: "break-all"
            }}>
              {formatAddress(walletAddress, isMobile ? 6 : 80, isMobile ? 4 : 8)}
            </div>
          </div>
          
          {/* 佣金信息 - 手机紧凑版 */}
          <Row gutter={[8, 8]} style={{ marginTop: isMobile ? 8 : 16 }}>
            <Col span={8}>
              <div>
                <div style={{ color: "#666", fontSize: isMobile ? 9 : 12 }}>TRX佣金</div>
                <div
                  style={{
                    fontSize: isMobile ? 14 : 18,
                    fontWeight: "bold",
                    color: "#faad14",
                    cursor: "pointer",
                    wordBreak: "break-all"
                  }}
                  onClick={() => {
                    const amount = prompt("输入提取金额");
                    if (amount) handleWithdraw(amount, "TRX");
                  }}
                >
                  {formatAmount(userInfo.user.total_commission_trx)}
                </div>
              </div>
            </Col>
            <Col span={8}>
              <div>
                <div style={{ color: "#666", fontSize: isMobile ? 9 : 12 }}>USDT佣金</div>
                <div
                  style={{
                    fontSize: isMobile ? 14 : 18,
                    fontWeight: "bold",
                    color: "#faad14",
                    cursor: "pointer"
                  }}
                  onClick={() => {
                    const amount = prompt("输入提取金额");
                    if (amount) handleWithdraw(amount, "USDT");
                  }}
                >
                  {formatAmount(userInfo.user.total_commission_usdt)}
                </div>
              </div>
            </Col>
            <Col span={8}>
              <div>
                <div style={{ color: "#666", fontSize: isMobile ? 9 : 12 }}>佣金比例</div>
                <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: "bold" }}>
                  {(userInfo.user.commission_rate * 100)}%
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* 下级成员 - 手机紧凑版 */}
      {referrals.length > 0 && (
        <Card 
          title="下级成员" 
          style={{ marginBottom: isMobile ? 12 : 16, borderRadius: 8 }}
          size={isMobile ? "small" : "default"}
        >
          {referrals.map((ref, idx) => (
            <div key={idx} style={{ 
              marginBottom: isMobile ? 6 : 8, 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              flexWrap: "wrap",
              gap: 6,
              fontSize: isMobile ? 11 : 14
            }}>
              <span>...{ref.owner_address.slice(-8)}</span>
              <span>比例: {(ref.commission_rate * 100)}%</span>
              <Button 
                size="small"
                onClick={() => {
                  const rate = prompt("输入新佣金比例 (0-1)", ref.commission_rate);
                  if (rate) handleUpdateCommission(ref.referral_code, parseFloat(rate));
                }}
                style={{ fontSize: isMobile ? 10 : 12 }}
              >
                修改
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* Tabs */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        items={items}
        size={isMobile ? "small" : "middle"}
        style={{ marginTop: isMobile ? 0 : 8 }}
      />
    </div>
  );
};

export default HistoryPage;
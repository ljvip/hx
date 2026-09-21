import { useState } from "react";
import { Button, Input, Select, Space } from "antd";
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { GAME_NAME_MAPPING } from "../../utils/constants";

// 紧凑样式定义
const styles = {
  th: {
    border: "1px solid #ddd",
    padding: "8px 6px",
    fontWeight: "bold",
    backgroundColor: "#f8f8f8",
    fontSize: "12px"
  },
  td: {
    border: "1px solid #ddd",
    padding: "6px 4px",
    fontSize: "11px"
  },
  evenRow: {
    backgroundColor: "#ffffff"
  },
  oddRow: {
    backgroundColor: "#f9f9f9"
  },
};

const CommissionHistoryTable = ({ data, loading, onRefresh, title }) => {
  const [searchText, setSearchText] = useState("");
  const [gameFilter, setGameFilter] = useState("all");
  const [tokenFilter, setTokenFilter] = useState("all");

  // 格式化时间
  const formatTimeDisplay = (timeStr) => {
    if (!timeStr) return "未知";
    const date = new Date(timeStr);
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  // 过滤数据
  const filteredData = data.filter(item => {
    const senderAddr = item.sender_addr || "";
    const game = item.game_type;
    const token = item.token_symbol;
    
    if (searchText && !senderAddr.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    if (gameFilter !== "all" && game !== gameFilter) {
      return false;
    }
    if (tokenFilter !== "all" && token !== tokenFilter) {
      return false;
    }
    return true;
  });

  // 为每行数据添加唯一 key
  const tableData = filteredData.map((item, index) => ({
    ...item,
    _key: item.id || index,
  }));

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>{title || "佣金历史"}</h3>
        <Space wrap size="small">
          <Input
            placeholder="搜索下级地址"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 160 }}
            size="small"
            allowClear
          />
          <Select
            value={gameFilter}
            onChange={setGameFilter}
            style={{ width: 100 }}
            size="small"
            options={[
              { value: "all", label: "全部游戏" },
              ...Object.entries(GAME_NAME_MAPPING).map(([key, value]) => ({
                value: key,
                label: value,
              })),
            ]}
          />
          <Select
            value={tokenFilter}
            onChange={setTokenFilter}
            style={{ width: 100 }}
            size="small"
            options={[
              { value: "all", label: "全部币种" },
              { value: "TRX", label: "TRX" },
              { value: "USDT", label: "USDT" },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={onRefresh} size="small">刷新</Button>
        </Space>
      </div>
      
      {/* 佣金记录表格 */}
      <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
          <thead>
            <tr style={{ 
              backgroundColor: '#f2f2f2', 
              position: 'sticky', 
              top: 0,
              zIndex: 1 
            }}>
              <th style={styles.th}>时间</th>
              <th style={styles.th}>下级地址</th>
              <th style={styles.th}>投注金额</th>
              <th style={styles.th}>佣金</th>
              {/* <th style={styles.th}>佣金比例</th> */}
              <th style={styles.th}>游戏类型</th>
              <th style={styles.th}>币种</th>
              {/* <th style={styles.th}>提取状态</th> */}
            </tr>
          </thead>
          <tbody>
            {tableData.map((item, index) => {
              const isEven = index % 2 === 0;
              
              return (
                <tr key={item._key} style={isEven ? styles.evenRow : styles.oddRow}>
                  <td style={styles.td}>{formatTimeDisplay(item.created_at)}</td>
                  <td style={styles.td}>
                    {item.sender_addr ? `...${item.sender_addr.slice(-8)}` : "未知"}
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontWeight: 'bold' }}>{item.bet_amount}</span>
                  </td>
                  <td style={{
                    ...styles.td,
                    color: '#faad14',
                    fontWeight: 'bold'
                  }}>
                    {item.commission}
                  </td>
                  {/* <td style={styles.td}>
                    {(item.commission_rate * 100).toFixed(1)}%
                  </td> */}
                  <td style={styles.td}>
                    {GAME_NAME_MAPPING[item.game_type] || item.game_type || "未知"}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: item.token_symbol === 'TRX' ? '#e6f7ff' : '#f6ffed',
                      color: item.token_symbol === 'TRX' ? '#1890ff' : '#52c41a',
                      fontSize: '10px'
                    }}>
                      {item.token_symbol || '-'}
                    </span>
                  </td>
                  {/* <td style={styles.td}>
                    {isWithdrawn ? (
                      <span style={{ color: '#52c41a' }}>已提取</span>
                    ) : (
                      <span style={{ color: '#999' }}>未提取</span>
                    )}
                  </td> */}
                </tr>
              );
            })}
            {tableData.length === 0 && !loading && (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                  暂无佣金记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {loading && (
        <div style={{ textAlign: "center", padding: "20px", color: "#999" }}>
          加载中...
        </div>
      )}
    </div>
  );
};

export default CommissionHistoryTable;
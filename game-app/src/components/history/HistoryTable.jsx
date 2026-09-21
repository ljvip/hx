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

// 根据地址判断链类型
const getChainTypeFromAddress = (address) => {
  if (!address) return "tron";
  if (address.toLowerCase().startsWith("0x")) {
    return "bsc";
  }
  if (address.startsWith("T")) {
    return "tron";
  }
  return "tron";
};

// 根据链类型和区块号获取区块浏览器链接
const getBlockExplorerUrl = (blockNumber, address) => {
  const chainType = getChainTypeFromAddress(address);
  if (chainType === "bsc") {
    return `https://bscscan.com/block/${blockNumber}`;
  }
  return `https://tronscan.org/#/block/${blockNumber}`;
};

// 获取网络图标
const getNetworkIcon = (address) => {
  const chainType = getChainTypeFromAddress(address);
  if (chainType === "bsc") {
    return "🟡";
  }
  return "🌐";
};

const HistoryTable = ({ data, loading, onRefresh, title }) => {
  const [searchText, setSearchText] = useState("");
  const [gameFilter, setGameFilter] = useState("all");
  
  // 兼容两种字段名的辅助函数
  const getField = (item, camelCase, snakeCase) => {
    return item[camelCase] !== undefined ? item[camelCase] : item[snakeCase];
  };

  // 格式化时间
  const formatTimeDisplay = (timeStr) => {
    if (!timeStr) return "未知";
    const date = new Date(timeStr);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  // 过滤数据
  const filteredData = data.filter(item => {
    const address = getField(item, 'OwnerAddress', 'owner_address');
    const game = getField(item, 'GameName', 'game_name');
    
    if (searchText && !address?.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    if (gameFilter !== "all" && game !== gameFilter) {
      return false;
    }
    return true;
  });

  // 为每行数据添加唯一 key
  const tableData = filteredData.map((item, index) => ({
    ...item,
    _key: item.id || item.TxID || item.tx_id || index,
  }));

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>{title || "交易历史"}</h3>
        <Space wrap size="small">
          <Input
            placeholder="搜索玩家地址"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 180 }}
            size="small"
            allowClear
          />
          <Select
            value={gameFilter}
            onChange={setGameFilter}
            style={{ width: 100 }}
            size="small"
            options={[
              { value: "all", label: "全部" },
              ...Object.entries(GAME_NAME_MAPPING).map(([key, value]) => ({
                value: key,
                label: value,
              })),
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={onRefresh} size="small">刷新</Button>
        </Space>
      </div>
      
      {/* 使用原生表格，样式与 TransferForm 一致 */}
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
              <th style={styles.th}>玩家</th>
              <th style={styles.th}>投注</th>
              <th style={styles.th}>返奖</th>
              <th style={styles.th}>游戏</th>
              <th style={styles.th}>开奖</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((item, index) => {
              const time = getField(item, 'CreatedAt', 'created_at');
              const address = getField(item, 'OwnerAddress', 'owner_address');
              const amount = getField(item, 'TransactionAmount', 'transaction_amount');
              const finalAmount = getField(item, 'FinalAmount', 'final_amount');
              const symbol = getField(item, 'TokenSymbol', 'token_symbol');
              const game = getField(item, 'GameName', 'game_name');
              const hash = getField(item, 'BlockHash', 'block_hash');
              const number = getField(item, 'BlockNumber', 'block_number');
              const userResult = getField(item, 'UserResult', 'user_result');
              
              const amountNum = parseFloat(amount) || 0;
              const finalAmountNum = parseFloat(finalAmount) || 0;
              
              // 判断输赢
              let isWin = false;
              let isLose = false;
              
              if (userResult === 'win' || userResult === '赢') {
                isWin = true;
              } else if (userResult === 'lose' || userResult === '输') {
                isLose = true;
              } else {
                if (finalAmountNum > amountNum) {
                  isWin = true;
                } else if (finalAmountNum < amountNum) {
                  isLose = true;
                }
              }
              
              // 根据玩家地址获取区块浏览器链接
              const blockExplorerUrl = getBlockExplorerUrl(number, address);
              const networkIcon = getNetworkIcon(address);
              const blockDisplay = `${networkIcon} ${hash?.slice(-5) || number}`;
              
              return (
                <tr key={item._key} style={index % 2 === 0 ? styles.evenRow : styles.oddRow}>
                  <td style={styles.td}>{formatTimeDisplay(time)}</td>
                  <td style={styles.td}>{address ? `...${address.slice(-6)}` : "未知"}</td>
                  <td style={styles.td}>{`${amount} ${symbol || ''}`}</td>
                  <td style={{
                    ...styles.td,
                    color: isLose || finalAmountNum === 0 ? '#1890ff' : (isWin ? '#ff4d4f' : '#333'),
                    fontWeight: (isLose || finalAmountNum === 0 || isWin) ? 'bold' : 'normal'
                  }}>
                    {(isLose || finalAmountNum === 0) ? '输' : finalAmount}
                  </td>
                  <td style={styles.td}>{GAME_NAME_MAPPING[game] || game || "未知"}</td>
                  <td style={styles.td}>
                    <a 
                      href={blockExplorerUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ color: '#1890ff', textDecoration: 'none' }}
                    >
                      {blockDisplay}
                    </a>
                  </td>
                </tr>
              );
            })}
            {tableData.length === 0 && !loading && (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                  暂无交易记录
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

export default HistoryTable;
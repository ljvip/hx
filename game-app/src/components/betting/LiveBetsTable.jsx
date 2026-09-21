// src/components/betting/LiveBetsTable.jsx
import { useState, useEffect, useCallback } from "react";
import { Badge, Tooltip } from "antd";
import { WifiOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { GAME_NAME_MAPPING } from "../../utils/constants";
import { useWebSocket } from "../../contexts/WebSocketContext";

const styles = {
  container: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1px solid #f0f0f0"
  },
  title: {
    color: "#52c41a",
    fontSize: "14px",
    fontWeight: "bold",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: 8
  },
  status: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: "11px",
    color: "#666"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "11px",
    textAlign: "center"
  },
  th: {
    border: "1px solid #e8e8e8",
    padding: "8px 4px",
    fontWeight: "bold",
    backgroundColor: "#fafafa",
    fontSize: "11px",
    position: "sticky",
    top: 0,
    zIndex: 1
  },
  td: {
    border: "1px solid #e8e8e8",
    padding: "6px 4px",
    fontSize: "10px"
  },
  evenRow: { backgroundColor: "#ffffff" },
  oddRow: { backgroundColor: "#f9f9f9" },
  highlightRow: { backgroundColor: "#e6f7ff", transition: "background-color 0.3s" }
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

const LiveBetsTable = ({ maxRecords = 10 }) => {
  const [transactions, setTransactions] = useState([]);
  const [newItemIds, setNewItemIds] = useState(new Set());
  const { isConnected, on, off } = useWebSocket();

  // 格式化金额
  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return '0';
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    return num.toFixed(2);
  };

  // 添加新交易
  const addNewTransaction = useCallback((newTransaction) => {
    setTransactions(prev => {
      const exists = prev.some(tx => tx.tx_id === newTransaction.tx_id);
      if (exists) return prev;
      const newList = [newTransaction, ...prev].slice(0, maxRecords);
      return newList;
    });
    
    const newId = newTransaction.id || newTransaction.tx_id;
    setNewItemIds(prev => new Set(prev).add(newId));
    setTimeout(() => {
      setNewItemIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(newId);
        return newSet;
      });
    }, 3000);
  }, [maxRecords]);

  // 监听 WebSocket 新投注消息
  useEffect(() => {
    if (!isConnected) return;

    const handleNewBet = (data) => {
      // 兼容不同的数据格式
      const txId = data.tx_id || data.TxID;
      const ownerAddress = data.owner_address || data.OwnerAddress;
      const blockNumber = data.block_number || data.BlockNumber;
      const blockHash = data.block_hash || data.BlockHash;
      const gameName = data.game_name || data.GameName;
      const transactionAmount = data.transaction_amount || data.TransactionAmount;
      const tokenSymbol = data.token_symbol || data.TokenSymbol || 'TRX';
      const finalAmount = data.final_amount || data.FinalAmount;
      const userResult = data.user_result || data.UserResult;
      const createdAt = data.created_at || data.CreatedAt;
      
      const newTransaction = {
        id: txId || Date.now(),
        tx_id: txId,
        owner_address: ownerAddress,
        block_number: blockNumber,
        block_hash: blockHash,
        game_name: gameName,
        transaction_amount: transactionAmount,
        token_symbol: tokenSymbol,
        final_amount: finalAmount,
        user_result: userResult,
        timestamp: createdAt || new Date().toISOString(),
      };
      addNewTransaction(newTransaction);
    };

    on('bet:new', handleNewBet);

    return () => {
      off('bet:new', handleNewBet);
    };
  }, [isConnected, addNewTransaction, on, off]);

  // 格式化时间
  const formatTime = (timestamp) => {
    if (!timestamp) return "未知";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  // 获取玩家地址缩写
  const getShortAddress = (address) => {
    if (!address) return "未知";
    return `...${address.slice(-6)}`;
  };

  // 获取游戏名称
  const getGameName = (game) => {
    return GAME_NAME_MAPPING[game] || game || "未知";
  };

  // 判断输赢和样式
  const getResultStyle = (transactionAmount, finalAmount, userResult) => {
    const amount = parseFloat(transactionAmount) || 0;
    const final = parseFloat(finalAmount) || 0;
    
    if (userResult === 'win' || userResult === '赢' || final > amount) {
      return { color: '#ff4d4f', text: formatAmount(final) };
    }
    if (userResult === 'lose' || userResult === '输' || final === 0) {
      return { color: '#1890ff', text: '输' };
    }
    return { color: '#333', text: formatAmount(final) };
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <ThunderboltOutlined style={{ color: '#52c41a' }} />
          <span>实时投注</span>
          {isConnected && <Badge status="processing" text="实时" />}
        </div>
        <div style={styles.status}>
          <Tooltip title={isConnected ? "实时连接中" : "等待连接"}>
            <WifiOutlined style={{ color: isConnected ? '#52c41a' : '#999' }} />
          </Tooltip>
        </div>
      </div>
      
      <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>时间</th>
              <th style={styles.th}>玩家</th>
              <th style={styles.th}>投注</th>
              <th style={styles.th}>返奖</th>
              <th style={styles.th}>游戏</th>
              <th style={styles.th}>开奖</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                  暂无投注记录
                </td>
              </tr>
            ) : (
              transactions.map((item, index) => {
                const isHighlight = newItemIds.has(item.id || item.tx_id);
                const resultStyle = getResultStyle(
                  item.transaction_amount, 
                  item.final_amount, 
                  item.user_result
                );
                // 根据玩家地址获取区块浏览器链接
                const ownerAddress = item.owner_address;
                const blockExplorerUrl = getBlockExplorerUrl(item.block_number, ownerAddress);
                const networkIcon = getNetworkIcon(ownerAddress);
                const blockDisplay = `${networkIcon} ${item.block_hash?.slice(-5) || item.block_number}`;
                
                return (
                  <tr 
                    key={item.id || item.tx_id || index}
                    style={{
                      ...(index % 2 === 0 ? styles.evenRow : styles.oddRow),
                      ...(isHighlight ? styles.highlightRow : {})
                    }}
                  >
                    <td style={styles.td}>{formatTime(item.timestamp || item.created_at)}</td>
                    <td style={styles.td}>{getShortAddress(item.owner_address)}</td>
                    <td style={styles.td}>{`${formatAmount(item.transaction_amount)} ${item.token_symbol || ''}`}</td>
                    <td style={{ ...styles.td, color: resultStyle.color, fontWeight: 'bold' }}>
                      {resultStyle.text}
                    </td>
                    <td style={styles.td}>{getGameName(item.game_name)}</td>
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
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LiveBetsTable;
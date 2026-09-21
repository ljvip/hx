// src/components/betting/GameTrends.jsx
import { useState, useEffect, useCallback } from "react";
import { message, Tooltip } from "antd";
import { getGameTrends } from "../../services/api";
import { GAME_NAME_MAPPING } from "../../utils/constants";
import { useWebSocket } from "../../contexts/WebSocketContext";

const getTrendColor = (result) => {
  if (!result) return "#e0e0e0";
  const redResults = ["大", "庄", "单", "输", "红"];
  const blueResults = ["小", "闲", "双", "赢", "蓝"];
  
  if (redResults.includes(result)) return "#ff4d4f";
  if (blueResults.includes(result)) return "#1890ff";
  if (/^\d+$/.test(result)) return "#ff4d4f";
  if (/^[a-zA-Z]+$/.test(result) && result.length === 1) return "#52c41a";
  return "#faad14";
};

const GameTrends = ({ gameName, compact = true }) => {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isConnected, on, off } = useWebSocket();

  const fetchTrends = useCallback(async () => {
    if (!gameName) return;
    
    setLoading(true);
    try {
      const limit = 52;
      const response = await getGameTrends(gameName, limit);
      const data = response?.data || [];
      
      const rows = 4;
      const cols = 13;
      const grid = [];
      
      for (let i = 0; i < rows; i++) {
        const row = [];
        for (let j = 0; j < cols; j++) {
          const index = j * rows + i;
          row.push(data[index] || null);
        }
        grid.push(row);
      }
      
      setTrends(grid);
    } catch (error) {
      console.error("获取走势失败:", error);
      message.error("获取游戏走势失败");
    } finally {
      setLoading(false);
    }
  }, [gameName]);

  // 初始加载
  useEffect(() => {
    const timer = setTimeout(fetchTrends, 0);
    return () => clearTimeout(timer);
  }, [fetchTrends]);

  // ✅ 监听 WebSocket bet:new 消息，触发走势图刷新
  useEffect(() => {
    if (!isConnected) return;

    const handleNewBet = () => {
      // console.log('收到新投注，刷新走势图:', data);
      // 延迟刷新，确保后端数据已更新
      setTimeout(() => {
        fetchTrends();
      }, 500);
    };

    on('bet:new', handleNewBet);

    return () => {
      off('bet:new', handleNewBet);
    };
  }, [isConnected, fetchTrends, on, off]);

  if (loading && trends.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "8px", fontSize: 12, color: "#999" }}>
        加载走势中...
      </div>
    );
  }

  if (trends.length === 0) return null;

  const cellSize = compact ? 18 : 24;
  const fontSize = compact ? 10 : 12;

  return (
    <div style={{ 
      overflowX: "auto", 
      margin: "8px 0",
      backgroundColor: "#fafafa",
      borderRadius: "8px",
      padding: "4px"
    }}>
      <div style={{ 
        textAlign: "center", 
        fontSize: 11, 
        marginBottom: 6, 
        color: "#888",
        fontWeight: 500
      }}>
        📊 {GAME_NAME_MAPPING[gameName] || gameName} 走势图
      </div>
      <table style={{ 
        borderCollapse: "collapse", 
        margin: "0 auto",
        fontSize: fontSize
      }}>
        <tbody>
          {trends.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((cell, colIdx) => {
                const value = cell?.result;
                return (
                  <td
                    key={colIdx}
                    style={{
                      padding: "2px",
                      textAlign: "center"
                    }}
                  >
                    {value ? (
                      <Tooltip title={`${value}`} placement="top">
                        <div
                          style={{
                            width: cellSize,
                            height: cellSize,
                            borderRadius: "50%",
                            backgroundColor: getTrendColor(value),
                            color: "#fff",
                            fontSize: fontSize,
                            fontWeight: "bold",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          {value.length > 2 ? value.slice(0, 2) : value}
                        </div>
                      </Tooltip>
                    ) : (
                      <div
                        style={{
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: "#f0f0f0",
                          borderRadius: "4px"
                        }}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GameTrends;
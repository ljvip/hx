import { useState, useEffect } from "react";
import { Card, Table, Tag, Badge } from "antd";
import { useWebSocket } from "../../hooks/useWebSocket";
import { GAME_NAME_MAPPING } from "../../utils/constants";
import { formatAddress, formatTime } from "../../utils/helpers";

const BetResults = ({ walletAddress }) => {
  const { status, subscribe } = useWebSocket({
    onMessage: (data) => {
      if (data.type === "betResults") {
        setResults(prev => [data.result, ...prev].slice(0, 20));
      }
    }
  });

  const [results, setResults] = useState([]);

  useEffect(() => {
    if (status === "🟢 已连接" && walletAddress) {
      subscribe(walletAddress);
    }
  }, [status, walletAddress, subscribe]);

  const getResultColor = (result) => {
    if (result === "赢" || result === "大" || result === "庄") return "success";
    if (result === "输" || result === "小" || result === "闲") return "error";
    return "warning";
  };

  const columns = [
    {
      title: "时间",
      dataIndex: "created_at",
      key: "time",
      render: (time) => formatTime(time),
      width: 100,
    },
    {
      title: "游戏",
      dataIndex: "game_name",
      key: "game",
      render: (game) => GAME_NAME_MAPPING[game] || game,
    },
    {
      title: "玩家",
      dataIndex: "owner_address",
      key: "player",
      render: (address) => formatAddress(address, 3, 4),
    },
    {
      title: "投注金额",
      dataIndex: "transaction_amount",
      key: "amount",
      render: (amount, record) => `${amount} ${record.token_symbol}`,
    },
    {
      title: "结果",
      dataIndex: "game_result",
      key: "result",
      render: (result) => (
        <Tag color={getResultColor(result)}>{result}</Tag>
      ),
    },
  ];

  return (
    <Card 
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>实时投注</span>
          <Badge 
            status={status === "🟢 已连接" ? "success" : "error"} 
            text={status}
          />
        </div>
      }
      style={{ borderRadius: "12px" }}
    >
      <Table
        dataSource={results}
        columns={columns}
        rowKey="tx_id"
        size="small"
        pagination={{ pageSize: 10 }}
        scroll={{ x: true }}
      />
    </Card>
  );
};

export default BetResults;
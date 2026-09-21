import { Alert } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from "@ant-design/icons";

const TransactionStatus = ({ status, message, transactionHash }) => {
  if (!status) return null;

  const getStatusConfig = () => {
    switch (status) {
      case "pending":
        return {
          type: "info",
          icon: <LoadingOutlined />,
          title: "交易处理中",
        };
      case "success":
        return {
          type: "success",
          icon: <CheckCircleOutlined />,
          title: "交易成功",
        };
      case "failed":
        return {
          type: "error",
          icon: <CloseCircleOutlined />,
          title: "交易失败",
        };
      default:
        return {
          type: "info",
          icon: null,
          title: "交易状态",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Alert
      message={config.title}
      description={
        <div>
          {message && <p>{message}</p>}
          {transactionHash && (
            <a
              href={`https://tronscan.org/#/transaction/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "12px" }}
            >
              查看交易详情 →
            </a>
          )}
        </div>
      }
      type={config.type}
      icon={config.icon}
      showIcon
      style={{ marginBottom: 16 }}
      closable
    />
  );
};

export default TransactionStatus;
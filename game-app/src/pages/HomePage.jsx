// src/pages/HomePage.jsx - 带错误边界版本
import React, { useEffect, useState } from "react";
import { Alert, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import WalletConnect from "../components/common/WalletConnect";
import TransferForm from "../components/betting/TransferForm";

const HomePage = () => {
  const navigate = useNavigate();
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // 初始化 Telegram Game Proxy
    let retryCount = 0;
    const maxRetries = 50;
    
    const checkProxy = () => {
      if (window.TelegramGameProxy) {
        console.log("TelegramGameProxy ready");
        window.TelegramGameProxy.receiveEvent();
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(checkProxy, 100);
      }
    };
    
    checkProxy();
  }, []);

  // 错误处理函数
  const handleError = (error) => {
    console.error("组件错误:", error);
    setHasError(true);
    setErrorMessage(error?.message || "组件加载失败");
  };

  if (hasError) {
    return (
      <div style={{ 
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "16px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}>
        <Alert
          message="页面出错"
          description={errorMessage || "请刷新页面重试"}
          type="error"
          showIcon
          action={
            <button onClick={() => window.location.reload()} style={{ padding: "4px 12px", cursor: "pointer" }}>
              刷新页面
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "16px"
    }}>
      <WalletConnect />
      <React.Suspense fallback={<Spin tip="加载中..." />}>
        <TransferForm onError={handleError} />
      </React.Suspense>
    </div>
  );
};

export default HomePage;
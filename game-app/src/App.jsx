// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import WalletProvider from "./contexts/WalletContext";
import { RefreshProvider } from "./contexts/RefreshContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import HomePage from "./pages/HomePage";
import HistoryPage from "./pages/HistoryPage";
import Register from "./pages/Register";
import ShareholderPage from "./pages/ShareholderPage";

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <RefreshProvider>
          {/* ✅ 正确顺序：WebSocketProvider 在外，WalletProvider 在内 */}
          <WebSocketProvider>
            <WalletProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/shareholder" element={<ShareholderPage />} />
                </Routes>
              </BrowserRouter>
            </WalletProvider>
          </WebSocketProvider>
        </RefreshProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
import { Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

const LoadingSpinner = ({ tip = "加载中...", size = "large", fullScreen = false }) => {
  const spinner = (
    <Spin 
      tip={tip} 
      size={size} 
      indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
    />
  );

  if (fullScreen) {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 9999,
      }}>
        {spinner}
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "40px",
    }}>
      {spinner}
    </div>
  );
};

export default LoadingSpinner;
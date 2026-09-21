// 格式化钱包地址
export const formatAddress = (address, start = 4, end = 6) => {
  if (!address) return "未知";
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

// 格式化金额
export const formatAmount = (amount, decimals = 2) => {
  if (!amount && amount !== 0) return "0";
  return Number(amount).toFixed(decimals);
};

// 格式化时间
export const formatTime = (timestamp) => {
  if (!timestamp) return "未知";
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// 防抖函数
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// 节流函数
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// 复制到剪贴板
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return { success: true, message: "复制成功" };
  } catch {
    return { success: false, message: "复制失败" };
  }
};

// 获取趋势颜色
export const getTrendColor = (result) => {
  const redResults = ["大", "庄", "单", "输"];
  const blueResults = ["小", "闲", "双", "赢"];
  
  if (redResults.includes(result)) return "#ff0000";
  if (blueResults.includes(result)) return "#0033ff";
  if (/^\d+$/.test(result)) return "#ff0000";
  if (/^[a-zA-Z]+$/.test(result)) return "#ff0000";
  if (/[0-9]/.test(result) && /[a-zA-Z]/.test(result)) return "#0033ff";
  return "#66ff66";
};

// 验证金额
export const isValidAmount = (amount) => {
  const num = Number(amount);
  return !isNaN(num) && num > 0 && num <= 1000000;
};

// 延迟函数
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
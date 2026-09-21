// src/services/tronService.js
import { USDT_CONTRACT, TRONGRID_API } from "../utils/constants";
import axios from "axios";

// 创建 axios 实例，添加重试配置
const tronApi = axios.create({
  baseURL: TRONGRID_API,
  timeout: 10000,
});

// 添加请求拦截器，添加延迟避免频率过高
let lastRequestTime = 0;
const minRequestInterval = 1000; // 最小请求间隔 1 秒

// 重试函数 - 只在真正的错误时重试，不重试"无数据"的情况
const fetchWithRetry = async (fn, retries = 3, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      // 添加延迟避免频率过高
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, minRequestInterval - timeSinceLastRequest));
      }
      lastRequestTime = Date.now();
      
      const result = await fn();
      
      // 如果返回成功但无数据，直接返回结果，不重试
      if (result.data?.success === true && (!result.data?.data || result.data.data.length === 0)) {
        console.log(`地址无账户数据，直接返回`);
        return result;
      }
      
      return result;
    } catch (error) {
      // 只有网络错误或非 404 的错误才重试
      if (error.response?.status === 429 && i < retries - 1) {
        console.log(`请求被限流，${delay}ms 后重试... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      // 404 错误不重试，直接抛出
      if (error.response?.status === 404) {
        console.log(`地址 ${error.config?.url?.split('/').pop()} 不存在，返回余额 0`);
        throw error;
      }
      if (i === retries - 1) throw error;
      console.log(`请求失败，${delay}ms 后重试... (${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// 获取 TRON 余额
export const getTronBalance = async (address) => {
  if (!address) return { trxBalance: 0, usdtBalance: 0 };
  
  try {
    const result = await fetchWithRetry(async () => {
      const response = await tronApi.get(`/v1/accounts/${address}`);
      return response;
    });
    
    const data = result.data;
    
    // 处理成功但无数据的情况
    if (data.success === true && (!data.data || data.data.length === 0)) {
      console.log(`地址 ${address} 无账户数据，返回余额 0`);
      return { trxBalance: 0, usdtBalance: 0 };
    }
    
    // 处理有数据的情况
    if (data.data && data.data.length > 0) {
      const accountData = data.data[0];
      const trxBalance = (accountData.balance / 1e6) || 0;
      
      // 查找 USDT 余额
      let usdtBalance = 0;
      if (accountData.trc20 && Array.isArray(accountData.trc20)) {
        const usdtToken = accountData.trc20.find(token => token[USDT_CONTRACT]);
        if (usdtToken && usdtToken[USDT_CONTRACT]) {
          usdtBalance = usdtToken[USDT_CONTRACT] / 1e6;
        }
      }
      
      return { trxBalance, usdtBalance };
    }
    
    return { trxBalance: 0, usdtBalance: 0 };
  } catch (error) {
    // 处理 404 错误
    if (error.response?.status === 404) {
      console.log(`地址 ${address} 不存在，返回余额 0`);
      return { trxBalance: 0, usdtBalance: 0 };
    }
    
    console.error("获取余额失败:", error.message);
    return { trxBalance: 0, usdtBalance: 0 };
  }
};

const requireTronWeb = () => {
  const tronWeb = getTronWeb();
  if (!tronWeb) throw new Error("请先安装 TronLink");
  if (!tronWeb.defaultAddress?.base58) throw new Error("请先登录钱包");
  return tronWeb;
};

// 转账 TRX
export const transferTRX = async (toAddress, amount) => {
  const tronWeb = requireTronWeb();

  try {
    const result = await tronWeb.trx.sendTransaction(
      toAddress,
      tronWeb.toSun(amount)
    );
    return result;
  } catch (error) {
    console.error("TRX 转账失败:", error);
    throw error;
  }
};

// 转账 USDT
export const transferUSDT = async (toAddress, amount) => {
  const tronWeb = requireTronWeb();

  try {
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const result = await contract.transfer(toAddress, tronWeb.toSun(amount)).send();
    return result;
  } catch (error) {
    console.error("USDT 转账失败:", error);
    throw error;
  }
};

// 签名消息
export const signMessage = async (message) => {
  const tronWeb = requireTronWeb();

  try {
    const hexMessage = tronWeb.toHex(message);
    const signature = await tronWeb.trx.sign(hexMessage);
    return signature;
  } catch (error) {
    console.error("签名失败:", error);
    throw error;
  }
};

// 检测是否为移动设备
export const isMobileDevice = () => {
  return /Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent);
};

// 跳转到 TokenPocket
export const redirectToTokenPocket = () => {
  const currentUrl = `${window.location.protocol}//${window.location.host}`;
  const params = JSON.stringify({ url: currentUrl, chain: "TRON" });
  window.location.href = `tpdapp://open?params=${encodeURIComponent(params)}`;
};

const isUsableTronWeb = (value) => !!value && value !== false && typeof value === "object";

// 新版 TronLink 注入 window.tron，授权前 window.tronWeb 不存在
export const getTronProvider = () => window.tron || window.tronLink || null;

export const getTronWeb = () => {
  const provider = getTronProvider();
  if (isUsableTronWeb(provider?.tronWeb)) return provider.tronWeb;
  if (isUsableTronWeb(window.tronWeb)) return window.tronWeb;
  return null;
};

const toBase58 = (raw, tronWeb) => {
  if (!raw || typeof raw !== "string") return null;
  if (raw.startsWith("T") && raw.length >= 30) return raw;
  if (!tronWeb?.address?.fromHex) return null;
  try {
    let hex = raw.startsWith("0x") ? raw.slice(2) : raw;
    if (hex.length === 40) hex = `41${hex}`;
    const base58 = tronWeb.address.fromHex(hex);
    return typeof base58 === "string" && base58.startsWith("T") ? base58 : null;
  } catch {
    return null;
  }
};

const waitForTronProvider = (timeout = 1500) => new Promise((resolve) => {
  const existing = getTronProvider() || window.tronWeb;
  if (existing) {
    resolve(existing);
    return;
  }

  let settled = false;
  const finish = (provider) => {
    if (settled) return;
    settled = true;
    window.removeEventListener("TIP6963:announceProvider", onAnnounce);
    window.removeEventListener("tronLink#initialized", onInit);
    resolve(provider || getTronProvider() || window.tronWeb || null);
  };
  const onAnnounce = (event) => {
    const provider = event.detail?.provider;
    const name = event.detail?.info?.name;
    if (provider && (!name || name === "TronLink")) finish(provider);
  };
  const onInit = () => finish(getTronProvider() || window.tronWeb);
  window.addEventListener("TIP6963:announceProvider", onAnnounce);
  window.addEventListener("tronLink#initialized", onInit);
  window.dispatchEvent(new Event("TIP6963:requestProvider"));
  setTimeout(() => finish(null), timeout);
});

const requestTronAccounts = async (provider) => {
  if (typeof provider?.request !== "function") return null;

  try {
    return await provider.request({ method: "eth_requestAccounts" });
  } catch (error) {
    if (error?.code === 4001 || error?.code === -32000) throw error;
  }

  const result = await provider.request({ method: "tron_requestAccounts" });
  if (result && typeof result === "object" && !Array.isArray(result) && result.code && result.code !== 200) {
    const error = new Error(result.message || "连接钱包失败");
    error.code = result.code;
    throw error;
  }
  return result;
};

const readConnectedAddress = async (provider, accounts) => {
  for (let i = 0; i < 10; i += 1) {
    const tronWeb = isUsableTronWeb(provider?.tronWeb)
      ? provider.tronWeb
      : getTronWeb();
    const fromAccounts = Array.isArray(accounts) ? toBase58(accounts[0], tronWeb) : null;
    const fromWeb = tronWeb?.defaultAddress?.base58 || null;
    if (fromAccounts || fromWeb) {
      return { address: fromAccounts || fromWeb, tronWeb, provider };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return { address: null, tronWeb: getTronWeb(), provider };
};

export const connectTronLink = async () => {
  const provider = await waitForTronProvider();
  if (!provider) {
    const error = new Error("未检测到 TronLink，请先安装");
    error.code = "NOT_INSTALLED";
    throw error;
  }

  const requester = [provider, window.tron, window.tronLink, window.tronWeb]
    .find((item) => typeof item?.request === "function");
  const accounts = requester ? await requestTronAccounts(requester) : null;
  const connected = await readConnectedAddress(provider, accounts);
  if (!connected.address) {
    throw new Error("未能获取到钱包地址，请先解锁 TronLink");
  }
  return connected;
};

// 检查 TronLink 是否安装
export const isTronLinkInstalled = () => {
  return !!(getTronProvider() || window.tronWeb);
};

// 获取当前钱包地址
export const getCurrentAddress = () => {
  return getTronWeb()?.defaultAddress?.base58 || null;
};
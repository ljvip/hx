// src/services/bscService.js
import { BSC_CONFIG, USDT_BSC_CONTRACT } from "../utils/constants";
// 优化后的 BSC 公共 RPC 节点列表（按优先级排序）
const BSC_RPC_URLS = [
  // Ankr - 最稳定，项目中使用广泛
  // 'https://rpc.ankr.com/bsc',
  // // 官方镜像节点（国内友好）
  // 'https://bsc-dataseed1.defibit.io/',
  // 'https://bsc-dataseed1.ninicoin.io/',
  // 'https://bsc-dataseed.defibit.io',
  // 'https://bsc-dataseed.ninicoin.io',
  // 官方主节点
  // 'https://bsc-dataseed.binance.org/',
  // 'https://bsc-dataseed1.binance.org/',
  // 'https://bsc-dataseed2.binance.org/',
  // 'https://bsc-dataseed3.binance.org/',
  // 'https://bsc-dataseed4.binance.org/',
  // // 社区/第三方节点
  'https://bsc-dataseed.nariox.org',
  'https://bsc.publicnode.com',
  'https://bsc.drpc.org',
];

let currentRpcIndex = 0;
let failedRpcs = new Set();

// 重置失败的 RPC 列表（定时重置，避免永久跳过）
setInterval(() => {
  failedRpcs.clear();
  console.log('已重置 RPC 失败列表');
}, 5 * 60 * 1000); // 每5分钟重置一次

// 获取下一个可用的 RPC 节点
const getNextRpc = () => {
  const startIndex = currentRpcIndex;
  while (true) {
    const rpcUrl = BSC_RPC_URLS[currentRpcIndex % BSC_RPC_URLS.length];
    if (!failedRpcs.has(rpcUrl)) {
      return rpcUrl;
    }
    currentRpcIndex++;
    if (currentRpcIndex - startIndex > BSC_RPC_URLS.length) {
      // 所有节点都失败了，重置失败列表
      failedRpcs.clear();
      return BSC_RPC_URLS[0];
    }
  }
};

// 标记 RPC 节点失败
const markRpcFailed = (rpcUrl) => {
  failedRpcs.add(rpcUrl);
  currentRpcIndex++;
  console.warn(`RPC节点失败，切换到下一个: ${rpcUrl}`);
};

// 带超时的 fetch
const fetchWithTimeout = async (url, options, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// 调用 RPC（带故障转移）
const callRPC = async (method, params, retryCount = 0) => {
  const rpcUrl = getNextRpc();
  const maxRetries = BSC_RPC_URLS.length;
  
  try {
    const response = await fetchWithTimeout(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: Date.now()
      })
    }, 10000);
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    return data.result;
  } catch (error) {
    console.error(`RPC调用失败 (${rpcUrl}):`, error.message);
    markRpcFailed(rpcUrl);
    
    if (retryCount < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return callRPC(method, params, retryCount + 1);
    }
    throw new Error(`所有 RPC 节点都失败了: ${error.message}`);
  }
};

// 检测是否安装了 MetaMask
export const isMetaMaskInstalled = () => {
  return typeof window.ethereum !== 'undefined';
};

// 获取当前链ID
export const getChainId = async () => {
  if (!window.ethereum) return null;
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return chainId;
  } catch (error) {
    console.error("获取链ID失败:", error);
    return null;
  }
};

// 检查是否在 BSC 网络
export const isBSCNetwork = async () => {
  const chainId = await getChainId();
  return chainId === BSC_CONFIG.chainId;
};

// 切换到 BSC 网络
export const switchToBSC = async () => {
  if (!window.ethereum) throw new Error("请安装 MetaMask");
  
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CONFIG.chainId }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [BSC_CONFIG],
        });
      } catch (addError) {
        console.error("添加BSC网络失败:", addError);
        throw new Error("添加BSC网络失败，请手动添加");
      }
    } else {
      throw switchError;
    }
  }
};

// 连接 BSC 钱包
export const connectBSCWallet = async () => {
  if (!window.ethereum) {
    window.open('https://metamask.io/download/', '_blank');
    throw new Error("请先安装 MetaMask 钱包");
  }
  
  try {
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    if (!accounts || accounts.length === 0) {
      throw new Error("未获取到钱包地址");
    }
    
    await switchToBSC();
    return accounts[0];
  } catch (error) {
    console.error("连接 BSC 钱包失败:", error);
    throw error;
  }
};

// 获取 BNB 余额
export const getBNBBalance = async (address) => {
  if (!address) return 0;
  
  try {
    const balanceHex = await callRPC('eth_getBalance', [address, 'latest']);
    const balance = parseInt(balanceHex, 16) / 1e18;
    return balance;
  } catch (error) {
    console.error("获取 BNB 余额失败:", error);
    return 0;
  }
};

// 获取 BSC USDT 余额
export const getBSCUSDTBalance = async (address) => {
  if (!address) return 0;
  
  try {
    // balanceOf 函数的 calldata
    const functionSignature = '0x70a08231';
    const addressParam = address.slice(2).padStart(64, '0');
    const data = functionSignature + addressParam;
    
    const result = await callRPC('eth_call', [{
      to: USDT_BSC_CONTRACT,
      data: data
    }, 'latest']);
    
    if (result && result !== '0x') {
      const balance = parseInt(result, 16) / 1e18;
      return balance;
    }
    return 0;
  } catch (error) {
    console.error("获取 USDT 余额失败:", error);
    return 0;
  }
};

// 获取 BSC 全部余额
export const getBSCBalance = async (address) => {
  try {
    const [bnb, usdt] = await Promise.all([
      getBNBBalance(address),
      getBSCUSDTBalance(address)
    ]);
    return { bnb: bnb || 0, usdt: usdt || 0 };
  } catch (error) {
    console.error("获取 BSC 余额失败:", error);
    return { bnb: 0, usdt: 0 };
  }
};

// 转账 BNB（使用 MetaMask）
export const transferBNB = async (toAddress, amount) => {
  if (!window.ethereum) throw new Error("请先安装 MetaMask");
  
  try {
    const accounts = await window.ethereum.request({ 
      method: 'eth_accounts' 
    });
    
    if (!accounts || accounts.length === 0) {
      throw new Error("请先连接钱包");
    }
    
    const fromAddress = accounts[0];
    const amountInWei = BigInt(Math.floor(amount * 1e18));
    
    const transaction = {
      from: fromAddress,
      to: toAddress,
      value: '0x' + amountInWei.toString(16),
      chainId: BSC_CONFIG.chainId,
    };
    
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [transaction],
    });
    
    return { result: true, txid: txHash };
  } catch (error) {
    console.error("BNB 转账失败:", error);
    throw new Error(error.message || "BNB转账失败");
  }
};

// 转账 BSC USDT（使用 MetaMask）
export const transferBSCUSDT = async (toAddress, amount) => {
  if (!window.ethereum) throw new Error("请先安装 MetaMask");
  
  try {
    const accounts = await window.ethereum.request({ 
      method: 'eth_accounts' 
    });
    
    if (!accounts || accounts.length === 0) {
      throw new Error("请先连接钱包");
    }
    
    const fromAddress = accounts[0];
    const amountInWei = BigInt(Math.floor(amount * 1e18));
    
    // USDT 转账数据: transfer(address,uint256)
    const transferData = '0xa9059cbb' + 
      toAddress.slice(2).padStart(64, '0') + 
      amountInWei.toString(16).padStart(64, '0');
    
    const transaction = {
      from: fromAddress,
      to: USDT_BSC_CONTRACT,
      data: transferData,
      chainId: BSC_CONFIG.chainId,
    };
    
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [transaction],
    });
    
    return { result: true, txid: txHash };
  } catch (error) {
    console.error("BSC USDT 转账失败:", error);
    throw new Error(error.message || "USDT转账失败");
  }
};


// 监听账户变化
export const onAccountChange = (callback) => {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
      const address = accounts && accounts.length > 0 ? accounts[0] : null;
      callback(address);
    });
  }
};

// 监听链变化
export const onChainChange = (callback) => {
  if (window.ethereum) {
    window.ethereum.on('chainChanged', (chainId) => {
      callback(chainId);
    });
  }
};

// 移除监听器
export const removeAccountChangeListener = (callback) => {
  if (window.ethereum) {
    window.ethereum.removeListener('accountsChanged', callback);
  }
};

export const removeChainChangeListener = (callback) => {
  if (window.ethereum) {
    window.ethereum.removeListener('chainChanged', callback);
  }
};
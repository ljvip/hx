// src/contexts/WalletContext.jsx (simplified version without adapter)
import { createContext, useState, useEffect, useCallback, useRef } from "react";
import { message } from "antd";
import { CHAIN_TYPES } from "../utils/constants";
import {
  getTronBalance,
  isMobileDevice,
  isTronLinkInstalled,
  connectTronLink,
  getTronProvider,
  getTronWeb,
} from "../services/tronService";
import {
  isMetaMaskInstalled,
  connectBSCWallet,
  getBSCBalance,
  onAccountChange,
  onChainChange,
  removeAccountChangeListener,
  removeChainChangeListener,
} from "../services/bscService";
import { useWebSocket } from "./WebSocketContext";

export const WalletContext = createContext(null);

const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [chainType, setChainType] = useState(null);
  const [balance, setBalance] = useState({ trx: 0, usdt: 0, bnb: 0 });
  const [loading, setLoading] = useState(false);
  const { isConnected: wsConnected, on, off } = useWebSocket();
  const tronAccountChangeHandlerRef = useRef(null);
  const tronProviderRef = useRef(null);
  const bscAccountChangeHandlerRef = useRef(null);
  const bscChainChangeHandlerRef = useRef(null);

  const updateBalance = useCallback(async (address, type) => {
   if (!address || !type) return;

   try {
     if (type === CHAIN_TYPES.TRON) {
       const { trxBalance, usdtBalance } = await getTronBalance(address);
       setBalance({ trx: trxBalance, usdt: usdtBalance, bnb: 0 });
     } else if (type === CHAIN_TYPES.BSC) {
       const { bnb, usdt } = await getBSCBalance(address);
       setBalance({ trx: 0, usdt: usdt, bnb: bnb });
     }
   } catch (error) {
     console.error("更新余额失败:", error);
   }
  }, []);

  const unbindTronAccountListener = useCallback(() => {
    const provider = tronProviderRef.current || getTronProvider() || getTronWeb();
    const handler = tronAccountChangeHandlerRef.current;
    if (provider && handler) {
      if (provider.removeListener) provider.removeListener("accountsChanged", handler);
      else if (provider.off) provider.off("accountsChanged", handler);
    }
    tronAccountChangeHandlerRef.current = null;
    tronProviderRef.current = null;
  }, []);

  const disconnectWallet = useCallback(async () => {
   unbindTronAccountListener();

   if (bscAccountChangeHandlerRef.current) {
     removeAccountChangeListener(bscAccountChangeHandlerRef.current);
     bscAccountChangeHandlerRef.current = null;
   }

   if (bscChainChangeHandlerRef.current) {
     removeChainChangeListener(bscChainChangeHandlerRef.current);
     bscChainChangeHandlerRef.current = null;
   }

   setWalletAddress(null);
   setChainType(null);
   setBalance({ trx: 0, usdt: 0, bnb: 0 });
   message.info("钱包已断开");
  }, [unbindTronAccountListener]);

  const handleTronAccountsChanged = useCallback((accounts) => {
   const raw = Array.isArray(accounts) ? accounts[0] : accounts;
   const newAddress = (typeof raw === "string" && raw.startsWith("T"))
     ? raw
     : getTronWeb()?.defaultAddress?.base58;
   if (newAddress) {
     setWalletAddress(newAddress);
     setChainType(CHAIN_TYPES.TRON);
     updateBalance(newAddress, CHAIN_TYPES.TRON);
     message.info("账户已切换");
   } else {
     disconnectWallet();
   }
  }, [disconnectWallet, updateBalance]);

  const connectTronWallet = useCallback(async () => {
   if (loading) return;

   setLoading(true);

   try {
     const { address, provider } = await connectTronLink();

     setWalletAddress(address);
     setChainType(CHAIN_TYPES.TRON);
     await updateBalance(address, CHAIN_TYPES.TRON);
     message.success("TRON 钱包已连接");

    unbindTronAccountListener();
    const listenerTarget = provider?.on ? provider : getTronProvider() || getTronWeb();
    // 检测 TP 钱包，跳过事件监听（TP 切换账户会自动刷新页面）
    const isTPWallet = 
      window.navigator.userAgent.includes("TokenPocket") ||
      provider?.isTokenPocket ||
      listenerTarget?.isTokenPocket;

    if (!isTPWallet && listenerTarget?.on) {
      tronProviderRef.current = listenerTarget;
      tronAccountChangeHandlerRef.current = handleTronAccountsChanged;
      listenerTarget.on("accountsChanged", handleTronAccountsChanged);
    }
   } catch (error) {
     console.error("连接 TRON 钱包失败:", error);

     if (error.code === 4001) {
       message.error("用户拒绝了连接请求");
     } else if (error.code === "NOT_INSTALLED" || error.message?.includes("未检测到")) {
       message.error("未检测到 TronLink，请先安装");
       if (isMobileDevice()) {
         setTimeout(() => {
           window.location.href = "https://www.tronlink.org/";
         }, 2000);
       }
     } else if (error.code === -32000) {
       message.error("TronLink 已锁定，请先解锁后再连接");
     } else {
       message.error(error.message || "连接钱包失败，请重试");
     }
   } finally {
     setLoading(false);
   }
  }, [handleTronAccountsChanged, loading, unbindTronAccountListener, updateBalance]);

  const connectBSCWalletHandler = useCallback(async () => {
   if (loading) return;

   setLoading(true);
   try {
     const address = await connectBSCWallet();
     setWalletAddress(address);
     setChainType(CHAIN_TYPES.BSC);
     await updateBalance(address, CHAIN_TYPES.BSC);
     message.success("BSC 钱包已连接");
   } catch (error) {
     console.error("连接 BSC 钱包失败:", error);
     message.error(error.message || "连接钱包失败，请重试");
   } finally {
     setLoading(false);
   }
  }, [loading, updateBalance]);

  const connectWallet = useCallback(async (preferredChain = null) => {
   if (preferredChain === CHAIN_TYPES.TRON) {
     await connectTronWallet();
   } else if (preferredChain === CHAIN_TYPES.BSC) {
     await connectBSCWalletHandler();
   } else {
     const hasTronLink = isTronLinkInstalled();
     if (hasTronLink) {
       await connectTronWallet();
     } else if (isMetaMaskInstalled()) {
       await connectBSCWalletHandler();
     } else {
       message.error("请先安装 TronLink 或 MetaMask 钱包", 5);
       if (isMobileDevice()) {
         setTimeout(() => {
           window.location.href = 'https://www.tronlink.org/';
         }, 2000);
       }
     }
   }
  }, [connectTronWallet, connectBSCWalletHandler]);

  useEffect(() => {
   if (!wsConnected) return;

   const handleNewBet = (data) => {
     if (walletAddress && data?.owner_address === walletAddress) {
       setTimeout(() => {
         updateBalance(walletAddress, chainType);
       }, 3000);
     }
   };

   const handleBalanceUpdate = (data) => {
     if (walletAddress && data?.address === walletAddress) {
       updateBalance(walletAddress, chainType);
     }
   };

   on('bet:new', handleNewBet);
   on('balance:update', handleBalanceUpdate);

   return () => {
     off('bet:new', handleNewBet);
     off('balance:update', handleBalanceUpdate);
   };
  }, [chainType, on, off, updateBalance, walletAddress, wsConnected]);

  useEffect(() => {
   const tryAutoConnect = async () => {
     const savedAddress = localStorage.getItem('lastWalletAddress');
     const savedChain = localStorage.getItem('lastChainType');

     if (savedAddress && savedChain === CHAIN_TYPES.TRON) {
       try {
         const address = getTronWeb()?.defaultAddress?.base58;
         if (address && address === savedAddress) {
           setWalletAddress(address);
           setChainType(CHAIN_TYPES.TRON);
           await updateBalance(address, CHAIN_TYPES.TRON);
           console.log("自动恢复 TRON 连接成功");
         }
       } catch (error) {
         console.log("自动恢复连接失败:", error.message);
         localStorage.removeItem('lastWalletAddress');
         localStorage.removeItem('lastChainType');
       }
     }
   };

   tryAutoConnect();
  }, [updateBalance]);

  useEffect(() => {
   if (walletAddress && chainType) {
     localStorage.setItem('lastWalletAddress', walletAddress);
     localStorage.setItem('lastChainType', chainType);
   }
  }, [walletAddress, chainType]);

  useEffect(() => {
   const handleAccountChange = (newAddress) => {
     if (newAddress) {
       setWalletAddress(newAddress);
       setChainType(CHAIN_TYPES.BSC);
       updateBalance(newAddress, CHAIN_TYPES.BSC);
       message.info("账户已切换");
     } else {
       disconnectWallet();
     }
   };

   const handleChainChange = () => {
     message.info("网络已切换，请重新连接钱包");
     disconnectWallet();
   };

   bscAccountChangeHandlerRef.current = handleAccountChange;
   bscChainChangeHandlerRef.current = handleChainChange;
   onAccountChange(handleAccountChange);
   onChainChange(handleChainChange);

   return () => {
     if (bscAccountChangeHandlerRef.current) {
       removeAccountChangeListener(bscAccountChangeHandlerRef.current);
       bscAccountChangeHandlerRef.current = null;
     }
     if (bscChainChangeHandlerRef.current) {
       removeChainChangeListener(bscChainChangeHandlerRef.current);
       bscChainChangeHandlerRef.current = null;
     }
   };
  }, [disconnectWallet, updateBalance]);

  return (
   <WalletContext.Provider value={{
     walletAddress,
     chainType,
     balance,
     loading,
     connectWallet,
     disconnectWallet,
     updateBalance,
   }}>
     {children}
   </WalletContext.Provider>
  );
};

export default WalletProvider;
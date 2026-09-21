// src/hooks/useTransactions.js
import { useState, useCallback } from "react";
import { getUserTransactions, getAllTransactions } from "../services/api";

export const useTransactions = (ownerAddress = null) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUserTransactions = useCallback(async (limit = 10) => {
    if (!ownerAddress) {
      setTransactions([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await getUserTransactions(ownerAddress, limit);
      // 处理响应数据
      if (response.data && Array.isArray(response.data)) {
        setTransactions(response.data);
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        setTransactions(response.data.data);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error("获取交易记录失败:", err);
      
      // 处理 404 错误（用户未注册）- 静默处理，不显示错误
      if (err.response?.status === 404) {
        // 用户未注册，静默返回空数组
        setTransactions([]);
        setError(null); // 不设置错误状态
      } else {
        setError(err.message || "获取交易记录失败");
        setTransactions([]);
      }
    } finally {
      setLoading(false);
    }
  }, [ownerAddress]);

  const fetchAllTransactions = useCallback(async (limit = 10) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAllTransactions(limit);
      if (response.data && Array.isArray(response.data)) {
        setTransactions(response.data);
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        setTransactions(response.data.data);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error("获取交易记录失败:", err);
      setError(err.message || "获取交易记录失败");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearTransactions = useCallback(() => {
    setTransactions([]);
    setError(null);
  }, []);

  return {
    transactions,
    loading,
    error,
    fetchUserTransactions,
    fetchAllTransactions,
    clearTransactions,
  };
};
// src/contexts/RefreshContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';

const RefreshContext = createContext(null);

export const useRefresh = () => {
  const context = useContext(RefreshContext);
  if (!context) {
    // 返回一个默认值，避免组件崩溃
    return {
      refreshKey: 0,
      triggerRefresh: () => {},
      lastRefreshType: null,
    };
  }
  return context;
};

export const RefreshProvider = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshType, setLastRefreshType] = useState(null);

  const triggerRefresh = useCallback((type = 'general') => {
    setRefreshKey(prev => prev + 1);
    setLastRefreshType(type);
    console.log(`触发刷新: ${type}, 新key: ${refreshKey + 1}`);
  }, [refreshKey]);

  return (
    <RefreshContext.Provider value={{
      refreshKey,
      triggerRefresh,
      lastRefreshType,
    }}>
      {children}
    </RefreshContext.Provider>
  );
};
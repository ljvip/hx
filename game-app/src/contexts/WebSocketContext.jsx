// src/contexts/WebSocketContext.jsx
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import wsService from '../services/websocket';
import { WS_URL } from '../utils/constants';

const WebSocketContext = createContext(null);

const noop = () => {};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    console.warn('WebSocketContext not found, using default');
    return {
      isConnected: false,
      subscribe: noop,
      on: noop,
      off: noop,
      sendMessage: noop,
    };
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(() => wsService.isConnected());
  const eventHandlersRef = useRef(new Map());

  const handleConnected = useCallback(() => {
    console.log('WebSocket connected');
    setIsConnected(true);
  }, []);

  const handleDisconnected = useCallback(() => {
    console.log('WebSocket disconnected');
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!WS_URL || WS_URL === 'ws://localhost:8081/ws') {
      console.warn('WebSocket URL 未配置，跳过连接');
      return undefined;
    }

    try {
      wsService.connect(WS_URL);
      wsService.on('connected', handleConnected);
      wsService.on('disconnected', handleDisconnected);

      return () => {
        wsService.off('connected', handleConnected);
        wsService.off('disconnected', handleDisconnected);
        wsService.disconnect();
      };
    } catch (error) {
      console.error('WebSocket init error:', error);
      return undefined;
    }
  }, [handleConnected, handleDisconnected]);

  const on = useCallback((event, callback) => {
    if (typeof callback !== 'function') {
      return;
    }

    const handlers = eventHandlersRef.current.get(event) || new Set();
    if (handlers.has(callback)) {
      return;
    }

    handlers.add(callback);
    eventHandlersRef.current.set(event, handlers);
    wsService.on(event, callback);
  }, []);

  const off = useCallback((event, callback) => {
    const handlers = eventHandlersRef.current.get(event);
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        eventHandlersRef.current.delete(event);
      }
    }
    wsService.off(event, callback);
  }, []);

  const subscribe = useCallback((address) => {
    if (address && isConnected) {
      wsService.subscribe(address);
    }
  }, [isConnected]);

  const sendMessage = useCallback((message) => {
    return wsService.send(message);
  }, []);

  const value = {
    isConnected,
    subscribe,
    on,
    off,
    sendMessage,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;
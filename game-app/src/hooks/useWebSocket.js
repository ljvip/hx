import { useState, useEffect, useCallback, useRef } from "react";
import { WS_URL } from "../utils/constants";

export const useWebSocket = (options = {}) => {
  const { autoConnect = true, reconnectInterval = 5000, onMessage } = options;
  const [status, setStatus] = useState("连接中...");
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    wsRef.current = new WebSocket(WS_URL);
    
    wsRef.current.onopen = () => {
      setStatus("🟢 已连接");
      if (options.onOpen) options.onOpen(wsRef.current);
    };
    
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        if (onMessage) onMessage(data);
      } catch (error) {
        console.error("解析消息失败:", error);
      }
    };
    
    wsRef.current.onclose = () => {
      setStatus("🔴 连接断开，正在重连...");
      reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
    };
    
    wsRef.current.onerror = (error) => {
      console.error("WebSocket错误:", error);
      setStatus("⚠️ 连接错误");
    };
  }, [reconnectInterval, onMessage, options]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback((address) => {
    sendMessage({ owner_address: address });
  }, [sendMessage]);

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  return { status, lastMessage, sendMessage, subscribe, disconnect, connect };
};
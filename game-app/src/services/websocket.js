// src/services/websocket.js
class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 3000;
    this.isConnecting = false;
    this.reconnectTimer = null;
    this.currentUrl = null;
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  connect(url) {
    if (!url) {
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.currentUrl = url;
    this.isConnecting = true;
    this.clearReconnectTimer();

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('WebSocket 连接成功');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.dispatchMessage(data);
        } catch (error) {
          console.error('解析消息失败:', error);
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        this.emit('disconnected');
        this.reconnect(url);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('WebSocket 连接失败:', error);
      this.isConnecting = false;
      this.reconnect(url);
    }
  }

  dispatchMessage(data) {
    if (!data || typeof data !== 'object') {
      this.emit('message', data);
      return;
    }

    console.log('收到WebSocket消息:', data);

    switch (data.type) {
      case 'betResult':
      case 'betResults': {
        const betData = data.data || data.result || data;
        this.emit('bet:new', betData);
        break;
      }
      case 'gameTrends': {
        this.emit('trends:update', data.data || data);
        break;
      }
      case 'balance':
      case 'balanceUpdate': {
        this.emit('balance:update', data);
        break;
      }
      case 'transaction': {
        this.emit('transaction:new', data.data);
        break;
      }
      case 'welcome': {
        this.emit('connected');
        break;
      }
      default: {
        if (data.owner_address || data.OwnerAddress) {
          this.emit('bet:new', data);
        } else if (data.trends || data.results) {
          this.emit('trends:update', data);
        } else if (data.game_name || data.GameName) {
          this.emit('trends:update', data);
        } else {
          this.emit('message', data);
        }
      }
    }
  }

  reconnect(url) {
    if (!url) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('已达到最大重连次数');
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      console.log(`尝试重连... (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      this.reconnectAttempts += 1;
      this.connect(url);
    }, this.reconnectInterval);
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  subscribe(address) {
    if (address) {
      this.send({ type: 'subscribe', owner_address: address });
    }
  }

  unsubscribe(address) {
    if (address) {
      this.send({ type: 'unsubscribe', owner_address: address });
    }
  }

  on(event, callback) {
    if (typeof callback !== 'function') {
      return;
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    callbacks.delete(callback);
    if (callbacks.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;

    this.listeners.get(event).forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`事件 ${event} 回调执行错误:`, error);
      }
    });
  }

  disconnect() {
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    this.listeners.clear();
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.currentUrl = null;
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();
export default wsService;
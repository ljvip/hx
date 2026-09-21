// src/api/request.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config';
import { ApiTimeout, ApiCategory, API_CATEGORY_MAP } from './types';

// 扩展 AxiosRequestConfig，添加自定义配置
declare module 'axios' {
  export interface AxiosRequestConfig {
    retryConfig?: {
      retries: number;
      retryDelay: number;
      retryCondition?: (error: AxiosError) => boolean;
    };
    skipTimeout?: boolean;  // 是否跳过自动超时设置
    apiCategory?: ApiCategory; // 手动指定API类型
    showLoading?: boolean;   // 是否显示loading
    _retryCount?: number;
  }
}

// 修复1: 删除未使用的接口，或者导出它供其他地方使用
// 如果其他地方需要使用，可以 export 它
// export interface TimeoutConfig {
//   timeout: number;
//   category: ApiCategory;
// }

class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: ApiTimeout.DEFAULT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // 设置token
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // 自动设置超时（除非明确跳过）
        if (!config.skipTimeout) {
          this.applyTimeout(config);
        }

        // 添加请求开始时间（用于性能监控）
        config.metadata = { startTime: Date.now() };

        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response) => {
        // 记录请求耗时
        const config = response.config;
        if (config.metadata?.startTime) {
          const duration = Date.now() - config.metadata.startTime;
          if (duration > 5000) {
            console.warn(`[慢请求] ${config.url} 耗时 ${duration}ms`);
          }
        }
        return response;
      },
      async (error: AxiosError) => {
        // 超时重试逻辑
        if (this.isTimeoutError(error)) {
          return this.handleTimeoutRetry(error);
        }

        // 处理认证错误
        if (error.response?.status === 401) {
          this.handleUnauthorized();
        }

        return Promise.reject(error);
      }
    );
  }

  // 判断是否为超时错误
  private isTimeoutError(error: AxiosError): boolean {
    return (
      error.code === 'ECONNABORTED' &&
      (error.message.includes('timeout') || error.message.includes('Timeout'))
    );
  }

  // 应用超时配置
  private applyTimeout(config: InternalAxiosRequestConfig) {
    // 1. 如果配置中已指定超时，使用指定的
    if (config.timeout && config.timeout !== ApiTimeout.DEFAULT) {
      return;
    }

    // 2. 如果手动指定了API类别
    if (config.apiCategory) {
      const categoryKey = config.apiCategory.toUpperCase() as keyof typeof ApiTimeout;
      config.timeout = ApiTimeout[categoryKey] || ApiTimeout.DEFAULT;
      return;
    }

    // 3. 根据URL自动匹配
    const url = config.url || '';
    let matchedCategory = ApiCategory.DEFAULT;

    for (const [pattern, category] of Object.entries(API_CATEGORY_MAP)) {
      if (url.includes(pattern)) {
        matchedCategory = category;
        break;
      }
    }

    // 4. 特殊处理：如果URL包含query参数且是查询类，适当增加超时
    if (matchedCategory === ApiCategory.QUERY && config.params) {
      // 如果是大数据量查询，增加超时
      const params = config.params as Record<string, unknown>;
      if (params.time_period === 'last_month' || params.time_period === 'last_3_months') {
        config.timeout = ApiTimeout.REPORT;
        return;
      }
    }

    // 5. 应用匹配的超时
    const categoryKey = matchedCategory.toUpperCase() as keyof typeof ApiTimeout;
    config.timeout = ApiTimeout[categoryKey] || ApiTimeout.DEFAULT;
  }

  // 处理超时重试
  private async handleTimeoutRetry(error: AxiosError): Promise<unknown> {
    const config = error.config;
    if (!config) {
      return Promise.reject(error);
    }
    const retryConfig = config.retryConfig || {
      retries: 2,
      retryDelay: 1000,
      retryCondition: (err: AxiosError) => this.isTimeoutError(err),
    };
    const retryCondition = retryConfig.retryCondition ?? ((err: AxiosError) => this.isTimeoutError(err));

    if (!config._retryCount) {
      config._retryCount = 0;
    }

    if (
      config._retryCount < retryConfig.retries &&
      retryCondition(error)
    ) {
      config._retryCount += 1;
      
      // 重试时递增超时时间
      config.timeout = (config.timeout || ApiTimeout.DEFAULT) * 1.5;
      
      console.warn(
        `[重试] ${config.url} 第 ${config._retryCount}/${retryConfig.retries} 次重试，超时: ${config.timeout}ms`
      );

      // 延迟后重试
      await new Promise(resolve => setTimeout(resolve, retryConfig.retryDelay));
      return this.instance(config);
    }

    // 所有重试失败
    console.error(`[失败] ${config.url} 所有重试均失败`);
    return Promise.reject(error);
  }

  // 处理未授权
  private handleUnauthorized() {
    localStorage.removeItem('token');
    // 可以在这里触发全局事件通知
    window.dispatchEvent(new CustomEvent('unauthorized'));
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  // 公共方法
  public get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.instance.get(url, config).then(res => res.data);
  }

  public post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.instance.post(url, data, config).then(res => res.data);
  }

  public put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.instance.put(url, data, config).then(res => res.data);
  }

  public delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.instance.delete(url, config).then(res => res.data);
  }

  // 批量请求
  public all<T = unknown>(requests: Promise<T>[]): Promise<T[]> {
    return Promise.all(requests);
  }

  // 取消请求
  public cancelRequest(_message?: string) {
    // 修复2: 使用下划线前缀表示参数有意未使用
    // 或者实现取消逻辑
    const source = axios.CancelToken.source();
    
    // 如果有消息，可以传递取消原因
    if (_message) {
      source.cancel(_message);
    }
    
    // 返回 cancel token 以便外部使用
    return source;
  }
}

export const apiClient = new ApiClient();
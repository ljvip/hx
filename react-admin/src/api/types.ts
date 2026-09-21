// src/api/types.ts
export enum ApiTimeout {
  DEFAULT = 30000,      // 默认 30秒
  QUERY = 60000,        // 查询类 60秒
  EXPORT = 120000,      // 导出类 2分钟
  UPLOAD = 300000,      // 上传类 5分钟
  REPORT = 180000,      // 报表类 3分钟
  BATCH = 90000,        // 批量操作 90秒
}

export enum ApiCategory {
  DEFAULT = 'default',
  QUERY = 'query',          // 查询
  EXPORT = 'export',        // 导出
  UPLOAD = 'upload',        // 上传
  REPORT = 'report',        // 报表
  BATCH = 'batch',          // 批量
}

// 路径匹配规则
export const API_CATEGORY_MAP: Record<string, ApiCategory> = {
  '/api/bet-results': ApiCategory.QUERY,
  '/api/bet-statistics': ApiCategory.QUERY,
  '/api/game-records': ApiCategory.QUERY,
  '/api/export': ApiCategory.EXPORT,
  '/api/download': ApiCategory.EXPORT,
  '/api/upload': ApiCategory.UPLOAD,
  '/api/report': ApiCategory.REPORT,
  '/api/batch': ApiCategory.BATCH,
  '/api/bulk': ApiCategory.BATCH,
};

// 扩展 AxiosRequestConfig 类型
// import { AxiosRequestConfig, AxiosError } from 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    retryConfig?: {
      retries: number;
      retryDelay: number;
      retryCondition?: (error: AxiosError) => boolean;
    };
    skipTimeout?: boolean;
    apiCategory?: ApiCategory;
    showLoading?: boolean;
    metadata?: {
      startTime: number;
    };
  }
}

// 超时配置接口
export interface TimeoutConfig {
  timeout: number;
  category: ApiCategory;
}

// API响应通用接口
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp?: number;
}

// 分页参数
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// 分页响应
export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
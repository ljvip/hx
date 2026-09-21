// src/api/shareholder.ts
import { apiClient } from './request';
// import { API_ENDPOINTS } from '../config';

// 股东信息
export interface Shareholder {
  id: number;
  user_id: number;
  code: string;
  name: string;
  level: number;
  parent_id: number | null;
  balance: number;
  total_income: number;
  total_cost: number;
  status: number;
  default_share_ratio?: number;  // 🆕 默认占成比例（来自后端）
  effective_share_ratio?: number; // 🆕 有效占成比例
  required_balance?: number;
  user_count?: number;
  user_name?: string;  // 🆕 用户名称
  owner_address?: string; // 🆕 用户地址
  is_active?: boolean; // 🆕 是否激活
  min_bet_trx?: number | string | null;
  min_bet_usdt?: number | string | null;
  min_bet_usdt_bsc?: number | string | null;
  max_bet?: number | string | null;
  effective_bet_limits?: {
    min_bet_trx: number | string;
    min_bet_usdt: number | string;
    min_bet_usdt_bsc: number | string;
    max_bet: number | string;
  };
  created_at: string;
  updated_at: string;
}

// 用户-股东关联
export interface UserShareholder {
  id: number;
  user_id: number;
  shareholder_id: number;
  share_ratio: number;
  effective_date: string;
  expire_date: string | null;
  status: number;
  created_at: string;
  updated_at: string;
}

// 股东交易记录
export interface ShareholderTransaction {
  id: number;
  trade_no: string;
  user_id: number;
  shareholder_id: number;
  game_name: string;
  bet_amount: number;
  odds: number;
  share_ratio: number;
  commission_rate: number;
  result: number; // 0-输 1-赢
  profit_loss: number;
  commission: number;
  change_amount: number;
  balance_after: number;
  remark: string;
  created_at: string;
}

// 股东统计信息
export interface ShareholderStats {
  id: number;
  code: string;
  name: string;
  balance: number;
  total_income: number;
  total_cost: number;
  user_count: number;
  level: number;
  status: number;
}

// 股东交易查询参数
export interface ShareholderTransactionFilters {
  shareholder_id?: number;
  user_id?: number;
  trade_no?: string;
  game_name?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

// 分配用户给股东请求
export interface AssignUserRequest {
  user_id: number;
  shareholder: string;
  share_ratio: number;
}

// 创建股东请求
export interface CreateShareholderRequest {
  user_id: number;
  code: string;
  name: string;
  level: number;
  parent_code?: string;
  password: string;
  min_bet_trx?: number | null;
  min_bet_usdt?: number | null;
  min_bet_usdt_bsc?: number | null;
  max_bet?: number | null;
}

export const shareholderApi = {
  // 获取股东余额
  getBalance: (userId: number) =>
    apiClient.get<{ user_id: number; balance: number }>(`/shareholder/${userId}/balance`),

  // 获取股东交易记录
  getTransactions: (userId: number, params?: ShareholderTransactionFilters) =>
    apiClient.get<{ user_id: number; transactions: ShareholderTransaction[]; total: number }>(
      `/shareholder/${userId}/transactions`,
      { params }
    ),

  // 获取股东统计信息
  getStats: (userId: number) =>
    apiClient.get<ShareholderStats>(`/shareholder/${userId}/stats`),

  // 分配用户给股东
  assignUser: (data: AssignUserRequest) =>
    apiClient.post<{ message: string }>('/shareholder/assign', data),

  // 创建股东
  createShareholder: (data: CreateShareholderRequest) =>
    apiClient.post<{ message: string; shareholder: Shareholder }>('/shareholder/create', data),

  // 获取所有股东列表
  getAllShareholders: () =>
    apiClient.get<Shareholder[]>('/shareholder/list'),

  // 获取股东关联的用户列表
  getShareholderUsers: (shareholderId: number) =>
    apiClient.get<{ users: UserShareholder[] }>(`/shareholder/${shareholderId}/users`),

  // 更新股东积分余额
  updateBalance: (id: number, balance: number) =>
    apiClient.put<{ message: string }>(`/shareholder/${id}/balance`, { balance }),

  // 🆕 更新股东的默认占成比例（对应后端 PUT /shareholder/:id/share-ratio）
  updateShareholderShareRatio: (id: number, shareRatio: number) =>
    apiClient.put<{ message: string }>(`/shareholder/${id}/share-ratio`, { share_ratio: shareRatio }),

  updateBetLimits: (
    id: number,
    data: {
      min_bet_trx: number | null;
      min_bet_usdt: number | null;
      min_bet_usdt_bsc: number | null;
      max_bet: number | null;
    }
  ) => apiClient.put<{ message: string }>(`/shareholder/${id}/bet-limits`, data),

  // 更新用户占成比例（注意：后端可能没有此接口，保留但谨慎使用）
  updateShareRatio: (data: { user_id: number; shareholder: string; share_ratio: number }) =>
    apiClient.put<{ message: string }>('/shareholder/share-ratio', data),
  
  // 更新股东状态
  updateShareholderStatus: (id: number, status: number) =>
    apiClient.put<{ message: string }>(`/shareholder/${id}/status`, { status }),

  // 管理员设置或重置股东登录密码
  setPassword: (id: number, password: string) =>
    apiClient.put<{ message: string }>(`/shareholder/${id}/password`, { password }),
};
// src/api/user.ts
import { apiClient } from './request';
import { API_ENDPOINTS } from '../config';

export interface User {
  id: number;
  name: string;
  telegram_id: string | number;
  owner_address: string;
  referral_code: string;
  referrer: string;
  ReferrerChain: string;
  total_bet_trx: number | string;
  total_bet_usdt: number | string;
  total_win_trx: number | string;
  total_win_usdt: number | string;
  use_trx: number | string;
  use_usdt: number | string;
  commission_rate: number | string;
  total_commission_trx: number | string;
  total_commission_usdt: number | string;
  join_time: string;
  is_shareholder: boolean;
  shareholder_code: string | null;
  is_system?: boolean;
  system_user?: boolean;
}

export const userApi = {
  getAllUsers: () =>
    apiClient.get<User[]>(API_ENDPOINTS.USER_ALL),

  getUser: (address: string) =>
    apiClient.get<{ message: string; user: User }>(`${API_ENDPOINTS.USER}/${address}`),

  updateExchange: (address: string, data: { use_trx?: number; use_usdt?: number }) =>
    apiClient.put(`${API_ENDPOINTS.UPDATE_USER_EXCHANGE}/${address}`, data),

  updateUser: (id: number, data: Partial<User>) =>
    apiClient.put<{ message: string; user: User }>(`/api/users/${id}`, data),

  deleteUser: (id: number) =>
    apiClient.delete<{ message: string }>(`/api/users/${id}`),
};
// src/api/commission.ts
import { apiClient } from './request';
import { API_ENDPOINTS } from '../config';

export interface CommissionRecord {
  id: number;
  receiver_code: string | null;
  receiver_addr: string | null;
  sender_code: string;
  sender_addr: string;
  bet_amount: number;
  commission: number;
  commission_rate: number;
  game_type: string;
  token_symbol: string;
  remark: string;
  withdraw_amount: number;
  created_at: string;
}

export interface CommissionFilters {
  sender_code?: string;
  receiver_code?: string;
  game_type?: string;
  token_symbol?: string;
  time_period?: string;
}

export interface GameCommissionRate {
  id: number;
  game_type: string;
  commission_rate: number;
  created_at: string;
  updated_at: string;
}

export const commissionApi = {
  getRecords: (filters: CommissionFilters) =>
    apiClient.get<{ results: CommissionRecord[] }>(API_ENDPOINTS.COMMISSION_RECORDS, { params: filters }),
  
  updateRemark: (data: { id: number; remark: string }) =>
    apiClient.put(API_ENDPOINTS.GAME_COMMISSION_RATE, data),
  
  getGameRates: () =>
    apiClient.get<GameCommissionRate[]>(API_ENDPOINTS.GAME_COMMISSION),
  
  updateGameRate: (data: { game_type: string; commission_rate: number }) =>
    apiClient.put(API_ENDPOINTS.GAME_RATE, data),
};
// src/api/referral.ts
import { apiClient } from './request';
import { API_ENDPOINTS } from '../config';

export interface ReferralBetResult {
  id: number;
  block_number: number;
  block_hash: string;
  owner_address: string;
  to_address: string;
  game_name: string;
  transaction_amount: number;
  token_symbol: string;
  tx_id: string;
  game_result: string;
  user_result: string;
  final_amount: number;
  created_at: string;
}

export interface ReferralBetResponse {
  umbrella_addresses: string[];
  direct_referrals: string[];
  results: ReferralBetResult[];
  total_final_amount: number;
  total_transaction_amount: number;
}

export interface ReferralCommissionResponse {
  umbrella_addresses: string[];
  commission_records: ReferralCommissionRecord[];
  total_commission_bet_amount: number;
  total_commission: number;
}

export interface ReferralCommissionRecord {
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

export interface ReferralQueryParams {
  owner_address?: string;
  telegram_id?: string;
  game_name?: string;
  token_symbol?: string;
  time_period?: string;
}

export const referralApi = {
  getBetResults: (params: ReferralQueryParams) =>
    apiClient.get<ReferralBetResponse>(API_ENDPOINTS.REFERRAL_BET_RESULTS, { params }),
  
  getCommissionResults: (params: ReferralQueryParams) =>
    apiClient.get<ReferralCommissionResponse>(API_ENDPOINTS.REFERRAL_COMMISSION_RESULTS, { params }),
};
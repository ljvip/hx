// src/api/bet.ts
import { apiClient } from './request';
import { API_ENDPOINTS } from '../config';

export interface BetResult {
  id: number;
  owner_address: string;
  to_address: string;
  game_name: string;
  token_symbol: string;
  transaction_amount: number;
  final_amount: number;
  game_result: string;
  user_result: string;
  created_at: string;
}

export interface BetResultsResponse {
  results: BetResult[];
  total_transaction_amount: number;
  total_final_amount: number;
}

export interface BetFilters {
  owner_address?: string;
  to_address?: string;
  game_name?: string;
  token_symbol?: string;
  time_period?: string;
}

export const betApi = {
  getResults: (filters: BetFilters) =>
    apiClient.get<BetResultsResponse>(API_ENDPOINTS.BET_RESULTS, { params: filters }),
};
// src/api/address.ts
import { apiClient } from './request';
import { API_ENDPOINTS } from '../config';

export interface AddressConfig {
  id: number;
  address: string;
  name: string;
  odds: number;
  remark: string;
  created_at: string;
}

export const addressApi = {
  getAddresses: () =>
    apiClient.get<AddressConfig[]>(API_ENDPOINTS.ADDRESSES),
  
  updateAddress: (data: AddressConfig) =>
    apiClient.put(API_ENDPOINTS.ADDRESS, data),
};
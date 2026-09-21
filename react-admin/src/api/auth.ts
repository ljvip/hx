// src/api/auth.ts
import { apiClient } from './request';
import { API_ENDPOINTS } from '../config';

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  message?: string;
}

export interface Admin {
  id: number;
  username: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export const authApi = {
  login: (params: LoginParams) => 
    apiClient.post<LoginResponse>(API_ENDPOINTS.LOGIN, params),
  
  getAdmins: () => 
    apiClient.get<Admin[]>(API_ENDPOINTS.ADMINS),
  
  createAdmin: (data: { username: string; password: string; role: string }) =>
    apiClient.post(API_ENDPOINTS.CREATE_ADMIN, data),
  
  changePassword: (data: { username: string; old_password: string; new_password: string }) =>
    apiClient.put(API_ENDPOINTS.CHANGE_PASSWORD, data),
};
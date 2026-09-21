// src/api/settings.ts
import { apiClient } from './request';

export type SettingValue = number | string;

// 系统配置接口。配置项由服务端维护，前端不预设字段。
export type AppSettings = Record<string, SettingValue>;

// 获取配置响应
export interface GetSettingsResponse {
  settings: AppSettings;
  remarks: {
    [key: string]: string;
  };
}

// 更新配置请求
export type UpdateSettingsRequest = Partial<AppSettings>;

export const settingsApi = {
  // 获取系统配置
  getSettings: () =>
    apiClient.get<GetSettingsResponse>('/settings'),

  // 更新系统配置
  updateSettings: (data: UpdateSettingsRequest) =>
    apiClient.put<{ message: string; settings: AppSettings }>('/settings', data),
};
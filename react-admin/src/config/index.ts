// src/config/index.ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://hx.a1cc.site/backend';

export const API_ENDPOINTS = {
  // 认证相关
  LOGIN: '/api/admins/login',
  ADMINS: '/admins',
  CREATE_ADMIN: '/api/admins/create-admin',
  CHANGE_PASSWORD: '/api/admins/change-password',
  
  // 投注记录
  BET_RESULTS: '/api/bet-results',
  
  // 佣金记录
  COMMISSION_RECORDS: '/api/commission-records',
  GAME_COMMISSION_RATE: '/api/game-commission-rate',
  GAME_RATE: '/game-rate',
  GAME_COMMISSION: '/game-commission',
  
  // 代理相关
  ADDRESSES: '/addresses',
  ADDRESS: '/address',
  REFERRAL_BET_RESULTS: '/api/referral-bet-results',
  REFERRAL_COMMISSION_RESULTS: '/api/referral-commission-results',
  
  // 用户相关
  USER_ALL: '/user/allusers',
  USER: '/user',
  UPDATE_USER_EXCHANGE: '/update-user-exchange',
};
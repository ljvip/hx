// src/utils/auth.ts
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  exp: number;
  username: string;
  role: string;
}

export const getUserRole = (): string | null => {
  const token = localStorage.getItem('token');
  console.log('Token:', token); // 打印 token 以便调试
  if (!token) return null;

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    console.log('Decoded JWT:', decoded); // 打印解码后的 token 数据
    return decoded.role || null;
  } catch (error) {
    console.error('Error decoding token:', error); // 打印解码错误
    return null;
  }
};

export const isLoggedIn = (): boolean => {
  const token = localStorage.getItem('token');
  console.log('Token:', token); // 打印 token 以便调试
  if (!token) return false;

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    console.log('Decoded JWT:', decoded); // 打印解码后的 token 数据
    const now = Date.now() / 1000;
    console.log('Current time:', now); // 打印当前时间
    console.log('Token expiration time:', decoded.exp); // 打印 token 过期时间
    return decoded.exp > now;
  } catch (error) {
    console.error('Error decoding token:', error); // 打印解码错误
    return false;
  }
};

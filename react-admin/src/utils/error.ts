import { isAxiosError } from 'axios';

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!isAxiosError(error)) return fallback;

  const data: unknown = error.response?.data;
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const message = data.message;
    return typeof message === 'string' ? message : fallback;
  }
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const message = data.error;
    return typeof message === 'string' ? message : fallback;
  }
  return fallback;
};

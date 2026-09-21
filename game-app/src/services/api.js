// src/services/api.js
import axios from "axios";
import { API_BASE_URL, BACKEND_API_BASE_URL } from "../utils/constants";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

const backendApi = axios.create({
  baseURL: BACKEND_API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

const shareholderApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

const requestCache = new Map();

const normalizeArrayData = (payload, fallback = []) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.list)) return payload.list;
  return fallback;
};

export const normalizeApiResponse = (payload, fallback = []) => ({
  success: true,
  data: normalizeArrayData(payload, fallback),
  message: "success",
});

export const withCache = async (key, requestFn, ttlMs = 30000) => {
  const cached = requestCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise;
  }

  const promise = requestFn();
  requestCache.set(key, {
    promise,
    expiresAt: Date.now() + ttlMs,
  });

  try {
    return await promise;
  } finally {
    const active = requestCache.get(key);
    if (active && active.promise === promise) {
      requestCache.delete(key);
    }
  }
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

backendApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

shareholderApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("shareholderToken");
    const session = localStorage.getItem("shareholderSession");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (session) {
      try {
        const { code } = JSON.parse(session);
        if (code) config.headers["X-Shareholder-Code"] = code;
      } catch {
        // Let the backend handle authentication when a stale session is present.
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status !== 404) {
      console.error("API Error:", error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

backendApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status !== 404) {
      console.error("Backend API Error:", error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

shareholderApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status !== 404) {
      console.error("Shareholder API Error:", error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

export const getUserInfo = async (address) => {
  try {
    const response = await api.get(`/user/${address}`);
    return response;
  } catch (error) {
    if (error.response?.status === 404) {
      return { data: { user: null, message: "User not found" } };
    }
    throw error;
  }
};

export const getBetLimits = async (ownerAddress = "") => {
  try {
    const response = await api.get("/settings/bet-limits", {
      params: ownerAddress ? { owner_address: ownerAddress } : {},
    });
    return {
      success: true,
      data: response?.data || {},
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      message: error.response?.data?.error || error.message || "failed",
    };
  }
};

export const getAppSettings = async () => {
  try {
    const response = await api.get("/settings");
    return {
      success: true,
      data: response?.data?.settings || {},
    };
  } catch (error) {
    return {
      success: false,
      data: {},
      message: error.response?.data?.error || error.message || "failed",
    };
  }
};

export const registerUser = (data) => api.post("/register", data);

export const getUserTransactions = async (address, limit = 10) => {
  try {
    const response = await api.get(`/api/transactions/${address}/${limit}`);
    return response;
  } catch (error) {
    if (error.response?.status === 404) {
      return { data: [] };
    }
    throw error;
  }
};

export const getAllTransactions = (limit = 10) =>
  api.get(`/user/alltransactions?limit=${limit}`);

export const getBackendAllTransactions = async (limit = 50) => {
  const key = `backend:allTransactions:${limit}`;
  return withCache(key, async () => {
    try {
      const response = await backendApi.get(`/user/alltransactions?limit=${limit}`);
      return normalizeApiResponse(response?.data || []);
    } catch (error) {
      console.error("获取后台交易数据失败:", error);
      return {
        success: false,
        data: [],
        message: error.message || "failed",
      };
    }
  }, 15000);
};

export const getBackendGameAddresses = async () => {
  const key = "backend:gameAddresses";
  return withCache(key, async () => {
    try {
      const response = await backendApi.get("/addresses");
      const addresses = normalizeArrayData(response?.data || []);
      return {
        success: true,
        data: addresses
          .map((item) => (item?.address || "").toLowerCase())
          .filter(Boolean),
        message: "success",
      };
    } catch (error) {
      console.error("获取后台游戏地址失败:", error);
      return {
        success: false,
        data: [],
        message: error.message || "failed",
      };
    }
  }, 15000);
};

export const getGameTrends = async (game, limit = 54) => {
  const key = `gameTrends:${game}:${limit}`;
  return withCache(key, async () => {
    try {
      const response = await api.get(`/game-trends?game=${game}&limit=${limit}`);
      return {
        success: true,
        data: normalizeArrayData(response?.data || [], []),
        message: "success",
      };
    } catch (error) {
      console.error("获取走势失败:", error);
      return {
        success: false,
        data: [],
        message: error.message || "failed",
      };
    }
  }, 15000);
};

export const getTeamInfo = (referralCode) =>
  api.get(`/team/${referralCode}`);
export const getReferrals = (address) =>
  api.get(`/user/${address}/referrals`);
export const getCommissionHistory = (referralCode, limit = 10, tokenSymbol = "USDT") =>
  api.get(`/commission/${referralCode}/records?limit=${limit}&token_symbol=${tokenSymbol}`);
export const withdrawCommission = (data) =>
  api.post("/api/commission/withdraw", data);
export const updateCommissionRate = (data) =>
  api.post("/user/set-commission", data);

const shareholderRequest = (method, path, payload) => {
  if (method === "get") {
    return shareholderApi.get(path, { params: payload });
  }
  return shareholderApi[method](path, payload);
};

export const shareholderLogin = (data) =>
  shareholderApi.post("/shareholder/login", data);
export const getShareholderDashboard = () =>
  shareholderApi.get("/shareholder/profile");
export const getShareholderProfile = getShareholderDashboard;
export const getShareholderBalance = () =>
  shareholderApi.get("/shareholder/balance");
export const getShareholderTransactions = (params = {}) =>
  shareholderRequest("get", "/shareholder/bets", params);
export const getShareholderPoints = (params = {}) =>
  shareholderRequest("get", "/shareholder/transactions", params);
export const getShareholderDownline = (params = {}) =>
  shareholderRequest("get", "/shareholder/users", params);
export const getShareholderDownlineUsers = getShareholderDownline;
export const getShareholderDownlineTransactions = (params = {}) =>
  shareholderRequest("get", "/shareholder/downline/transactions", params);
export const getShareholderCommissions = (params = {}) =>
  shareholderRequest("get", "/shareholder/commissions", params);
export const getShareholderDownlineCommissions = getShareholderCommissions;
export const changeShareholderPassword = (data) =>
  shareholderApi.put("/shareholder/password", data);
export const changeShareholderRatio = (data) =>
  shareholderApi.put("/shareholder/share-ratio", data);
export const updateShareholderShareRatio = changeShareholderRatio;
export const withdrawShareholder = (data) =>
  shareholderApi.post("/shareholder/withdraw", data);
export const getShareholderRechargeInfo = () =>
  shareholderApi.get("/shareholder/recharge");
export const updateShareholderBetLimits = (data) =>
  shareholderApi.put("/shareholder/bet-limits", data);
export const transferToShareholderWallet = (data) =>
  shareholderApi.post("/shareholder/transfer", data);


// ============ 推荐投注查询（referral-bet-results） ============

const referralApi = axios.create({
  baseURL: BACKEND_API_BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

referralApi.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("shareholderToken") || localStorage.getItem("token");
    const session = localStorage.getItem("shareholderSession");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (session) {
      try {
        const { code } = JSON.parse(session);
        if (code) config.headers["X-Shareholder-Code"] = code;
      } catch {
        /* ignore */
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

referralApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status !== 404) {
      console.error("Referral API Error:", error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * 查询推荐投注结果
 * @param {Object} params
 * @param {string} [params.owner_address]
 * @param {string} [params.telegram_id]
 * @param {string} [params.game_name]
 * @param {string} [params.token_symbol]
 * @param {string} [params.time_period]
 */
const cleanQueryParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    )
  );

export const getReferralBetResults = async (params = {}) => {
  try {
    const response = await referralApi.get("/api/referral-bet-results", {
      params: cleanQueryParams(params),
    });
    const payload = response?.data || {};
    return {
      success: true,
      data: {
        results: Array.isArray(payload.results) ? payload.results : [],
        umbrella_addresses: Array.isArray(payload.umbrella_addresses)
          ? payload.umbrella_addresses
          : [],
        direct_referrals: Array.isArray(payload.direct_referrals)
          ? payload.direct_referrals
          : [],
        total_final_amount: Number(payload.total_final_amount ?? 0),
        total_transaction_amount: Number(payload.total_transaction_amount ?? 0),
      },
      message: "success",
    };
  } catch (error) {
    console.error("获取推荐投注结果失败:", error);
    return {
      success: false,
      data: {
        results: [],
        umbrella_addresses: [],
        direct_referrals: [],
        total_final_amount: 0,
        total_transaction_amount: 0,
      },
      message:
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "failed",
    };
  }
};

export const getReferralCommissionResults = async (params = {}) => {
  try {
    const response = await referralApi.get("/api/referral-commission-results", {
      params: cleanQueryParams(params),
    });
    const payload = response?.data || {};
    return {
      success: true,
      data: {
        umbrella_addresses: Array.isArray(payload.umbrella_addresses)
          ? payload.umbrella_addresses
          : [],
        commission_records: Array.isArray(payload.commission_records)
          ? payload.commission_records
          : Array.isArray(payload.results)
            ? payload.results
            : [],
        referral_codes: Array.isArray(payload.referral_codes)
          ? payload.referral_codes
          : [],
        total_commission: Number(payload.total_commission ?? 0),
        total_commission_bet_amount: Number(
          payload.total_commission_bet_amount ?? payload.total_bet_amount ?? 0
        ),
      },
      message: "success",
    };
  } catch (error) {
    console.error("获取推荐佣金结果失败:", error);
    return {
      success: false,
      data: {
        umbrella_addresses: [],
        commission_records: [],
        referral_codes: [],
        total_commission: 0,
        total_commission_bet_amount: 0,
      },
      message:
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "failed",
    };
  }
};

export default api;
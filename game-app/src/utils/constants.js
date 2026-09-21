// src/utils/constants.js

// src/utils/constants.js

// 游戏配置 - 同时包含 TRON 和 BSC 地址
export const GAMES = [
  // { 
  //   value: "lucky_banker", 
  //   label: "庄闲和", 
  //   tron_address: "TJbxrS7ZBqLBAZThgVUYjHxcsXQFEFFFQK",
  //   bsc_address: "0x54a7DCE1006FB732F99162cEf00AfF9Af5C45f24",  // 请替换为 BSC 链上的实际合约地址
  //   description: "赔付：庄/闲 1:1.98（平点点数为奇数→闲赢，偶数→庄输），和 1:7.5。开奖：取区块哈希最后5位，前2位为庄，后2位为闲。下注：根据投注金额个位数决定，8或9→押和，偶数(0,2,4,6)→押庄，奇数(1,3,5,7)→押闲。"
  // },
  // { 
  //   value: "hash_lucky", 
  //   label: "幸运哈希", 
  //   tron_address: "TBJNUqncUrNdhKAcX7xN6DrobEKgNCCCQK",
  //   bsc_address: "0x336329359b45298B1931eBaD9937A1559677b97C",
  //   description: "赔付：1:2。开奖：取区块哈希最后两位字符，若包含字母+数字组合则玩家赢。下注：无特殊限制。"
  // },
  // { 
  //   value: "hash_baccarat", 
  //   label: "百家乐", 
  //   tron_address: "TMQCHfHj2REm6q5B5sB8qo54JHtfXEEEQK",
  //   bsc_address: "0x7d33d63f6473153A9Ed222360327fcCF52b0B03a",  // 请替换为 BSC 链上的实际合约地址
  //   description: "赔付：庄/闲 1:2（双方0点和局退50%，其他和局退99%），和 1:7.5。开奖：取区块哈希最后5位，前2位为庄，后2位为闲。下注：根据投注金额个位数决定，8或9→押和，偶数(0,2,4,6)→押庄，奇数(1,3,5,7)→押闲。"
  // },
  { 
    value: "single_double", 
    label: "哈希单双", 
    tron_address: "TRqzCjnShbBYzATGD2ApUzhXKWB3bAAAQK",
    bsc_address: "0x57a689bd5bD3090864414C578aC31dD0A6A6d98B",  // 请替换为 BSC 链上的实际合约地址
    description: "赔付：1:1.95。开奖：取区块哈希最后一位数字，奇数=单，偶数=双。下注：根据投注金额个位数决定，奇数→押单，偶数→押双。"
  },
  { 
    value: "big_small", 
    label: "哈希大小", 
    tron_address: "TW3S2AD9meQ5jQkkNn8NPmujSTR5BBBBQK",
    bsc_address: "0xD62668d1579ae94b9d11c66A083adaD847988894",  // 请替换为 BSC 链上的实际合约地址
    description: "赔付：1:1.95。开奖：取区块哈希最后一位数字，0-4=小，5-9=大。下注：根据投注金额个位数决定，0-4→押小，5-9→押大。"
  },
  // { 
  //   value: "tenfold_bull", 
  //   label: "十倍牛", 
  //   // tron_address: "TEKF8g6Ap7Y7kCGegT2P2BCEuCPivDDDQK",
  //   bsc_address: "0x295F5c74A06D825056Cae34ec6F6816a625A70fd",  // 请替换为 BSC 链上的实际合约地址
  //   description: "赔付：最高10倍，赢的点数为倍数，实际赔付 = (参与金额/10) × 0.98 × 倍数（平点点数为奇数→闲赢，偶数→庄赢）。开奖：取区块哈希最后5位，前3位和值为庄，后3位和值为闲。下注：玩家始终押闲。"
  // },
  // { 
  //   value: "pingbei_niuniu", 
  //   label: "平倍牛", 
  //   // tron_address: "TYLY1YMcwS5PK5kf2TH9pDzwJZe3mGGGQK",
  //   bsc_address: "0x3982a83584475a5399B188588A14436C2e215399",  // 请替换为 BSC 链上的实际合约地址
  //   description: "赔付：1:1.95（平点点数为奇数→闲赢，偶数→庄赢）。开奖：取区块哈希最后5位，前3位为庄，后3位为闲。下注：玩家始终押闲。"
  // },
];

// 根据链类型获取游戏地址
export const getGameAddress = (game, chainType) => {
  if (chainType === CHAIN_TYPES.BSC) {
    return game.bsc_address;
  }
  return game.tron_address; // 默认 TRON
};

// 根据链类型获取游戏列表（带正确的地址）
export const getGamesByChain = (chainType) => {
  return GAMES.map(game => ({
    ...game,
    address: chainType === CHAIN_TYPES.BSC ? game.bsc_address : game.tron_address
  }));
};

export const GAME_NAME_MAPPING = {
  lucky_banker: "庄闲",
  hash_lucky: "幸运",
  hash_baccarat: "百家乐",
  single_double: "单双",
  big_small: "大小",
  tenfold_bull: "十倍牛",
  pingbei_niuniu: "平倍牛",
};


const env = import.meta.env;

export const USDT_CONTRACT = env.VITE_TRON_USDT_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const API_BASE_URL = env.VITE_API_BASE_URL || 'https://hx.a1cc.site/backend';
export const BACKEND_API_BASE_URL = env.VITE_BACKEND_API_BASE_URL || API_BASE_URL;
export const TRONGRID_API = "https://api.trongrid.io";
export const WS_URL = env.VITE_WS_URL || "";

// 表格样式
export const TABLE_STYLES = {
  th: { 
    border: "1px solid #ddd", 
    padding: "6px 4px", 
    textAlign: "center", 
    fontWeight: "bold", 
    backgroundColor: "#f8f8f8",
    fontSize: "11px"
  },
  td: { 
    border: "1px solid #ddd", 
    padding: "5px 4px", 
    textAlign: "center",
    fontSize: "10px"
  },
  evenRow: { 
    backgroundColor: "#ffffff" 
  },
  oddRow: { 
    backgroundColor: "#f9f9f9" 
  },
};

// 走势图配置
export const TREND_CONFIG = {
  ROW_COUNT: 6,
  COLUMN_COUNT: 13,
  COLORS: {
    red: "#ff0000",
    blue: "#0033ff",
    green: "#66ff66",
  },
};

// 交易状态
export const TRANSACTION_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
};

// ========== 新增 BSC 相关配置 ==========
export const CHAIN_TYPES = {
  TRON: 'tron',
  BSC: 'bsc'
};

export const BSC_CONFIG = {
  chainId: env.VITE_BSC_CHAIN_ID || '0x38',
  chainName: 'Binance Smart Chain',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18
  },
  rpcUrls: [env.VITE_BSC_RPC_URL || 'https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/']
};

// // WebSocket URL - 设置为空字符串可以禁用 WebSocket


export const USDT_BSC_CONTRACT = env.VITE_BSC_USDT_CONTRACT || "0x55d398326f99059fF775485246999027B3197955";
export const BSC_API_URL = env.VITE_BSC_API_URL || "https://api.bscscan.com/api";
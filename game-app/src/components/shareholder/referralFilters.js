export const GAME_FILTER_OPTIONS = [
  { value: "tenfold_bull", label: "十倍牛" },
  { value: "single_double", label: "单双" },
  { value: "pingbei_niuniu", label: "平倍牛" },
  { value: "big_small", label: "大小" },
  { value: "hash_baccarat", label: "百家乐" },
  { value: "hash_lucky", label: "幸运" },
  { value: "lucky_banker", label: "庄闲" },
  { value: "vip_odd_even", label: "VIP单双" },
  { value: "vip_big_small", label: "VIP大小" },
];

export const TOKEN_FILTER_OPTIONS = [
  { value: "USDT", label: "USDT" },
  { value: "TRX", label: "TRX" },
];

export const TIME_PERIOD_OPTIONS = [
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "this_week", label: "本周" },
  { value: "last_week", label: "上周" },
  { value: "this_month", label: "本月" },
  { value: "last_month", label: "上月" },
];

export const GAME_LABELS = Object.fromEntries(
  GAME_FILTER_OPTIONS.map((item) => [item.value, item.label])
);

export const formatFilterAmount = (value, digits = 2) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : Number(0).toFixed(digits);
};

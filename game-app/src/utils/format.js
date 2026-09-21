export const number = (value) =>
  Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 6 });

export const date = (value) => (value ? new Date(value).toLocaleString() : "-");

export const statusColor = (status) => {
  const s = String(status || "").toLowerCase();
  if (["success", "completed", "approved", "成功"].includes(s)) return "success";
  if (["failed", "rejected", "失败"].includes(s)) return "error";
  return "processing";
};

export const shorten = (text) =>
  text && text.length > 12 ? `${text.slice(0, 4)}...${text.slice(-7)}` : text || "-";

export const copyText = async (text) => {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    return true;
  } catch {
    return false;
  }
};
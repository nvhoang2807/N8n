/**
 * Đọc số người dùng gõ / dán từ Excel, chấp nhận cả kiểu Việt Nam và kiểu quốc tế:
 * "3.499.200.000", "3,499,200,000", "58,32", "58.32", "9,9%", "60 000 000 đ".
 */
export function parseNumber(input: string | number | null | undefined): number | undefined {
  if (input === null || input === undefined) return undefined;
  if (typeof input === "number") return Number.isFinite(input) ? input : undefined;
  let s = input.trim().replace(/[\s %đ₫]/gi, "").replace(/vn[dđ]$/i, "");
  if (!s) return undefined;
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1);
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : undefined;
}

/** Tỷ lệ (0.099) → chuỗi phần trăm để sửa ("9.9"), bỏ sai số dấu phẩy động */
export function toPercentText(fraction: number | undefined): string {
  if (fraction === undefined) return "";
  return String(Math.round(fraction * 1e8) / 1e6);
}

/** Chuỗi phần trăm ("9,9") → tỷ lệ (0.099) */
export function fromPercentText(text: string): number | undefined {
  const n = parseNumber(text);
  return n === undefined ? undefined : Math.round(n * 1e6) / 1e8;
}

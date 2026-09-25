/** Vài phép trộn màu hex đơn giản, dùng để suy ra biến CSS (đậm hơn / nhạt hơn) từ 1 màu thương hiệu do nhân viên chọn. */

function toRgb(hex: string): [number, number, number] | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix([r, g, b]: [number, number, number], target: number, amount: number): [number, number, number] {
  const t = (v: number) => Math.round(v + (target - v) * amount);
  return [t(r), t(g), t(b)];
}

/** Trộn với đen — dùng cho gradient/hover đậm hơn màu gốc */
export function darken(hex: string, amount = 0.22): string | undefined {
  const rgb = toRgb(hex);
  if (!rgb) return undefined;
  const [r, g, b] = mix(rgb, 0, amount);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Trộn với trắng — dùng cho nền nhạt (chip, hover) */
export function lighten(hex: string, amount = 0.9): string | undefined {
  const rgb = toRgb(hex);
  if (!rgb) return undefined;
  const [r, g, b] = mix(rgb, 255, amount);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Các biến CSS suy ra từ màu thương hiệu của dự án; undefined nếu dự án không đặt màu riêng (dùng mặc định của trang) */
export function projectColorVars(color: string | undefined): Record<string, string> | undefined {
  if (!color || !toRgb(color)) return undefined;
  const dark = darken(color);
  const soft = lighten(color);
  return {
    "--proj-color": color,
    ...(dark ? { "--proj-color-dark": dark } : {}),
    ...(soft ? { "--proj-color-soft": soft } : {}),
  };
}

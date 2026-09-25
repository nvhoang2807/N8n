import { computeQuote, unitListPrice } from "./calc.ts";
import type { Project } from "./types";

export type ValidationResult = { errors: string[]; warnings: string[] };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Không dùng làm mã dự án vì trùng đường dẫn hệ thống */
export const RESERVED_IDS = ["admin", "api", "new", "_next", "favicon.ico"];

const pct = (p: number) => `${Math.round(p * 1e6) / 1e4}%`;

/** Kiểm tra cấu hình dự án trước khi lưu. errors chặn lưu, warnings chỉ nhắc. */
export function validateProject(p: Project): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!p.id || !SLUG.test(p.id)) {
    errors.push("Mã dự án chỉ gồm chữ thường không dấu, số và dấu gạch ngang (VD: serena-riverside).");
  } else if (RESERVED_IDS.includes(p.id)) {
    errors.push(`Mã dự án "${p.id}" trùng đường dẫn hệ thống, hãy đặt mã khác.`);
  }
  if (!p.name?.trim()) errors.push("Chưa nhập tên dự án.");
  if (!(p.vatRate >= 0 && p.vatRate < 1)) errors.push("Thuế VAT không hợp lệ.");
  if (!(p.maintenanceRate >= 0 && p.maintenanceRate < 1)) errors.push("Phí bảo trì không hợp lệ.");

  // Loại căn & căn hộ
  if (p.units.length === 0 && !p.customUnits) errors.push("Dự án chưa có căn nào.");
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const u of p.units) {
    if (!u.code?.trim()) errors.push("Có căn chưa nhập mã căn.");
    else if (seen.has(u.code)) dupes.add(u.code);
    seen.add(u.code);
    if (!(u.grossArea > 0) || !(u.netArea > 0)) errors.push(`Căn ${u.code}: diện tích phải lớn hơn 0.`);
    if (!p.unitTypes[u.type]) errors.push(`Căn ${u.code}: loại "${u.type}" chưa khai báo trong Loại sản phẩm.`);
  }
  if (dupes.size) errors.push(`Trùng mã căn: ${[...dupes].slice(0, 10).join(", ")}${dupes.size > 10 ? "…" : ""}`);
  const needPrice = new Set(
    p.customUnits ? [] : p.units.filter((u) => u.price === undefined).map((u) => u.type),
  );
  for (const t of needPrice) {
    if (!(p.defaultUnitPrice[t] > 0)) {
      warnings.push(`Loại "${t}" chưa có đơn giá mặc định — nhân viên sẽ phải tự nhập đơn giá.`);
    }
  }

  for (const d of p.optionalDiscounts) {
    if (!d.id || !SLUG.test(d.id)) errors.push(`Chiết khấu tùy chọn "${d.label}": mã không hợp lệ.`);
    if (!d.options.includes(d.default)) errors.push(`Chiết khấu "${d.label}": mức mặc định phải nằm trong các mức cho chọn.`);
  }

  // PTTT
  if (p.methods.length === 0) errors.push("Dự án chưa có phương thức thanh toán nào.");
  const methodIds = new Set<string>();
  const sampleUnit = p.units.find((u) => u.grossArea > 0 || u.netArea > 0);
  // Giá dùng để tính thử: giá của căn mẫu; loại căn chưa có đơn giá tham khảo thì lấy đơn giá
  // tham khảo cao nhất của dự án. Không có đơn giá nào thì không kiểm tra đợt âm (tránh báo nhầm).
  const knownPrices = Object.values(p.defaultUnitPrice).filter((v) => v > 0);
  const samplePrice = sampleUnit
    ? unitListPrice(p, sampleUnit) ||
      (knownPrices.length ? unitListPrice(p, sampleUnit, Math.max(...knownPrices)) : 0)
    : 0;
  for (const m of p.methods) {
    const name = m.name || m.id || "(chưa đặt tên)";
    if (!m.id || !SLUG.test(m.id)) errors.push(`PTTT "${name}": mã không hợp lệ.`);
    else if (methodIds.has(m.id)) errors.push(`Trùng mã PTTT "${m.id}".`);
    methodIds.add(m.id);
    if (!m.name?.trim()) errors.push(`PTTT "${m.id}": chưa có tên.`);
    if (m.milestones.length === 0) {
      errors.push(`PTTT "${name}": chưa có đợt thanh toán.`);
      continue;
    }
    const total = m.milestones.reduce((s, r) => s + (r.advance ? 0 : (r.percent ?? 0)), 0);
    if (Math.abs(total - 1) > 1e-6) {
      errors.push(`PTTT "${name}": tổng tỷ lệ các đợt là ${pct(total)} (phải bằng 100%, không tính cọc/ứng trước).`);
    }
    const remainders = m.milestones.filter((r) => r.remainder);
    if (remainders.length > 1) errors.push(`PTTT "${name}": chỉ được một đợt "phần còn lại".`);
    if (remainders.length === 1 && !m.milestones[m.milestones.length - 1].remainder) {
      errors.push(`PTTT "${name}": đợt "phần còn lại" phải là đợt cuối cùng.`);
    }
    if (!m.milestones.some((r) => r.includeMaintenance)) {
      warnings.push(`PTTT "${name}": chưa có đợt nào thu phí bảo trì.`);
    }
    const hasBank = m.milestones.some((r) => r.payer === "bank");
    if (m.loan && !hasBank) warnings.push(`PTTT "${name}": có khoản vay nhưng không có đợt nào ngân hàng giải ngân.`);
    for (const d of m.discounts) {
      if (!(d.percent >= 0 && d.percent < 1)) errors.push(`PTTT "${name}": chiết khấu "${d.label}" không hợp lệ.`);
    }

    if (sampleUnit && Math.abs(total - 1) <= 1e-6) {
      const listPrice = samplePrice || 1_000_000_000;
      const q = computeQuote(p, m, { listPrice, netArea: sampleUnit.netArea });
      const negative = q.schedule.find((r) => r.amount < 0);
      if (negative && samplePrice > 0) {
        errors.push(`PTTT "${name}": ${negative.label} bị âm — kiểm tra lại cọc/ứng trước và tỷ lệ.`);
      }
      if (q.mismatch !== 0) {
        errors.push(`PTTT "${name}": tổng các đợt lệch ${q.mismatch.toLocaleString("vi-VN")} đ so với tổng HĐMB (thiếu đợt thu phí bảo trì hoặc đợt "phần còn lại"?).`);
      }
    }
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

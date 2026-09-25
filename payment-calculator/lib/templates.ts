import type { Milestone, PaymentMethod, Project } from "./types";

/** Các mẫu dùng khi tạo mới trong trang admin */

export function blankMilestone(index: number): Milestone {
  return { label: `Đợt ${index}`, due: "", percent: 0 };
}

export function blankMethod(existingIds: string[] = []): PaymentMethod {
  let n = existingIds.length + 1;
  while (existingIds.includes(`pttt-${n}`)) n++;
  return {
    id: `pttt-${n}`,
    name: `PTTT ${n}`,
    summary: "",
    discounts: [],
    milestones: [
      { label: "Cọc", due: "Thanh toán theo Phiếu Đặt Cọc", amount: 50_000_000, advance: true },
      { label: "Đợt 1", due: "Ký Hợp đồng mua bán", percent: 0.3, deductAdvances: true, monthsAfterContract: 0 },
      { label: "Đợt 2", due: "Thông báo bàn giao căn hộ + Gồm phí bảo trì 2%", percent: 0.65, includeMaintenance: true },
      { label: "Đợt 3", due: "Thông báo bàn giao Giấy chứng nhận", percent: 0.05, remainder: true },
    ],
  };
}

export function blankProject(): Project {
  return {
    id: "",
    name: "",
    developer: "",
    unitTypes: { CH: "Căn hộ" },
    defaultUnitPrice: { CH: 0 },
    vatRate: 0.1,
    maintenanceRate: 0.02,
    landValuePerM2: 0,
    optionalDiscounts: [],
    units: [],
    methods: [{ ...blankMethod(), id: "pttt-chuan", name: "PTTT Chuẩn" }],
    notes: [
      "Các chiết khấu được tính trên giá trị căn hộ ban hành chưa VAT, chưa phí bảo trì.",
      "Giá trị trên bảng tính chỉ mang tính chất tham khảo, giá trị thực tế căn cứ theo Hợp đồng mua bán.",
    ],
    order: 50,
  };
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

import type { Project } from "../lib/types";
import { palmRiver } from "./palm-river/index.ts";
import { serenaRiverside } from "./serena-riverside/index.ts";

/**
 * Dữ liệu MẶC ĐỊNH — chỉ dùng khi Vercel Blob chưa có dữ liệu (lần chạy đầu / chạy local).
 * Lần lưu đầu tiên trong trang /admin sẽ chép toàn bộ danh sách này lên Blob;
 * từ đó mọi chỉnh sửa làm trong /admin, không cần sửa file này.
 */

/** Dự án MẪU (dữ liệu minh họa) — ví dụ dự án có bảng giá cố định từng căn */
const sampleProject: Project = {
  id: "du-an-mau",
  name: "Dự án mẫu (minh họa)",
  developer: "Chủ đầu tư minh họa",
  description: "Ví dụ dự án có giá cố định từng căn — xóa khi đã có dự án thật",
  unitTypes: { CH: "Căn hộ" },
  defaultUnitPrice: {},
  vatRate: 0.1,
  maintenanceRate: 0.02,
  optionalDiscounts: [],
  units: [
    { code: "M-05.08", type: "CH", bedrooms: 1, grossArea: 55, netArea: 50.1, price: 2_850_000_000 },
    { code: "M-12.03", type: "CH", bedrooms: 2, grossArea: 74, netArea: 68.5, price: 3_620_000_000 },
    { code: "M-22.01", type: "CH", bedrooms: 3, grossArea: 104, netArea: 96.4, price: 5_380_000_000 },
  ],
  methods: [
    {
      id: "chuan",
      name: "Chuẩn theo tiến độ",
      summary: "CK 3%, thanh toán giãn theo tiến độ xây dựng",
      discounts: [{ label: "Chiết khấu chung", percent: 0.03 }],
      milestones: [
        { label: "Cọc", due: "Khi chọn căn", amount: 100_000_000, advance: true },
        { label: "Đợt 1", due: "Ký HĐMB", percent: 0.2, deductAdvances: true, monthsAfterContract: 0 },
        { label: "Đợt 2", due: "03 tháng kể từ ngày ký HĐMB", percent: 0.15, monthsAfterContract: 3 },
        { label: "Đợt 3", due: "06 tháng kể từ ngày ký HĐMB", percent: 0.15, monthsAfterContract: 6 },
        { label: "Đợt 4", due: "Nhận bàn giao + phí bảo trì 2%", percent: 0.45, includeMaintenance: true },
        { label: "Đợt 5", due: "Nhận sổ hồng", percent: 0.05, remainder: true },
      ],
    },
    {
      id: "tts-95",
      name: "Thanh toán sớm 95%",
      summary: "CK 3% + 9%, thanh toán 95% khi ký HĐMB",
      discounts: [
        { label: "Chiết khấu chung", percent: 0.03 },
        { label: "Chiết khấu thanh toán sớm", percent: 0.09 },
      ],
      milestones: [
        { label: "Cọc", due: "Khi chọn căn", amount: 100_000_000, advance: true },
        { label: "Đợt 1", due: "Ký HĐMB", percent: 0.95, deductAdvances: true, monthsAfterContract: 0 },
        { label: "Đợt 2", due: "Nhận bàn giao", percent: 0, includeMaintenance: true },
        { label: "Đợt 3", due: "Nhận sổ hồng", percent: 0.05, remainder: true },
      ],
    },
  ],
};

export const defaultProjects: Project[] = [
  { ...serenaRiverside, order: 1 },
  { ...palmRiver, order: 2 },
  { ...sampleProject, order: 99, hidden: true },
];

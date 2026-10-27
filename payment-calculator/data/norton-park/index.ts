import { units } from "./units.ts";
import type { Loan, Milestone, PaymentMethod, Project } from "../../lib/types";

/**
 * Norton Park (Gamuda Land) — chính sách thanh toán dự kiến theo
 * "NORTON KICK-OFF 08.10 - SALES SCHEMES - Shared File.pdf" (thư mục Chính sách bán hàng trong Sales Kit).
 * Khung tính giá theo Serena Riverside: giá công bố chưa VAT, CK Early Bird trên giá công bố, CK PTTT trên giá
 * còn lại; VAT 10%; phí bảo trì 2% trên giá sau CK; tỷ lệ các đợt trên giá gồm VAT, PBT thu khi bàn giao.
 * Chưa có bảng giá & danh sách căn → nhân viên nhập căn (loại, diện tích, đơn giá).
 */

const DEPOSIT = 100_000_000; // Đặt chỗ 100 triệu
const CONTRACT = "Ký HĐMB (dự kiến 12/2026)";
const HANDOVER = "Bàn giao (dự kiến 09/2029) + Gồm phí bảo trì 2%";
const PINK_BOOK = "Nhận sổ hồng";

const deposit: Milestone = { label: "Đặt chỗ", due: "Đặt chỗ", amount: DEPOSIT, advance: true };

const contract = (percent: number): Milestone => ({
  label: "Đợt 1",
  due: CONTRACT,
  note: "Đã cấn trừ tiền đặt chỗ",
  percent,
  deductAdvances: true,
  monthsAfterContract: 0,
});

const after = (n: number, months: number, percent: number, extra: Partial<Milestone> = {}): Milestone => ({
  label: `Đợt ${n}`,
  due: `${String(months).padStart(2, "0")} tháng sau ký HĐMB`,
  percent,
  monthsAfterContract: months,
  ...extra,
});

/** Bàn giao + sổ hồng, số đợt tiếp theo sau các đợt giữa */
const tail = (n: number, handoverPercent: number, months = 33): Milestone[] => [
  { label: `Đợt ${n}`, due: HANDOVER, percent: handoverPercent, includeMaintenance: true, monthsAfterContract: months },
  { label: `Đợt ${n + 1}`, due: PINK_BOOK, percent: 0.05, remainder: true },
];

function method(id: string, name: string, summary: string, discount: number, milestones: Milestone[], loan?: Loan): PaymentMethod {
  return {
    id,
    name,
    summary,
    discounts: discount > 0 ? [{ label: `Chiết khấu ${name}`, percent: discount }] : [],
    milestones,
    loan,
  };
}

/** Lựa chọn 01: 15% ký HĐMB, sau đó mỗi 3 tháng 2-2-2-2-2-5-5-5-10-10%, bàn giao 35%, sổ hồng 5% */
const scheme1 = [0.02, 0.02, 0.02, 0.02, 0.02, 0.05, 0.05, 0.05, 0.1, 0.1].map((p, i) => after(i + 2, (i + 1) * 3, p));

/** Lựa chọn 02: 10% ký HĐMB; 5% sau 6, 12, 18 tháng; 3 tháng/lần 5-10-10-10%; bàn giao 35%; sổ hồng 5% */
const scheme2 = (
  [
    [6, 0.05],
    [12, 0.05],
    [18, 0.05],
    [21, 0.05],
    [24, 0.1],
    [27, 0.1],
    [30, 0.1],
  ] as const
).map(([m, p], i) => after(i + 2, m, p));

/** Lựa chọn 03: 10% ký HĐMB; 6 tháng/lần 5-5-15-15-15%; bàn giao 30%; sổ hồng 5% */
const scheme3 = (
  [
    [6, 0.05],
    [12, 0.05],
    [18, 0.15],
    [24, 0.15],
    [30, 0.15],
  ] as const
).map(([m, p], i) => after(i + 2, m, p));

/**
 * Lựa chọn 05: hỗ trợ lãi suất tối đa 10%/năm trên 60% giá trị HĐMB trong 24 tháng.
 * Ngân hàng cho vay 75% (20+20+20+15) nên phần được hỗ trợ ≈ 60/75 = 80% khoản vay: ước tính bằng cách
 * cho khách trả lãi trên 20% còn lại (2%/năm khi lãi suất giả định 10%).
 */
const BANK_LOAN: Loan = {
  bank: "Ngân hàng liên kết",
  policy: "Hỗ trợ lãi suất tối đa 10%/năm trên 60% giá trị HĐMB trong vòng 24 tháng.",
  supportMonths: 24,
  customerRate: 0.02,
  termYears: 20,
  rateAfter: 0.1,
  gracePrincipalMonths: 24,
};

/** Loại sản phẩm theo bảng tính giá trên nortonpark.com.vn */
export const NORTON_UNIT_TYPES: Record<string, string> = {
  Studio: "Studio",
  "1PN+": "Căn hộ 1PN+",
  "2PN": "Căn hộ 2PN",
  "2PN+": "Căn hộ 2PN+",
  "3PN": "Căn hộ 3PN",
  PES: "Căn hộ sân vườn",
  Duplex: "Duplex",
  SHOP: "Podium Shop",
};

/** Đơn giá công bố 66 triệu/m² tim tường. Duplex & Podium Shop CĐT chưa công khai giá — tạm 70 triệu/m² */
export const NORTON_UNIT_PRICE: Record<string, number> = {
  Studio: 66_000_000,
  "1PN+": 66_000_000,
  "2PN": 66_000_000,
  "2PN+": 66_000_000,
  "3PN": 66_000_000,
  PES: 66_000_000,
  Duplex: 70_000_000,
  SHOP: 70_000_000,
};

export const nortonPark: Project = {
  id: "norton-park",
  name: "Norton Park",
  developer: "Gamuda Land",
  description: "Phân khu B · 63 layout căn hộ, Duplex & Podium Shop",
  unitTypes: NORTON_UNIT_TYPES,
  defaultUnitPrice: NORTON_UNIT_PRICE,
  timeline: { contractMonth: "2026-12", handoverMonth: "2029-09" },
  vatRate: 0.1,
  maintenanceRate: 0.02,
  customUnits: true,
  optionalDiscounts: [
    { id: "early-bird", label: "Chiết khấu đặt chỗ sớm (Early Bird)", options: [0, 0.01], default: 0, base: "list" },
  ],
  units,
  methods: [
    method("pttt-chuan", "Thanh toán chuẩn", "CK 5% · 15% ký HĐMB, 3 tháng/đợt, 35% khi bàn giao", 0.05, [
      deposit,
      contract(0.15),
      ...scheme1,
      ...tail(12, 0.35),
    ]),
    method("pttt-10-diem", "10% ký HĐMB – 10 điểm", "CK 1% · 10% ký HĐMB, giãn 6 tháng rồi 3 tháng/đợt", 0.01, [
      deposit,
      contract(0.1),
      ...scheme2,
      ...tail(9, 0.35),
    ]),
    method("pttt-nua-nam-vo-uu", "10% ký HĐMB – Nửa năm vô ưu", "CK 2% · 10% ký HĐMB, 6 tháng/đợt, 30% khi bàn giao", 0.02, [
      deposit,
      contract(0.1),
      ...scheme3,
      ...tail(7, 0.3),
    ]),
    method("pttt-nhanh", "Thanh toán nhanh", "CK 10% · 70% trong 9 tháng sau ký HĐMB", 0.1, [
      deposit,
      contract(0.15),
      after(2, 3, 0.2),
      after(3, 6, 0.2),
      after(4, 9, 0.15),
      ...tail(5, 0.25, 32),
    ]),
    method(
      "pttt-ngan-hang",
      "Ngân hàng hỗ trợ",
      "Ngân hàng giải ngân 75% · Hỗ trợ lãi suất 24 tháng",
      0,
      [
        deposit,
        contract(0.1),
        after(2, 9, 0.2, { payer: "bank" }),
        after(3, 12, 0.2, { payer: "bank" }),
        after(4, 15, 0.2, { payer: "bank" }),
        { label: "Đợt 5", due: HANDOVER, note: "Khách thanh toán 10%", percent: 0.1, includeMaintenance: true, monthsAfterContract: 32 },
        { label: "Đợt 5", due: "Bàn giao (dự kiến 09/2029)", note: "Ngân hàng giải ngân 15%", percent: 0.15, payer: "bank", monthsAfterContract: 32 },
        { label: "Đợt 6", due: PINK_BOOK, percent: 0.05, remainder: true },
      ],
      BANK_LOAN,
    ),
  ],
  notes: [
    "Chính sách thanh toán dự kiến (Sales Kit 08/10/2026); giá bán và PTTT chỉ mang tính tham khảo, có thể thay đổi theo quyết định của Chủ đầu tư.",
    "Chiết khấu đặt chỗ sớm 1% áp dụng cho khách hoàn tất booking sớm theo thời hạn Chủ đầu tư quy định. Tổng chiết khấu lên đến 14%.",
    "Các chiết khấu được tính trên giá trị căn hộ ban hành chưa VAT, chưa phí bảo trì.",
  ],
};

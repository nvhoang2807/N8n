import type { Loan, Milestone, PaymentMethod, Project } from "../../lib/types";
import { units } from "./units.ts";

/**
 * Imperia Sensa Park (MIK Group)
 * - Danh sách 922 căn: "Bang_Ma_Can_Ho_922_Can_Kem_Huong.xlsx"
 * - Chính sách & lịch thanh toán: "PHIẾU TẠM TÍNH GIÁ ISP.xlsx" (sheet CHUẨN, VAY, ĐẶC BIỆT, NHANH 70%, NHANH 95%)
 *
 * Cách tính theo file:
 *  - Giá gốc = đơn giá × DT tim tường; đơn giá 90.000.000, bàn giao Hoàn thiện +7% (96.300.000)
 *  - CK lần lượt: Early Bird 2% (trên giá gốc) → Secret Box 1% → CK PTTT (trên giá còn lại)
 *  - VAT 10% trên giá sau CK; phí bảo trì 2% trên giá gốc
 *  - Tỷ lệ các đợt tính trên giá sau CK gồm VAT (chưa PBT); PBT thu ở đợt bàn giao
 */

const DEPOSIT = 100_000_000;
const HANDOVER = "Bàn giao (Dự kiến Quý IV/2028) + Gồm phí bảo trì 2%";
const CERTIFICATE = "Nhận Giấy chứng nhận (GCN)";

/** Đặt cọc + Đợt 1 (ký TTKQ) + Đợt 2 (ký HĐMB = ngày D) */
function head(contractPercent: number): Milestone[] {
  return [
    { label: "Đặt cọc", due: "Đặt cọc", amount: DEPOSIT, advance: true },
    {
      label: "Đợt 1",
      due: "Ký TTKQ (10 ngày sau đặt cọc)",
      note: "Đã cấn trừ tiền đặt cọc",
      percent: 0.1,
      deductAdvances: true,
    },
    { label: "Đợt 2", due: "Ký HĐMB (Dự kiến Quý I/2027) (D)", percent: contractPercent, monthsAfterContract: 0 },
  ];
}

const certificate = (label: string): Milestone => ({ label, due: CERTIFICATE, percent: 0.05, remainder: true });

/** File chưa có thông báo chính sách hỗ trợ lãi suất — chỉ ước tính theo lãi suất thả nổi giả định */
const LOAN: Loan = {
  bank: "Ngân hàng tài trợ dự án",
  policy: "Chưa có thông báo chính sách hỗ trợ lãi suất — ước tính theo lãi suất thả nổi giả định.",
  supportMonths: 0,
  customerRate: 0.1,
  termYears: 20,
  rateAfter: 0.1,
  gracePrincipalMonths: 0,
};

function method(
  id: string,
  name: string,
  summary: string,
  discount: number,
  milestones: Milestone[],
  loan?: Loan,
): PaymentMethod {
  return {
    id,
    name,
    summary,
    discounts: discount > 0 ? [{ label: `Chiết khấu ${name}`, percent: discount }] : [],
    milestones,
    loan,
  };
}

export const imperiaSensaPark: Project = {
  id: "imperia-sensa-park",
  name: "Imperia Sensa Park",
  developer: "MIK Group",
  location: "Đường Võ Chí Công, P. Phước Long, TP. HCM",
  description: "2 tháp Sensa A & Sensa B · 922 căn hộ",
  unitTypes: { Studio: "Studio", "1PN+": "Căn hộ 1PN+", "2PN": "Căn hộ 2PN", "3PN": "Căn hộ 3PN", Duplex: "Duplex" },
  defaultUnitPrice: {
    Studio: 90_000_000,
    "1PN+": 90_000_000,
    "2PN": 90_000_000,
    "3PN": 90_000_000,
    Duplex: 90_000_000,
  },
  vatRate: 0.1,
  maintenanceRate: 0.02,
  maintenanceBase: "list",
  totalLabel: "Tổng giá trị sau CK gồm VAT & PBT",
  priceOptions: [
    {
      id: "ban-giao",
      label: "Loại bàn giao",
      choices: [
        { label: "Hoàn thiện", percent: 0.07 },
        { label: "Sáng tạo", percent: 0 },
      ],
      default: 0,
    },
  ],
  optionalDiscounts: [
    { id: "early-bird", label: "Early Bird (trước 14/10/2026)", options: [0, 0.02], default: 0.02, base: "list" },
    { id: "secret-box", label: "Secret Box", options: [0, 0.01], default: 0 },
  ],
  units,
  methods: [
    method("pttt-chuan", "PTTT Chuẩn", "CK 5% · 5%/tháng sau HĐMB, 50% khi bàn giao", 0.05, [
      ...head(0.1),
      ...[30, 60, 90, 120, 150].map(
        (d, i): Milestone => ({ label: `Đợt ${i + 3}`, due: `D+${d}`, percent: 0.05, daysAfterContract: d }),
      ),
      { label: "Đợt 8", due: HANDOVER, percent: 0.5, includeMaintenance: true },
      certificate("Đợt 9"),
    ]),
    method(
      "pttt-vay",
      "PTTT Vay",
      "Ngân hàng giải ngân 70%",
      0, // Không chiết khấu PTTT (file Excel ghi 5% là chép nhầm từ PTTT khác)
      [
        ...head(0.1),
        {
          label: "Đợt 3",
          due: "D+30",
          note: "Ngân hàng giải ngân 70%",
          percent: 0.7,
          payer: "bank",
          daysAfterContract: 30,
        },
        { label: "Đợt 4", due: HANDOVER, percent: 0.05, includeMaintenance: true },
        certificate("Đợt 5"),
      ],
      LOAN,
    ),
    method(
      "pttt-dac-biet",
      "PTTT Đặc biệt",
      "Ngân hàng giải ngân 55% + 15% khi bàn giao",
      0, // Không chiết khấu PTTT
      [
        ...head(0),
        {
          label: "Đợt 3",
          due: "D+30",
          note: "Ngân hàng giải ngân 55%",
          percent: 0.55,
          payer: "bank",
          daysAfterContract: 30,
        },
        { label: "Đợt 4", due: HANDOVER, note: "Khách thanh toán 15%", percent: 0.15, includeMaintenance: true },
        { label: "Đợt 4", due: "Bàn giao (Dự kiến Quý IV/2028)", note: "Ngân hàng giải ngân 15%", percent: 0.15, payer: "bank" },
        certificate("Đợt 5"),
      ],
      LOAN,
    ),
    method("pttt-nhanh-70", "PTTT Nhanh 70%", "CK 11% · Thanh toán 70% trong 30 ngày sau HĐMB", 0.11, [
      ...head(0.1),
      { label: "Đợt 3", due: "D+30", percent: 0.5, daysAfterContract: 30 },
      { label: "Đợt 4", due: HANDOVER, percent: 0.25, includeMaintenance: true },
      certificate("Đợt 5"),
    ]),
    method("pttt-nhanh-95", "PTTT Nhanh 95%", "CK 14% · Thanh toán 95% trong 30 ngày sau HĐMB", 0.14, [
      ...head(0.1),
      { label: "Đợt 3", due: "D+30", percent: 0.75, daysAfterContract: 30 },
      { label: "Đợt 4", due: HANDOVER, percent: 0, includeMaintenance: true },
      certificate("Đợt 5"),
    ]),
  ],
  notes: [
    "Early Bird 2% tính trên giá gốc; Secret Box và CK PTTT tính trên giá còn lại sau chiết khấu trước.",
    "Phí bảo trì 2% tính trên giá gốc (chưa VAT, trước chiết khấu).",
    "Quà tặng không trừ giá: 12 tháng phí quản lý.",
    "Bảng tính này chỉ mang tính chất tham khảo, không dùng làm căn cứ đối chiếu với CĐT.",
  ],
};

import type { Loan, Milestone, PaymentMethod, Project } from "../../lib/types";
import { units } from "./units.ts";

/**
 * Serena Riverside — cấu hình theo file "SRN_BẢNG TẠM TÍNH GIÁ_Final.xlsx".
 * Sheet SP → units.json, sheet CTCK + CHI TIẾT → các PTTT bên dưới.
 */

const HANDOVER = "Thông báo bàn giao căn hộ (Dự kiến Quý 4/2028)";
const CERTIFICATE = "Thông báo bàn giao Giấy chứng nhận";

/** Ghi chú tiến độ xây dựng theo thứ tự đợt sau HĐMB (sheet CHI TIẾT, cột H) */
function constructionNote(k: number): string {
  if (k <= 12) return `Đổ bê tông sàn tầng ${k * 2}`;
  if (k === 13) return "Cất nóc Block A";
  return `Xây tô tầng ${(k - 13) * 3}`;
}

function head(firstPercent: number): Milestone[] {
  return [
    {
      label: "Cọc",
      due: "Thanh toán theo Phiếu Đặt Cọc",
      amount: 50_000_000,
      advance: true,
    },
    {
      label: "VBTT",
      due: "Ký Văn bản Thỏa thuận (trong vòng 7 ngày kể từ ngày cọc)",
      note: "Tương đương 5% giá trị căn hộ",
      percent: 0.05,
      advance: true,
      deductAdvances: true,
    },
    {
      label: "Đợt 1",
      due: "Ký Hợp đồng mua bán – Hoàn thành xong phần móng cọc (Dự kiến Quý 2/2027)",
      note: "Đã bao gồm số tiền Thỏa thuận đảm bảo (nếu có)",
      percent: firstPercent,
      deductAdvances: true,
      monthsAfterContract: 0,
    },
  ];
}

function tail(startIndex: number): Milestone[] {
  return [
    {
      label: `Đợt ${startIndex}`,
      due: `${HANDOVER} + Gồm phí bảo trì 2%`,
      percent: 0.25,
      includeMaintenance: true,
    },
    { label: `Đợt ${startIndex + 1}`, due: CERTIFICATE, percent: 0.05, remainder: true },
  ];
}

/** PTTT giãn theo tháng: Đợt 1 = firstPercent, sau đó `months` đợt mỗi tháng, rồi bàn giao 25% + GCN 5% */
function monthly(firstPercent: number, monthlyPercents: number[]): Milestone[] {
  const rows: Milestone[] = monthlyPercents.map((percent, i) => ({
    label: `Đợt ${i + 2}`,
    due: `${String(i + 1).padStart(2, "0")} tháng kể từ ngày ký HĐMB`,
    note: constructionNote(i + 1),
    percent,
    monthsAfterContract: i + 1,
  }));
  return [...head(firstPercent), ...rows, ...tail(monthlyPercents.length + 2)];
}

function fast(percent: number, discount: number): PaymentMethod {
  const p = Math.round(percent * 100);
  const rest = Math.round((0.7 - percent) / 0.025);
  return {
    id: `pttt-nhanh-${p}`,
    name: `PTTT nhanh ${p}%`,
    summary: `CK ${formatPct(discount)} tổng giá trị căn hộ`,
    discounts: [{ label: `Chiết khấu PTTT nhanh ${p}%`, percent: discount }],
    milestones:
      rest === 0 ? [...head(percent), ...tail(2)] : monthly(percent, Array(rest).fill(0.025)),
  };
}

function loanMethod(
  id: string,
  name: string,
  summary: string,
  discount: number,
  secondPercent: number,
  bankPercent: number,
  loan: Loan,
): PaymentMethod {
  return {
    id,
    name,
    summary,
    discounts: discount > 0 ? [{ label: `Chiết khấu ${name}`, percent: discount }] : [],
    milestones: [
      ...head(0.1),
      {
        label: "Đợt 2",
        due: "01 tháng kể từ ngày ký HĐMB",
        percent: secondPercent,
        monthsAfterContract: 1,
      },
      {
        label: "Đợt 3",
        due: "Trong vòng 45 ngày kể từ ngày ký Hợp đồng mua bán (Đợt 1)",
        note: "Ngân hàng giải ngân 100% Đợt 3",
        percent: bankPercent,
        payer: "bank",
        daysAfterContract: 45,
      },
      ...tail(4),
    ],
    loan,
  };
}

function formatPct(p: number): string {
  return `${Math.round(p * 1000) / 10}%`;
}

/** Giả định khoản vay (nhân viên có thể chỉnh trên giao diện) */
const LOAN_DEFAULTS = { termYears: 20, rateAfter: 0.1, bank: "Ngân hàng tài trợ dự án" };

export const serenaRiverside: Project = {
  id: "serena-riverside",
  name: "Serena Riverside",
  developer: "Công ty CP Đầu tư Đạt Phước",
  description: "Căn hộ & Officetel",
  unitTypes: { CH: "Căn hộ", OT: "Officetel" },
  defaultUnitPrice: { CH: 56_300_000, OT: 50_600_000 },
  vatRate: 0.1,
  maintenanceRate: 0.02,
  landValuePerM2: 1_844_504,
  optionalDiscounts: [
    {
      id: "si",
      label: "Chiết khấu mua sỉ/KH thân thiết",
      options: [0, 0.01, 0.015],
      default: 0,
      base: "list",
    },
    {
      id: "early-bird",
      label: "Chiết khấu Early Bird",
      options: [0, 0.01],
      default: 0,
      base: "list",
    },
  ],
  units,
  methods: [
    {
      id: "pttt-chuan",
      name: "PTTT Chuẩn",
      summary: "CK 4.9% tổng giá trị căn hộ",
      discounts: [{ label: "Chiết khấu PTTT Chuẩn", percent: 0.049 }],
      milestones: monthly(0.1, [0.1, ...Array(20).fill(0.025)]),
    },
    fast(0.7, 0.099),
    fast(0.6, 0.097),
    fast(0.5, 0.09),
    fast(0.4, 0.08),
    fast(0.3, 0.067),
    loanMethod(
      "pttt-vay-1",
      "PTTT Vay 1",
      "CĐT hỗ trợ 100% lãi suất vay trong thời gian 24 tháng",
      0,
      0.1,
      0.5,
      {
        ...LOAN_DEFAULTS,
        policy: "CĐT hỗ trợ 100% lãi suất vay trong thời gian 24 tháng",
        supportMonths: 24,
        customerRate: 0,
        gracePrincipalMonths: 24,
      },
    ),
    loanMethod(
      "pttt-vay-2",
      "PTTT Vay 2",
      "KH trả lãi suất 4,6%/năm cố định 03 năm đầu, CĐT hỗ trợ phần chênh lệch",
      0,
      0.1,
      0.5,
      {
        ...LOAN_DEFAULTS,
        policy:
          "KH thanh toán lãi suất vay 4,6%/năm, cố định trong 03 năm đầu. Chủ đầu tư hỗ trợ phần chênh lệch lãi suất phát sinh.",
        supportMonths: 36,
        customerRate: 0.046,
        gracePrincipalMonths: 0,
      },
    ),
    loanMethod(
      "pttt-vay-3",
      "PTTT Vay 3",
      "KH trả lãi suất 6,1%/năm cố định 04 năm đầu, CĐT hỗ trợ phần chênh lệch",
      0,
      0.1,
      0.5,
      {
        ...LOAN_DEFAULTS,
        policy:
          "KH thanh toán lãi suất vay 6,1%/năm, cố định trong 04 năm đầu. Chủ đầu tư hỗ trợ phần chênh lệch lãi suất phát sinh.",
        supportMonths: 48,
        customerRate: 0.061,
        gracePrincipalMonths: 0,
      },
    ),
    loanMethod(
      "pttt-vay-40",
      "PTTT Vay 40%",
      "CK 2.1% tổng giá trị căn hộ + CĐT hỗ trợ 100% lãi suất vay trong 24 tháng",
      0.021,
      0.2,
      0.4,
      {
        ...LOAN_DEFAULTS,
        policy: "CĐT hỗ trợ 100% lãi suất vay trong thời gian 24 tháng",
        supportMonths: 24,
        customerRate: 0,
        gracePrincipalMonths: 24,
      },
    ),
  ],
  notes: [
    "Các chiết khấu được tính trên giá trị căn hộ ban hành chưa VAT, chưa phí bảo trì.",
    "Giá trị trên bảng tính chỉ mang tính chất tham khảo, giá trị thực tế căn cứ theo Hợp đồng mua bán.",
  ],
};

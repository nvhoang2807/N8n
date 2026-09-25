import type { Milestone, PaymentMethod, Project } from "../../lib/types";

/**
 * Palm River — cấu hình theo file "PHIẾU TẠM TÍNH GIÁ PALM RIVER.xlsm"
 * (sheet PTTT ĐẶC BIỆT, PTTT CHUẨN, PTTT SỚM, PTTT VAY).
 *
 * Khác Serena Riverside:
 *  - Giá gốc = DT thông thủy × đơn giá (priceArea: "net")
 *  - VAT 10% trên toàn bộ giá sau CK (không trừ tiền sử dụng đất)
 *  - Phí bảo trì 2% tính trên giá gốc trước chiết khấu (maintenanceBase: "list")
 *  - Không có bảng giá: nhân viên nhập mã căn, loại, diện tích, đơn giá (customUnits)
 *  - CK PTTT trong file là mức tối đa, nhân viên điền lại mức thực tế (adjustableMethodDiscount)
 */

const HANDOVER = "Thông báo bàn giao căn hộ + Gồm phí bảo trì 2%";
const CERTIFICATE = "Nhận Giấy chứng nhận (GCN)";

/** XNĐK 100 triệu + Đợt 1 (VBTT, tổng đạt 5%) + Đợt 2 (ký HĐMB) */
function head(contractPercent: number): Milestone[] {
  return [
    { label: "XNĐK", due: "Đăng ký nguyện vọng", note: "Xác nhận đặt chỗ", amount: 100_000_000, advance: true },
    {
      label: "Đợt 1",
      due: "5 ngày sau XNĐK (Ký VBTT)",
      note: "Đã cấn trừ tiền XNĐK",
      percent: 0.05,
      deductAdvances: true,
    },
    { label: "Đợt 2", due: "3 tháng sau Đợt 1 (Ký HĐMB)", percent: contractPercent, monthsAfterContract: 0 },
  ];
}

const certificate = (label: string): Milestone => ({ label, due: CERTIFICATE, percent: 0.05, remainder: true });

function method(id: string, name: string, summary: string, discount: number, milestones: Milestone[]): PaymentMethod {
  return {
    id,
    name,
    summary,
    discounts: discount > 0 ? [{ label: `Chiết khấu ${name}`, percent: discount }] : [],
    milestones,
  };
}

export const palmRiver: Project = {
  id: "palm-river",
  name: "Palm River",
  developer: "",
  location: "Palm City, TP. Thủ Đức",
  description: "Căn hộ Palm River",
  unitTypes: { "1PN": "Căn hộ 1PN", "2PN": "Căn hộ 2PN", "3PN": "Căn hộ 3PN", "4PN": "Căn hộ 4PN" },
  defaultUnitPrice: { "3PN": 168_000_000 },
  vatRate: 0.1,
  maintenanceRate: 0.02,
  maintenanceBase: "list",
  priceArea: "net",
  customUnits: true,
  adjustableMethodDiscount: true,
  totalLabel: "Tổng giá trị sau CK gồm VAT & PBT",
  optionalDiscounts: [
    { id: "early-bird", label: "Chiết khấu Early Bird", options: [0, 0.005, 0.01], default: 0.005 },
    { id: "than-thiet", label: "Chiết khấu KH thân thiết", options: [0, 0.01], default: 0 },
    { id: "si", label: "Chiết khấu sỉ", options: [0, 0.005, 0.01, 0.015], default: 0 },
  ],
  // Căn mẫu trong sheet GIỎ HÀNG; căn khác nhân viên tự nhập
  units: [{ code: "PR-10-10", type: "3PN", grossArea: 145, netArea: 130 }],
  methods: [
    method("pttt-dac-biet", "PTTT Đặc biệt", "CK đến 6.5% · Thanh toán 30% đến khi nhận nhà", 0.065, [
      ...head(0.05),
      { label: "Đợt 3", due: "3 tháng sau Đợt 2", percent: 0.1, monthsAfterContract: 3 },
      { label: "Đợt 4", due: "6 tháng sau Đợt 3", percent: 0.1, monthsAfterContract: 9 },
      { label: "Đợt 5", due: `15 tháng sau Đợt 3 – ${HANDOVER}`, percent: 0.65, includeMaintenance: true, monthsAfterContract: 18 },
      certificate("Đợt 6"),
    ]),
    method("pttt-chuan", "PTTT Chuẩn", "CK đến 11% · Thanh toán 3 tháng/đợt", 0.11, [
      ...head(0.05),
      ...[0.05, 0.05, 0.1, 0.1, 0.1, 0.1, 0.1].map(
        (percent, i): Milestone => ({
          label: `Đợt ${i + 3}`,
          due: `3 tháng sau Đợt ${i + 2}`,
          percent,
          monthsAfterContract: (i + 1) * 3,
        }),
      ),
      { label: "Đợt 10", due: HANDOVER, percent: 0.25, includeMaintenance: true },
      certificate("Đợt 11"),
    ]),
    method("pttt-nhanh", "PTTT Nhanh", "CK đến 13% · Thanh toán 70% khi ký HĐMB", 0.13, [
      ...head(0.65),
      { label: "Đợt 3", due: `24 tháng sau Đợt 2 – ${HANDOVER}`, percent: 0.25, includeMaintenance: true, monthsAfterContract: 24 },
      certificate("Đợt 4"),
    ]),
    {
      id: "pttt-vay",
      name: "PTTT Vay",
      summary: "Ngân hàng giải ngân 70% · Hỗ trợ lãi suất 24 tháng",
      discounts: [],
      milestones: [
        ...head(0.05),
        {
          label: "Đợt 2",
          due: "3 tháng sau Đợt 1 (Ký HĐMB)",
          note: "Ngân hàng giải ngân 55%",
          percent: 0.55,
          payer: "bank",
          monthsAfterContract: 0,
        },
        { label: "Đợt 3", due: `24 tháng sau Đợt 2 – ${HANDOVER}`, percent: 0.15, includeMaintenance: true, monthsAfterContract: 24 },
        {
          label: "Đợt 3",
          due: "24 tháng sau Đợt 2",
          note: "Ngân hàng giải ngân 15%",
          percent: 0.15,
          payer: "bank",
          monthsAfterContract: 24,
        },
        certificate("Đợt 4"),
      ],
      loan: {
        bank: "Ngân hàng tài trợ dự án",
        policy: "Hỗ trợ lãi suất 24 tháng, ân hạn nợ gốc 36–60 tháng.",
        supportMonths: 24,
        customerRate: 0,
        termYears: 20,
        rateAfter: 0.1,
        gracePrincipalMonths: 36,
      },
    },
  ],
  notes: [
    "Chiết khấu Early Bird tính trên giá gốc; các chiết khấu sau tính trên giá còn lại sau chiết khấu trước.",
    "Chiết khấu sỉ: 2 căn 0,5% · 3–4 căn 1% · từ 5 căn 1,5%.",
    "Phí bảo trì 2% tính trên giá gốc (chưa VAT, trước chiết khấu).",
    "Bảng tính này chỉ mang tính chất tham khảo, không dùng làm căn cứ đối chiếu với CĐT.",
  ],
};

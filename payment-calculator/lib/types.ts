/**
 * Mô hình dữ liệu cho bảng tạm tính giá trị HĐMB.
 *
 * Trình tự tính (khớp bảng tạm tính Excel của chủ đầu tư):
 *  (1) Giá công bố = đơn giá × DT tim tường (hoặc thông thủy, xem priceArea; hoặc giá căn nhập sẵn)
 *      — chưa VAT, chưa phí bảo trì
 *  (2) Trừ các chiết khấu → Giá sau chiết khấu (chưa VAT)
 *  (3) Tiền sử dụng đất = DT thông thủy × đơn giá tiền SDĐ (không chịu VAT)
 *  (4) VAT = (Giá sau CK − tiền SDĐ) × 10%
 *  (5) Giá trị căn hộ gồm VAT = Giá sau CK + VAT
 *  (6) Phí bảo trì = Giá sau CK × 2% (hoặc Giá công bố × 2%, xem maintenanceBase)
 *  (7) Tổng giá trị HĐMB = (5) + (6)
 */

export type Discount = {
  label: string;
  /** Tỷ lệ chiết khấu, ví dụ 0.05 = 5% */
  percent: number;
  /**
   * "list": tính trên giá công bố (1).
   * "running": tính trên giá còn lại sau các chiết khấu trước đó (mặc định).
   */
  base?: "list" | "running";
};

/** Chiết khấu tùy chọn ở cấp dự án (CK sỉ, Early Bird...), nhân viên chọn mức áp dụng */
export type OptionalDiscount = {
  id: string;
  label: string;
  options: number[];
  default: number;
  base?: "list" | "running";
};

export type Milestone = {
  label: string;
  /** Thời điểm thanh toán hiển thị cho khách */
  due: string;
  note?: string;
  /** Tỷ lệ trên Giá trị căn hộ gồm VAT (chưa phí bảo trì) */
  percent?: number;
  /** Số tiền cố định (VND), ví dụ tiền cọc */
  amount?: number;
  /**
   * Khoản ứng trước (cọc, văn bản thỏa thuận): sẽ được trừ vào đợt kế tiếp có deductAdvances.
   * Đợt ứng trước không hiển thị tỷ lệ.
   */
  advance?: boolean;
  /** Trừ các khoản ứng trước chưa được cấn trừ */
  deductAdvances?: boolean;
  /** Cộng phí bảo trì vào đợt này */
  includeMaintenance?: boolean;
  /** Đợt cuối: = Tổng giá trị HĐMB − các đợt trước (hấp thụ sai số làm tròn) */
  remainder?: boolean;
  /** Ai thanh toán đợt này. Mặc định: khách hàng */
  payer?: "customer" | "bank";
  /** Số tháng sau ngày ký HĐMB, dùng để ước tính ngày đến hạn */
  monthsAfterContract?: number;
  /** Số ngày sau ngày ký HĐMB (dùng thay monthsAfterContract khi hạn tính theo ngày) */
  daysAfterContract?: number;
};

export type Loan = {
  bank?: string;
  /** Mô tả chính sách hỗ trợ lãi suất */
  policy: string;
  /** Số tháng áp dụng chính sách hỗ trợ */
  supportMonths: number;
  /** Lãi suất khách trả trong thời gian hỗ trợ (năm). 0 = CĐT hỗ trợ 100% */
  customerRate: number;
  /** Thời hạn vay giả định (năm) */
  termYears: number;
  /** Lãi suất thả nổi giả định sau thời gian hỗ trợ (năm) */
  rateAfter: number;
  /** Số tháng ân hạn nợ gốc giả định (0 = trả gốc ngay từ tháng đầu) */
  gracePrincipalMonths: number;
};

export type PaymentMethod = {
  id: string;
  name: string;
  /** Mô tả ưu đãi, ví dụ "CK 9.9% tổng giá trị căn hộ" */
  summary: string;
  discounts: Discount[];
  milestones: Milestone[];
  loan?: Loan;
};

export type Unit = {
  code: string;
  /** Loại sản phẩm, ví dụ "CH" (căn hộ), "OT" (officetel) */
  type: string;
  /** Số phòng ngủ, ví dụ 2 hoặc "1+" */
  bedrooms?: number | string;
  bathrooms?: number;
  direction?: string;
  /** Diện tích tim tường (m²) — cơ sở tính giá */
  grossArea: number;
  /** Diện tích thông thủy (m²) — cơ sở tính tiền sử dụng đất */
  netArea: number;
  /** Giá công bố cố định (nếu có bảng giá từng căn). Không có thì dùng đơn giá × DT tim tường */
  price?: number;
};

export type Project = {
  id: string;
  name: string;
  developer: string;
  location?: string;
  description?: string;
  /** Tên loại sản phẩm hiển thị, ví dụ { CH: "Căn hộ", OT: "Officetel" } */
  unitTypes: Record<string, string>;
  /** Đơn giá tham khảo theo loại sản phẩm (VND/m² tim tường), nhân viên có thể sửa */
  defaultUnitPrice: Record<string, number>;
  /** Thuế suất VAT, ví dụ 0.1 */
  vatRate: number;
  /** Tỷ lệ phí bảo trì, ví dụ 0.02 */
  maintenanceRate: number;
  /**
   * Cơ sở tính phí bảo trì. "net" (mặc định): giá sau chiết khấu chưa VAT;
   * "list": giá công bố trước chiết khấu.
   */
  maintenanceBase?: "net" | "list";
  /** Diện tích nhân với đơn giá để ra giá công bố. Mặc định "gross" (tim tường) */
  priceArea?: "gross" | "net";
  /** Cho nhân viên nhập căn không có trong danh sách (tự điền loại, diện tích, đơn giá) */
  customUnits?: boolean;
  /** Tên dòng tổng giá trị hiển thị cho khách. Mặc định "Tổng giá trị HĐMB" */
  totalLabel?: string;
  /** Cho nhân viên hạ chiết khấu PTTT theo từng khách (không vượt mức cấu hình) */
  adjustableMethodDiscount?: boolean;
  /** Đơn giá tiền sử dụng đất (VND/m² thông thủy), trừ khỏi cơ sở tính VAT */
  landValuePerM2?: number;
  optionalDiscounts: OptionalDiscount[];
  units: Unit[];
  methods: PaymentMethod[];
  notes?: string[];
  /** Thứ tự hiển thị trên trang chủ (nhỏ đứng trước) */
  order?: number;
  /** Ẩn khỏi danh sách trang chủ (vẫn mở được bằng link) */
  hidden?: boolean;
  /** Thời điểm lưu gần nhất (ISO), do hệ thống ghi */
  updatedAt?: string;
};

/** Thông tin rút gọn để hiển thị danh sách dự án */
export type ProjectSummary = Pick<
  Project,
  "id" | "name" | "developer" | "location" | "description" | "hidden" | "order" | "updatedAt"
> & { unitCount: number; methodCount: number };

export function summarize(p: Project): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    developer: p.developer,
    location: p.location,
    description: p.description,
    hidden: p.hidden,
    order: p.order,
    updatedAt: p.updatedAt,
    unitCount: p.units.length,
    methodCount: p.methods.length,
  };
}

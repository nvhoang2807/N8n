import type { Discount, Loan, PaymentMethod, Project } from "./types";

export type DiscountLine = { label: string; percent: number; amount: number };

export type ScheduleRow = {
  index: number;
  label: string;
  due: string;
  note?: string;
  /** Tỷ lệ hiển thị (undefined với khoản cọc / ứng trước) */
  percent?: number;
  amount: number;
  cumulative: number;
  /**
   * Lũy kế tỷ lệ thanh toán (cộng dồn cột Tỷ lệ, như bảng Excel): 5%, 10%, 15%…
   * Khoản ứng trước tính theo tỷ lệ của nó cho tới khi được cấn trừ.
   * undefined với khoản chỉ có số tiền cố định (cọc) và chưa có tỷ lệ nào trước đó.
   */
  cumulativePercent?: number;
  payer: "customer" | "bank";
  includesMaintenance: boolean;
  dueDate?: Date;
};

export type LoanEstimate = {
  amount: number;
  bank?: string;
  policy: string;
  supportMonths: number;
  customerRate: number;
  termYears: number;
  rateAfter: number;
  graceMonths: number;
  /** Số tiền khách trả tháng đầu trong thời gian hỗ trợ (gốc nếu có + lãi theo LS khách trả) */
  monthlyDuringSupport: number;
  /** Gốc + lãi tháng đầu tiên sau thời gian hỗ trợ (dư nợ giảm dần, LS thả nổi giả định) */
  firstFullPayment: number;
  /** Giá trị lãi chủ đầu tư hỗ trợ (ước tính theo lãi suất giả định) */
  supportValue: number;
};

export type Quote = {
  listPrice: number;
  discounts: DiscountLine[];
  totalDiscount: number;
  /** Giá sau tất cả chiết khấu, chưa VAT, chưa phí bảo trì */
  netPrice: number;
  landValue: number;
  vat: number;
  /** Giá trị căn hộ gồm VAT, chưa phí bảo trì — cơ sở tính % tiến độ */
  priceWithVat: number;
  maintenance: number;
  /** Tổng giá trị HĐMB gồm VAT và phí bảo trì */
  total: number;
  schedule: ScheduleRow[];
  customerPays: number;
  bankPays: number;
  /** total − tổng tiến độ; khác 0 nghĩa là cấu hình tiến độ chưa khớp */
  mismatch: number;
  loan?: LoanEstimate;
};

export type QuoteInput = {
  /** Giá công bố (1), chưa VAT, chưa phí bảo trì */
  listPrice: number;
  /** Diện tích thông thủy — để tính tiền sử dụng đất */
  netArea: number;
  /** Mức chiết khấu tùy chọn đã chọn, theo id */
  optionalDiscounts?: Record<string, number>;
  /** Ngày ký HĐMB dự kiến — để ước tính ngày các đợt */
  contractDate?: Date;
  /** Chiết khấu PTTT áp dụng cho khách (thay mức của chiết khấu đầu tiên trong PTTT) */
  methodDiscount?: number;
  /** Ghi đè giả định khoản vay */
  rateAfter?: number;
  termYears?: number;
};

const round = (n: number) => Math.round(n);

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

function dueDate(contractDate?: Date, months?: number, days?: number): Date | undefined {
  if (!contractDate) return undefined;
  if (months !== undefined) return addMonths(contractDate, months);
  if (days !== undefined) {
    const d = new Date(contractDate.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }
  return undefined;
}

/** Diện tích dùng để tính giá công bố của dự án */
export function pricedArea(project: Project, unit: { grossArea: number; netArea: number }): number {
  return project.priceArea === "net" ? unit.netArea : unit.grossArea;
}

export function unitListPrice(
  project: Project,
  unit: { type: string; grossArea: number; netArea: number; price?: number },
  unitPrice?: number,
): number {
  if (unitPrice === undefined && unit.price !== undefined) return unit.price;
  const perM2 = unitPrice ?? project.defaultUnitPrice[unit.type] ?? 0;
  return round(pricedArea(project, unit) * perM2);
}

export function computeQuote(
  project: Project,
  method: PaymentMethod,
  input: QuoteInput,
): Quote {
  const listPrice = round(input.listPrice);

  const chosen: Discount[] = [
    ...project.optionalDiscounts
      .map((d) => ({
        label: d.label,
        percent: input.optionalDiscounts?.[d.id] ?? d.default,
        base: d.base,
      }))
      .filter((d) => d.percent > 0),
    ...method.discounts
      .map((d, i) =>
        i === 0 && input.methodDiscount !== undefined
          ? { ...d, percent: Math.min(Math.max(input.methodDiscount, 0), d.percent) }
          : d,
      )
      .filter((d) => d.percent > 0),
  ];

  let running = listPrice;
  const discounts: DiscountLine[] = [];
  for (const d of chosen) {
    const base = d.base === "list" ? listPrice : running;
    const amount = round(base * d.percent);
    running -= amount;
    discounts.push({ label: d.label, percent: d.percent, amount });
  }
  const netPrice = running;
  const totalDiscount = listPrice - netPrice;

  const landValue = round(input.netArea * (project.landValuePerM2 ?? 0));
  const vat = round(Math.max(netPrice - landValue, 0) * project.vatRate);
  const priceWithVat = netPrice + vat;
  const maintenanceBase = project.maintenanceBase === "list" ? listPrice : netPrice;
  const maintenance = round(maintenanceBase * project.maintenanceRate);
  const total = priceWithVat + maintenance;

  let pendingAdvances = 0;
  let cumulative = 0;
  let percentSum = 0;
  let pendingAdvancePercent = 0;
  const schedule: ScheduleRow[] = method.milestones.map((m, i) => {
    let amount: number;
    if (m.remainder) {
      amount = total - cumulative;
    } else {
      const gross =
        m.amount !== undefined
          ? m.amount
          : round((m.percentBase === "list" ? listPrice : priceWithVat) * (m.percent ?? 0));
      amount = gross;
      if (m.deductAdvances) {
        amount -= pendingAdvances;
        pendingAdvances = 0;
      }
      if (m.advance) pendingAdvances += gross;
      if (m.includeMaintenance) amount += maintenance;
    }
    cumulative += amount;

    if (m.deductAdvances) pendingAdvancePercent = 0;
    if (m.advance) pendingAdvancePercent += m.percent ?? 0;
    else percentSum += m.percent ?? 0;
    const pctSoFar = percentSum + pendingAdvancePercent;
    const cumulativePercent = pctSoFar > 0 ? Math.round(pctSoFar * 1e8) / 1e8 : undefined;
    return {
      index: i + 1,
      label: m.label,
      due: m.due,
      note: m.note,
      percent: m.advance ? undefined : m.percent,
      amount,
      cumulative,
      cumulativePercent,
      payer: m.payer ?? "customer",
      includesMaintenance: !!m.includeMaintenance,
      dueDate: dueDate(input.contractDate, m.monthsAfterContract, m.daysAfterContract),
    };
  });

  const bankPays = schedule
    .filter((r) => r.payer === "bank")
    .reduce((s, r) => s + r.amount, 0);

  return {
    listPrice,
    discounts,
    totalDiscount,
    netPrice,
    landValue,
    vat,
    priceWithVat,
    maintenance,
    total,
    schedule,
    customerPays: cumulative - bankPays,
    bankPays,
    mismatch: total - cumulative,
    loan: method.loan
      ? estimateLoan(method.loan, bankPays, input.rateAfter, input.termYears)
      : undefined,
  };
}

export function estimateLoan(
  loan: Loan,
  amount: number,
  rateAfter = loan.rateAfter,
  termYears = loan.termYears,
): LoanEstimate {
  const graceMonths = Math.min(loan.gracePrincipalMonths, termYears * 12 - 1);
  const principal = amount / (termYears * 12 - graceMonths);

  // Mô phỏng theo tháng trong thời gian hỗ trợ: dư nợ giảm dần sau ân hạn gốc.
  let outstanding = amount;
  let supportValue = 0;
  let monthlyDuringSupport = 0;
  for (let m = 1; m <= loan.supportMonths; m++) {
    const payPrincipal = m > graceMonths ? Math.min(principal, outstanding) : 0;
    if (m === 1) {
      monthlyDuringSupport = payPrincipal + (outstanding * loan.customerRate) / 12;
    }
    supportValue += (outstanding * Math.max(rateAfter - loan.customerRate, 0)) / 12;
    outstanding -= payPrincipal;
  }
  const firstPrincipal =
    loan.supportMonths + 1 > graceMonths ? Math.min(principal, outstanding) : 0;

  return {
    amount,
    bank: loan.bank,
    policy: loan.policy,
    supportMonths: loan.supportMonths,
    customerRate: loan.customerRate,
    termYears,
    rateAfter,
    graceMonths,
    monthlyDuringSupport: round(monthlyDuringSupport),
    firstFullPayment: round(firstPrincipal + (outstanding * rateAfter) / 12),
    supportValue: round(supportValue),
  };
}

const vnd = new Intl.NumberFormat("vi-VN");
const dec = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export function formatVnd(n: number): string {
  return vnd.format(round(n));
}

/** Hiển thị gọn: 3,45 tỷ / 450 triệu */
export function formatShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${dec.format(n / 1e9)} tỷ`;
  if (abs >= 1e6) return `${dec.format(n / 1e6)} triệu`;
  return `${formatVnd(n)} đ`;
}

export function formatPercent(p: number): string {
  return `${dec.format(p * 100)}%`;
}

/** Tháng/năm, ví dụ 06/2027 */
export function formatDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

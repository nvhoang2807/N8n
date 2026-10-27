import type { Discount, Loan, Milestone, PaymentMethod, Project } from "./types";

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
  /** Tháng dự kiến thanh toán (YYYY-MM) khi đã biết tháng ký HĐMB */
  month?: string;
};

/** Cách trả nợ: "declining" = dư nợ giảm dần (gốc đều), "annuity" = trả góp đều (gốc + lãi bằng nhau) */
export type LoanType = "declining" | "annuity";

export type LoanRow = {
  month: number;
  /** Dư nợ đầu kỳ */
  opening: number;
  principal: number;
  /** Lãi khách trả trong kỳ */
  interest: number;
  payment: number;
  /** Dư nợ cuối kỳ */
  closing: number;
  /** Lãi suất khách áp dụng trong kỳ (năm) */
  rate: number;
  /** Kỳ thuộc thời gian CĐT hỗ trợ lãi */
  supported: boolean;
};

export type LoanEstimate = {
  type: LoanType;
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
  /** Tổng lãi khách tự trả suốt thời hạn vay */
  totalInterest: number;
  /** Tổng gốc + lãi khách trả */
  totalPayment: number;
  /** Số tiền trả cao nhất trong một tháng */
  maxPayment: number;
  schedule: LoanRow[];
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
  /** Mốc thời gian (tháng cố định) để ước tính tháng thanh toán của từng đợt */
  timeline?: TimelineInput;
  /** Chiết khấu PTTT áp dụng cho khách (thay mức của chiết khấu đầu tiên trong PTTT) */
  methodDiscount?: number;
  /** Ghi đè giả định khoản vay */
  rateAfter?: number;
  termYears?: number;
  loanType?: LoanType;
};

const round = (n: number) => Math.round(n);

/** Mốc thời gian đầu vào (YYYY-MM): tháng ký HĐMB, bàn giao, GCN và tháng bắt đầu (hôm nay) */
export type TimelineInput = { contract?: string; handover?: string; certificate?: string; start?: string };

/** "2027-04" (hoặc "2027-04-15") → số tháng liên tục, để cộng trừ tháng */
export function monthIndex(key?: string): number | undefined {
  const m = /^(\d{4})-(\d{2})/.exec(key ?? "");
  if (!m) return undefined;
  const mo = Number(m[2]);
  return mo >= 1 && mo <= 12 ? Number(m[1]) * 12 + mo - 1 : undefined;
}

export const monthKey = (i: number): string => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;

/** 2027-04 → 04/2027 */
export function formatMonth(key: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(key);
  return m ? `${m[2]}/${m[1]}` : key;
}

const isCertificate = (m: Milestone) => /giấy chứng nhận|\bgcn\b|sổ hồng|pink book/i.test(m.due);
const isHandover = (m: Milestone) => !!m.includeMaintenance || /bàn giao|handover/i.test(m.due);

/**
 * Quy từng đợt ra tháng cố định (số tháng liên tục):
 *  - có monthsAfterContract / daysAfterContract → tháng ký HĐMB + số tháng (30 ngày = 1 tháng)
 *  - khoản ứng trước (cọc, VBTT, ký quỹ) → tháng bắt đầu (hôm nay), không muộn hơn tháng ký HĐMB
 *  - đợt bàn giao → tháng bàn giao của dự án, nhưng luôn sau các đợt đóng theo tháng đứng trước nó
 *  - đợt nhận GCN → tháng GCN của dự án, mặc định bàn giao + 12 tháng
 * Trả về undefined cho mọi đợt nếu chưa biết tháng ký HĐMB.
 */
export function resolveMonths(milestones: Milestone[], tl: TimelineInput): (number | undefined)[] {
  const contract = monthIndex(tl.contract);
  if (contract === undefined) return milestones.map(() => undefined);
  const start = Math.min(monthIndex(tl.start) ?? contract, contract);
  const handoverBase = monthIndex(tl.handover);
  const certBase = monthIndex(tl.certificate);
  let prevMax = start;
  let handover: number | undefined;
  return milestones.map((m) => {
    let v: number;
    if (m.monthsAfterContract !== undefined) v = contract + m.monthsAfterContract;
    else if (m.daysAfterContract !== undefined) v = contract + Math.round(m.daysAfterContract / 30);
    else if (m.advance) v = start;
    else if (isCertificate(m)) {
      v = certBase ?? (handover ?? prevMax) + 12;
      if (v <= prevMax) v = prevMax + 1;
    } else if (isHandover(m)) {
      if (handover === undefined) {
        handover = handoverBase === undefined ? prevMax : handoverBase > prevMax ? handoverBase : prevMax + 1;
      }
      v = handover;
    } else v = prevMax;
    prevMax = Math.max(prevMax, v);
    return v;
  });
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

/** Giá công bố sau khi áp các tùy chọn đơn giá (VD bàn giao hoàn thiện +7%) */
export function applyPriceOptions(
  project: Project,
  listPrice: number,
  chosen: Record<string, number> = {},
): number {
  let factor = 1;
  for (const o of project.priceOptions ?? []) {
    const choice = o.choices[chosen[o.id] ?? o.default] ?? o.choices[o.default];
    factor *= 1 + (choice?.percent ?? 0);
  }
  return round(listPrice * factor);
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
  const months = resolveMonths(method.milestones, input.timeline ?? {});
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
      month: months[i] === undefined ? undefined : monthKey(months[i]),
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
      ? estimateLoan(method.loan, bankPays, input.rateAfter, input.termYears, input.loanType)
      : undefined,
  };
}

/**
 * Mô phỏng khoản vay theo tháng.
 * - Trong thời gian hỗ trợ: khách trả lãi theo LS khách (customerRate), CĐT bù phần chênh tới LS thả nổi giả định.
 * - Ân hạn gốc: các tháng đầu chỉ trả lãi.
 * - "declining" (dư nợ giảm dần): gốc chia đều cho số tháng còn lại sau ân hạn, lãi tính trên dư nợ.
 * - "annuity" (trả góp đều): gốc + lãi bằng nhau mỗi tháng; tính lại số tiền góp khi hết ân hạn
 *   và khi lãi suất đổi (hết thời gian hỗ trợ), như cách ngân hàng áp dụng với lãi thả nổi.
 */
export function estimateLoan(
  loan: Loan,
  amount: number,
  rateAfter = loan.rateAfter,
  termYears = loan.termYears,
  type: LoanType = "declining",
): LoanEstimate {
  const months = Math.max(1, Math.round(termYears * 12));
  const graceMonths = Math.min(loan.gracePrincipalMonths, months - 1);
  const evenPrincipal = amount / (months - graceMonths);

  const schedule: LoanRow[] = [];
  let outstanding = amount;
  let supportValue = 0;
  let annuityPayment = 0;
  let annuityRate: number | undefined;

  for (let m = 1; m <= months; m++) {
    const supported = m <= loan.supportMonths;
    const rate = supported ? loan.customerRate : rateAfter;
    const interest = (outstanding * rate) / 12;
    if (supported) supportValue += (outstanding * Math.max(rateAfter - loan.customerRate, 0)) / 12;

    let principal = 0;
    if (m > graceMonths) {
      if (m === months) principal = outstanding;
      else if (type === "declining") principal = Math.min(evenPrincipal, outstanding);
      else {
        if (annuityRate !== rate) {
          // Bắt đầu trả gốc hoặc lãi suất vừa đổi: tính lại số tiền góp đều trên dư nợ và số tháng còn lại
          const remaining = months - m + 1;
          const r = rate / 12;
          annuityPayment = r === 0 ? outstanding / remaining : (outstanding * r) / (1 - Math.pow(1 + r, -remaining));
          annuityRate = rate;
        }
        principal = Math.min(Math.max(annuityPayment - interest, 0), outstanding);
      }
    }

    const opening = outstanding;
    outstanding -= principal;
    schedule.push({
      month: m,
      opening: round(opening),
      principal: round(principal),
      interest: round(interest),
      payment: round(principal + interest),
      closing: round(Math.max(outstanding, 0)),
      rate,
      supported,
    });
  }

  const afterSupport = schedule[Math.min(loan.supportMonths, months - 1)];
  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);

  return {
    type,
    amount,
    bank: loan.bank,
    policy: loan.policy,
    supportMonths: loan.supportMonths,
    customerRate: loan.customerRate,
    termYears,
    rateAfter,
    graceMonths,
    monthlyDuringSupport: loan.supportMonths > 0 ? schedule[0].payment : 0,
    firstFullPayment: afterSupport.payment,
    supportValue: round(supportValue),
    totalInterest,
    totalPayment: totalInterest + amount,
    maxPayment: Math.max(...schedule.map((r) => r.payment)),
    schedule,
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

export type CashFlowRow = {
  /** YYYY-MM */
  month: string;
  /** Các sự kiện trong tháng (đợt thanh toán, giải ngân, mốc vay) */
  events: string[];
  /** Đóng cho chủ đầu tư */
  developer: number;
  /** Trả ngân hàng (gốc + lãi khách tự trả) */
  bank: number;
  spend: number;
  /** Tổng đã chi tới hết tháng */
  cumSpend: number;
  /** Số dư = tiền mặt + tiền để dành lũy kế − tổng đã chi */
  balance: number;
};

export type CashFlow = {
  rows: CashFlowRow[];
  /** Tổng khách tự đóng cho chủ đầu tư tới hết đợt bàn giao */
  toHandover: number;
  minBalance: number;
  minMonth: string;
  /** Tháng đầu tiên số dư âm */
  firstShortMonth?: string;
  /** Tiền để dành mỗi tháng tối thiểu để không tháng nào thiếu (với tiền mặt hiện có) */
  neededSaving: number;
  /** Tiền mặt còn thiếu ngay trong tháng bắt đầu — để dành thêm không bù được */
  shortNow: number;
};

/**
 * Dòng tiền từng tháng của khách: các đợt đóng cho CĐT, tiền trả ngân hàng sau giải ngân,
 * so với tiền mặt hiện có + tiền để dành mỗi tháng (bắt đầu từ tháng sau tháng bắt đầu).
 * undefined nếu chưa biết tháng của các đợt (chưa có tháng ký HĐMB).
 */
export function cashFlow(
  quote: Quote,
  opts: { start: string; cash: number; saving: number },
): CashFlow | undefined {
  const start = monthIndex(opts.start);
  if (start === undefined || quote.schedule.some((r) => r.month === undefined)) return undefined;
  // Đợt đã qua (tháng trước tháng bắt đầu) coi như đến hạn ngay tháng bắt đầu
  const at = (r: ScheduleRow) => Math.max(monthIndex(r.month) ?? start, start);

  const events = new Map<number, string[]>();
  const addEvent = (t: number, text: string) => events.set(t, [...(events.get(t) ?? []), text]);
  const developer = new Map<number, number>();
  let disbursedAt: number | undefined;
  let handoverAt: number | undefined;
  let last = start;
  for (const r of quote.schedule) {
    const t = at(r);
    last = Math.max(last, t);
    if (r.includesMaintenance && handoverAt === undefined) handoverAt = t;
    if (r.payer === "bank") {
      disbursedAt = Math.max(disbursedAt ?? t, t);
      addEvent(t, `${r.label}: ngân hàng giải ngân`);
    } else {
      developer.set(t, (developer.get(t) ?? 0) + r.amount);
      addEvent(t, r.label);
    }
  }
  handoverAt ??= last;

  const loan = quote.loan;
  const repay = new Map<number, number>();
  let end = last;
  if (loan && disbursedAt !== undefined) {
    for (const row of loan.schedule) repay.set(disbursedAt + row.month, row.payment);
    if (loan.supportMonths > 0) addEvent(disbursedAt + loan.supportMonths + 1, "Hết thời gian hỗ trợ lãi suất");
    addEvent(disbursedAt + loan.graceMonths + 1, "Bắt đầu trả gốc");
    end = Math.max(end, disbursedAt + Math.max(loan.supportMonths, loan.graceMonths) + 12);
  }
  end = Math.min(end, start + 120);

  const rows: CashFlowRow[] = [];
  let cum = 0;
  let toHandover = 0;
  let minBalance = Infinity;
  let minMonth = monthKey(start);
  let firstShortMonth: string | undefined;
  let neededSaving = 0;
  let shortNow = 0;
  for (let t = start; t <= end; t++) {
    const dev = developer.get(t) ?? 0;
    const bank = repay.get(t) ?? 0;
    if (t <= handoverAt) toHandover += dev;
    cum += dev + bank;
    const n = t - start;
    const balance = opts.cash + opts.saving * n - cum;
    if (n === 0) shortNow = Math.max(0, cum - opts.cash);
    else neededSaving = Math.max(neededSaving, (cum - opts.cash) / n);
    if (balance < minBalance) {
      minBalance = balance;
      minMonth = monthKey(t);
    }
    if (balance < 0 && firstShortMonth === undefined) firstShortMonth = monthKey(t);
    rows.push({
      month: monthKey(t),
      events: events.get(t) ?? [],
      developer: dev,
      bank,
      spend: dev + bank,
      cumSpend: cum,
      balance,
    });
  }
  return { rows, toHandover, minBalance, minMonth, firstShortMonth, neededSaving: Math.ceil(neededSaving), shortNow };
}

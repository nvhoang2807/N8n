"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeQuote,
  formatDate,
  formatPercent,
  formatShort,
  formatVnd,
  unitListPrice,
  type Quote,
} from "@/lib/calc.ts";
import type { PaymentMethod, Project, Unit } from "@/lib/types";

type State = {
  unitCode: string;
  /** Đơn giá/m² nhân viên nhập; rỗng = dùng giá mặc định */
  unitPrice: string;
  methodId: string;
  optional: Record<string, number>;
  contractDate: string;
  rateAfter: string;
  termYears: string;
  customer: string;
};

const ADVISOR_KEY = "advisor";

function initialState(project: Project): State {
  return {
    unitCode: project.units[0]?.code ?? "",
    unitPrice: "",
    methodId: project.methods[0]?.id ?? "",
    optional: Object.fromEntries(project.optionalDiscounts.map((d) => [d.id, d.default])),
    contractDate: "",
    rateAfter: "",
    termYears: "",
    customer: "",
  };
}

/** Đọc trạng thái từ URL để nhân viên gửi link cho khách */
function stateFromUrl(project: Project): State {
  const q = new URLSearchParams(window.location.search);
  const s = initialState(project);
  const unit = q.get("u");
  if (unit && project.units.some((u) => u.code === unit)) s.unitCode = unit;
  const method = q.get("m");
  if (method && project.methods.some((m) => m.id === method)) s.methodId = method;
  s.unitPrice = q.get("dg") ?? "";
  s.contractDate = q.get("hd") ?? "";
  s.customer = q.get("kh") ?? "";
  for (const d of project.optionalDiscounts) {
    const v = Number(q.get(`ck_${d.id}`));
    if (d.options.includes(v)) s.optional[d.id] = v;
  }
  return s;
}

function stateToUrl(s: State): string {
  const q = new URLSearchParams();
  if (s.unitCode) q.set("u", s.unitCode);
  if (s.unitPrice) q.set("dg", s.unitPrice);
  q.set("m", s.methodId);
  for (const [k, v] of Object.entries(s.optional)) if (v) q.set(`ck_${k}`, String(v));
  if (s.contractDate) q.set("hd", s.contractDate);
  if (s.customer) q.set("kh", s.customer);
  return `${window.location.pathname}?${q.toString()}`;
}

const digits = (v: string) => v.replace(/\D/g, "");

export default function Calculator({
  project,
  projectList,
}: {
  project: Project;
  projectList: { id: string; name: string }[];
}) {
  const [state, setState] = useState<State | null>(null);
  const [advisor, setAdvisor] = useState({ name: "", phone: "" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setState(stateFromUrl(project));
    try {
      const saved = localStorage.getItem(ADVISOR_KEY);
      if (saved) setAdvisor(JSON.parse(saved));
    } catch {}
  }, [project]);

  useEffect(() => {
    if (state) window.history.replaceState(null, "", stateToUrl(state));
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(ADVISOR_KEY, JSON.stringify(advisor));
    } catch {}
  }, [advisor]);

  const unit: Unit | undefined = state
    ? project.units.find((u) => u.code.toLowerCase() === state.unitCode.trim().toLowerCase())
    : undefined;

  const perM2 = state?.unitPrice ? Number(state.unitPrice) : undefined;
  const listPrice = unit ? unitListPrice(project, unit, perM2) : 0;

  const quotes = useMemo(() => {
    if (!state || !unit || listPrice <= 0) return [];
    const contractDate = state.contractDate ? new Date(`${state.contractDate}T00:00:00`) : undefined;
    return project.methods.map((m) => ({
      method: m,
      quote: computeQuote(project, m, {
        listPrice,
        netArea: unit.netArea,
        optionalDiscounts: state.optional,
        contractDate,
        rateAfter: state.rateAfter ? Number(state.rateAfter) / 100 : undefined,
        termYears: state.termYears ? Number(state.termYears) : undefined,
      }),
    }));
  }, [state, project, unit, listPrice]);

  if (!state) return <main className="page" />;

  const update = (patch: Partial<State>) => setState((s) => (s ? { ...s, ...patch } : s));
  const selected = quotes.find((q) => q.method.id === state.methodId) ?? quotes[0];
  const fixedPrice = unit?.price !== undefined && !state.unitPrice;
  const defaultPerM2 = unit ? project.defaultUnitPrice[unit.type] : undefined;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <main className="page">
      <header className="top hero">
        <div>
          <p className="eyebrow">Bảng tạm tính chi tiết giá trị HĐMB</p>
          <h1>{project.name}</h1>
          <p className="muted">
            {project.developer}
            {project.description ? ` · ${project.description}` : ""}
          </p>
        </div>
        <div className="actions no-print">
          <button onClick={copyLink}>{copied ? "Đã sao chép ✓" : "Sao chép link"}</button>
          <button className="primary" onClick={() => window.print()}>
            In / Lưu PDF
          </button>
        </div>
      </header>

      <section className="card no-print">
        <h2>
          <span className="step">1</span>Chọn dự án & căn hộ
        </h2>
        <div className="grid">
          <label>
            Dự án
            <select
              value={project.id}
              onChange={(e) => {
                const q = state.customer ? `?kh=${encodeURIComponent(state.customer)}` : "";
                window.location.href = `/${e.target.value}${q}`;
              }}
            >
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mã căn
            <input
              list="unit-codes"
              value={state.unitCode}
              placeholder="VD: A-04-01"
              onChange={(e) => update({ unitCode: e.target.value.toUpperCase(), unitPrice: "" })}
            />
            <datalist id="unit-codes">
              {project.units.map((u) => (
                <option key={u.code} value={u.code}>
                  {`${project.unitTypes[u.type] ?? u.type} · ${u.bedrooms ?? "?"}PN · ${u.grossArea} m²`}
                </option>
              ))}
            </datalist>
          </label>
          {unit && !fixedPrice && (
            <label>
              Đơn giá (đ/m² tim tường)
              <input
                inputMode="numeric"
                value={formatVnd(Number(state.unitPrice || defaultPerM2 || 0))}
                onChange={(e) => update({ unitPrice: digits(e.target.value) })}
              />
              {!state.unitPrice && defaultPerM2 ? (
                <small className="muted">Đơn giá tham khảo theo loại căn — sửa theo bảng giá thực tế</small>
              ) : null}
            </label>
          )}
          {project.optionalDiscounts.map((d) => (
            <label key={d.id}>
              {d.label}
              <select
                value={state.optional[d.id] ?? d.default}
                onChange={(e) => update({ optional: { ...state.optional, [d.id]: Number(e.target.value) } })}
              >
                {d.options.map((o) => (
                  <option key={o} value={o}>
                    {o === 0 ? "Không áp dụng" : formatPercent(o)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Tên khách hàng (tùy chọn)
            <input value={state.customer} onChange={(e) => update({ customer: e.target.value })} />
          </label>
          <label>
            Ngày ký HĐMB dự kiến (tùy chọn)
            <input
              type="date"
              value={state.contractDate}
              onChange={(e) => update({ contractDate: e.target.value })}
            />
          </label>
        </div>
        {!unit && state.unitCode && <p className="warn">Không tìm thấy mã căn “{state.unitCode}”.</p>}
      </section>

      {unit && (
        <section className="card unit">
          <UnitFacts project={project} unit={unit} customer={state.customer} />
        </section>
      )}

      {quotes.length > 0 && (
        <section className="card no-print">
          <h2>
            <span className="step">2</span>So sánh phương thức thanh toán
          </h2>
          <p className="muted">
            Bấm vào một PTTT để xem chi tiết. “Tiết kiệm” so với PTTT có tổng giá trị HĐMB cao nhất.
          </p>
          <Compare
            quotes={quotes}
            selectedId={selected.method.id}
            onSelect={(id) => update({ methodId: id })}
          />
        </section>
      )}

      {selected && (
        <>
          <section className="card">
            <h2>
              <span className="step no-print">3</span>Chi tiết giá trị — {selected.method.name}
            </h2>
            <p className="muted">{selected.method.summary}</p>
            <Breakdown project={project} quote={selected.quote} />
          </section>

          <section className="card">
            <h2>Lịch thanh toán</h2>
            <Schedule quote={selected.quote} showDates={!!state.contractDate} />
          </section>

          {selected.quote.loan && (
            <section className="card">
              <LoanBox
                method={selected.method}
                quote={selected.quote}
                rateAfter={state.rateAfter}
                termYears={state.termYears}
                onChange={update}
              />
            </section>
          )}
        </>
      )}

      <section className="card notes">
        <h2>Ghi chú</h2>
        <ul>
          {(project.notes ?? []).map((n) => (
            <li key={n}>{n}</li>
          ))}
          <li>Bảng tính được lập ngày {new Intl.DateTimeFormat("vi-VN").format(new Date())}.</li>
        </ul>
        <div className="advisor">
          <label className="no-print">
            Chuyên viên tư vấn
            <input value={advisor.name} onChange={(e) => setAdvisor({ ...advisor, name: e.target.value })} />
          </label>
          <label className="no-print">
            Số điện thoại
            <input
              inputMode="tel"
              value={advisor.phone}
              onChange={(e) => setAdvisor({ ...advisor, phone: e.target.value })}
            />
          </label>
          {(advisor.name || advisor.phone) && (
            <p className="print-only">
              Chuyên viên tư vấn: <strong>{advisor.name}</strong> {advisor.phone && `· ${advisor.phone}`}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function UnitFacts({ project, unit, customer }: { project: Project; unit: Unit; customer: string }) {
  const facts: [string, string][] = [
    ["Mã căn", unit.code],
    ["Loại", project.unitTypes[unit.type] ?? unit.type],
    ["Phòng ngủ", unit.bedrooms !== undefined ? String(unit.bedrooms) : "—"],
    ["WC", unit.bathrooms !== undefined ? String(unit.bathrooms) : "—"],
    ["Hướng", unit.direction ?? "—"],
    ["DT tim tường", `${unit.grossArea} m²`],
    ["DT thông thủy", `${unit.netArea} m²`],
  ];
  return (
    <>
      {customer && (
        <p className="customer">
          Kính gửi Quý khách: <strong>{customer}</strong>
        </p>
      )}
      <dl className="facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function Compare({
  quotes,
  selectedId,
  onSelect,
}: {
  quotes: { method: PaymentMethod; quote: Quote }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const maxTotal = Math.max(...quotes.map((q) => q.quote.total));
  return (
    <div className="table-wrap">
      <table className="compare stack">
        <thead>
          <tr>
            <th>PTTT</th>
            <th className="num">Tổng giá trị HĐMB</th>
            <th className="num">Tiết kiệm</th>
            <th className="num">Đến khi ký HĐMB</th>
            <th className="num">Ngân hàng cho vay</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map(({ method, quote }) => {
            // Vốn khách cần chuẩn bị tới hết Đợt 1 (ký HĐMB)
            const firstIdx = quote.schedule.findIndex((r) => r.label === "Đợt 1");
            const upfront = quote.schedule
              .slice(0, firstIdx >= 0 ? firstIdx + 1 : 1)
              .filter((r) => r.payer === "customer")
              .reduce((s, r) => s + r.amount, 0);
            const saving = maxTotal - quote.total;
            return (
              <tr
                key={method.id}
                className={method.id === selectedId ? "selected" : ""}
                onClick={() => onSelect(method.id)}
              >
                <td>
                  <strong>{method.name}</strong>
                  <div className="muted small">{method.summary}</div>
                </td>
                <td className="num" data-label="Tổng giá trị HĐMB">{formatShort(quote.total)}</td>
                <td className="num good" data-label="Tiết kiệm">{saving > 0 ? `−${formatShort(saving)}` : "—"}</td>
                <td className="num" data-label="Đến khi ký HĐMB">{formatShort(upfront)}</td>
                <td className="num" data-label="Ngân hàng cho vay">{quote.bankPays > 0 ? formatShort(quote.bankPays) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Breakdown({ project, quote }: { project: Project; quote: Quote }) {
  const rows: { label: string; value: number; strong?: boolean; minus?: boolean }[] = [
    { label: "Giá công bố (chưa VAT, chưa phí bảo trì)", value: quote.listPrice },
    ...quote.discounts.map((d) => ({
      label: `${d.label} (${formatPercent(d.percent)})`,
      value: d.amount,
      minus: true,
    })),
    { label: "Giá sau chiết khấu (chưa VAT, chưa phí bảo trì)", value: quote.netPrice, strong: true },
  ];
  if (quote.landValue > 0) rows.push({ label: "Giá trị tiền sử dụng đất (không chịu VAT)", value: quote.landValue });
  rows.push(
    { label: `Thuế VAT ${formatPercent(project.vatRate)}`, value: quote.vat },
    { label: "Giá căn hộ gồm VAT (chưa phí bảo trì)", value: quote.priceWithVat, strong: true },
    { label: `Phí bảo trì ${formatPercent(project.maintenanceRate)}`, value: quote.maintenance },
  );
  return (
    <>
      <div className="table-wrap">
        <table>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.strong ? "strong" : ""}>
                <td>{r.label}</td>
                <td className={`num ${r.minus ? "good" : ""}`}>
                  {r.minus ? "−" : ""}
                  {formatVnd(r.value)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Tổng giá trị HĐMB (gồm VAT & phí bảo trì)</td>
              <td className="num">{formatVnd(quote.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="kpis">
        <div className="kpi-main">
          <span>Tổng giá trị HĐMB</span>
          <strong>{formatShort(quote.total)}</strong>
        </div>
        <div>
          <span>Tổng chiết khấu</span>
          <strong className="good">{formatShort(quote.totalDiscount)}</strong>
        </div>
        <div>
          <span>Khách tự thanh toán</span>
          <strong>{formatShort(quote.customerPays)}</strong>
        </div>
        {quote.bankPays > 0 && (
          <div>
            <span>Ngân hàng giải ngân</span>
            <strong>{formatShort(quote.bankPays)}</strong>
          </div>
        )}
      </div>
    </>
  );
}

function Schedule({ quote, showDates }: { quote: Quote; showDates: boolean }) {
  return (
    <div className="table-wrap">
      <table className="schedule stack">
        <thead>
          <tr>
            <th>Đợt</th>
            <th>Thời điểm thanh toán</th>
            {showDates && <th>Dự kiến</th>}
            <th className="num">Tỷ lệ</th>
            <th className="num">Giá trị (đ)</th>
            <th className="num">Lũy kế</th>
          </tr>
        </thead>
        <tbody>
          {quote.schedule.map((r) => (
            <tr key={r.index} className={r.payer === "bank" ? "bank" : ""}>
              <td className="nowrap">
                <strong>{r.label}</strong>
              </td>
              <td className="due">
                {r.due}
                {r.note && <div className="muted small">{r.note}</div>}
                {r.payer === "bank" && <span className="tag">Ngân hàng giải ngân</span>}
              </td>
              {showDates && <td data-label="Dự kiến">{r.dueDate ? formatDate(r.dueDate) : "—"}</td>}
              <td className="num" data-label="Tỷ lệ">{r.percent !== undefined ? formatPercent(r.percent) : "—"}</td>
              <td className="num amount" data-label="Giá trị (đ)">{formatVnd(r.amount)}</td>
              <td className="num muted" data-label="Lũy kế">{formatPercent(r.cumulative / quote.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={showDates ? 4 : 3}>Tổng cộng</td>
            <td className="num" data-label="Tổng cộng">{formatVnd(quote.total - quote.mismatch)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      {quote.mismatch !== 0 && (
        <p className="warn">Cấu hình tiến độ lệch {formatVnd(quote.mismatch)} đ so với tổng giá trị HĐMB.</p>
      )}
    </div>
  );
}

function LoanBox({
  method,
  quote,
  rateAfter,
  termYears,
  onChange,
}: {
  method: PaymentMethod;
  quote: Quote;
  rateAfter: string;
  termYears: string;
  onChange: (patch: Partial<State>) => void;
}) {
  const loan = quote.loan!;
  return (
    <>
      <h2>Ước tính khoản vay — {method.name}</h2>
      <p>{loan.policy}</p>
      <div className="grid no-print">
        <label>
          Lãi suất thả nổi giả định sau ưu đãi (%/năm)
          <input
            inputMode="decimal"
            value={rateAfter || String(Math.round(loan.rateAfter * 1000) / 10)}
            onChange={(e) => onChange({ rateAfter: e.target.value.replace(",", ".") })}
          />
        </label>
        <label>
          Thời hạn vay (năm)
          <input
            inputMode="numeric"
            value={termYears || String(loan.termYears)}
            onChange={(e) => onChange({ termYears: digits(e.target.value) })}
          />
        </label>
      </div>
      <div className="kpis">
        <div>
          <span>Số tiền vay</span>
          <strong>{formatShort(loan.amount)}</strong>
        </div>
        <div>
          <span>
            Khách trả tháng đầu ({loan.supportMonths} tháng ưu đãi
            {loan.customerRate > 0 ? `, LS ${formatPercent(loan.customerRate)}` : ""})
          </span>
          <strong>{loan.monthlyDuringSupport > 0 ? `${formatShort(loan.monthlyDuringSupport)}/tháng` : "0 đ"}</strong>
        </div>
        <div>
          <span>Tháng đầu sau ưu đãi (gốc + lãi)</span>
          <strong>{formatShort(loan.firstFullPayment)}/tháng</strong>
        </div>
        <div>
          <span>CĐT hỗ trợ lãi (ước tính)</span>
          <strong className="good">{formatShort(loan.supportValue)}</strong>
        </div>
      </div>
      <p className="muted small">
        Giả định: vay {loan.termYears} năm, dư nợ giảm dần
        {loan.graceMonths > 0 ? `, ân hạn gốc ${loan.graceMonths} tháng` : ", trả gốc từ tháng đầu"}, lãi suất thả nổi{" "}
        {formatPercent(loan.rateAfter)}/năm. Số liệu thực tế theo thẩm định của ngân hàng.
      </p>
    </>
  );
}

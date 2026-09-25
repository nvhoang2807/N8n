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
import { projectColorVars } from "@/lib/color.ts";
import { fromPercentText, parseNumber, toPercentText } from "@/lib/numbers.ts";
import UnitPicker, { normalizeCode } from "./UnitPicker";
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
  /** Căn nhập tay (dự án cho phép căn ngoài danh sách): loại, DT thông thủy, DT tim tường */
  customType: string;
  customNet: string;
  customGross: string;
  /** CK PTTT áp dụng cho khách (chuỗi %), theo id PTTT */
  methodDiscount: Record<string, string>;
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
    customType: Object.keys(project.unitTypes)[0] ?? "",
    customNet: "",
    customGross: "",
    methodDiscount: {},
  };
}

/** Đọc trạng thái từ URL để nhân viên gửi link cho khách */
function stateFromUrl(project: Project): State {
  const q = new URLSearchParams(window.location.search);
  const s = initialState(project);
  const unit = q.get("u");
  if (unit && (project.customUnits || findUnit(project, unit))) s.unitCode = unit;
  if (project.customUnits) {
    const type = q.get("lc");
    if (type && project.unitTypes[type]) s.customType = type;
    s.customNet = q.get("tt") ?? "";
    s.customGross = q.get("tim") ?? "";
  }
  if (project.adjustableMethodDiscount) {
    for (const m of project.methods) {
      const v = q.get(`ckm_${m.id}`);
      if (v) s.methodDiscount[m.id] = v;
    }
  }
  const method = q.get("m");
  if (method && project.methods.some((m) => m.id === method)) s.methodId = method;
  s.unitPrice = q.get("dg") ?? "";
  s.contractDate = q.get("hd") ?? "";
  s.customer = q.get("kh") ?? "";
  for (const d of project.optionalDiscounts) {
    const raw = q.get(`ck_${d.id}`);
    if (raw !== null && d.options.includes(Number(raw))) s.optional[d.id] = Number(raw);
  }
  return s;
}

function stateToUrl(project: Project, s: State): string {
  const q = new URLSearchParams();
  if (s.unitCode) q.set("u", s.unitCode);
  if (s.unitPrice) q.set("dg", s.unitPrice);
  q.set("m", s.methodId);
  // Chỉ ghi mức khác mặc định (kể cả 0 khi mặc định khác 0)
  for (const d of project.optionalDiscounts) {
    const v = s.optional[d.id] ?? d.default;
    if (v !== d.default) q.set(`ck_${d.id}`, String(v));
  }
  if (s.contractDate) q.set("hd", s.contractDate);
  if (s.customer) q.set("kh", s.customer);
  if (s.customNet) q.set("tt", s.customNet);
  if (s.customGross) q.set("tim", s.customGross);
  if (s.customNet || s.customGross) q.set("lc", s.customType);
  for (const [k, v] of Object.entries(s.methodDiscount)) if (v) q.set(`ckm_${k}`, v);
  return `${window.location.pathname}?${q.toString()}`;
}

const digits = (v: string) => v.replace(/\D/g, "");

/** Vị trí đợt ký HĐMB: đợt cuối có mốc 0 tháng sau HĐMB; không có thì đợt "Đợt 1" */
function contractMilestoneIndex(method: PaymentMethod): number {
  const ms = method.milestones;
  for (let i = ms.length - 1; i >= 0; i--) if (ms[i].monthsAfterContract === 0) return i;
  const first = ms.findIndex((m) => m.label === "Đợt 1");
  return first >= 0 ? first : 0;
}

const DEFAULT_TOTAL_LABEL = "Tổng giá trị HĐMB";
const totalLabelOf = (project: Project) => project.totalLabel?.trim() || DEFAULT_TOTAL_LABEL;

const pricedAreaOf = (project: Project, u: Unit) => (project.priceArea === "net" ? u.netArea : u.grossArea);

/** Tìm căn theo mã, bỏ qua hoa/thường, dấu gạch và khoảng trắng ("b0602" → B-06-02) */
function findUnit(project: Project, code: string): Unit | undefined {
  const q = normalizeCode(code);
  if (!q) return undefined;
  return (
    project.units.find((u) => u.code.toLowerCase() === code.trim().toLowerCase()) ??
    project.units.find((u) => normalizeCode(u.code) === q)
  );
}

/** Căn nhân viên tự nhập; chỉ hợp lệ khi đã có diện tích dùng để tính giá */
function customUnit(project: Project, s: State): Unit | undefined {
  const u: Unit = {
    code: s.unitCode.trim() || "—",
    type: s.customType,
    netArea: parseNumber(s.customNet) ?? 0,
    grossArea: parseNumber(s.customGross) ?? 0,
  };
  return pricedAreaOf(project, u) > 0 ? u : undefined;
}

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setState(stateFromUrl(project));
    try {
      const saved = localStorage.getItem(ADVISOR_KEY);
      if (saved) setAdvisor(JSON.parse(saved));
    } catch {}
  }, [project]);

  useEffect(() => {
    if (state) window.history.replaceState(null, "", stateToUrl(project, state));
  }, [state, project]);

  useEffect(() => {
    try {
      localStorage.setItem(ADVISOR_KEY, JSON.stringify(advisor));
    } catch {}
  }, [advisor]);

  const listedUnit: Unit | undefined = state
    ? findUnit(project, state.unitCode)
    : undefined;
  const customMode = !!state && !listedUnit && !!project.customUnits;
  const unit: Unit | undefined = customMode ? customUnit(project, state) : listedUnit;

  const perM2 = state?.unitPrice ? Number(state.unitPrice) : undefined;
  const listPrice = unit ? unitListPrice(project, unit, perM2) : 0;

  const unitOptions = useMemo(
    () =>
      project.units.map((u) => ({
        code: u.code,
        detail: [
          project.unitTypes[u.type] ?? u.type,
          u.bedrooms !== undefined ? `${u.bedrooms}PN` : "",
          `${pricedAreaOf(project, u)} m²`,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [project],
  );

  const quotes = useMemo(() => {
    if (!state || !unit || listPrice <= 0) return [];
    const contractDate = state.contractDate ? new Date(`${state.contractDate}T00:00:00`) : undefined;
    return project.methods.map((m) => ({
      method: m,
      quote: computeQuote(project, m, {
        listPrice,
        netArea: unit.netArea,
        optionalDiscounts: state.optional,
        methodDiscount: project.adjustableMethodDiscount
          ? fromPercentText(state.methodDiscount[m.id] ?? "")
          : undefined,
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
  const priceType = customMode ? state.customType : unit?.type;
  const defaultPerM2 = priceType ? project.defaultUnitPrice[priceType] : undefined;
  const areaName = project.priceArea === "net" ? "thông thủy" : "tim tường";
  const maxMethodDiscount = selected?.method.discounts[0]?.percent;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // Xuất ảnh PNG giống bản in: chỉ căn hộ + PTTT đang chọn, ẩn ô nhập và bảng so sánh
  const saveImage = async () => {
    if (saving) return;
    setSaving(true);
    const root = document.documentElement;
    root.classList.add("capturing");
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(document.body, {
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
      });
      if (!blob) throw new Error("empty image");
      const name = [project.id, unit?.code, selected?.method.name]
        .filter(Boolean)
        .join("-")
        .replace(/[^\p{L}\p{N}-]+/gu, "-")
        .replace(/^-+|-+$/g, "");
      const file = new File([blob], `${name}.png`, { type: "image/png" });
      if (window.matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: file.name }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      alert("Không tạo được hình, vui lòng thử lại hoặc dùng In / Lưu PDF.");
    } finally {
      root.classList.remove("capturing");
      setSaving(false);
    }
  };

  return (
    <main className="page" style={projectColorVars(project.color)}>
      <header className="top hero">
        <div className="hero-title">
          {project.image && <img src={project.image} alt="" className="project-avatar" />}
          <div>
            <p className="eyebrow">Bảng tạm tính chi tiết giá trị HĐMB</p>
            <h1>{project.name}</h1>
            <p className="muted">
              {[project.developer, project.description].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="actions no-print">
          <button onClick={copyLink}>{copied ? "Đã sao chép ✓" : "Sao chép link"}</button>
          {selected && (
            <button onClick={saveImage} disabled={saving}>
              {saving ? "Đang tạo hình…" : "Tải hình"}
            </button>
          )}
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
            <UnitPicker
              value={state.unitCode}
              options={unitOptions}
              allowCustom={project.customUnits}
              onChange={(code) =>
                update(project.customUnits ? { unitCode: code } : { unitCode: code, unitPrice: "" })
              }
            />
          </label>
          {customMode && (
            <>
              <label>
                Loại căn
                <select value={state.customType} onChange={(e) => update({ customType: e.target.value })}>
                  {Object.entries(project.unitTypes).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                DT thông thủy (m²)
                <input
                  inputMode="decimal"
                  value={state.customNet}
                  placeholder="VD: 130"
                  onChange={(e) => update({ customNet: e.target.value })}
                />
              </label>
              <label>
                DT tim tường (m²)
                <input
                  inputMode="decimal"
                  value={state.customGross}
                  placeholder="VD: 145"
                  onChange={(e) => update({ customGross: e.target.value })}
                />
              </label>
            </>
          )}
          {((unit && !fixedPrice) || customMode) && (
            <label>
              Đơn giá (đ/m² {areaName})
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
        {customMode ? (
          <p className="muted small">
            {project.units.length > 0 && state.unitCode ? `Mã căn “${state.unitCode}” chưa có trong danh sách. ` : ""}
            Nhập loại căn, diện tích và đơn giá để tính. Giá gốc = đơn giá × DT {areaName}.
          </p>
        ) : (
          !unit && state.unitCode && <p className="warn">Không tìm thấy mã căn “{state.unitCode}”.</p>
        )}
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
            Bấm vào một PTTT để xem chi tiết. “Tiết kiệm” so với PTTT có {totalLabelOf(project).toLowerCase()} cao nhất.
          </p>
          <Compare
            totalLabel={totalLabelOf(project)}
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
            {project.adjustableMethodDiscount && maxMethodDiscount !== undefined && (
              <div className="grid no-print">
                <label>
                  CK PTTT áp dụng cho khách (%, tối đa {formatPercent(maxMethodDiscount)})
                  <input
                    inputMode="decimal"
                    value={state.methodDiscount[selected.method.id] ?? toPercentText(maxMethodDiscount)}
                    onChange={(e) =>
                      update({ methodDiscount: { ...state.methodDiscount, [selected.method.id]: e.target.value } })
                    }
                  />
                </label>
              </div>
            )}
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
  const facts = (
    [
      ["Mã căn", unit.code],
      ["Loại", project.unitTypes[unit.type] ?? unit.type],
      ["Phòng ngủ", unit.bedrooms !== undefined ? String(unit.bedrooms) : undefined],
      ["WC", unit.bathrooms !== undefined ? String(unit.bathrooms) : undefined],
      ["Hướng", unit.direction],
      ["DT tim tường", unit.grossArea > 0 ? `${unit.grossArea} m²` : undefined],
      ["DT thông thủy", unit.netArea > 0 ? `${unit.netArea} m²` : undefined],
    ] as [string, string | undefined][]
  ).filter((f): f is [string, string] => !!f[1]);
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
  totalLabel,
}: {
  quotes: { method: PaymentMethod; quote: Quote }[];
  selectedId: string;
  onSelect: (id: string) => void;
  totalLabel: string;
}) {
  const maxTotal = Math.max(...quotes.map((q) => q.quote.total));
  return (
    <div className="table-wrap">
      <table className="compare stack">
        <thead>
          <tr>
            <th>PTTT</th>
            <th className="num">{totalLabel}</th>
            <th className="num">Tiết kiệm</th>
            <th className="num">Đến khi ký HĐMB</th>
            <th className="num">Ngân hàng cho vay</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map(({ method, quote }) => {
            // Vốn khách cần chuẩn bị tới hết đợt ký HĐMB (đợt có mốc 0 tháng sau HĐMB)
            const contractIdx = contractMilestoneIndex(method);
            const upfront = quote.schedule
              .slice(0, contractIdx + 1)
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
                <td className="num" data-label={totalLabel}>{formatShort(quote.total)}</td>
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
              <td>
                {project.totalLabel?.trim() ? totalLabelOf(project) : `${DEFAULT_TOTAL_LABEL} (gồm VAT & phí bảo trì)`}
              </td>
              <td className="num">{formatVnd(quote.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="kpis">
        <div className="kpi-main">
          <span>{totalLabelOf(project)}</span>
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
              <td className="num muted" data-label="Lũy kế">{r.cumulativePercent !== undefined ? formatPercent(r.cumulativePercent) : "—"}</td>
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveProjectAction } from "@/app/admin/actions";
import { computeQuote, formatPercent, formatVnd, unitListPrice } from "@/lib/calc.ts";
import { parseUnitsTable, UNIT_COLUMNS, unitsToTable } from "@/lib/importUnits.ts";
import { blankMethod, blankMilestone, slugify } from "@/lib/templates.ts";
import type { Discount, Loan, Milestone, OptionalDiscount, PaymentMethod, Project, Unit } from "@/lib/types";
import { validateProject } from "@/lib/validate.ts";
import { move, NumberField, PercentField, PercentListField, RowTools } from "./fields";

type Tab = "general" | "units" | "methods";

export default function ProjectEditor({
  initial,
  previousId,
  blobReady,
}: {
  initial: Project;
  /** Mã dự án đang lưu (undefined = dự án mới) */
  previousId?: string;
  blobReady: boolean;
}) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(initial);
  const [savedJson, setSavedJson] = useState(JSON.stringify(initial));
  const [tab, setTab] = useState<Tab>("general");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(project) !== savedJson;
  const { errors, warnings } = useMemo(() => validateProject(project), [project]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (patch: Partial<Project>) => setProject((p) => ({ ...p, ...patch }));

  const save = () => {
    if (errors.length) {
      setShowIssues(true);
      setStatus({ kind: "error", text: "Còn lỗi cần sửa trước khi lưu." });
      return;
    }
    startTransition(async () => {
      const res = await saveProjectAction(project, previousId);
      if (!res.ok) {
        setStatus({ kind: "error", text: res.error });
        return;
      }
      setSavedJson(JSON.stringify(project));
      setStatus({ kind: "ok", text: `Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN")} — trang khách đã cập nhật.` });
      if (project.id !== previousId) router.replace(`/admin/${project.id}`);
    });
  };

  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.id || "du-an"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Project;
      if (!Array.isArray(data.units) || !Array.isArray(data.methods)) throw new Error();
      setProject({ ...data, id: project.id || data.id });
      setStatus({ kind: "ok", text: `Đã nạp ${file.name} — kiểm tra rồi bấm Lưu.` });
    } catch {
      setStatus({ kind: "error", text: "File JSON không đúng định dạng dự án." });
    }
  };

  return (
    <main className="page admin">
      <div className="admin-bar">
        <div>
          <Link href="/admin" className="small">
            ← Danh sách dự án
          </Link>
          <h1>{project.name || "Dự án mới"}</h1>
        </div>
        <div className="actions">
          {previousId && (
            <a className="button" href={`/${previousId}`} target="_blank" rel="noreferrer">
              Xem trang khách ↗
            </a>
          )}
          <button className="primary" onClick={save} disabled={pending || !blobReady || (!dirty && !!previousId)}>
            {pending ? "Đang lưu…" : dirty || !previousId ? "Lưu" : "Đã lưu"}
          </button>
        </div>
      </div>

      {!blobReady && (
        <p className="warn">Chưa kết nối Vercel Blob nên chưa lưu được. Xem hướng dẫn trong README (mục Deploy).</p>
      )}
      {status && <p className={status.kind === "ok" ? "notice ok" : "notice error"} style={{ whiteSpace: "pre-line" }}>{status.text}</p>}

      <button type="button" className={`issues ${errors.length ? "has-errors" : ""}`} onClick={() => setShowIssues((v) => !v)}>
        {errors.length ? `✕ ${errors.length} lỗi` : "✓ Không có lỗi"}
        {warnings.length ? ` · ${warnings.length} lưu ý` : ""} {errors.length + warnings.length ? (showIssues ? "▲" : "▼") : ""}
      </button>
      {showIssues && errors.length + warnings.length > 0 && (
        <ul className="issue-list">
          {errors.map((e) => (
            <li key={e} className="error">{e}</li>
          ))}
          {warnings.map((w) => (
            <li key={w} className="warning">{w}</li>
          ))}
        </ul>
      )}

      <nav className="tabs">
        <button className={tab === "general" ? "active" : ""} onClick={() => setTab("general")}>
          Thông tin chung
        </button>
        <button className={tab === "units" ? "active" : ""} onClick={() => setTab("units")}>
          Căn hộ ({project.units.length})
        </button>
        <button className={tab === "methods" ? "active" : ""} onClick={() => setTab("methods")}>
          Phương thức thanh toán ({project.methods.length})
        </button>
      </nav>

      {tab === "general" && <GeneralTab project={project} update={update} isNew={!previousId} />}
      {tab === "units" && <UnitsTab project={project} update={update} />}
      {tab === "methods" && <MethodsTab project={project} update={update} />}

      <section className="card">
        <h2>Sao lưu</h2>
        <p className="muted small">Tải toàn bộ cấu hình dự án về máy dạng JSON, hoặc nạp lại từ file đã tải.</p>
        <div className="actions">
          <button type="button" onClick={exportJson}>
            Tải file JSON
          </button>
          <label className="button">
            Nạp file JSON
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
            />
          </label>
        </div>
      </section>
    </main>
  );
}

/* ---------------- Thông tin chung ---------------- */

function GeneralTab({
  project,
  update,
  isNew,
}: {
  project: Project;
  update: (p: Partial<Project>) => void;
  isNew: boolean;
}) {
  const types = Object.keys(project.unitTypes);

  const setTypes = (rows: { code: string; label: string; price?: number }[]) =>
    update({
      unitTypes: Object.fromEntries(rows.map((r) => [r.code, r.label])),
      defaultUnitPrice: Object.fromEntries(rows.filter((r) => r.price).map((r) => [r.code, r.price!])),
    });
  const typeRows = types.map((code) => ({
    code,
    label: project.unitTypes[code],
    price: project.defaultUnitPrice[code],
  }));

  const renameType = (index: number, code: string) => {
    const old = typeRows[index].code;
    const rows = typeRows.map((r, i) => (i === index ? { ...r, code } : r));
    update({
      unitTypes: Object.fromEntries(rows.map((r) => [r.code, r.label])),
      defaultUnitPrice: Object.fromEntries(rows.filter((r) => r.price).map((r) => [r.code, r.price!])),
      units: project.units.map((u) => (u.type === old ? { ...u, type: code } : u)),
    });
  };

  const setOptional = (list: OptionalDiscount[]) => update({ optionalDiscounts: list });

  return (
    <>
      <section className="card">
        <h2>Thông tin dự án</h2>
        <div className="grid">
          <label>
            Tên dự án *
            <input
              value={project.name}
              onChange={(e) =>
                update(isNew && (!project.id || project.id === slugify(project.name))
                  ? { name: e.target.value, id: slugify(e.target.value) }
                  : { name: e.target.value })
              }
            />
          </label>
          <label>
            Mã dự án (đường dẫn) *
            <input value={project.id} onChange={(e) => update({ id: slugify(e.target.value) })} />
            <small className="muted">Trang khách: /{project.id || "…"}</small>
          </label>
          <label>
            Chủ đầu tư
            <input value={project.developer} onChange={(e) => update({ developer: e.target.value })} />
          </label>
          <label>
            Vị trí
            <input value={project.location ?? ""} onChange={(e) => update({ location: e.target.value || undefined })} />
          </label>
          <label>
            Tên dòng tổng giá trị
            <input
              value={project.totalLabel ?? ""}
              placeholder="Tổng giá trị HĐMB"
              onChange={(e) => update({ totalLabel: e.target.value || undefined })}
            />
          </label>
          <label>
            Mô tả ngắn
            <input value={project.description ?? ""} onChange={(e) => update({ description: e.target.value || undefined })} />
          </label>
          <label>
            Thứ tự hiển thị
            <NumberField value={project.order} onChange={(v) => update({ order: v })} placeholder="VD: 1" />
          </label>
          <label className="check">
            <input type="checkbox" checked={!!project.hidden} onChange={(e) => update({ hidden: e.target.checked })} />
            Ẩn khỏi trang chủ (vẫn xem được bằng link)
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Thuế & phí</h2>
        <div className="grid">
          <label>
            Thuế VAT
            <PercentField value={project.vatRate} onChange={(v) => update({ vatRate: v ?? 0 })} />
          </label>
          <label>
            Phí bảo trì
            <PercentField value={project.maintenanceRate} onChange={(v) => update({ maintenanceRate: v ?? 0 })} />
          </label>
          <label>
            Đơn giá tiền sử dụng đất (đ/m² thông thủy)
            <NumberField money value={project.landValuePerM2} onChange={(v) => update({ landValuePerM2: v })} placeholder="0 nếu không trừ" />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Cách tính giá</h2>
        <div className="grid">
          <label>
            Giá công bố = đơn giá ×
            <select
              value={project.priceArea ?? "gross"}
              onChange={(e) => update({ priceArea: e.target.value === "net" ? "net" : undefined })}
            >
              <option value="gross">DT tim tường</option>
              <option value="net">DT thông thủy</option>
            </select>
          </label>
          <label>
            Phí bảo trì tính trên
            <select
              value={project.maintenanceBase ?? "net"}
              onChange={(e) => update({ maintenanceBase: e.target.value === "list" ? "list" : undefined })}
            >
              <option value="net">Giá sau chiết khấu</option>
              <option value="list">Giá công bố (trước chiết khấu)</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={!!project.customUnits}
              onChange={(e) => update({ customUnits: e.target.checked || undefined })}
            />
            Cho nhân viên nhập căn ngoài danh sách (tự điền loại, diện tích, đơn giá)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={!!project.adjustableMethodDiscount}
              onChange={(e) => update({ adjustableMethodDiscount: e.target.checked || undefined })}
            />
            Cho nhân viên hạ CK PTTT theo từng khách (không vượt mức đã cấu hình)
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Loại sản phẩm & đơn giá tham khảo</h2>
        <p className="muted small">
          Giá công bố = đơn giá × DT {project.priceArea === "net" ? "thông thủy" : "tim tường"} (khi căn không có giá
          riêng). Nhân viên vẫn sửa được đơn giá khi tư vấn.
        </p>
        <div className="table-wrap">
          <table className="edit-table">
            <thead>
              <tr>
                <th>Mã loại</th>
                <th>Tên hiển thị</th>
                <th>Đơn giá mặc định (đ/m²)</th>
                <th>Số căn</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {typeRows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <input value={r.code} onChange={(e) => renameType(i, e.target.value.toUpperCase())} />
                  </td>
                  <td>
                    <input
                      value={r.label}
                      onChange={(e) => setTypes(typeRows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    />
                  </td>
                  <td>
                    <NumberField
                      money
                      value={r.price}
                      onChange={(v) => setTypes(typeRows.map((x, j) => (j === i ? { ...x, price: v } : x)))}
                    />
                  </td>
                  <td className="num">{project.units.filter((u) => u.type === r.code).length}</td>
                  <td>
                    <RowTools
                      index={i}
                      length={typeRows.length}
                      onMove={(a, b) => setTypes(move(typeRows, a, b))}
                      onRemove={(j) => setTypes(typeRows.filter((_, k) => k !== j))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setTypes([...typeRows, { code: `LOAI${typeRows.length + 1}`, label: "" }])}>
          + Thêm loại
        </button>
      </section>

      <section className="card">
        <h2>Chiết khấu tùy chọn</h2>
        <p className="muted small">
          Chiết khấu nhân viên chọn khi tư vấn, áp dụng cho mọi PTTT (VD: CK sỉ, Early Bird, KH thân thiết). Tính trước chiết khấu của PTTT.
        </p>
        <div className="table-wrap">
          <table className="edit-table">
            <thead>
              <tr>
                <th>Tên chiết khấu</th>
                <th>Các mức cho chọn (%)</th>
                <th>Mặc định</th>
                <th>Tính trên</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {project.optionalDiscounts.map((d, i) => {
                const set = (patch: Partial<OptionalDiscount>) =>
                  setOptional(project.optionalDiscounts.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={i}>
                    <td>
                      <input value={d.label} onChange={(e) => set({ label: e.target.value, id: slugify(e.target.value) || d.id })} />
                    </td>
                    <td>
                      <PercentListField value={d.options} onChange={(options) => set({ options })} />
                    </td>
                    <td>
                      <select value={d.default} onChange={(e) => set({ default: Number(e.target.value) })}>
                        {d.options.map((o) => (
                          <option key={o} value={o}>
                            {formatPercent(o)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <BaseSelect value={d.base} onChange={(base) => set({ base })} />
                    </td>
                    <td>
                      <RowTools
                        index={i}
                        length={project.optionalDiscounts.length}
                        onMove={(a, b) => setOptional(move(project.optionalDiscounts, a, b))}
                        onRemove={(j) => setOptional(project.optionalDiscounts.filter((_, k) => k !== j))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() =>
            setOptional([
              ...project.optionalDiscounts,
              { id: `ck-${project.optionalDiscounts.length + 1}`, label: "", options: [0, 0.01], default: 0, base: "list" },
            ])
          }
        >
          + Thêm chiết khấu tùy chọn
        </button>
      </section>

      <section className="card">
        <h2>Ghi chú hiển thị cho khách</h2>
        <p className="muted small">Mỗi dòng là một ghi chú.</p>
        <textarea
          rows={4}
          value={(project.notes ?? []).join("\n")}
          onChange={(e) => update({ notes: e.target.value.split("\n") })}
          onBlur={(e) => update({ notes: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
        />
      </section>
    </>
  );
}

function BaseSelect({ value, onChange }: { value?: "list" | "running"; onChange: (v: "list" | "running") => void }) {
  return (
    <select value={value ?? "running"} onChange={(e) => onChange(e.target.value as "list" | "running")}>
      <option value="list">Giá công bố</option>
      <option value="running">Giá sau các CK trước</option>
    </select>
  );
}

/* ---------------- Căn hộ ---------------- */

const PAGE_SIZE = 50;

function UnitsTab({ project, update }: { project: Project; update: (p: Partial<Project>) => void }) {
  const [paste, setPaste] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = project.units
    .map((u, index) => ({ u, index }))
    .filter(({ u }) => !query || u.code.toLowerCase().includes(query.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const setUnit = (index: number, patch: Partial<Unit>) =>
    update({ units: project.units.map((u, i) => (i === index ? { ...u, ...patch } : u)) });

  const doImport = (mode: "replace" | "merge") => {
    const { units, skipped } = parseUnitsTable(paste);
    if (units.length === 0) {
      setMessage("Không đọc được căn nào. Hãy copy đúng các cột theo thứ tự bên trên (kể cả dòng tiêu đề cũng được).");
      return;
    }
    let next: Unit[];
    if (mode === "replace") next = units;
    else {
      const byCode = new Map(project.units.map((u) => [u.code, u]));
      for (const u of units) byCode.set(u.code, u);
      next = [...byCode.values()];
    }
    const newTypes = [...new Set(units.map((u) => u.type))].filter((t) => !project.unitTypes[t]);
    update({
      units: next,
      unitTypes: { ...project.unitTypes, ...Object.fromEntries(newTypes.map((t) => [t, t])) },
    });
    setPaste("");
    setPage(0);
    setMessage(
      `Đã nhập ${units.length} căn${mode === "merge" ? " (cập nhật căn trùng mã)" : ""}.` +
        (newTypes.length ? ` Đã thêm loại mới: ${newTypes.join(", ")} — đặt tên & đơn giá ở tab Thông tin chung.` : "") +
        (skipped.length ? ` Bỏ qua ${skipped.length} dòng: ${skipped.slice(0, 5).map((s) => `dòng ${s.line} (${s.reason})`).join(", ")}.` : ""),
    );
  };

  return (
    <>
      <section className="card">
        <h2>Dán danh sách căn từ Excel</h2>
        <p className="muted small">
          Copy các cột theo đúng thứ tự: <strong>{UNIT_COLUMNS.join(" | ")}</strong>. Cột giá công bố để trống nếu tính theo
          đơn giá × DT tim tường.
        </p>
        <textarea
          rows={6}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={"A-04-01\tOT\t1\t1\tĐB\t58,32\t52,04"}
        />
        <div className="actions">
          <button type="button" className="primary" disabled={!paste.trim()} onClick={() => doImport("replace")}>
            Thay toàn bộ danh sách
          </button>
          <button type="button" disabled={!paste.trim()} onClick={() => doImport("merge")}>
            Thêm / cập nhật theo mã căn
          </button>
          <button
            type="button"
            disabled={!project.units.length}
            onClick={async () => {
              await navigator.clipboard.writeText(unitsToTable(project.units));
              setMessage("Đã sao chép danh sách — dán vào Excel để chỉnh rồi dán ngược lại.");
            }}
          >
            Sao chép danh sách hiện tại
          </button>
        </div>
        {message && <p className="notice ok">{message}</p>}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>Danh sách căn ({project.units.length})</h2>
          <input
            className="search"
            placeholder="Tìm mã căn…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="table-wrap">
          <table className="edit-table units">
            <thead>
              <tr>
                <th>Mã căn</th>
                <th>Loại</th>
                <th>PN</th>
                <th>WC</th>
                <th>Hướng</th>
                <th>DT tim tường</th>
                <th>DT thông thủy</th>
                <th>Giá công bố riêng</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ u, index }) => (
                <tr key={index}>
                  <td>
                    <input value={u.code} onChange={(e) => setUnit(index, { code: e.target.value })} />
                  </td>
                  <td>
                    <select value={u.type} onChange={(e) => setUnit(index, { type: e.target.value })}>
                      {Object.entries(project.unitTypes).map(([code, label]) => (
                        <option key={code} value={code}>
                          {label || code}
                        </option>
                      ))}
                      {!project.unitTypes[u.type] && <option value={u.type}>{u.type}</option>}
                    </select>
                  </td>
                  <td>
                    <input
                      className="narrow"
                      value={u.bedrooms ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setUnit(index, { bedrooms: v === "" ? undefined : /^\d+$/.test(v) ? Number(v) : v });
                      }}
                    />
                  </td>
                  <td>
                    <NumberField className="narrow" value={u.bathrooms} onChange={(v) => setUnit(index, { bathrooms: v })} />
                  </td>
                  <td>
                    <input className="narrow" value={u.direction ?? ""} onChange={(e) => setUnit(index, { direction: e.target.value || undefined })} />
                  </td>
                  <td>
                    <NumberField value={u.grossArea} onChange={(v) => setUnit(index, { grossArea: v ?? 0 })} />
                  </td>
                  <td>
                    <NumberField value={u.netArea} onChange={(v) => setUnit(index, { netArea: v ?? 0 })} />
                  </td>
                  <td>
                    <NumberField money value={u.price} onChange={(v) => setUnit(index, { price: v || undefined })} placeholder="theo đơn giá" />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="danger"
                      title="Xóa căn"
                      onClick={() => update({ units: project.units.filter((_, i) => i !== index) })}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row-between">
          <button
            type="button"
            onClick={() => {
              const type = Object.keys(project.unitTypes)[0] ?? "CH";
              update({ units: [...project.units, { code: "", type, grossArea: 0, netArea: 0 }] });
              setQuery("");
              setPage(Math.floor(project.units.length / PAGE_SIZE));
            }}
          >
            + Thêm căn
          </button>
          {pages > 1 && (
            <span className="pager">
              <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
                ‹
              </button>
              Trang {page + 1}/{pages}
              <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                ›
              </button>
            </span>
          )}
        </div>
      </section>
    </>
  );
}

/* ---------------- Phương thức thanh toán ---------------- */

function MethodsTab({ project, update }: { project: Project; update: (p: Partial<Project>) => void }) {
  const [selected, setSelected] = useState(0);
  const methods = project.methods;
  const index = Math.min(selected, methods.length - 1);
  const method = methods[index];

  const setMethods = (list: PaymentMethod[]) => update({ methods: list });
  const setMethod = (patch: Partial<PaymentMethod>) =>
    setMethods(methods.map((m, i) => (i === index ? { ...m, ...patch } : m)));

  const duplicate = (i: number) => {
    const src = methods[i];
    let id = `${src.id}-copy`;
    while (methods.some((m) => m.id === id)) id += "-2";
    const copy = { ...structuredClone(src), id, name: `${src.name} (bản sao)` };
    setMethods([...methods.slice(0, i + 1), copy, ...methods.slice(i + 1)]);
    setSelected(i + 1);
  };

  return (
    <div>
      <section className="card method-list">
        <div className="chips">
          {methods.map((m, i) => (
            <button key={i} type="button" className={i === index ? "chip active" : "chip"} onClick={() => setSelected(i)}>
              {m.name || "(chưa đặt tên)"}
            </button>
          ))}
          <button
            type="button"
            className="chip add"
            onClick={() => {
              setMethods([...methods, blankMethod(methods.map((m) => m.id))]);
              setSelected(methods.length);
            }}
          >
            + Thêm PTTT
          </button>
        </div>
        {method && (
          <div className="row-between">
            <span className="muted small">
              Đang sửa: <strong>{method.name}</strong> ({index + 1}/{methods.length})
            </span>
            <span className="row-tools labeled">
              <button type="button" disabled={index === 0} onClick={() => { setMethods(move(methods, index, index - 1)); setSelected(index - 1); }}>
                ← Chuyển lên
              </button>
              <button type="button" disabled={index === methods.length - 1} onClick={() => { setMethods(move(methods, index, index + 1)); setSelected(index + 1); }}>
                Chuyển xuống →
              </button>
              <button type="button" onClick={() => duplicate(index)}>
                ⧉ Nhân bản PTTT này
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (confirm(`Xóa PTTT "${method.name}"?`)) {
                    setMethods(methods.filter((_, k) => k !== index));
                    setSelected(Math.max(0, index - 1));
                  }
                }}
              >
                ✕ Xóa
              </button>
            </span>
          </div>
        )}
      </section>

      {method ? (
        <div className="method-editor">
          <MethodEditor key={index} project={project} method={method} onChange={setMethod} />
        </div>
      ) : (
        <p className="muted">Chưa có PTTT nào.</p>
      )}
    </div>
  );
}

function MethodEditor({
  project,
  method,
  onChange,
}: {
  project: Project;
  method: PaymentMethod;
  onChange: (patch: Partial<PaymentMethod>) => void;
}) {
  const setDiscounts = (discounts: Discount[]) => onChange({ discounts });
  const setMilestones = (milestones: Milestone[]) => onChange({ milestones });
  const setMilestone = (i: number, patch: Partial<Milestone>) =>
    setMilestones(method.milestones.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const percentTotal = method.milestones.reduce((s, r) => s + (r.advance ? 0 : (r.percent ?? 0)), 0);

  return (
    <>
      <section className="card">
        <h2>Thông tin PTTT</h2>
        <div className="grid">
          <label>
            Tên PTTT *
            <input value={method.name} onChange={(e) => onChange({ name: e.target.value })} />
          </label>
          <label>
            Mã (trong link)
            <input value={method.id} onChange={(e) => onChange({ id: slugify(e.target.value) })} />
          </label>
          <label className="wide">
            Mô tả ưu đãi hiển thị cho khách
            <input value={method.summary} onChange={(e) => onChange({ summary: e.target.value })} placeholder="VD: CK 9.9% tổng giá trị căn hộ" />
          </label>
        </div>

        <h3>Chiết khấu của PTTT</h3>
        <div className="table-wrap">
          <table className="edit-table">
            <thead>
              <tr>
                <th>Tên chiết khấu</th>
                <th>Tỷ lệ</th>
                <th>Tính trên</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {method.discounts.map((d, i) => {
                const set = (patch: Partial<Discount>) =>
                  setDiscounts(method.discounts.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={i}>
                    <td>
                      <input value={d.label} onChange={(e) => set({ label: e.target.value })} />
                    </td>
                    <td>
                      <PercentField value={d.percent} onChange={(v) => set({ percent: v ?? 0 })} />
                    </td>
                    <td>
                      <BaseSelect value={d.base} onChange={(base) => set({ base })} />
                    </td>
                    <td>
                      <RowTools
                        index={i}
                        length={method.discounts.length}
                        onMove={(a, b) => setDiscounts(move(method.discounts, a, b))}
                        onRemove={(j) => setDiscounts(method.discounts.filter((_, k) => k !== j))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setDiscounts([...method.discounts, { label: `Chiết khấu ${method.name}`, percent: 0 }])}
        >
          + Thêm chiết khấu
        </button>
      </section>

      <section className="card">
        <div className="row-between">
          <h2>Các đợt thanh toán</h2>
          <span className={Math.abs(percentTotal - 1) > 1e-6 ? "warn" : "good"}>
            Tổng tỷ lệ: {formatPercent(percentTotal)}
          </span>
        </div>
        <p className="muted small">
          Tỷ lệ tính trên <strong>giá căn hộ gồm VAT (chưa phí bảo trì)</strong>, hoặc trên giá công bố (chưa CK, chưa VAT)
          nếu chọn ở từng đợt. Cọc/VBTT đánh dấu “Ứng trước” sẽ được trừ vào
          đợt kế tiếp có đánh dấu “Trừ ứng trước” và không tính vào tổng 100%.
        </p>
        <div className="table-wrap">
          <table className="edit-table milestones">
            <thead>
              <tr>
                <th>Đợt</th>
                <th>Thời điểm thanh toán</th>
                <th>Ghi chú</th>
                <th>Tỷ lệ</th>
                <th>Hoặc số tiền cố định</th>
                <th title="Cọc / VBTT: sẽ được trừ vào đợt sau">Ứng trước</th>
                <th title="Trừ các khoản ứng trước chưa cấn trừ">Trừ ứng trước</th>
                <th title="Cộng phí bảo trì vào đợt này">+ Phí BT</th>
                <th title="Đợt cuối = tổng HĐMB − các đợt trước">Phần còn lại</th>
                <th title="Ngân hàng giải ngân đợt này">NH giải ngân</th>
                <th title="Số tháng sau ngày ký HĐMB, để ước tính ngày">Tháng sau HĐMB</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {method.milestones.map((m, i) => (
                <tr key={i} className={m.payer === "bank" ? "bank" : ""}>
                  <td>
                    <input className="narrow" value={m.label} onChange={(e) => setMilestone(i, { label: e.target.value })} />
                  </td>
                  <td>
                    <textarea rows={3} value={m.due} onChange={(e) => setMilestone(i, { due: e.target.value })} />
                  </td>
                  <td>
                    <textarea rows={3} value={m.note ?? ""} onChange={(e) => setMilestone(i, { note: e.target.value || undefined })} />
                  </td>
                  <td>
                    <PercentField
                      className="narrow"
                      value={m.amount !== undefined ? undefined : m.percent}
                      onChange={(v) => setMilestone(i, { percent: v, amount: undefined })}
                    />
                    {m.amount === undefined && (
                      <select
                        className="narrow"
                        title="Tỷ lệ tính trên"
                        value={m.percentBase ?? "withVat"}
                        onChange={(e) => setMilestone(i, { percentBase: e.target.value === "list" ? "list" : undefined })}
                      >
                        <option value="withVat">trên giá gồm VAT</option>
                        <option value="list">trên giá công bố</option>
                      </select>
                    )}
                  </td>
                  <td>
                    <NumberField
                      money
                      value={m.amount}
                      placeholder="—"
                      onChange={(v) => setMilestone(i, v === undefined ? { amount: undefined } : { amount: v, percent: undefined })}
                    />
                  </td>
                  <td className="center">
                    <input type="checkbox" checked={!!m.advance} onChange={(e) => setMilestone(i, { advance: e.target.checked || undefined })} />
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={!!m.deductAdvances}
                      onChange={(e) => setMilestone(i, { deductAdvances: e.target.checked || undefined })}
                    />
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={!!m.includeMaintenance}
                      onChange={(e) => setMilestone(i, { includeMaintenance: e.target.checked || undefined })}
                    />
                  </td>
                  <td className="center">
                    <input type="checkbox" checked={!!m.remainder} onChange={(e) => setMilestone(i, { remainder: e.target.checked || undefined })} />
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={m.payer === "bank"}
                      onChange={(e) => setMilestone(i, { payer: e.target.checked ? "bank" : undefined })}
                    />
                  </td>
                  <td>
                    <NumberField
                      className="narrow"
                      value={m.monthsAfterContract}
                      onChange={(v) => setMilestone(i, { monthsAfterContract: v, daysAfterContract: undefined })}
                    />
                  </td>
                  <td>
                    <RowTools
                      index={i}
                      length={method.milestones.length}
                      onMove={(a, b) => setMilestones(move(method.milestones, a, b))}
                      onDuplicate={(j) =>
                        setMilestones([
                          ...method.milestones.slice(0, j + 1),
                          { ...method.milestones[j], remainder: undefined },
                          ...method.milestones.slice(j + 1),
                        ])
                      }
                      onRemove={(j) => setMilestones(method.milestones.filter((_, k) => k !== j))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <button type="button" onClick={() => setMilestones([...method.milestones, blankMilestone(method.milestones.length)])}>
            + Thêm đợt
          </button>
          <button type="button" onClick={() => setMilestones(renumber(method.milestones))}>
            Đánh số lại “Đợt 1, 2, 3…”
          </button>
        </div>
      </section>

      <LoanEditor loan={method.loan} onChange={(loan) => onChange({ loan })} />
      <MethodPreview project={project} method={method} />
    </>
  );
}

/** Đặt lại tên các đợt tỷ lệ thành Đợt 1, 2, 3… (giữ nguyên tên các khoản ứng trước như Cọc, VBTT) */
function renumber(milestones: Milestone[]): Milestone[] {
  let n = 0;
  return milestones.map((m) => (m.advance ? m : { ...m, label: `Đợt ${++n}` }));
}

function LoanEditor({ loan, onChange }: { loan?: Loan; onChange: (loan?: Loan) => void }) {
  const set = (patch: Partial<Loan>) => loan && onChange({ ...loan, ...patch });
  return (
    <section className="card">
      <label className="check">
        <input
          type="checkbox"
          checked={!!loan}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? {
                    bank: "Ngân hàng tài trợ dự án",
                    policy: "CĐT hỗ trợ 100% lãi suất vay trong thời gian 24 tháng",
                    supportMonths: 24,
                    customerRate: 0,
                    termYears: 20,
                    rateAfter: 0.1,
                    gracePrincipalMonths: 24,
                  }
                : undefined,
            )
          }
        />
        <strong>PTTT có vay ngân hàng</strong> (hiện ô ước tính khoản vay cho khách)
      </label>
      {loan && (
        <div className="grid">
          <label className="wide">
            Chính sách hỗ trợ lãi suất (hiển thị cho khách)
            <input value={loan.policy} onChange={(e) => set({ policy: e.target.value })} />
          </label>
          <label>
            Ngân hàng
            <input value={loan.bank ?? ""} onChange={(e) => set({ bank: e.target.value || undefined })} />
          </label>
          <label>
            Số tháng hỗ trợ
            <NumberField value={loan.supportMonths} onChange={(v) => set({ supportMonths: v ?? 0 })} />
          </label>
          <label>
            Lãi suất khách trả trong thời gian hỗ trợ
            <PercentField value={loan.customerRate} onChange={(v) => set({ customerRate: v ?? 0 })} />
            <small className="muted">0% = CĐT hỗ trợ 100%</small>
          </label>
          <label>
            Ân hạn nợ gốc (tháng)
            <NumberField value={loan.gracePrincipalMonths} onChange={(v) => set({ gracePrincipalMonths: v ?? 0 })} />
          </label>
          <label>
            Thời hạn vay giả định (năm)
            <NumberField value={loan.termYears} onChange={(v) => set({ termYears: v ?? 20 })} />
          </label>
          <label>
            Lãi suất thả nổi giả định sau hỗ trợ
            <PercentField value={loan.rateAfter} onChange={(v) => set({ rateAfter: v ?? 0 })} />
          </label>
        </div>
      )}
      {loan && (
        <p className="muted small">
          Số tiền vay = tổng các đợt đánh dấu “NH giải ngân”. Khách xem trang có thể tự chỉnh lãi suất & thời hạn để ước tính.
        </p>
      )}
    </section>
  );
}

function MethodPreview({ project, method }: { project: Project; method: PaymentMethod }) {
  const [code, setCode] = useState(project.units[0]?.code ?? "");
  const [perM2, setPerM2] = useState<number | undefined>();
  const unit = project.units.find((u) => u.code === code) ?? project.units[0];

  if (!unit) return null;
  const listPrice = unitListPrice(project, unit, perM2) || 0;
  const quote =
    listPrice > 0
      ? computeQuote(project, method, {
          listPrice,
          netArea: unit.netArea,
          optionalDiscounts: Object.fromEntries(project.optionalDiscounts.map((d) => [d.id, d.default])),
        })
      : null;

  return (
    <section className="card">
      <h2>Xem trước số tiền</h2>
      <p className="muted small">Đối chiếu với bảng tính Excel của chủ đầu tư trước khi lưu.</p>
      <div className="grid">
        <label>
          Căn
          <input list="preview-units" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <datalist id="preview-units">
            {project.units.slice(0, 1000).map((u) => (
              <option key={u.code} value={u.code} />
            ))}
          </datalist>
        </label>
        {unit.price === undefined && (
          <label>
            Đơn giá thử (đ/m²)
            <NumberField money value={perM2 ?? project.defaultUnitPrice[unit.type]} onChange={setPerM2} />
          </label>
        )}
      </div>
      {quote ? (
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <td>Giá công bố</td>
                <td className="num">{formatVnd(quote.listPrice)}</td>
              </tr>
              {quote.discounts.map((d) => (
                <tr key={d.label}>
                  <td>
                    {d.label} ({formatPercent(d.percent)})
                  </td>
                  <td className="num good">−{formatVnd(d.amount)}</td>
                </tr>
              ))}
              <tr>
                <td>Giá gồm VAT (chưa phí BT)</td>
                <td className="num">{formatVnd(quote.priceWithVat)}</td>
              </tr>
              <tr>
                <td>Phí bảo trì</td>
                <td className="num">{formatVnd(quote.maintenance)}</td>
              </tr>
              {quote.schedule.map((r) => (
                <tr key={r.index} className={r.payer === "bank" ? "bank" : ""}>
                  <td>
                    {r.label}
                    {r.payer === "bank" ? " (ngân hàng)" : ""}
                  </td>
                  <td className="num">{formatVnd(r.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Tổng giá trị HĐMB</td>
                <td className="num">{formatVnd(quote.total)}</td>
              </tr>
            </tfoot>
          </table>
          {quote.mismatch !== 0 && <p className="warn">Tổng các đợt lệch {formatVnd(quote.mismatch)} đ so với tổng HĐMB.</p>}
        </div>
      ) : (
        <p className="muted">Nhập đơn giá để xem trước.</p>
      )}
    </section>
  );
}

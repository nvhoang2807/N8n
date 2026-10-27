"use client";

import { type Quote, cashFlow, formatMonth, formatShort, formatVnd, savingInMonth } from "@/lib/calc.ts";
import { parseNumber } from "@/lib/numbers.ts";

const digits = (v: string) => v.replace(/\D/g, "");
const signed = (n: number) => (n < 0 ? `−${formatVnd(-n)}` : formatVnd(n));
const dash = (n: number) => (n ? formatVnd(n) : "—");

/**
 * Tiền để dành & dòng tiền từng tháng: khách nhập tiền hiện có và số tiền để dành mỗi tháng,
 * bảng chỉ ra từng tháng phải đóng gì (CĐT + trả ngân hàng) và số dư còn lại, tháng nào bắt đầu thiếu.
 */
export default function CashFlowBox({
  quote,
  startMonth,
  cash,
  saving,
  growth,
  growthPer,
  rent,
  onChange,
}: {
  quote: Quote;
  /** Tháng hiện tại (YYYY-MM): tiền mặt có ở tháng này, tiền để dành bắt đầu cộng từ tháng sau */
  startMonth: string;
  cash: string;
  saving: string;
  /** Lũy tiến % của tiền để dành (chuỗi %) và chu kỳ tăng */
  growth: string;
  growthPer: "month" | "year";
  /** Tiền thuê mỗi tháng từ sau bàn giao (chuỗi số VND) */
  rent: string;
  onChange: (patch: { cash?: string; saving?: string; savingGrowth?: string; savingGrowthPer?: "month" | "year"; rent?: string }) => void;
}) {
  const cashN = Number(cash) || 0;
  const savingN = Number(saving) || 0;
  const rentN = Number(rent) || 0;
  const growthRate = Math.max(0, parseNumber(growth) || 0) / 100;
  const flow = cashFlow(quote, {
    start: startMonth,
    cash: cashN,
    saving: savingN,
    growth: growthRate,
    growthPer: growthPer,
    rent: rentN,
  });
  const unit = growthPer === "year" ? "năm" : "tháng";
  // Ví dụ minh họa lũy tiến: tháng 1, 2, 3 (hoặc năm 1, 2, 3)
  const step = (n: number) => savingInMonth(savingN, growthPer === "year" ? 1 + (n - 1) * 12 : n, growthRate, growthPer);

  return (
    <>
      <h2>Tiền để dành & dòng tiền từng tháng</h2>
      <p className="muted">
        Nhập tiền đang có, số tiền để dành mỗi tháng (có thể tăng dần theo lũy tiến %) và tiền thuê nhà sau khi nhận
        để biết có đủ tiền theo từng đợt không. Bảng tính cả tiền trả ngân hàng sau khi giải ngân.
      </p>
      <div className="grid">
        <label>
          Tiền hiện có (đ)
          <input
            inputMode="numeric"
            value={cash ? formatVnd(cashN) : ""}
            placeholder="0"
            onChange={(e) => onChange({ cash: digits(e.target.value) })}
          />
        </label>
        <label>
          Để dành tháng đầu (đ)
          <input
            inputMode="numeric"
            value={saving ? formatVnd(savingN) : ""}
            placeholder="0"
            onChange={(e) => onChange({ saving: digits(e.target.value) })}
          />
        </label>
        <label>
          Lũy tiến tiền để dành (%)
          <div className="inline-fields">
            <input
              inputMode="decimal"
              value={growth}
              placeholder="0"
              onChange={(e) => onChange({ savingGrowth: e.target.value })}
            />
            <select value={growthPer} onChange={(e) => onChange({ savingGrowthPer: e.target.value === "year" ? "year" : "month" })}>
              <option value="month">mỗi tháng</option>
              <option value="year">mỗi năm</option>
            </select>
          </div>
          {growthRate > 0 && savingN > 0 && (
            <small className="muted">
              {unit === "năm" ? "Năm" : "Tháng"} 1: {formatShort(step(1))} → {unit} 2: {formatShort(step(2))} → {unit} 3:{" "}
              {formatShort(step(3))}
            </small>
          )}
        </label>
        <label>
          Tiền thuê mỗi tháng (đ)
          <input
            inputMode="numeric"
            value={rent ? formatVnd(rentN) : ""}
            placeholder="0"
            onChange={(e) => onChange({ rent: digits(e.target.value) })}
          />
          <small className="muted">Nhận từ tháng sau khi nhận nhà</small>
        </label>
      </div>

      {!flow ? (
        <p className="warn">Chọn tháng ký HĐMB dự kiến ở phần trên để xem dòng tiền từng tháng.</p>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi-main">
              <span>Tự có tới nhận nhà</span>
              <strong>{formatShort(flow.toHandover)}</strong>
            </div>
            <div>
              <span>{growthRate > 0 ? "Cần để dành tháng đầu tối thiểu" : "Cần để dành tối thiểu mỗi tháng"}</span>
              <strong>{flow.neededSaving > 0 ? formatShort(flow.neededSaving) : "Không cần"}</strong>
            </div>
            <div>
              <span>Số dư thấp nhất ({formatMonth(flow.minMonth)})</span>
              <strong className={flow.minBalance < 0 ? "warn-text" : "good"}>
                {flow.minBalance < 0 ? `−${formatShort(-flow.minBalance)}` : formatShort(flow.minBalance)}
              </strong>
            </div>
          </div>

          <h3 className="cashflow-years-title">Cần bao nhiêu tiền mỗi năm</h3>
          <div className="table-wrap">
            <table className="cashflow-years">
              <thead>
                <tr>
                  <th>Năm</th>
                  <th className="num">Cần chi trong năm</th>
                  <th className="num">Trong đó đóng CĐT</th>
                  <th className="num">Trả ngân hàng</th>
                  <th className="num">Để dành + tiền thuê</th>
                  <th className="num">Số dư cuối năm</th>
                </tr>
              </thead>
              <tbody>
                {flow.years.map((y) => (
                  <tr key={y.year}>
                    <td>
                      <strong>{y.year}</strong>
                    </td>
                    <td className="num">
                      <strong>{formatVnd(y.spend)}</strong>
                    </td>
                    <td className="num">{dash(y.developer)}</td>
                    <td className="num">{dash(y.bank)}</td>
                    <td className="num">{dash(y.income)}</td>
                    <td className={`num ${y.endBalance < 0 ? "neg" : ""}`}>{signed(y.endBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {flow.firstShortMonth ? (
            <p className="warn">
              Số dư cuối năm màu đỏ là năm đang thiếu tiền (thiếu đầu tiên từ {formatMonth(flow.firstShortMonth)}). Để đủ
              cần để dành ít nhất {formatVnd(flow.neededSaving)} đ{" "}
              {growthRate > 0 ? `ở ${unit} đầu (tăng ${growth}% mỗi ${unit})` : "mỗi tháng"}
              {flow.shortNow > 0 ? `, và có thêm ${formatVnd(flow.shortNow)} đ tiền mặt ngay từ đầu` : ""}.
            </p>
          ) : (
            <p className="good">
              Với {formatVnd(cashN)} đ hiện có và {formatVnd(savingN)} đ để dành
              {growthRate > 0 ? ` (tăng ${growth}% mỗi ${unit})` : " mỗi tháng"}
              {rentN > 0 ? `, thêm ${formatVnd(rentN)} đ tiền thuê sau nhận nhà` : ""}, bạn đủ tiền cho mọi khoản tới{" "}
              {formatMonth(flow.rows[flow.rows.length - 1].month)} (thấp nhất {formatVnd(flow.minBalance)} đ vào{" "}
              {formatMonth(flow.minMonth)}).
            </p>
          )}

          <details className="cashflow" open>
            <summary>Bảng từng tháng</summary>
            <div className="table-wrap cashflow-wrap">
              <table className="cashflow-table">
                <thead>
                  <tr>
                    <th>Tháng</th>
                    <th>Sự kiện</th>
                    <th className="num">Đóng cho CĐT</th>
                    <th className="num">Trả ngân hàng</th>
                    <th className="num">Tổng chi tháng</th>
                    <th className="num">Để dành</th>
                    <th className="num">Tiền thuê</th>
                    <th className="num">Số dư (đ)</th>
                  </tr>
                </thead>
                <tbody>
                  {flow.rows.map((r) => (
                    <tr key={r.month} className={r.spend > 0 && r.developer > 0 ? "key" : ""}>
                      <td className="nowrap">{formatMonth(r.month)}</td>
                      <td className="small">{r.events.join(" · ")}</td>
                      <td className="num">{dash(r.developer)}</td>
                      <td className="num">{dash(r.bank)}</td>
                      <td className="num">{dash(r.spend)}</td>
                      <td className="num">{dash(r.saved)}</td>
                      <td className="num">{dash(r.rent)}</td>
                      <td className={`num ${r.balance < 0 ? "neg" : ""}`}>{signed(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="muted small">
            Số dư = tiền hiện có + tiền để dành và tiền thuê lũy kế − mọi khoản đã đóng và đã trả ngân hàng. Tiền trả ngân hàng tính
            theo giả định khoản vay ở phần trên. Chỉ mang tính tham khảo.
          </p>
        </>
      )}
    </>
  );
}

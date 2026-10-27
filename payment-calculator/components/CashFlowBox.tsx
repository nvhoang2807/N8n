"use client";

import { type Quote, cashFlow, formatMonth, formatShort, formatVnd } from "@/lib/calc.ts";

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
  onChange,
}: {
  quote: Quote;
  /** Tháng hiện tại (YYYY-MM): tiền mặt có ở tháng này, tiền để dành bắt đầu cộng từ tháng sau */
  startMonth: string;
  cash: string;
  saving: string;
  onChange: (patch: { cash?: string; saving?: string }) => void;
}) {
  const cashN = Number(cash) || 0;
  const savingN = Number(saving) || 0;
  const flow = cashFlow(quote, { start: startMonth, cash: cashN, saving: savingN });

  return (
    <>
      <h2>Tiền để dành & dòng tiền từng tháng</h2>
      <p className="muted">
        Nhập số tiền đang có và số tiền để dành mỗi tháng để biết có đủ tiền theo từng đợt không. Bảng tính cả tiền
        trả ngân hàng sau khi giải ngân.
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
          Để dành mỗi tháng (đ)
          <input
            inputMode="numeric"
            value={saving ? formatVnd(savingN) : ""}
            placeholder="0"
            onChange={(e) => onChange({ saving: digits(e.target.value) })}
          />
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
              <span>Cần để dành tối thiểu mỗi tháng</span>
              <strong>{flow.neededSaving > 0 ? formatShort(flow.neededSaving) : "Không cần"}</strong>
            </div>
            <div>
              <span>Số dư thấp nhất ({formatMonth(flow.minMonth)})</span>
              <strong className={flow.minBalance < 0 ? "warn-text" : "good"}>
                {flow.minBalance < 0 ? `−${formatShort(-flow.minBalance)}` : formatShort(flow.minBalance)}
              </strong>
            </div>
            <div>
              <span>Tháng bắt đầu thiếu tiền</span>
              <strong className={flow.firstShortMonth ? "warn-text" : "good"}>
                {flow.firstShortMonth ? formatMonth(flow.firstShortMonth) : "Không thiếu"}
              </strong>
            </div>
          </div>

          {flow.firstShortMonth ? (
            <p className="warn">
              Bạn bắt đầu thiếu tiền từ {formatMonth(flow.firstShortMonth)}. Để đủ cần để dành ít nhất{" "}
              {formatVnd(flow.neededSaving)} đ mỗi tháng
              {flow.shortNow > 0 ? `, và có thêm ${formatVnd(flow.shortNow)} đ tiền mặt ngay từ đầu` : ""}.
            </p>
          ) : (
            <p className="good">
              Với {formatVnd(cashN)} đ hiện có và {formatVnd(savingN)} đ mỗi tháng, bạn đủ tiền cho mọi khoản tới{" "}
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
                      <td className={`num ${r.balance < 0 ? "neg" : ""}`}>{signed(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="muted small">
            Số dư = tiền hiện có + tiền để dành lũy kế − mọi khoản đã đóng và đã trả ngân hàng. Tiền trả ngân hàng tính
            theo giả định khoản vay ở phần trên. Chỉ mang tính tham khảo.
          </p>
        </>
      )}
    </>
  );
}

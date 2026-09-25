import { test } from "node:test";
import assert from "node:assert/strict";
import { computeQuote, unitListPrice } from "./calc.ts";
import { projects } from "../data/projects.ts";
import { serenaRiverside as srn } from "../data/serena-riverside/index.ts";

const unit = srn.units.find((u) => u.code === "A-04-01")!;
const method = (id: string) => srn.methods.find((m) => m.id === id)!;

// Số liệu đối chiếu lấy từ file Excel SRN_BẢNG TẠM TÍNH GIÁ_Final.xlsx
// (căn A-04-01, đơn giá 60.000.000, CK sỉ 1%, Early Bird 1%, PTTTN 70%).
test("khớp bảng tạm tính Excel — PTTTN 70%", () => {
  const listPrice = unitListPrice(srn, unit, 60_000_000);
  assert.equal(listPrice, 3_499_200_000);

  const q = computeQuote(srn, method("pttt-nhanh-70"), {
    listPrice,
    netArea: unit.netArea,
    optionalDiscounts: { si: 0.01, "early-bird": 0.01 },
  });

  assert.deepEqual(
    q.discounts.map((d) => d.amount),
    [34_992_000, 34_992_000, 339_492_384],
  );
  assert.equal(q.netPrice, 3_089_723_616);
  assert.equal(q.landValue, 95_987_988);
  assert.equal(q.vat, 299_373_563);
  assert.equal(q.priceWithVat, 3_389_097_179);
  assert.equal(q.maintenance, 61_794_472);
  assert.equal(q.total, 3_450_891_651);
  assert.deepEqual(
    q.schedule.map((r) => r.amount),
    [50_000_000, 119_454_859, 2_202_913_166, 909_068_767, 169_454_859],
  );
  assert.equal(q.mismatch, 0);
});

test("mọi PTTT của mọi dự án cộng đủ 100% tổng giá trị HĐMB", () => {
  for (const project of projects) {
    const u = project.units[0];
    for (const m of project.methods) {
      const q = computeQuote(project, m, {
        listPrice: unitListPrice(project, u),
        netArea: u.netArea,
      });
      assert.equal(q.mismatch, 0, `${project.id}/${m.id}`);
      const pct = m.milestones.reduce((s, r) => s + (r.advance ? 0 : (r.percent ?? 0)), 0);
      assert.ok(Math.abs(pct - 1) < 1e-9, `${project.id}/${m.id}: tổng tỷ lệ ${pct}`);
      assert.ok(q.schedule.every((r) => r.amount >= 0), `${project.id}/${m.id}: đợt âm`);
    }
  }
});

test("PTTT vay: ngân hàng giải ngân đúng tỷ lệ", () => {
  const listPrice = unitListPrice(srn, unit);
  const q = computeQuote(srn, method("pttt-vay-40"), { listPrice, netArea: unit.netArea });
  assert.equal(q.bankPays, Math.round(q.priceWithVat * 0.4));
  assert.equal(q.customerPays + q.bankPays, q.total);
  assert.ok(q.loan);
  assert.equal(q.loan.monthlyDuringSupport, 0);
  assert.ok(q.loan.supportValue > 0);
});

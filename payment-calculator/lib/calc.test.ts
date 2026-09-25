import { test } from "node:test";
import assert from "node:assert/strict";
import { computeQuote, unitListPrice } from "./calc.ts";
import { defaultProjects as projects } from "../data/projects.ts";
import { serenaRiverside as srn } from "../data/serena-riverside/index.ts";
import { palmRiver as pr } from "../data/palm-river/index.ts";

/** Căn mẫu trong sheet GIỎ HÀNG của file Palm River (TT 130 m², tim tường 145 m², 3PN) */
const PR_10_10 = { code: "PR-10-10", type: "3PN", grossArea: 145, netArea: 130 };

const unit = srn.units.find((u) => u.code === "A-04-01")!;
const method = (id: string) => srn.methods.find((m) => m.id === id)!;

// Số liệu đối chiếu lấy từ file Excel SRN_BẢNG TẠM TÍNH GIÁ_Final 2.xlsx
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
    // VBTT = 5% giá công bố − cọc (CHI TIẾT!F15)
    [50_000_000, 124_960_000, 2_197_408_025, 909_068_767, 169_454_859],
  );
  assert.equal(q.mismatch, 0);
});

test("mọi PTTT của mọi dự án cộng đủ 100% tổng giá trị HĐMB", () => {
  for (const project of projects) {
    const u = project.units[0];
    for (const m of project.methods) {
      const q = computeQuote(project, m, {
        // Loại căn chưa có đơn giá tham khảo: dùng đơn giá cao nhất của dự án (như bước kiểm tra trong admin)
        listPrice:
          unitListPrice(project, u) || unitListPrice(project, u, Math.max(0, ...Object.values(project.defaultUnitPrice))),
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

// Palm River — đối chiếu file "PHIẾU TẠM TÍNH GIÁ PALM RIVER.xlsm": căn PR-10-10
// (TT 130 m², đơn giá 168.000.000), Early Bird 1%, KH thân thiết 1%, CK sỉ 1,5%.
// Excel không làm tròn, app làm tròn từng khoản nên cho phép lệch ≤ 2 đ.
test("khớp bảng tạm tính Excel — Palm River, cả 4 PTTT", () => {
  const u = PR_10_10;
  const listPrice = unitListPrice(pr, u);
  assert.equal(listPrice, 21_840_000_000);
  const near = (actual: number[], expected: number[], label: string) => {
    assert.equal(actual.length, expected.length, label);
    actual.forEach((a, i) => assert.ok(Math.abs(a - expected[i]) <= 2, `${label} dòng ${i + 1}: ${a} ≠ ${expected[i]}`));
  };
  const cases: [string, number, number[]][] = [
    ["pttt-dac-biet", 22_122_005_882.34, [
      100_000_000, 984_260_294.117, 1_084_260_294.117, 2_168_520_588.234, 2_168_520_588.234,
      14_532_183_823.521, 1_084_260_294.117,
    ]],
    ["pttt-chuan", 21_078_332_871.96, [
      100_000_000, 932_076_643.598, 1_032_076_643.598, 1_032_076_643.598, 1_032_076_643.598,
      2_064_153_287.196, 2_064_153_287.196, 2_064_153_287.196, 2_064_153_287.196, 2_064_153_287.196,
      5_597_183_217.99, 1_032_076_643.598,
    ]],
    ["pttt-nhanh", 20_614_478_200.68, [
      100_000_000, 908_883_910.034, 13_115_490_830.442, 5_481_219_550.17, 1_008_883_910.034,
    ]],
    ["pttt-vay", 23_629_533_564, [
      100_000_000, 1_059_636_678.2, 1_159_636_678.2, 12_756_003_460.2, 3_915_710_034.6, 3_478_910_034.6,
      1_159_636_678.2,
    ]],
  ];
  for (const [id, total, schedule] of cases) {
    const q = computeQuote(pr, pr.methods.find((m) => m.id === id)!, {
      listPrice,
      netArea: u.netArea,
      optionalDiscounts: { "early-bird": 0.01, "than-thiet": 0.01, si: 0.015 },
    });
    assert.deepEqual(q.discounts.slice(0, 3).map((d) => d.amount), [218_400_000, 216_216_000, 321_080_760], id);
    assert.equal(q.maintenance, 436_800_000, id);
    near([q.total], [total], `${id} tổng`);
    near(q.schedule.map((r) => r.amount), schedule, id);
    assert.equal(q.mismatch, 0, id);
  }
});

test("hạ chiết khấu PTTT theo khách, không vượt mức tối đa", () => {
  const u = PR_10_10;
  const m = pr.methods.find((x) => x.id === "pttt-chuan")!;
  const input = { listPrice: unitListPrice(pr, u), netArea: u.netArea, optionalDiscounts: { "early-bird": 0 } };
  const at = (methodDiscount?: number) => computeQuote(pr, m, { ...input, methodDiscount }).discounts.at(-1)?.percent;
  assert.equal(at(), 0.11);
  assert.equal(at(0.08), 0.08);
  assert.equal(at(0.2), 0.11);
  assert.equal(computeQuote(pr, m, { ...input, methodDiscount: 0 }).discounts.length, 0);
});

test("lũy kế là cộng dồn tỷ lệ các đợt như bảng Excel", () => {
  const cum = (project: typeof pr, id: string) => {
    const u = project.units[0];
    const q = computeQuote(project, project.methods.find((m) => m.id === id)!, {
      listPrice: unitListPrice(project, u),
      netArea: u.netArea,
    });
    return q.schedule.map((r) => (r.cumulativePercent === undefined ? undefined : Math.round(r.cumulativePercent * 1000) / 10));
  };
  // Palm River PTTT Chuẩn: XNĐK —, Đợt 1 5%, Đợt 2 10% … Đợt 11 100%
  assert.deepEqual(cum(pr, "pttt-chuan"), [undefined, 5, 10, 15, 20, 30, 40, 50, 60, 70, 95, 100]);
  assert.deepEqual(cum(pr, "pttt-vay"), [undefined, 5, 10, 65, 80, 95, 100]);
  // Serena: Cọc —, VBTT 5% (ứng trước), Đợt 1 70% (đã gồm VBTT), bàn giao 95%, GCN 100%
  assert.deepEqual(cum(srn, "pttt-nhanh-70"), [undefined, 5, 70, 95, 100]);
});

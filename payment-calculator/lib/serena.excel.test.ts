import { test } from "node:test";
import assert from "node:assert/strict";
import { computeQuote, unitListPrice } from "./calc.ts";
import { serenaRiverside as srn } from "../data/serena-riverside/index.ts";

// Số liệu tính bằng chính công thức của file "SRN_BẢNG TẠM TÍNH GIÁ_Final 2.xlsx"
// (sheet TÍNH GIÁ + CHI TIẾT): căn A-04-01, đơn giá 60.000.000, CK sỉ 1%, Early Bird 1%.
// Đã đối chiếu thêm 200 tổ hợp (10 PTTT × 4 căn × 5 mức CK) khi cập nhật file này.
const excel: Record<string, { total: number; schedule: number[] }> = {
  "pttt-chuan": { total: 3_642_927_747, schedule: [50_000_000, 124_960_000, 182_810_406, 357_770_406, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 89_442_601, 959_649_703, 178_885_212] },
  "pttt-vay-1": { total: 3_831_123_121, schedule: [50_000_000, 124_960_000, 201_293_880, 376_253_880, 1_881_269_401, 1_009_219_020, 188_126_940] },
  "pttt-vay-2": { total: 3_831_123_121, schedule: [50_000_000, 124_960_000, 201_293_880, 376_253_880, 1_881_269_401, 1_009_219_020, 188_126_940] },
  "pttt-vay-3": { total: 3_831_123_121, schedule: [50_000_000, 124_960_000, 201_293_880, 376_253_880, 1_881_269_401, 1_009_219_020, 188_126_940] },
  "pttt-vay-40": { total: 3_750_467_961, schedule: [50_000_000, 124_960_000, 193_372_391, 736_664_782, 1_473_329_565, 987_975_027, 184_166_196] },
  "pttt-nhanh-70": { total: 3_450_891_651, schedule: [50_000_000, 124_960_000, 2_197_408_025, 909_068_767, 169_454_859] },
  "pttt-nhanh-60": { total: 3_458_573_095, schedule: [50_000_000, 124_960_000, 1_863_024_872, 84_916_036, 84_916_036, 84_916_036, 84_916_036, 911_092_005, 169_832_074] },
  "pttt-nhanh-50": { total: 3_485_458_148, schedule: [50_000_000, 124_960_000, 1_536_563_209, 85_576_160, 85_576_160, 85_576_160, 85_576_160, 85_576_160, 85_576_160, 85_576_160, 85_576_160, 918_173_335, 171_152_324] },
  "pttt-nhanh-40": { total: 3_523_865_367, schedule: [50_000_000, 124_960_000, 1_209_347_117, 86_519_195, 86_519_195, 86_519_195, 86_519_195, 86_519_195, 86_519_195, 86_519_195, 86_519_195, 86_519_195, 86_519_195, 86_519_195, 86_519_195, 928_289_522, 173_038_388] },
  "pttt-nhanh-30": { total: 3_573_794_753, schedule: [50_000_000, 124_960_000, 877_981_675, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 87_745_140, 941_440_567, 175_490_271] },
};

test("Serena: khớp file Excel Final 2 — đủ 10 PTTT, từng đợt", () => {
  const unit = srn.units.find((u) => u.code === "A-04-01")!;
  const listPrice = unitListPrice(srn, unit, 60_000_000);
  for (const [id, expected] of Object.entries(excel)) {
    const q = computeQuote(srn, srn.methods.find((m) => m.id === id)!, {
      listPrice,
      netArea: unit.netArea,
      optionalDiscounts: { si: 0.01, "early-bird": 0.01 },
    });
    assert.equal(q.total, expected.total, `${id}: tổng`);
    assert.deepEqual(q.schedule.map((r) => r.amount), expected.schedule, `${id}: lịch thanh toán`);
  }
});

test("Serena: VBTT = 5% giá công bố − tiền cọc", () => {
  const unit = srn.units.find((u) => u.code === "A-04-01")!;
  const listPrice = unitListPrice(srn, unit, 60_000_000);
  const q = computeQuote(srn, srn.methods[0], { listPrice, netArea: unit.netArea });
  assert.equal(q.schedule[1].amount, Math.round(listPrice * 0.05) - 50_000_000);
});

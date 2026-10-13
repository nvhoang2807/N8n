import { test } from "node:test";
import assert from "node:assert/strict";
import { fromPercentText, parseNumber, toPercentText } from "./numbers.ts";
import { parseUnitsTable, unitsToTable } from "./importUnits.ts";
import { validateProject } from "./validate.ts";
import { defaultProjects } from "../data/projects.ts";
import { blankProject } from "./templates.ts";

test("đọc số kiểu Việt Nam và quốc tế", () => {
  assert.equal(parseNumber("3.499.200.000"), 3_499_200_000);
  assert.equal(parseNumber("3,499,200,000"), 3_499_200_000);
  assert.equal(parseNumber("58,32"), 58.32);
  assert.equal(parseNumber("58.32"), 58.32);
  assert.equal(parseNumber("60 000 000 đ"), 60_000_000);
  assert.equal(parseNumber("9,9%"), 9.9);
  assert.equal(parseNumber("abc"), undefined);
  assert.equal(parseNumber(""), undefined);
  assert.equal(fromPercentText("9,9"), 0.099);
  assert.equal(toPercentText(0.099), "9.9");
  assert.equal(toPercentText(0.025), "2.5");
});

test("dán danh sách căn từ Excel", () => {
  const text = [
    "Mã căn\tLoại\tSố PN\tSố WC\tHướng\tDT tim tường\tDT thông thủy",
    "A-04-01\tOT\t1\t1\tĐB\t58,32\t52,04",
    "B-06-02\tCH\t1+\t1\tTB - ĐB\t58.89\t53.06\t3.315.507.000",
    "C-01\tCH\t2\t2\tĐN\tabc\t50",
    "",
  ].join("\n");
  const { units, skipped } = parseUnitsTable(text);
  assert.equal(units.length, 2);
  assert.deepEqual(units[0], { code: "A-04-01", type: "OT", bedrooms: 1, bathrooms: 1, direction: "ĐB", grossArea: 58.32, netArea: 52.04 });
  assert.equal(units[1].bedrooms, "1+");
  assert.equal(units[1].price, 3_315_507_000);
  assert.deepEqual(skipped, [{ line: 4, reason: "diện tích không phải số" }]);
  // Xuất ra rồi dán lại phải giữ nguyên
  assert.deepEqual(parseUnitsTable(unitsToTable(units)).units, units);
});

test("dữ liệu mặc định hợp lệ", () => {
  for (const p of defaultProjects) {
    assert.deepEqual(validateProject(p).errors, [], p.id);
  }
});

test("bắt lỗi cấu hình sai", () => {
  const p = structuredClone(defaultProjects[0]);
  p.id = "admin";
  p.methods[0].milestones[2].percent = 0.2; // Đợt 1 của PTTT chuẩn 10% → 20%
  p.units.push({ ...p.units[0] });
  const { errors } = validateProject(p);
  assert.ok(errors.some((e) => e.includes("trùng đường dẫn")));
  assert.ok(errors.some((e) => e.includes("tổng tỷ lệ các đợt là 110%")));
  assert.ok(errors.some((e) => e.includes("Trùng mã căn")));
});

test("mẫu dự án trống chỉ thiếu căn", () => {
  const p = blankProject();
  p.id = "du-an-moi";
  p.name = "Dự án mới";
  assert.deepEqual(validateProject(p).errors, ["Dự án chưa có căn nào."]);
});

test("không báo nhầm 'đợt âm' khi loại căn chưa có đơn giá tham khảo", () => {
  const palm = defaultProjects.find((p) => p.id === "palm-river")!;
  // Danh sách giống admin Palm River: căn 2PN đứng đầu, chỉ 3PN có đơn giá tham khảo
  const project = {
    ...palm,
    units: [
      { code: "CT3-10-1", type: "2PN", grossArea: 84.9, netArea: 75.8 },
      { code: "CT3-10-5", type: "3PN", grossArea: 126.1, netArea: 115.2 },
    ],
  };
  assert.deepEqual(validateProject(project).errors, []);
  // Không có đơn giá nào: vẫn lưu được, không tự đoán giá để báo âm
  assert.deepEqual(validateProject({ ...project, defaultUnitPrice: {} }).errors, []);
});

test("file Excel mẫu đọc ngược lại ra đúng danh sách căn", async () => {
  const { rowsToTable, unitsToRows } = await import("./importUnits.ts");
  const units = [
    { code: "CT3-10-1", type: "2PN", grossArea: 84.9, netArea: 75.8 },
    { code: "B-06-02", type: "CH", bedrooms: "1+", bathrooms: 1, direction: "TB - ĐB", grossArea: 58.89, netArea: 53.06, price: 3_315_507_000 },
  ];
  // Mô phỏng ô Excel: số là number, ô trống là null
  const back = parseUnitsTable(rowsToTable(unitsToRows(units)));
  assert.deepEqual(JSON.parse(JSON.stringify(back.units)), units);
  assert.deepEqual(back.skipped, []);
});

test("tự sửa dữ liệu đã lưu: bỏ CK 5% PTTT Vay & Đặc biệt (Imperia), giữ chỉnh sửa khác, chạy 1 lần", async () => {
  const { applyMigrations } = await import("./migrations.ts");
  const isp = defaultProjects.find((p) => p.id === "imperia-sensa-park")!;
  // Bản cũ đã lưu: còn CK 5% + một chỉnh sửa trong admin (ghi chú)
  const old = {
    ...isp,
    notes: ["Ghi chú admin tự sửa"],
    methods: isp.methods.map((m) =>
      m.id === "pttt-vay" || m.id === "pttt-dac-biet"
        ? { ...m, summary: `CK 5% · ${m.summary}`, discounts: [{ label: `Chiết khấu ${m.name}`, percent: 0.05 }] }
        : m,
    ),
  };
  const { project, changed } = applyMigrations(old);
  assert.equal(changed, true);
  for (const id of ["pttt-vay", "pttt-dac-biet"]) {
    const m = project.methods.find((x) => x.id === id)!;
    assert.deepEqual(m.discounts, []);
    assert.ok(!m.summary.startsWith("CK"), m.summary);
  }
  assert.equal(project.methods.find((x) => x.id === "pttt-chuan")!.discounts[0].percent, 0.05);
  // Bước "ghi đè từ code" chạy sau: cấu hình trùng bản trong code
  assert.deepEqual(project.methods, isp.methods);
  assert.equal(applyMigrations(project).changed, false);
  // Dự án khác không bị đụng tới
  assert.equal(applyMigrations(defaultProjects[0]).changed, false);
});

test("Norton Park: 63 layout, giá khớp nortonpark.com.vn (66 triệu × DT tim tường)", async () => {
  const { unitListPrice } = await import("./calc.ts");
  const { applyMigrations } = await import("./migrations.ts");
  const norton = defaultProjects.find((p) => p.id === "norton-park")!;
  assert.equal(norton.units.length, 63);
  assert.equal(unitListPrice(norton, norton.units.find((u) => u.code === "ST1.1a")!), 2_779_920_000);
  // Dữ liệu cũ trên Blob (chưa có căn) nhận đủ 63 layout, giữ căn nhập tay
  const old = { ...norton, units: [{ code: "X1", type: "2PN", grossArea: 70, netArea: 65 }], migrations: [] };
  const { project } = applyMigrations(old);
  assert.equal(project.units.length, 64);
  assert.equal(project.defaultUnitPrice.PES, 66_000_000);
  assert.ok(validateProject(project).errors.length === 0);
  // Giá từng căn như trên trang: C4.1a 7.500.900.000 đ → đơn giá quy ra 66 triệu/m² × 113,65 m²
  const c4 = project.units.find((u) => u.code === "C4.1a")!;
  assert.equal(c4.price, 7_500_900_000);
  assert.equal(unitListPrice(project, c4), 7_500_900_000);
  assert.equal(Math.round(c4.price! / c4.grossArea), 66_000_000);
  // Duplex & Podium Shop: tạm 70 triệu/m²
  for (const u of project.units.filter((x) => x.type === "Duplex" || x.type === "SHOP")) {
    assert.equal(u.price, Math.round(u.grossArea * 70_000_000));
  }
  assert.equal(project.units.filter((x) => x.type === "Duplex" || x.type === "SHOP").length, 12);
});

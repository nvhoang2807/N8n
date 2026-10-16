import { imperiaSensaPark } from "../data/imperia-sensa-park/index.ts";
import { specialMethod as serenaSpecialMethod, specialMethod2 as serenaSpecialMethod2 } from "../data/serena-riverside/index.ts";
import { NORTON_UNIT_PRICE, NORTON_UNIT_TYPES } from "../data/norton-park/index.ts";
import { units as nortonUnits } from "../data/norton-park/units.ts";
import type { Project } from "./types";

/**
 * Sửa dữ liệu dự án đã lưu trên Blob khi cấu hình trong code thay đổi, mà không cần bấm "Cập nhật"
 * trong admin. Mỗi bước chỉ sửa đúng phần cần sửa (giữ nguyên các chỉnh sửa khác trong admin),
 * chạy một lần cho mỗi dự án và được ghi lại trong project.migrations.
 */
export type Migration = { id: string; projectId: string; apply: (p: Project) => Project };

export const migrations: Migration[] = [
  {
    // PTTT Vay & Đặc biệt của Imperia Sensa Park không có chiết khấu PTTT (file Excel ghi 5% là nhầm)
    id: "2026-10-isp-vay-dac-biet-khong-ck",
    projectId: "imperia-sensa-park",
    apply: (p) => ({
      ...p,
      methods: p.methods.map((m) =>
        m.id === "pttt-vay" || m.id === "pttt-dac-biet"
          ? { ...m, discounts: [], summary: m.summary.replace(/^CK\s*[\d.,]+%\s*·\s*/i, "") }
          : m,
      ),
    }),
  },
  {
    // Ghi đè toàn bộ cấu hình Imperia Sensa Park bằng bản trong code (theo yêu cầu "deploy đè"),
    // chỉ giữ thứ tự, ẩn/hiện, màu và ảnh đại diện đã chỉnh trong admin
    id: "2026-10-isp-ghi-de-tu-code",
    projectId: "imperia-sensa-park",
    apply: (p) => ({
      ...imperiaSensaPark,
      order: p.order ?? imperiaSensaPark.order,
      hidden: p.hidden,
      color: p.color,
      image: p.image,
      migrations: p.migrations,
      updatedAt: p.updatedAt,
    }),
  },
  {
    // Norton Park: đơn giá tham khảo căn hộ 66 triệu/m²
    id: "2026-10-norton-don-gia-66tr",
    projectId: "norton-park",
    apply: (p) => ({
      ...p,
      defaultUnitPrice: { ...p.defaultUnitPrice, "1PN": 66_000_000, "2PN": 66_000_000, "3PN": 66_000_000 },
    }),
  },
  {
    // Norton Park: khoản đầu là "Đặt chỗ" 100 triệu (cấn trừ vào đợt ký HĐMB)
    id: "2026-10-norton-dat-cho-100tr",
    projectId: "norton-park",
    apply: (p) => ({
      ...p,
      methods: p.methods.map((m) => ({
        ...m,
        milestones: m.milestones.map((x) =>
          x.advance && x.amount !== undefined
            ? { ...x, label: "Đặt chỗ", due: "Đặt chỗ", amount: 100_000_000 }
            : x.deductAdvances && x.note === "Đã cấn trừ tiền đặt cọc"
              ? { ...x, note: "Đã cấn trừ tiền đặt chỗ" }
              : x,
        ),
      })),
    }),
  },
  {
    // Norton Park: 63 layout (mã, cảnh quan, DT tim tường/thông thủy) từ nortonpark.com.vn/calculator;
    // giữ các căn đã nhập tay trong admin nếu mã chưa có trong danh sách
    id: "2026-10-norton-63-layout",
    projectId: "norton-park",
    apply: (p) => {
      const codes = new Set(nortonUnits.map((u) => u.code));
      return {
        ...p,
        description: "Phân khu B · 63 layout căn hộ, Duplex & Podium Shop",
        unitTypes: { ...p.unitTypes, ...NORTON_UNIT_TYPES },
        defaultUnitPrice: { ...p.defaultUnitPrice, ...NORTON_UNIT_PRICE },
        units: [...nortonUnits, ...p.units.filter((u) => !codes.has(u.code))],
      };
    },
  },
  {
    // Norton Park: mỗi layout có giá dự kiến riêng như trên nortonpark.com.vn (đơn giá quy ra = giá ÷ DT tim tường)
    id: "2026-10-norton-gia-tung-can",
    projectId: "norton-park",
    apply: (p) => {
      const byCode = new Map(nortonUnits.map((u) => [u.code, u]));
      return { ...p, units: p.units.map((u) => byCode.get(u.code) ?? u) };
    },
  },
  {
    // Norton Park: Duplex & Podium Shop chưa có giá công khai → tạm 70 triệu/m² tim tường
    id: "2026-10-norton-duplex-shop-70tr",
    projectId: "norton-park",
    apply: (p) => {
      const byCode = new Map(nortonUnits.map((u) => [u.code, u]));
      return {
        ...p,
        defaultUnitPrice: { ...p.defaultUnitPrice, Duplex: 70_000_000, SHOP: 70_000_000 },
        units: p.units.map((u) => (u.type === "Duplex" || u.type === "SHOP" ? (byCode.get(u.code) ?? u) : u)),
      };
    },
  },
  {
    // Serena Riverside: thêm PTTT Đặc biệt (Tờ trình 13/10/2026), giữ nguyên các PTTT đang có
    id: "2026-10-serena-pttt-dac-biet",
    projectId: "serena-riverside",
    apply: (p) =>
      p.methods.some((m) => m.id === serenaSpecialMethod.id) ? p : { ...p, methods: [...p.methods, serenaSpecialMethod] },
  },
  {
    // Serena Riverside: đưa PTTT Đặc biệt lên đầu danh sách
    id: "2026-10-serena-dac-biet-len-dau",
    projectId: "serena-riverside",
    apply: (p) => ({
      ...p,
      methods: [
        ...p.methods.filter((m) => m.id === serenaSpecialMethod.id),
        ...p.methods.filter((m) => m.id !== serenaSpecialMethod.id),
      ],
    }),
  },
  {
    // Serena Riverside: PTTT Đặc biệt 1 & 2 theo Thông báo 11/2026/TB-ĐP (ký quỹ 5%, ghi chú tiến độ mới),
    // thay bản Đặc biệt cũ, đặt cả hai lên đầu danh sách
    id: "2026-10-serena-dac-biet-1-2",
    projectId: "serena-riverside",
    apply: (p) => ({
      ...p,
      methods: [
        serenaSpecialMethod,
        serenaSpecialMethod2,
        ...p.methods.filter((m) => m.id !== serenaSpecialMethod.id && m.id !== serenaSpecialMethod2.id),
      ],
    }),
  },
];

/** Dự án mới trong code (data/) tự được thêm lên kho đã khởi tạo, không cần bấm "+ Thêm" trong admin */
export const AUTO_ADD = ["norton-park"];

/** Áp các bước chưa chạy cho dự án; changed = true nếu cần ghi lại */
export function applyMigrations(project: Project): { project: Project; changed: boolean } {
  const done = new Set(project.migrations ?? []);
  let next = project;
  let changed = false;
  for (const m of migrations) {
    if (m.projectId !== project.id || done.has(m.id)) continue;
    next = { ...m.apply(next), migrations: [...(next.migrations ?? []), m.id] };
    changed = true;
  }
  return { project: next, changed };
}

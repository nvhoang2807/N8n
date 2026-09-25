import { parseNumber } from "./numbers.ts";
import type { Unit } from "./types";

/** Thứ tự cột khi dán từ Excel */
export const UNIT_COLUMNS = [
  "Mã căn",
  "Loại",
  "Số PN",
  "Số WC",
  "Hướng",
  "DT tim tường",
  "DT thông thủy",
  "Giá công bố (nếu có)",
] as const;

export type ImportResult = { units: Unit[]; skipped: { line: number; reason: string }[] };

/** Đọc bảng dán từ Excel/Google Sheet (các cột cách nhau bằng Tab) */
export function parseUnitsTable(text: string): ImportResult {
  const units: Unit[] = [];
  const skipped: ImportResult["skipped"] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  lines.forEach((raw, i) => {
    if (!raw.trim()) return;
    const cells = raw.split(raw.includes("\t") ? "\t" : ";").map((c) => c.trim());
    const [code, type, bed, bath, direction, gross, net, price] = cells;
    const grossArea = parseNumber(gross);
    const netArea = parseNumber(net);
    if (!code || grossArea === undefined || netArea === undefined) {
      // Dòng tiêu đề thì bỏ qua im lặng
      if (units.length === 0 && grossArea === undefined) return;
      skipped.push({ line: i + 1, reason: !code ? "thiếu mã căn" : "diện tích không phải số" });
      return;
    }
    const bedNum = parseNumber(bed);
    const bathNum = parseNumber(bath);
    const unit: Unit = {
      code,
      type: type || "CH",
      bedrooms: bedNum ?? (bed ? bed : undefined),
      bathrooms: bathNum,
      direction: direction || undefined,
      grossArea,
      netArea,
    };
    const p = parseNumber(price);
    if (p !== undefined && p > 0) unit.price = p;
    units.push(unit);
  });
  return { units, skipped };
}

/** Các dòng đọc từ file Excel (mảng ô) → bảng chữ như khi dán, để dùng chung parseUnitsTable */
export function rowsToTable(rows: unknown[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => (cell === null || cell === undefined || cell instanceof Date ? "" : String(cell).replace(/[\t\n\r]+/g, " ").trim()))
        .join("\t"),
    )
    .join("\n");
}

/** Dữ liệu cho file Excel mẫu: dòng tiêu đề + danh sách căn (hoặc 1 dòng ví dụ nếu chưa có căn) */
export function unitsToRows(units: Unit[], exampleType = "CH"): (string | number | null)[][] {
  const rows = units.length
    ? units.map((u) => [u.code, u.type, u.bedrooms ?? null, u.bathrooms ?? null, u.direction ?? null, u.grossArea, u.netArea, u.price ?? null])
    : [["A-01-01", exampleType, 2, 2, "ĐN", 75.5, 68.2, null]];
  return [[...UNIT_COLUMNS], ...rows];
}

export function unitsToTable(units: Unit[]): string {
  const rows = units.map((u) =>
    [u.code, u.type, u.bedrooms ?? "", u.bathrooms ?? "", u.direction ?? "", u.grossArea, u.netArea, u.price ?? ""].join("\t"),
  );
  return [UNIT_COLUMNS.join("\t"), ...rows].join("\n");
}

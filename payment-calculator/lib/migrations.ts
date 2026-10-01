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
];

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

import type { Metadata } from "next";
import Link from "next/link";
import DeleteProjectButton from "@/components/admin/DeleteProjectButton";
import LoginForm from "@/components/admin/LoginForm";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { blobEnabled, readProjects } from "@/lib/store";
import { defaultProjects } from "@/data/projects.ts";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { sameConfig } from "@/lib/types";
import { addDefaultProjectAction, logoutAction, updateDefaultProjectAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quản trị dự án", robots: { index: false } };

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <main className="page admin">
        <section className="card">
          <h1>Chưa bật trang quản trị</h1>
          <p>
            Vào Vercel → Project → <strong>Settings → Environment Variables</strong>, thêm biến <code>ADMIN_PASSWORD</code>{" "}
            (mật khẩu đăng nhập) rồi deploy lại.
          </p>
        </section>
      </main>
    );
  }
  if (!(await isAdmin())) {
    return (
      <main className="page admin">
        <LoginForm />
      </main>
    );
  }

  const { projects, source } = await readProjects();
  const blobReady = blobEnabled();
  const available =
    source === "blob" ? defaultProjects.filter((d) => !projects.some((p) => p.id === d.id)) : [];
  const outdated =
    source === "blob"
      ? defaultProjects.filter((d) => {
          const current = projects.find((p) => p.id === d.id);
          return current && !sameConfig(current, d);
        })
      : [];

  return (
    <main className="page admin">
      <div className="admin-bar">
        <div>
          <p className="eyebrow">Quản trị</p>
          <h1>Dự án ({projects.length})</h1>
        </div>
        <div className="actions">
          <Link className="button" href="/" target="_blank">
            Xem trang khách ↗
          </Link>
          <Link className="button primary" href="/admin/new">
            + Tạo dự án
          </Link>
          <form action={logoutAction}>
            <button>Đăng xuất</button>
          </form>
        </div>
      </div>

      {!blobReady && (
        <p className="notice error">
          Chưa kết nối Vercel Blob nên chưa lưu được thay đổi. Vào Vercel → Project → <strong>Storage</strong> → tạo Blob store
          (chọn Private) và kết nối với project, rồi deploy lại.
        </p>
      )}
      {blobReady && source === "default" && (
        <p className="notice ok">
          Đang dùng dữ liệu mặc định. Lần lưu đầu tiên sẽ tự chép toàn bộ dự án lên Vercel Blob.
        </p>
      )}

      {available.length > 0 && (
        <section className="card">
          <h2>Dự án có sẵn chưa được thêm</h2>
          <p className="muted small">Dự án đã được cấu hình sẵn nhưng chưa có trong danh sách đang dùng.</p>
          <div className="actions">
            {available.map((p) => (
              <form key={p.id} action={addDefaultProjectAction.bind(null, p.id)}>
                <button className="primary">+ Thêm {p.name}</button>
              </form>
            ))}
          </div>
        </section>
      )}

      {outdated.length > 0 && (
        <section className="card">
          <h2>Cấu hình mới từ file Excel</h2>
          <p className="muted small">
            Cách tính trong app đã được cập nhật theo file Excel mới nhưng dự án dưới đây vẫn đang dùng bản cũ. Bấm cập nhật
            để áp dụng (các chỉnh sửa đã làm trong admin cho dự án đó sẽ bị thay thế).
          </p>
          <div className="actions">
            {outdated.map((p) => (
              <form key={p.id} action={updateDefaultProjectAction.bind(null, p.id)}>
                <ConfirmButton
                  className="primary"
                  message={`Cập nhật ${p.name} theo cấu hình mới? Các chỉnh sửa trong admin của dự án này sẽ bị thay thế.`}
                >
                  ↻ Cập nhật {p.name}
                </ConfirmButton>
              </form>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dự án</th>
                <th className="num">Căn</th>
                <th className="num">PTTT</th>
                <th>Cập nhật</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/${p.id}`}>
                      <strong>{p.name}</strong>
                    </Link>
                    {p.hidden && <span className="tag">Đang ẩn</span>}
                    <div className="muted small">/{p.id}</div>
                  </td>
                  <td className="num">{p.units.length}</td>
                  <td className="num">{p.methods.length}</td>
                  <td className="small muted">
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—"}
                  </td>
                  <td className="actions end">
                    <Link className="button" href={`/admin/${p.id}`}>
                      Sửa
                    </Link>
                    <Link className="button" href={`/admin/new?from=${p.id}`}>
                      Nhân bản
                    </Link>
                    <a className="button" href={`/${p.id}`} target="_blank" rel="noreferrer">
                      Xem
                    </a>
                    <DeleteProjectButton id={p.id} name={p.name} disabled={!blobReady} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

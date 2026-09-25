import Link from "next/link";
import { loadProjects } from "@/lib/store";

export const revalidate = 3600;

export default async function Home() {
  const projects = (await loadProjects()).filter((p) => !p.hidden);
  return (
    <main className="page">
      <header className="top">
        <div>
          <p className="eyebrow">Bảng tạm tính giá trị HĐMB</p>
          <h1>Chọn dự án</h1>
          <p className="muted">Chọn dự án để xem giá căn hộ, chiết khấu và lịch thanh toán theo từng phương thức.</p>
        </div>
      </header>
      {projects.length === 0 && <p className="muted">Chưa có dự án nào.</p>}
      <div className="project-grid">
        {projects.map((p) => (
          <Link key={p.id} href={`/${p.id}`} className="card project-card">
            <h2>{p.name}</h2>
            <p className="muted">
              {p.developer}
              {p.location ? ` · ${p.location}` : ""}
            </p>
            {p.description && <p className="small">{p.description}</p>}
            <p className="small muted">
              {p.units.length} căn · {p.methods.length} phương thức thanh toán
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}

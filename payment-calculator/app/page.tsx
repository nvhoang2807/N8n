import Link from "next/link";
import { loadProjects } from "@/lib/store";

export const revalidate = 3600;

export default async function Home() {
  const projects = (await loadProjects()).filter((p) => !p.hidden);
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Bảng tạm tính giá trị HĐMB</p>
        <h1>Chọn dự án</h1>
        <p>Xem giá căn hộ, chiết khấu và lịch thanh toán theo từng phương thức — nhanh, rõ ràng, in được ngay.</p>
      </section>
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
            <div className="stats">
              <span>{p.units.length} căn</span>
              <span>{p.methods.length} phương thức thanh toán</span>
            </div>
            <span className="cta">Xem bảng tính →</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

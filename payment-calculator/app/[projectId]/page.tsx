import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Calculator from "@/components/Calculator";
import { loadProject, loadProjects } from "@/lib/store";

// Trang được tạo khi có người truy cập lần đầu rồi cache lại (ISR);
// admin lưu dữ liệu sẽ làm mới ngay.
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ projectId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await loadProject((await params).projectId);
  return project
    ? { title: `${project.name} — Bảng tạm tính giá`, description: `Ước tính giá trị HĐMB và lịch thanh toán dự án ${project.name}.` }
    : {};
}

export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  const projects = await loadProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) notFound();
  const projectList = projects
    .filter((p) => !p.hidden || p.id === project.id)
    .map((p) => ({ id: p.id, name: p.name }));
  return <Calculator project={project} projectList={projectList} />;
}

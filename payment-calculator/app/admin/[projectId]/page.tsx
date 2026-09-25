import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ProjectEditor from "@/components/admin/ProjectEditor";
import { isAdmin } from "@/lib/auth";
import { blobEnabled, readProjects } from "@/lib/store";
import { blankProject } from "@/lib/templates.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sửa dự án", robots: { index: false } };

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function EditProjectPage({ params, searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin");
  const { projectId } = await params;
  const { projects } = await readProjects();

  if (projectId === "new") {
    const { from } = await searchParams;
    const source = projects.find((p) => p.id === from);
    let initial = blankProject();
    if (source) {
      let id = `${source.id}-copy`;
      while (projects.some((p) => p.id === id)) id += "-2";
      initial = { ...structuredClone(source), id, name: `${source.name} (bản sao)`, hidden: true, updatedAt: undefined };
    }
    return <ProjectEditor initial={initial} blobReady={blobEnabled()} />;
  }

  const project = projects.find((p) => p.id === projectId);
  if (!project) notFound();
  return <ProjectEditor key={project.id} initial={project} previousId={project.id} blobReady={blobEnabled()} />;
}

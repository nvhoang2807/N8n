"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { defaultProjects } from "@/data/projects.ts";
import { login, logout, requireAdmin } from "@/lib/auth";
import { deleteProject, PROJECTS_TAG, saveProject } from "@/lib/store";
import type { Project } from "@/lib/types";
import { validateProject } from "@/lib/validate.ts";

export type ActionResult = { ok: true } | { ok: false; error: string };

function refreshPublicPages() {
  updateTag(PROJECTS_TAG);
  revalidatePath("/", "layout");
}

export async function loginAction(_: string | null, form: FormData): Promise<string | null> {
  const ok = await login(String(form.get("password") ?? ""));
  if (!ok) return "Sai mật khẩu.";
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/admin");
}

export async function saveProjectAction(project: Project, previousId?: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { errors } = validateProject(project);
    if (errors.length) return { ok: false, error: errors.join("\n") };
    await saveProject(project, previousId);
    refreshPublicPages();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await deleteProject(id);
    refreshPublicPages();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Thêm một dự án có sẵn trong code (data/) nhưng chưa có trên Blob, ví dụ dự án mới được bổ sung */
export async function addDefaultProjectAction(id: string): Promise<void> {
  await requireAdmin();
  const project = defaultProjects.find((p) => p.id === id);
  if (!project) throw new Error(`Không có dự án mặc định "${id}".`);
  await saveProject(project);
  refreshPublicPages();
  revalidatePath("/admin");
}

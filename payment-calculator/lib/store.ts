import "server-only";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { del, get, list, put } from "@vercel/blob";
import { unstable_cache } from "next/cache";
import { defaultProjects } from "@/data/projects.ts";
import type { Project } from "./types";

/**
 * Lưu dữ liệu dự án trên Vercel Blob: mỗi dự án là một file projects/<id>.json.
 * Khi Blob chưa cấu hình (chạy local) hoặc chưa có file nào → dùng dữ liệu mặc định trong data/.
 */

const PREFIX = "projects/";
export const PROJECTS_TAG = "projects";

const access = process.env.BLOB_ACCESS === "public" ? "public" : "private";

/** Chạy thử trên máy không có Blob: đặt LOCAL_STORE_DIR=.data để lưu file JSON cục bộ */
const localDir = process.env.BLOB_READ_WRITE_TOKEN ? undefined : process.env.LOCAL_STORE_DIR;

export function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || localDir);
}

/** Lớp lưu trữ tối thiểu: Vercel Blob khi deploy, thư mục cục bộ khi chạy thử */
const storage = {
  async list(): Promise<string[]> {
    if (localDir) {
      const dir = join(localDir, PREFIX);
      await mkdir(dir, { recursive: true });
      return (await readdir(dir)).map((f) => `${PREFIX}${f}`);
    }
    const paths: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
      paths.push(...page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return paths;
  },
  async read(pathname: string): Promise<string | null> {
    if (localDir) return readFile(join(localDir, pathname), "utf8").catch(() => null);
    const res = await get(pathname, { access, useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return new Response(res.stream).text();
  },
  async write(pathname: string, body: string, contentType: string): Promise<void> {
    if (localDir) {
      await mkdir(join(localDir, PREFIX), { recursive: true });
      await writeFile(join(localDir, pathname), body);
      return;
    }
    await put(pathname, body, {
      access,
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType,
      cacheControlMaxAge: 60,
    });
  },
  async remove(pathname: string): Promise<void> {
    if (localDir) await rm(join(localDir, pathname), { force: true });
    else await del(pathname);
  },
};

const pathFor = (id: string) => `${PREFIX}${id}.json`;
/** Đánh dấu Blob đã được khởi tạo, để xóa hết dự án không làm dữ liệu mặc định hiện lại */
const INIT_MARKER = `${PREFIX}_initialized.txt`;

function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) => (a.order ?? 50) - (b.order ?? 50) || a.name.localeCompare(b.name, "vi"),
  );
}

/** Đọc trực tiếp từ kho (không cache) — dùng trong trang admin */
export async function readProjects(): Promise<{ projects: Project[]; source: "blob" | "default" }> {
  if (!blobEnabled()) return { projects: sortProjects(defaultProjects), source: "default" };
  const paths = await storage.list();
  const files = paths.filter((p) => p.endsWith(".json"));
  if (files.length === 0 && !paths.includes(INIT_MARKER)) {
    return { projects: sortProjects(defaultProjects), source: "default" };
  }
  const texts = await Promise.all(files.map((p) => storage.read(p)));
  const projects = texts.filter((t): t is string => t !== null).map((t) => JSON.parse(t) as Project);
  return { projects: sortProjects(projects), source: "blob" };
}

/** Bản có cache cho trang khách — làm mới ngay khi admin lưu (updateTag) hoặc tối đa sau 1 giờ */
export const loadProjects = unstable_cache(
  async () => (await readProjects()).projects,
  ["projects-v1"],
  { tags: [PROJECTS_TAG], revalidate: 3600 },
);

export async function loadProject(id: string): Promise<Project | undefined> {
  return (await loadProjects()).find((p) => p.id === id);
}

async function writeProject(project: Project): Promise<void> {
  await storage.write(pathFor(project.id), JSON.stringify(project), "application/json");
}

/** Lần ghi đầu tiên: chép toàn bộ dữ liệu mặc định lên Blob để không bị mất */
async function ensureInitialized(): Promise<Project[]> {
  const { projects, source } = await readProjects();
  if (source === "default") {
    await Promise.all(projects.map(writeProject));
    await storage.write(INIT_MARKER, new Date().toISOString(), "text/plain");
  }
  return projects;
}

export async function saveProject(project: Project, previousId?: string): Promise<void> {
  if (!blobEnabled()) throw new Error("Chưa kết nối Vercel Blob (thiếu BLOB_READ_WRITE_TOKEN).");
  const existing = await ensureInitialized();
  if (project.id !== previousId && existing.some((p) => p.id === project.id)) {
    throw new Error(`Mã dự án "${project.id}" đã tồn tại.`);
  }
  await writeProject({ ...project, updatedAt: new Date().toISOString() });
  if (previousId && previousId !== project.id) await storage.remove(pathFor(previousId));
}

export async function deleteProject(id: string): Promise<void> {
  if (!blobEnabled()) throw new Error("Chưa kết nối Vercel Blob (thiếu BLOB_READ_WRITE_TOKEN).");
  await ensureInitialized();
  await storage.remove(pathFor(id));
}

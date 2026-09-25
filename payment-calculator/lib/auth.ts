import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/** Đăng nhập admin bằng một mật khẩu chung đặt ở biến môi trường ADMIN_PASSWORD */

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 ngày

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function sessionToken(): string {
  return createHmac("sha256", process.env.ADMIN_PASSWORD ?? "")
    .update("payment-calculator-admin")
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  return Boolean(value && safeEqual(value, sessionToken()));
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
}

export async function login(password: string): Promise<boolean> {
  if (!adminConfigured() || !safeEqual(password, process.env.ADMIN_PASSWORD!)) return false;
  (await cookies()).set(COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return true;
}

export async function logout(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

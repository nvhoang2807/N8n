"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";

export default function LoginForm() {
  const [error, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="card login">
      <h1>Quản trị dự án</h1>
      <label>
        Mật khẩu
        <input type="password" name="password" autoFocus required autoComplete="current-password" />
      </label>
      {error && <p className="warn">{error}</p>}
      <button className="primary" disabled={pending}>
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}

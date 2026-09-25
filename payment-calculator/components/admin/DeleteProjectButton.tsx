"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteProjectAction } from "@/app/admin/actions";

export default function DeleteProjectButton({ id, name, disabled }: { id: string; name: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="danger"
      disabled={disabled || pending}
      onClick={() => {
        if (!confirm(`Xóa dự án "${name}"? Thao tác này không hoàn tác được (nên tải file JSON sao lưu trước).`)) return;
        startTransition(async () => {
          const res = await deleteProjectAction(id);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
    >
      {pending ? "Đang xóa…" : "Xóa"}
    </button>
  );
}

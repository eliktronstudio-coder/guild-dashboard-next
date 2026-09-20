"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteArchiveButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        `Удалить архив «${label}»?\n\nАктивности и операции казны из него не удалятся — они вернутся в живой учёт и снова засчитаются в текущую казну и статистику.`
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/archive/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Не удалось удалить архив.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      title="Удалить архив"
      className="rounded p-1.5 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-60"
    >
      <Trash2 size={15} />
    </button>
  );
}

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getUnpublishedMap } from "@/lib/design/store";
import DesignEditor from "@/components/design/DesignEditor";

/**
 * Вкладка «Дизайн». Доступ только администратору — проверка здесь и,
 * независимо от неё, в каждом методе /api/design/*.
 */
export default async function DesignPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const unpublished = await getUnpublishedMap();
  return <DesignEditor initialUnpublished={unpublished} />;
}

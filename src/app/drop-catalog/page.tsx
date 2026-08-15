import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDropCatalog } from "@/lib/queries";
import DropCatalogPanel from "@/components/admin/DropCatalogPanel";

export default async function DropCatalogPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const items = await getDropCatalog();

  return (
    <DropCatalogPanel
      items={items.map((i) => ({ id: i.id, name: i.name, price: i.price, imageUrl: i.imageUrl }))}
    />
  );
}

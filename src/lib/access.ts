import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ACCOUNT_ROLES } from "@/lib/accountRoles";

/** Authorize before querying or serializing private data, including RSC requests. */
export const getApprovedUser = cache(async () => {
  const user = await getCurrentUser();
  return user &&
    user.role !== "random" &&
    ACCOUNT_ROLES.some((role) => role === user.role)
    ? user
    : null;
});

export async function requireGuildMember() {
  const user = await getApprovedUser();
  if (!user) redirect("/access");
  return user;
}

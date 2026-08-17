// Роли учётной записи (права доступа) — не путать с игровой ролью/классом
// игрока (Танк/Хил/... из lib/roles.ts).
export const ACCOUNT_ROLES = ["admin", "gm", "rl", "member"] as const;

export const accountRoleLabel: Record<string, string> = {
  admin: "Админ",
  gm: "ГМ",
  rl: "РЛ",
  member: "Участник",
};

// Админ и ГМ — полные права на всё.
export function isFullAdminRole(role: string | undefined | null): boolean {
  return role === "admin" || role === "gm";
}

// РЛ дополнительно получает права на управление активностями
// (создание/редактирование активностей, состав, гости, скрины) —
// но не на дроп/казну/выплаты/пользователей/реестр дропа.
export function canManageActivitiesRole(role: string | undefined | null): boolean {
  return isFullAdminRole(role) || role === "rl";
}

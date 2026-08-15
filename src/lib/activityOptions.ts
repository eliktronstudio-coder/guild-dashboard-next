export const ACTIVITY_CATEGORIES = ["Мини-РБ", "Прайм"];
export const ACTIVITY_MODES = ["PvE", "PvP"];
export const ACTIVITY_DIFFICULTIES = ["Обычная", "Героическая"];
export const ACTIVITY_STATUSES = ["К выплате", "Выплачено", "Отменено"];

export const statusColor: Record<string, string> = {
  "К выплате": "border-accent/40 bg-accent-soft text-accent",
  "Выплачено": "border-success/40 bg-success/10 text-success",
  "Отменено": "border-danger/40 bg-danger/10 text-danger",
};

export const roleColor: Record<string, string> = {
  "Танк": "border-success/40 bg-success/10 text-success",
  "Хил": "border-danger/40 bg-danger/10 text-danger",
  "Милик": "border-accent/40 bg-accent-soft text-accent",
  "Лучник": "border-purple-400/40 bg-purple-400/10 text-purple-300",
  "Маг": "border-blue-400/40 bg-blue-400/10 text-blue-300",
  "Без роли": "border-border bg-surface-2 text-muted",
};

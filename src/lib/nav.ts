import {
  LayoutDashboard,
  Swords,
  Users,
  Landmark,
  Wallet,
  Calculator,
  ShieldCheck,
  BookOpen,
  ImagePlay,
  Map,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    title: "Обзор",
    items: [
      { href: "/dashboard", label: "Статистика", icon: LayoutDashboard },
      { href: "/activities", label: "Активность", icon: Swords },
      { href: "/players", label: "Состав", icon: Users },
    ],
  },
  {
    title: "Экономика",
    items: [
      { href: "/treasury", label: "Казна", icon: Landmark },
      { href: "/payments", label: "Выплаты", icon: Wallet },
    ],
  },
  {
    title: "Инструменты",
    items: [
      { href: "/calculator", label: "Калькуляторы", icon: Calculator },
      { href: "/archeage", label: "ArcheAge", icon: Map, adminOnly: true },
    ],
  },
  {
    title: "Администрирование",
    items: [
      { href: "/users", label: "Пользователи", icon: ShieldCheck, adminOnly: true },
      { href: "/drop-catalog", label: "Реестр дропа", icon: BookOpen, adminOnly: true },
      { href: "/activity-banners", label: "Баннеры активностей", icon: ImagePlay, adminOnly: true },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items);

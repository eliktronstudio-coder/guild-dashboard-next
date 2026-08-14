import {
  LayoutDashboard,
  Swords,
  Users,
  Image,
  Trophy,
  Landmark,
  Gavel,
  Wallet,
  Calculator,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    title: "Обзор",
    items: [
      { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
      { href: "/activities", label: "Активности", icon: Swords },
      { href: "/players", label: "Состав", icon: Users },
      { href: "/media", label: "Мультимедиа", icon: Image },
      { href: "/tournament", label: "Турниры", icon: Trophy },
    ],
  },
  {
    title: "Экономика",
    items: [
      { href: "/treasury", label: "Казна", icon: Landmark },
      { href: "/auction", label: "Аукцион", icon: Gavel },
      { href: "/payments", label: "Выплаты", icon: Wallet },
    ],
  },
  {
    title: "Инструменты",
    items: [
      { href: "/calculator", label: "Калькулятор РБ опыта", icon: Calculator },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items);

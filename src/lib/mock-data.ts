export type Role = "Танк" | "Хил" | "Милик" | "Лучник" | "Маг";

export type Player = {
  id: number;
  name: string;
  role: Role;
  level: number;
  xp: number;
  attendancePct: number;
};

export type Activity = {
  id: number;
  name: string;
  participants: number;
  date: string;
};

export type TreasuryPoint = {
  date: string;
  gold: number;
  inventory: number;
};

export type AttendancePoint = {
  date: string;
  count: number;
};

export type AuctionLot = {
  id: number;
  item: string;
  seller: string;
  price: number;
  endsIn: string;
};

export type Payment = {
  id: number;
  player: string;
  amount: number;
  status: "Выплачено" | "Ожидает" | "Отклонено";
  date: string;
};

export const players: Player[] = [
  { id: 1, name: "Amagami", role: "Милик", level: 9, xp: 4975, attendancePct: 100 },
  { id: 2, name: "Boop", role: "Хил", level: 8, xp: 4210, attendancePct: 96 },
  { id: 3, name: "Estq", role: "Милик", level: 10, xp: 5460, attendancePct: 100 },
  { id: 4, name: "Harwester", role: "Лучник", level: 7, xp: 3680, attendancePct: 92 },
  { id: 5, name: "Khinaar", role: "Хил", level: 12, xp: 7375, attendancePct: 100 },
  { id: 6, name: "Neverq", role: "Танк", level: 11, xp: 6860, attendancePct: 89 },
  { id: 7, name: "Neneverq", role: "Хил", level: 11, xp: 6375, attendancePct: 94 },
  { id: 8, name: "Yupi", role: "Танк", level: 10, xp: 5460, attendancePct: 87 },
  { id: 9, name: "Sorvin", role: "Маг", level: 6, xp: 2980, attendancePct: 81 },
  { id: 10, name: "Latrys", role: "Лучник", level: 9, xp: 4720, attendancePct: 90 },
];

export const activities: Activity[] = [
  { id: 1633, name: "АГЛ", participants: 13, date: "14 августа" },
  { id: 1632, name: "Разъяренный Морфеос", participants: 11, date: "14 августа" },
  { id: 1631, name: "Логово Вирма", participants: 15, date: "13 августа" },
  { id: 1630, name: "Страж Бездны", participants: 9, date: "12 августа" },
  { id: 1629, name: "АГЛ", participants: 14, date: "11 августа" },
];

export const treasuryHistory: TreasuryPoint[] = [
  { date: "1 авг", gold: 512000, inventory: 84000 },
  { date: "3 авг", gold: 498000, inventory: 91000 },
  { date: "5 авг", gold: 470500, inventory: 97000 },
  { date: "7 авг", gold: 455200, inventory: 102000 },
  { date: "9 авг", gold: 431000, inventory: 108500 },
  { date: "11 авг", gold: 402300, inventory: 114000 },
  { date: "13 авг", gold: 378900, inventory: 121000 },
  { date: "14 авг", gold: 356140, inventory: 126500 },
];

export const attendanceHistory: AttendancePoint[] = [
  { date: "8 авг", count: 10 },
  { date: "9 авг", count: 12 },
  { date: "10 авг", count: 8 },
  { date: "11 авг", count: 14 },
  { date: "12 авг", count: 9 },
  { date: "13 авг", count: 15 },
  { date: "14 авг", count: 13 },
];

export const auctionLots: AuctionLot[] = [
  { id: 1, item: "Меч рассвета", seller: "Estq", price: 42000, endsIn: "2 ч 14 мин" },
  { id: 2, item: "Плащ теней", seller: "Boop", price: 18500, endsIn: "5 ч 02 мин" },
  { id: 3, item: "Кольцо стихий", seller: "Neverq", price: 27300, endsIn: "8 ч 40 мин" },
  { id: 4, item: "Свиток возрождения x5", seller: "Khinaar", price: 9600, endsIn: "12 ч 10 мин" },
];

export const payments: Payment[] = [
  { id: 1, player: "Amagami", amount: 24500, status: "Выплачено", date: "10 августа" },
  { id: 2, player: "Boop", amount: 21800, status: "Выплачено", date: "10 августа" },
  { id: 3, player: "Neverq", amount: 19200, status: "Ожидает", date: "14 августа" },
  { id: 4, player: "Sorvin", amount: 8100, status: "Отклонено", date: "14 августа" },
];

export const stats = {
  treasuryGold: -2673810,
  raidDropGoldEquivalent: 184300,
  avgActivityDays: 7,
  daysUntilPayout: 3,
};

export function topByAttendance(count = 5): Player[] {
  return [...players].sort((a, b) => b.attendancePct - a.attendancePct).slice(0, count);
}

export function topByXp(count = 5): Player[] {
  return [...players].sort((a, b) => b.xp - a.xp).slice(0, count);
}

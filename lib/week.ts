export function isoWeek(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export type VisitDay = "Woensdag" | "Donderdag";

export function dayForToday(date: Date = new Date()): VisitDay {
  // 3 = Wednesday, 4 = Thursday
  return date.getDay() === 4 ? "Donderdag" : "Woensdag";
}

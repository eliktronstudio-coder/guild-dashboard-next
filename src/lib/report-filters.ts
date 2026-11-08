export type ReportParams = Record<string, string | string[] | undefined>;
export function value(input: string | string[] | undefined) {
  return typeof input === "string" ? input : "";
}
export function parseDay(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(input + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === input
    ? date
    : null;
}
export function positivePage(input: string | undefined, max = 100000) {
  const number = Number(input ?? 1);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, max) : 1;
}
export function csvCell(input: unknown) {
  if (typeof input === "number" && Number.isFinite(input))
    return '"' + String(input) + '"';
  let text = input === null || input === undefined ? "" : String(input);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function csv(rows: unknown[][]) {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}

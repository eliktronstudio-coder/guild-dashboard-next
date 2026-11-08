import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
export function prepareDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:"))
    throw new Error("Isolated SQLite URL required");
  writeFileSync(fileURLToPath(new URL(url)), "", { flag: "a" });
}

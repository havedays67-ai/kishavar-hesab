import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const ROOT = join(dirname(new URL(import.meta.url).pathname), "../..");
export const TRAIN_DIR = join(ROOT, "artifacts/train");
export const CREATE_TABLES_SQL = "tools/train";

/** فقط وقتی محتوا عوض شده بنویس تا کلیدهای determinism در CI سبز بمانند. */
export function writeIfChanged(path: string, content: string): void {
  if (existsSync(path)) {
    const previous = readFileSync(path, "utf8");
    if (previous === content) return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

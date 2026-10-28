// کدام نمایش‌ها مبلغ را با ارقام فارسی نشان می‌دهند؟ (ناهمگونی)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["app-v2/src/pages", "app-v2/src/components", "app-v2/src/lib"];
const hits: { file: string; line: number; text: string }[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!/\.(ts|tsx)$/.test(full)) continue;
    const lines = readFileSync(full, "utf8").split("\n");
    lines.forEach((text, index) => {
      if (/toPersianDigits\([^)]*toLocaleString\("en-US"\)/.test(text) && /تومان/.test(text)) hits.push({ file: full, line: index + 1, text: text.trim().slice(0, 120) });
    });
  }
};
for (const root of roots) walk(root);
console.log("money-with-persian-digits:", hits.length);
for (const hit of hits.slice(0, 15)) console.log(`${hit.file}:${hit.line} → ${hit.text}`);

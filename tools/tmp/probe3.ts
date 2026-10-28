// ناهمگونی نمایش مبلغ در بقیهٔ صفحات (بدون toLocaleString)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const roots = ["app-v2/src/pages", "app-v2/src/components"];
const hits: { file: string; line: number; text: string }[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!/\.(tsx|ts)$/.test(full)) continue;
    readFileSync(full, "utf8").split("\n").forEach((text, index) => {
      if (/\$\{[^}]*money\([^)]*\)/.test(text) || /money\(([^)]*)\)/.test(text)) {
        if (/تومان/.test(text) || /money\(/.test(text)) hits.push({ file: full, line: index + 1, text: text.trim().slice(0, 110) });
      }
    });
  }
};
for (const root of roots) walk(root);
console.log("hits:", hits.length);
for (const hit of hits.slice(0, 12)) console.log(`${hit.file}:${hit.line} → ${hit.text}`);

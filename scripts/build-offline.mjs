import { build } from "esbuild";

await build({
  entryPoints: ["offline/app.ts"],
  bundle: true,
  format: "iife",
  target: "es2018",
  minify: true,
  sourcemap: false,
  outfile: "capacitor-web/app.js",
  logLevel: "info",
});

import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  // app-v2 is a standalone Vite project with its own tsconfig and build; it is not part of the Next.js app.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "app-v2/**"]),
]);

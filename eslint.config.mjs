import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Module boundaries: ui/ is generic and knows nothing of stocks; features
  // never reach into routes. Features may use each other and ui/.
  {
    files: ["src/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/features/*", "@/app/*"], message: "ui/ must stay generic: pass data in as props." }] },
      ],
    },
  },
  {
    files: ["src/features/**", "src/lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/app/*"], message: "Routes compose features, not the other way round." }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

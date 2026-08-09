import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // macOS AppleDouble sidecars on external volumes are not source files.
    "**/._*",
    // Vendored document skills are maintained upstream, not in this repository.
    ".github/skills/**",
    // Generated documents and FSD checker fixtures are inputs/outputs, not app code.
    "scripts/outputs/**",
    "scripts/fixtures/**",
  ]),
  {
    // Document authoring scripts are plain CommonJS run directly with node.
    files: ["scripts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;

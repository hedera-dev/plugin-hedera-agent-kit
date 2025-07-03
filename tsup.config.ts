import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  tsconfig: "./tsconfig.build.json", // Use build-specific tsconfig
  sourcemap: true,
  clean: true,
  format: ["esm"], // ESM output format
  dts: true,
  external: ["dotenv", "fs", "path", "https", "http", "@elizaos/core", "zod"],
});

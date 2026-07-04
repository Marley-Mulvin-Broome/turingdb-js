import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2022",
  platform: "node",
  tsconfig: "tsconfig.build.json",
  splitting: false,
  sourcemap: true,
});

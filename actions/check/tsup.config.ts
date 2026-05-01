import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node20",
  clean: true,
  outDir: "dist",
  minify: false,
  sourcemap: false,
  noExternal: [/.*/],
  shims: true,
  outExtension() {
    return { js: ".cjs" };
  },
});

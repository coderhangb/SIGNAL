import { build } from "esbuild";
import path from "node:path";
await build({
  absWorkingDir: import.meta.dirname,
  entryPoints: ["./src/index.js"],
  outdir: "./dist",
  outExtension: { ".js": ".mjs" },
  platform: "node",
  target: "node22",
  format: "esm",
  bundle: true,
  packages: "external",
  sourcemap: true,
  tsconfigRaw: {},
  logLevel: "info",
});

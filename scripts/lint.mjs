import { readdir } from "node:fs/promises";
import { ESLint } from "eslint";
const files = [];
async function collect(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", "dist"].includes(e.name)) continue;
    const file = `${dir}/${e.name}`;
    if (e.isDirectory()) await collect(file);
    else if (/\.(js|mjs|jsx)$/.test(file)) files.push(file);
  }
}
for (const dir of [
  "artifacts/api-server/src",
  "artifacts/api-server/tests",
  "artifacts/signal/src",
  "artifacts/signal/tests",
  "scripts",
  "tests",
])
  await collect(dir);
const eslint = new ESLint();
const results = await eslint.lintFiles(files);
console.log((await eslint.loadFormatter("stylish")).format(results));
process.exitCode = results.some((r) => r.errorCount) ? 1 : 0;

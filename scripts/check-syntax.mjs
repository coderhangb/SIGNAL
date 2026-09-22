import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { transform } from "esbuild";
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await check(file);
    else if (/\.(js|mjs|jsx)$/.test(file)) {
      if (file.endsWith(".jsx"))
        await transform(await readFile(file, "utf8"), {
          loader: "jsx",
          sourcefile: file,
        });
      else {
        const p = spawnSync(process.execPath, ["--check", file], {
          stdio: "inherit",
          windowsHide: true,
        });
        if (p.status !== 0) process.exit(p.status || 1);
      }
    }
  }
}
await check("artifacts/api-server/src");
await check("artifacts/signal/src");
console.log(
  "JavaScript/JSX syntax checks passed. Runtime schemas are tested separately; no TypeScript migration.",
);

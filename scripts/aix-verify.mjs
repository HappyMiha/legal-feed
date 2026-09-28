import { spawnSync } from "node:child_process";
const npm = process.env.npm_execpath;
if (!npm) throw Error("Run npm run aix:verify.");
for (const step of ["typecheck", "lint", "test", "build", "test:e2e"]) {
  const result = spawnSync(process.execPath, [npm, "run", step], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

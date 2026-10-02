import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
const files = ["public/artifacts.js", "src/http/capability-router.js", "src/http/ask-execution-guard.js", "src/repositories/artifact-repository.js", "src/http/r2-storage.js"];
for (const directory of ["src/services/artifacts", "src/services/plugins"]) {
  for (const name of await readdir(directory)) if (name.endsWith(".js")) files.push(`${directory}/${name}`);
}
for (const file of files) {
  const checked = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (checked.status !== 0) process.exit(1);
}

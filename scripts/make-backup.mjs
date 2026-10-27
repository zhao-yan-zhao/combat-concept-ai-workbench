import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";

const dest = "D:/项目/_backups/combat-concept-ai-workbench-8792-20261026-task-force-ov6.zip";
const tmpDir = "D:/项目/_backups/tmp-backup";

if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

function copySafe(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const base = path.basename(src);
    if (base === "node_modules" || base === ".git" || base === "tmp-backup") return;
    fs.mkdirSync(dst, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copySafe(path.join(src, child), path.join(dst, child));
    }
  } else {
    const ext = path.extname(src);
    if (ext === ".sqlite" || ext === ".sqlite-journal" || ext === ".db3") return;
    fs.copyFileSync(src, dst);
  }
}

copySafe("D:/项目/combat-concept-ai-workbench", tmpDir);
cp.execSync(`powershell -Command "Compress-Archive -Path '${tmpDir}/*' -DestinationPath '${dest}' -Force"`);
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log("Backup zip created:", dest, "Size:", fs.statSync(dest).size);

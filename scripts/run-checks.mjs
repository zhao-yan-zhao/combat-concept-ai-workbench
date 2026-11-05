import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const groupsFile = path.join(__dirname, "check-groups.json");

if (!fs.existsSync(groupsFile)) {
  console.error("Missing scripts/check-groups.json file.");
  process.exit(1);
}

const groups = JSON.parse(fs.readFileSync(groupsFile, "utf8"));
const requestedGroups = process.argv.slice(2);

if (requestedGroups.length === 0) {
  console.log("用法: node scripts/run-checks.mjs [group...]");
  console.log("可用分组清单:");
  for (const [name, list] of Object.entries(groups)) {
    console.log(`  - ${name} (${list.length} 个脚本)`);
  }
  console.log("  - all (运行所有分组)");
  process.exit(0);
}

// Collect scripts to run
const selectedScripts = new Set();
const unknownGroups = [];

for (const g of requestedGroups) {
  if (g === "all") {
    for (const list of Object.values(groups)) {
      for (const s of list) selectedScripts.add(s);
    }
  } else if (groups[g]) {
    for (const s of groups[g]) selectedScripts.add(s);
  } else {
    unknownGroups.push(g);
  }
}

if (unknownGroups.length > 0) {
  console.error(`未知分组: ${unknownGroups.join(", ")}`);
  console.error(`有效分组包括: ${Object.keys(groups).join(", ")}, all`);
  process.exit(1);
}

const scriptList = Array.from(selectedScripts);
console.log(`\n=== 开始执行选定测试 (共 ${scriptList.length} 个脚本) ===\n`);

const results = {
  passed: [],
  failed: [],
  timedOut: []
};

const TIMEOUT_MS = 60000;

for (let i = 0; i < scriptList.length; i++) {
  const scriptName = scriptList[i];
  const scriptPath = path.join(projectRoot, "scripts", scriptName);
  const progress = `[${i + 1}/${scriptList.length}]`;

  process.stdout.write(`${progress} 运行 ${scriptName} ... `);

  const outcome = await runSingleScript(scriptPath, TIMEOUT_MS);
  if (outcome.status === "PASS") {
    results.passed.push(scriptName);
    console.log(`✓ 通过 (${outcome.durationMs}ms)`);
  } else if (outcome.status === "TIMEOUT") {
    results.timedOut.push(scriptName);
    console.log(`✗ 超时 (>60s)`);
  } else {
    results.failed.push({ script: scriptName, error: outcome.error });
    console.log(`✗ 失败 (code=${outcome.code})`);
    if (outcome.error) {
      console.log(`    详细信息: ${outcome.error.split("\n")[0]}`);
    }
  }
}

// Summary
console.log("\n================ 汇总报告 ================");
console.log(`总脚本数: ${scriptList.length}`);
console.log(`通过 (PASS):    ${results.passed.length}`);
console.log(`失败 (FAIL):    ${results.failed.length}`);
console.log(`超时 (TIMEOUT): ${results.timedOut.length}`);

if (results.failed.length > 0) {
  console.log("\n失败脚本列表:");
  for (const f of results.failed) {
    console.log(`  - ${f.script}: ${f.error ? f.error.split("\n")[0] : "exit with non-zero"}`);
  }
}

if (results.timedOut.length > 0) {
  console.log("\n超时脚本列表:");
  for (const t of results.timedOut) {
    console.log(`  - ${t}`);
  }
}

console.log("==========================================\n");

if (results.failed.length > 0 || results.timedOut.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

function runSingleScript(filePath, timeoutMs) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let timedOut = false;

    const child = spawn(process.execPath, [filePath], {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdout.resume();

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch {}
      resolve({
        status: "TIMEOUT",
        durationMs: Date.now() - startTime
      });
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      if (timedOut) return;
      resolve({
        status: "FAIL",
        code: -1,
        error: err.message,
        durationMs: Date.now() - startTime
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      const durationMs = Date.now() - startTime;
      if (code === 0) {
        resolve({ status: "PASS", durationMs });
      } else {
        resolve({
          status: "FAIL",
          code,
          error: stderr.trim() || `Script exited with code ${code}`,
          durationMs
        });
      }
    });
  });
}

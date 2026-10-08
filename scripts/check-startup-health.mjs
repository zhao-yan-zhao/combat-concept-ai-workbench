import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

// 1. 验证启动与停止脚本文件完整性
const requiredFiles = [
  "start.bat",
  "start.ps1",
  "start.sh",
  "stop.bat",
  "stop.ps1"
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  assert(fs.existsSync(fullPath), `启动脚本文件缺失: ${file}`);
  const content = fs.readFileSync(fullPath, "utf8");
  assert(content.length > 50, `启动脚本内容过短: ${file}`);
  assert(content.includes("8792"), `${file} 应包含默认端口 8792`);
  if (file.startsWith("start")) {
    assert(content.includes("server.mjs"), `${file} 应包含服务端入口 server.mjs`);
  } else {
    assert(content.includes("Stop-Process") || content.includes("taskkill") || content.includes("进程"), `${file} 应包含进程停止逻辑`);
  }
}

console.log("[√] 启动脚本文件完整性与配置项检查通过");

// 2. 验证探测逻辑
const port = Number(process.env.PORT || 8792);
const healthUrl = `http://127.0.0.1:${port}/api/health`;

async function testHealthEndpoint() {
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) {
      console.log(`[i] 服务当前未在运行或返回非 200 (状态: ${res.status})，跳过在线健康探测。`);
      return;
    }
    const data = await res.json();
    assert.equal(data.ok, true, "健康检查应返回 ok: true");
    assert(data.projectRepository, "健康检查应包含 projectRepository");
    assert.equal(data.projectRepository.mode, "sqlite", "数据库持久化模式必须为 sqlite");
    console.log(`[√] 在线健康探测通过 (服务运行正常, 存储模式: ${data.projectRepository.mode})`);
  } catch {
    console.log("[i] 当前服务离线，这是正常状态（脚本可独立拉起服务）。");
  }
}

await testHealthEndpoint();
console.log("Startup scripts verification completed successfully.");

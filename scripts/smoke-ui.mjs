// @ts-check
/**
 * scripts/smoke-ui.mjs
 * 
 * 行为级冒烟测试：
 * 1. 临时隔离目录运行服务，原生 SQLite，不污染开发数据库；
 * 2. 原生 CDP 连接本机无头 Edge，零第三方 npm 依赖；
 * 3. 登录、新建项目、切换六步主线视图、验证 OV-1 制图图例渲染；
 * 4. 监听 Runtime.exceptionThrown / Console error，确保无未捕获异常。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Find Edge executable
const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
].filter(Boolean);

const EDGE_PATH = EDGE_CANDIDATES.find((p) => p && fs.existsSync(p));
if (!EDGE_PATH) {
  console.error("Microsoft Edge not found. Please set EDGE_PATH environment variable.");
  process.exit(1);
}

// Find free TCP port helper
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address()?.port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

const serverPort = await findFreePort();
const cdpPort = await findFreePort();
const tempDir = await mkdtemp(path.join(tmpdir(), "workbench-smoke-"));

console.log(`[Smoke] Temporary workspace: ${tempDir}`);
console.log(`[Smoke] Server port: ${serverPort}, CDP port: ${cdpPort}`);

let serverProc = null;
let edgeProc = null;
let ws = null;

try {
  // 1. Start isolated server
  serverProc = spawn(process.execPath, ["server.mjs"], {
    cwd: path.resolve("."),
    env: {
      ...process.env,
      PORT: String(serverPort),
      PROJECT_STORAGE_MODE: "sqlite",
      PROJECT_DB_PATH: path.join(tempDir, "projects.sqlite"),
      PROJECT_DATA_PATH: path.join(tempDir, "projects.json"),
      COLLABORATION_LOCAL_IDENTITY_DB_PATH: path.join(tempDir, "collab.sqlite"),
      COLLABORATION_LOCAL_IDENTITY_PATH: path.join(tempDir, "collab.json"),
      CONCEPT_MAP_TOOL_ENABLED: "false"
    },
    stdio: "pipe"
  });

  serverProc.stdout.on("data", (d) => {
    // console.log(`[Server] ${d.toString().trim()}`);
  });
  serverProc.stderr.on("data", (d) => {
    console.error(`[Server Error] ${d.toString().trim()}`);
  });

  // Wait for server health
  let serverReady = false;
  const healthUrl = `http://127.0.0.1:${serverPort}/api/health`;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        const json = await res.json();
        if (json.ok) {
          serverReady = true;
          break;
        }
      }
    } catch {}
    await sleep(250);
  }

  if (!serverReady) {
    throw new Error(`Server failed to start on port ${serverPort}`);
  }
  console.log(`[Smoke] Server is healthy and running on port ${serverPort}`);

  // 2. Launch headless Edge
  const edgeUserDataDir = path.join(tempDir, "edge-user-data");
  edgeProc = spawn(
    EDGE_PATH,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--disable-extensions",
      `--user-data-dir=${edgeUserDataDir}`,
      `--remote-debugging-port=${cdpPort}`,
      "about:blank"
    ],
    { stdio: "ignore" }
  );

  // Discover CDP WebSocket target
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
      target = list.find((t) => t.type === "page");
    } catch {}
    if (!target) await sleep(250);
  }

  if (!target?.webSocketDebuggerUrl) {
    throw new Error(`Failed to attach to headless Edge CDP on port ${cdpPort}`);
  }
  console.log(`[Smoke] Headless Edge attached via CDP: ${target.webSocketDebuggerUrl}`);

  // 3. Connect CDP via native WebSocket
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let messageId = 0;
  const pendingRequests = new Map();
  const criticalErrors = [];

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pendingRequests.has(msg.id)) {
      pendingRequests.get(msg.id)(msg);
      pendingRequests.delete(msg.id);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const details = msg.params?.exceptionDetails;
      const desc = details?.exception?.description || details?.text || "Unknown Exception";
      // Filter out benign resize/network cancellations if any
      if (!desc.includes("ResizeObserver") && !desc.includes("AbortError: The user aborted a request")) {
        criticalErrors.push(`[Runtime.exceptionThrown] ${desc}`);
      }
    }
    if (msg.method === "Log.entryAdded" && msg.params?.entry?.level === "error") {
      const text = msg.params.entry.text || "";
      if (!text.includes("favicon.ico") && !text.includes("ResizeObserver")) {
        criticalErrors.push(`[Log.error] ${text}`);
      }
    }
  });

  const sendCommand = (method, params = {}) => {
    return new Promise((resolve) => {
      const id = ++messageId;
      pendingRequests.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evalInPage = async (expression) => {
    const res = await sendCommand("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.result?.value;
  };

  await sendCommand("Runtime.enable");
  await sendCommand("Log.enable");
  await sendCommand("Page.enable");
  await sendCommand("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  // 4. Setup collaboration user and project via API first
  const baseUrl = `http://127.0.0.1:${serverPort}`;
  console.log(`[Smoke] Initializing test session and test project via API ...`);
  const setupRes = await fetch(`${baseUrl}/api/collaboration/auth/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "smoke_tester", label: "Smoke Tester", password: "smoke-pass-2026" })
  });
  
  const rawCookies = typeof setupRes.headers.getSetCookie === "function"
    ? setupRes.headers.getSetCookie()
    : [setupRes.headers.get("set-cookie") || ""];
  const sessionCookieStr = rawCookies.find((c) => c.includes("combat_collaboration_session")) || rawCookies[0] || "";
  const tokenMatch = sessionCookieStr.match(/combat_collaboration_session=([^;]+)/);
  const sessionToken = tokenMatch ? tokenMatch[1] : "";
  const authCookieHeader = `combat_collaboration_session=${sessionToken}`;
  console.log(`[Smoke] Auth session token acquired: ${sessionToken.slice(0, 16)}...`);

  // Create or configure smoke project in free test mode
  const createRes = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cookie": authCookieHeader
    },
    body: JSON.stringify({
      id: "smoke-auto-project",
      title: "端到端冒烟测试项目",
      description: "Headless Edge CDP Smoke Verification",
      workflow: { mode: "free", completedThrough: 6, version: 2 }
    })
  });
  const createdProject = await createRes.json();
  console.log("[Smoke] Created project response:", JSON.stringify(createdProject));

  // Navigate directly to the smoke project with auth cookie
  const projectUrl = `${baseUrl}/?project=smoke-auto-project`;
  console.log(`[Smoke] Setting auth cookie and navigating to ${projectUrl} ...`);
  
  // Set auth cookie in browser via CDP Network domain
  await sendCommand("Network.enable");
  await sendCommand("Network.setCookie", {
    name: "combat_collaboration_session",
    value: sessionToken,
    domain: "127.0.0.1",
    path: "/"
  });

  await sendCommand("Page.navigate", { url: projectUrl });
  await sleep(2500);

  const pageInfo = await evalInPage(`(() => ({
    title: document.title,
    viewRoot: Boolean(document.querySelector('#viewRoot')),
    renderedView: document.querySelector('#viewRoot')?.dataset?.renderedView,
    testModeBtn: document.querySelector('#workflowTestModeBtn')?.getAttribute('aria-checked')
  }))()`);
  console.log("[Smoke] Initial page state:", JSON.stringify(pageInfo));

  // If test mode is not yet free, activate it via UI toggle
  if (pageInfo.testModeBtn !== "true") {
    console.log("[Smoke] Activating free test mode via UI toggle ...");
    await evalInPage(`document.querySelector('[data-action="toggle-workflow-test-mode"]')?.click()`);
    await sleep(800);
  }

  // 5. Navigate through the 6 mainline steps
  const MAINLINE_STEPS = ["brief", "phase-action", "force-mission", "ov5", "ov1", "scenario"];
  for (const step of MAINLINE_STEPS) {
    console.log(`[Smoke] Switching to mainline step: ${step} ...`);
    const switchRes = await evalInPage(`(() => {
      const btn = document.querySelector('.step-button[data-view="${step}"]') || document.querySelector('[data-view="${step}"]');
      if (!btn) return { ok: false, reason: "Button not found in DOM" };
      if (btn.disabled) return { ok: false, reason: "Button is disabled" };
      btn.click();
      return { ok: true };
    })()`);
    if (!switchRes.ok) {
      throw new Error(`Failed to switch to mainline step [${step}]: ${switchRes.reason}`);
    }
    await sleep(800);
    const rendered = await evalInPage(`document.querySelector('#viewRoot')?.dataset?.renderedView`);
    console.log(`[Smoke] Mainline step [${step}] active, renderedView: "${rendered}"`);
  }

  // 6. Verify DoDAF OV-1 Drafting Legend in OV-1 View
  console.log("[Smoke] Verifying OV-1 drafting legend and canvas in Step 05 ...");
  await evalInPage(`(() => {
    const btn = document.querySelector('.step-button[data-view="ov1"]') || document.querySelector('[data-view="ov1"]');
    btn?.click();
  })()`);
  await sleep(1500);

  const ov1Rendered = await evalInPage(`(() => {
    const root = document.querySelector('#viewRoot');
    const hasLegend = Boolean(root?.querySelector('[data-dodaf-legend="OV-1"]'));
    const hasCanvas = Boolean(root?.querySelector('[data-dodaf-product="OV-1"]'));
    return {
      renderedView: root?.dataset?.renderedView,
      hasLegend,
      hasCanvas
    };
  })()`);
  console.log("[Smoke] OV-1 render check:", JSON.stringify(ov1Rendered));

  if (!ov1Rendered.hasLegend) {
    throw new Error(`OV-1 view did not render the required [data-dodaf-legend="OV-1"] legend! RenderedView: ${ov1Rendered.renderedView}`);
  }
  console.log("[Smoke] ✓ OV-1 legend [data-dodaf-legend=\"OV-1\"] verified cleanly");

  // 6.1 T1.3 撤销事务链路冒烟验证：应用候选 -> 节点数变更 -> 点击撤销 -> 节点数精确回退
  console.log("[Smoke] Verifying T1.3 Undo transaction flow (apply candidate -> undo -> restore nodes) ...");
  const undoTestResult = await evalInPage(`(async () => {
    try {
      const wb = window.__workbench;
      if (!wb) return { ok: false, reason: "window.__workbench not found" };
      const state = wb.getState();
      const originalCount = (state.ov1?.nodes || []).length;

      // 绕过 window.confirm 自动确认
      const originalConfirm = window.confirm;
      window.confirm = () => true;

      try {
        // 模拟执行一个事务变更：修改 OV-1 节点
        await wb.applyWithRecoveryPoint({
          label: "冒烟测试添加候选节点",
          source: "smoke-ov1-candidate"
        }, async () => {
          state.ov1 = {
            ...(state.ov1 || {}),
            nodes: [
              ...(state.ov1?.nodes || []),
              { id: "smoke-node-cand-1", label: "候选节点 Alpha", role: "sensor" },
              { id: "smoke-node-cand-2", label: "候选节点 Beta", role: "shooter" }
            ]
          };
        });

        const appliedCount = (state.ov1?.nodes || []).length;
        const undoBtn = document.getElementById("undoTransactionBtn");
        const undoDisabledBefore = undoBtn?.disabled;
        const undoTextBefore = undoBtn?.textContent;

        // 触发顶部撤销按钮点击 (data-action="undo-last-transaction")
        undoBtn?.click();
        await new Promise((r) => setTimeout(r, 600));

        const restoredCount = (state.ov1?.nodes || []).length;
        const undoDisabledAfter = undoBtn?.disabled;

        return {
          ok: true,
          originalCount,
          appliedCount,
          restoredCount,
          undoDisabledBefore,
          undoDisabledAfter,
          undoTextBefore
        };
      } finally {
        window.confirm = originalConfirm;
      }
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  })()`);

  console.log("[Smoke] Undo transaction flow check:", JSON.stringify(undoTestResult));
  if (!undoTestResult.ok || undoTestResult.appliedCount !== (undoTestResult.originalCount + 2) || undoTestResult.restoredCount !== undoTestResult.originalCount) {
    throw new Error(`Undo transaction test failed! Applied: ${undoTestResult.appliedCount}, Restored: ${undoTestResult.restoredCount}, Expected: ${undoTestResult.originalCount}`);
  }
  console.log("[Smoke] ✓ T1.3 Undo transaction flow verified cleanly (nodes: " + undoTestResult.originalCount + " -> " + undoTestResult.appliedCount + " -> " + undoTestResult.restoredCount + ")");

  // 7. Check for critical runtime errors
  console.log(`[Smoke] Critical errors recorded during walkthrough: ${criticalErrors.length}`);
  if (criticalErrors.length > 0) {
    console.error("[Smoke] ✗ Test failed due to frontend runtime errors:");
    for (const err of criticalErrors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log("[Smoke] ✓ Headless Edge CDP smoke test PASSED with 0 errors!");
} finally {
  // Cleanup processes and temp directory
  try { if (ws && ws.readyState === WebSocket.OPEN) ws.close(); } catch {}
  try { if (edgeProc && !edgeProc.killed) edgeProc.kill("SIGKILL"); } catch {}
  try { if (serverProc && !serverProc.killed) serverProc.kill("SIGKILL"); } catch {}
  try { await rm(tempDir, { recursive: true, force: true }); } catch {}
  console.log("[Smoke] Cleaned up temporary test environment.");
}

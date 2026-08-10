import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createConnection } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8765;

/**
 * Ensure the independent combat-map-web drawing tool is reachable.
 * Process boundary: detached + unref; workbench does not own its lifecycle
 * and does not kill it on shutdown. Failures never block workbench startup.
 */
export async function ensureConceptMapToolStarted(options = {}) {
  if (isDisabled(process.env.CONCEPT_MAP_TOOL_ENABLED)) {
    return { status: "disabled" };
  }

  const host = String(options.host || process.env.CONCEPT_MAP_TOOL_HOST || DEFAULT_HOST).trim() || DEFAULT_HOST;
  const port = Number(options.port || process.env.CONCEPT_MAP_TOOL_PORT || DEFAULT_PORT) || DEFAULT_PORT;
  const root = fileURLToPath(new URL("..", import.meta.url));
  const toolRoot = resolve(
    String(options.toolRoot || process.env.CONCEPT_MAP_TOOL_ROOT || join(root, "..", "combat-map-web")).trim()
  );
  const serverScript = join(toolRoot, "server.py");

  if (await isPortOpen(host, port)) {
    return { status: "already-running", host, port, toolRoot };
  }

  try {
    await access(serverScript);
  } catch {
    return { status: "missing", host, port, toolRoot, detail: `未找到 ${serverScript}` };
  }

  const pythonCandidates = uniqueStrings([
    process.env.CONCEPT_MAP_TOOL_PYTHON,
    process.platform === "win32" ? "py" : null,
    "python",
    "python3"
  ]);

  let lastError = null;
  for (const python of pythonCandidates) {
    try {
      const child = spawn(python, pythonArgs(python, serverScript, host, port), {
        cwd: toolRoot,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        shell: false
      });
      child.unref();
      child.once("error", () => {
        // Detached tool lifecycle is independent; log only when spawn itself fails.
      });

      const ready = await waitForPort(host, port, {
        timeoutMs: Number(process.env.CONCEPT_MAP_TOOL_READY_MS || 8000),
        intervalMs: 250
      });
      if (ready) {
        return { status: "started", host, port, toolRoot, pid: child.pid, python };
      }
      lastError = new Error(`started but port ${host}:${port} not ready`);
    } catch (error) {
      lastError = error;
    }
  }

  return {
    status: "failed",
    host,
    port,
    toolRoot,
    detail: lastError?.message || "无法启动概念图绘制工具"
  };
}

function pythonArgs(python, serverScript, host, port) {
  const args = [serverScript, "--host", host, "--port", String(port)];
  if (process.platform === "win32" && /^py(\.exe)?$/i.test(python)) {
    return ["-3", ...args];
  }
  return args;
}

function isDisabled(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no";
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function isPortOpen(host, port, timeoutMs = 400) {
  return new Promise((resolveOpen) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolveOpen(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function waitForPort(host, port, { timeoutMs = 8000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(host, port)) return true;
    await sleep(intervalMs);
  }
  return false;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

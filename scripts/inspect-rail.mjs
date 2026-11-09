import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRuntime } from "../server/createRuntime.mjs";
import { createRequestHandler } from "../server/createRequestHandler.mjs";

const PORT = 58921;
const CDP_PORT = 58922;

const runtime = createRuntime({
  env: {
    PORT: String(PORT),
    DATA_DIR: path.join(process.cwd(), "data"),
    PROJECT_STORAGE_MODE: "sqlite"
  }
});
const server = http.createServer(createRequestHandler(runtime));

server.listen(PORT, async () => {
  console.log(`Server started on ${PORT}`);
  
  // 查找 edge 或 chrome
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  const browserPath = candidates.find((p) => fs.existsSync(p));
  if (!browserPath) {
    console.error("No browser found");
    server.close();
    process.exit(1);
  }

  const browser = spawn(browserPath, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=" + path.join(process.cwd(), "tmp-chrome-debug"),
    `http://127.0.0.1:${PORT}/?project=default`
  ]);

  // wait for CDP
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const pages = await listRes.json();
  const page = pages.find((p) => p.type === "page");
  if (!page) {
    console.error("No page found");
    browser.kill();
    server.close();
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const handler = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === curId) {
        ws.removeEventListener("message", handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await new Promise((r) => ws.onopen = r);

  // 等待页面加载和渲染
  await new Promise((r) => setTimeout(r, 2000));

  const evalResult = await send("Runtime.evaluate", {
    expression: `(() => {
      const rail = document.querySelector(".project-rail");
      const spine = document.querySelector(".step-spine");
      const path = document.querySelector(".step-path");
      const nodes = Array.from(document.querySelectorAll(".step-node"));

      const rRect = rail ? rail.getBoundingClientRect() : null;
      const sRect = spine ? spine.getBoundingClientRect() : null;
      const pRect = path ? path.getBoundingClientRect() : null;
      const nRects = nodes.map((n, i) => {
        const rect = n.getBoundingClientRect();
        return { index: i, top: rect.top, height: rect.height, bottom: rect.bottom };
      });

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        rail: rRect ? { top: rRect.top, height: rRect.height, bottom: rRect.bottom } : null,
        spine: sRect ? { top: sRect.top, height: sRect.height, bottom: sRect.bottom } : null,
        path: pRect ? { top: pRect.top, height: pRect.height, bottom: pRect.bottom } : null,
        pathComputed: path ? {
          display: getComputedStyle(path).display,
          flexDirection: getComputedStyle(path).flexDirection,
          justifyContent: getComputedStyle(path).justifyContent,
          height: getComputedStyle(path).height,
          gap: getComputedStyle(path).gap
        } : null,
        spineComputed: spine ? {
          height: getComputedStyle(spine).height,
          display: getComputedStyle(spine).display
        } : null,
        railComputed: rail ? {
          height: getComputedStyle(rail).height,
          top: getComputedStyle(rail).top
        } : null,
        nodes: nRects
      };
    })()`,
    returnByValue: true
  });

  console.log("Layout inspection result:\n", JSON.stringify(evalResult.result.value, null, 2));

  ws.close();
  browser.kill();
  server.close();
  process.exit(0);
});

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9223;
const USER_DATA = path.join(process.cwd(), ".playwright-cli", "headless-profile");

fs.mkdirSync(USER_DATA, { recursive: true });

async function run() {
  console.log("Launching headless Edge browser...");
  const edge = spawn(EDGE_PATH, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "about:blank"
  ]);

  edge.stderr.on("data", (d) => {});
  edge.on("error", (e) => console.error("Edge spawn error:", e));

  // Wait for remote debugging endpoint to become ready
  let endpoint = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        endpoint = await res.json();
        break;
      }
    } catch {}
  }

  if (!endpoint) {
    console.error("Failed to connect to Edge remote debugging port");
    edge.kill();
    process.exit(1);
  }

  console.log("Connected to browser:", endpoint.Browser);

  // Get active pages
  const pagesRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const pages = await pagesRes.json();
  const pageTarget = pages.find((p) => p.type === "page") || pages[0];

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  console.log("Navigating to http://127.0.0.1:8792/ ...");
  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");

  await send("Page.navigate", { url: "http://127.0.0.1:8792/" });

  // Wait for load
  await new Promise((r) => setTimeout(r, 2000));

  const titleRes = await send("Runtime.evaluate", {
    expression: "document.title"
  });
  console.log("Page title:", titleRes.result?.value);

  const shot = await send("Page.captureScreenshot", { format: "png" });
  const shotPath = path.join(process.cwd(), ".playwright-cli", "probe-test.png");
  fs.writeFileSync(shotPath, Buffer.from(shot.data, "base64"));
  console.log("Saved test screenshot to:", shotPath);

  ws.close();
  edge.kill();
  console.log("Browser probe finished cleanly.");
}

run().catch((e) => {
  console.error("Probe error:", e);
  process.exit(1);
});

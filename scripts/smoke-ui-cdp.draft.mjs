// DRAFT smoke test (headless Edge via CDP, zero deps). Usage: node scripts/smoke-ui-cdp.draft.mjs http://127.0.0.1:<port>/  — run against an isolated server with temp DB paths.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.argv[2] || "http://127.0.0.1:8792/";
const port = 9333;
const proc = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "edge-"))}`, `--remote-debugging-port=${port}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {}
  if (!target) await sleep(250);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split("\n").slice(0, 3).join(" | "));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("CONSOLE " + m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errors.push("LOG " + m.params.entry.text.slice(0, 200) + " " + (m.params.entry.url || ""));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: URL_ });
await sleep(3000);
console.log("setup:", await ev(`(async()=>{const h={'content-type':'application/json'};const b=JSON.stringify({username:'smoke',label:'Smoke',password:'smoke-test-password-1'});
 const s=await fetch('/api/collaboration/auth/setup',{method:'POST',headers:h,body:b,credentials:'include'});
 const l=await fetch('/api/collaboration/auth/login',{method:'POST',headers:h,body:b,credentials:'include'});
 return s.status+'/'+l.status;})()`));
errors.length = 0;
await send("Page.reload");
await sleep(6000);
console.log("create via UI:", await ev(`(async()=>{document.querySelector('[data-action="toggle-project-create"]')?.click(); await new Promise(r=>setTimeout(r,500));
 const f=document.querySelector('#projectCreateForm'); if(!f) return 'no form';
 const set=(n,v)=>{const i=f.querySelector('[name="'+n+'"]'); if(i){i.value=v;}}; set('id','smoke-proj'); set('title','冒烟测试项目'); set('description','smoke');
 f.requestSubmit(); await new Promise(r=>setTimeout(r,3000)); return 'submitted, bodyLen='+document.body.innerText.length;})()`));
await sleep(3000);
console.log("title:", await ev("document.title"));
console.log("body text len:", await ev("document.body.innerText.length"));
console.log("errors after load:", errors.length); errors.forEach((e) => console.log("  ", e));
// Click through workflow step / nav actions that are visible and non-destructive.
const actions = await ev(`[...new Set([...document.querySelectorAll('[data-action]')].filter(b=>b.offsetParent).map(b=>b.dataset.action))]`);
console.log("visible actions:", actions?.length, JSON.stringify(actions).slice(0, 800));
const safe = (actions || []).filter((a) => !/delete|remove|reset|clear|logout|generate|ai|export|restore|save|confirm|apply|accept|adopt|send/i.test(a));
for (const a of safe.slice(0, 40)) {
  const before = errors.length;
  await ev(`(()=>{const b=[...document.querySelectorAll('[data-action="${a}"]')].find(x=>x.offsetParent); b&&b.click(); return !!b;})()`);
  await sleep(500);
  if (errors.length > before) console.log(`click ${a} ->`, errors.slice(before).join(" || "));
}
// Step capsules / phase navigation
await ev(`document.querySelector('[data-action="toggle-workflow-test-mode"]')?.click()`);
await sleep(800);
const seen = new Set();
for (let round = 0; round < 3; round++) {
  const views = await ev(`[...new Set([...document.querySelectorAll('[data-view],[data-view-mode],[data-view-page]')].filter(b=>b.offsetParent).map(b=>(b.dataset.view?'view:'+b.dataset.view:b.dataset.viewMode?'mode:'+b.dataset.viewMode:'page:'+b.dataset.viewPage)))]`) || [];
  for (const v of views) {
    if (seen.has(v)) continue; seen.add(v);
    const [k, val] = [v.split(":")[0], v.slice(v.indexOf(":") + 1)];
    const attr = k === "view" ? "data-view" : k === "mode" ? "data-view-mode" : "data-view-page";
    const before = errors.length;
    await ev(`(()=>{const b=[...document.querySelectorAll('[${attr}="${val}"]')].find(x=>x.offsetParent); b&&b.click();})()`);
    await sleep(900);
    const len = await ev(`document.body.innerText.length`);
    console.log(`${v.padEnd(36)} bodyLen=${len}`, errors.length > before ? "ERR: " + errors.slice(before).join(" || ") : "");
  }
}
console.log("TOTAL errors:", errors.length);
if (process.env.DUMP) {
  const { writeFileSync } = await import("node:fs");
  await ev(`(()=>{const b=[...document.querySelectorAll('[data-view="ov5"]')].find(x=>x.offsetParent); b&&b.click();})()`);
  await sleep(2500);
  writeFileSync(process.env.DUMP + ".txt", await ev(`document.body.innerText`));
  writeFileSync(process.env.DUMP + ".html", await ev(`document.body.outerHTML`));
}
ws.close(); proc.kill();
process.exit(0);

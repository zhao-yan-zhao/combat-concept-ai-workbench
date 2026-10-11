import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const CDP_PORT = 9240 + Math.floor(Math.random() * 80);
const USER_DATA = path.join(process.cwd(), ".playwright-cli", `headless-profile-audit-${process.pid}`);
const SCREENSHOT_DIR = path.join(process.cwd(), ".playwright-cli");

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log("=== 1. 获取本地协同测试登录 Cookie ===");
  const loginRes = await fetch("http://127.0.0.1:8792/api/collaboration/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "testuser", password: "testpassword123" })
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }
  const setCookieHeader = loginRes.headers.get("set-cookie") || "";
  const tokenMatch = setCookieHeader.match(/combat_collaboration_session=([^;]+)/);
  if (!tokenMatch) {
    throw new Error(`Could not extract session token from Set-Cookie: ${setCookieHeader}`);
  }
  const sessionToken = tokenMatch[1];
  console.log("成功获取 Session Token:", sessionToken.slice(0, 24) + "...");

  console.log("=== 2. 启动 Headless Edge 浏览器 ===");
  const edge = spawn(EDGE_PATH, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "about:blank"
  ]);

  edge.on("error", (err) => console.error("Edge process error:", err));

  let endpoint = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) {
        endpoint = await res.json();
        break;
      }
    } catch {}
  }
  if (!endpoint) {
    edge.kill();
    throw new Error("Failed to connect to Edge remote debugging port");
  }

  const pagesRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const pages = await pagesRes.json();
  const pageTarget = pages.find((p) => p.type === "page") || pages[0];

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let idCounter = 1;
  const pending = new Map();
  const consoleLogs = [];
  const uncaughtErrors = [];

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send("Runtime.evaluate", {
      expression,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      const detail = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      console.error("Browser JS Exception:", detail);
      throw new Error(`Evaluation failed: ${detail}`);
    }
    return res.result?.value;
  }

  await new Promise((resolve) => { ws.onopen = resolve; });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Runtime.consoleAPICalled") {
      const args = (msg.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
      consoleLogs.push(`[${msg.params.type}] ${args}`);
    } else if (msg.method === "Runtime.exceptionThrown") {
      const details = msg.params.exceptionDetails;
      const desc = details?.exception?.description || details?.text || JSON.stringify(details);
      uncaughtErrors.push(desc);
    }

    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await send("Page.enable");
  await send("Network.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });

  // 设置 Session Cookie
  await send("Network.setCookie", {
    name: "combat_collaboration_session",
    value: sessionToken,
    url: "http://127.0.0.1:8792/",
    domain: "127.0.0.1",
    path: "/"
  });

  console.log("=== 3. 导航至工作台并等待加载 ===");
  await send("Page.navigate", { url: "http://127.0.0.1:8792/?project=dd" });

  // 轮询等待工作台装载完成
  let ready = false;
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const res = await send("Runtime.evaluate", {
        expression: "Boolean(window.__workbench && window.__workbench.getState())",
        returnByValue: true
      });
      if (res.result?.value === true) {
        ready = true;
        break;
      }
    } catch {}
  }

  if (!ready) {
    console.error("Recent Console Logs:", consoleLogs);
    console.error("Uncaught Errors:", uncaughtErrors);
    throw new Error("工作台前端未能正常初始化或 window.__workbench 未挂载");
  }

  console.log("=== 4. 切换至 OV-6b 状态流程图 ===");
  const navRes = await evaluate(`(() => {
    window.__workbench.goToWorkflowView("ov6b");
    window.__workbench.render();
    const state = window.__workbench.getState();
    return {
      activeView: state.activeView,
      authenticated: state.collaboration?.session?.authenticated,
      actor: state.collaboration?.session?.actor?.label
    };
  })()`);
  console.log("工作台状态:", navRes);

  // 等待后台初始装载完成
  await new Promise((r) => setTimeout(r, 2500));

  console.log("=== 5. 注入包含判定菱形、循环与多分支的测试状态机 ===");
  const setupMachine = await evaluate(`(() => {
    const state = window.__workbench.getState();
    
    // 创建一个包含所有要素的完备状态机：
    // 初始态(initial) -> 侦搜态(normal) -> 确证判定(decision, 满足->突击, 不满足->侦搜) -> 突击态(normal) -> 毁伤评估(normal) -> 结束态(final)
    const testMachine = {
      id: "sm-audit-test-machine",
      name: "无人蜂群多目标侦打状态流程",
      subjectType: "task",
      subjectRef: "task-swarm-recon-strike",
      canvasLayout: "auto",
      states: [
        { id: "s-init", label: "进入待命空域", kind: "initial" },
        { id: "s-recon", label: "分布式广域侦搜", kind: "normal" },
        { id: "s-decide", label: "目标确证与威胁度判定", kind: "decision", decisionExpression: "目标威胁度 >= 0.85 且定位精度 <= 5m" },
        { id: "s-strike", label: "蜂群饱和协同突击", kind: "normal" },
        { id: "s-reassess", label: "战场毁伤评估", kind: "normal" },
        { id: "s-finish", label: "完成突击脱离撤出", kind: "final" }
      ],
      transitions: [
        { id: "t1", fromStateRef: "s-init", toStateRef: "s-recon", condition: "阵位展开完毕" },
        { id: "t2", fromStateRef: "s-recon", toStateRef: "s-decide", condition: "截获疑似辐射源特征" },
        { id: "t3", fromStateRef: "s-decide", toStateRef: "s-strike", branchResult: "满足", condition: "满足判定条件" },
        { id: "t4", fromStateRef: "s-decide", toStateRef: "s-recon", branchResult: "不满足", condition: "不满足，重置扫描波束" },
        { id: "t5", fromStateRef: "s-strike", toStateRef: "s-reassess", condition: "导引头自毁确认" },
        { id: "t6", fromStateRef: "s-reassess", toStateRef: "s-finish", condition: "目标彻底瘫痪" }
      ]
    };

    const existing = state.ov6b?.stateMachines || [];
    state.ov6b = {
      version: 2,
      stateMachines: [testMachine, ...existing.filter(m => m.id !== testMachine.id)]
    };
    state.ov6bSelectedMachineId = testMachine.id;
    window.__workbench.render();

    // 点击该机器列表项以激活编辑
    const itemBtn = document.querySelector('[data-machine-id="sm-audit-test-machine"]');
    if (itemBtn) itemBtn.click();

    return {
      id: testMachine.id,
      name: testMachine.name,
      stateCount: testMachine.states.length,
      transitionCount: testMachine.transitions.length,
      currentCanvasMachine: document.querySelector(".sm-flow-canvas")?.dataset.machineId
    };
  })()`);
  console.log("测试状态机注入完成:", setupMachine);

  await new Promise((r) => setTimeout(r, 1200));

  console.log("=== 6. 执行几何度量审计（重叠/顶点贴合/文字居中/无限画布）===");
  const auditMetrics = await evaluate(`(() => {
    const stage = document.querySelector(".sm-flow-stage");
    const world = document.querySelector(".sm-flow-world");
    if (!stage || !world) {
      return {
        error: "Canvas stage or world not found",
        canvas: Boolean(document.querySelector(".sm-flow-canvas")),
        smPage: Boolean(document.querySelector(".sm-page")),
        activeView: window.__workbench.getState().activeView,
        machines: (window.__workbench.getState().ov6b?.stateMachines || []).map(m => m.id),
        selectedMachineId: window.__workbench.getState().ov6bSelectedMachineId,
        mainHtmlSnippet: document.querySelector(".sm-main-panel")?.innerHTML.slice(0, 300)
      };
    }
    const nodes = [...document.querySelectorAll(".sm-flow-node-wrap")];
    const labels = [...document.querySelectorAll(".sm-flow-edge-label")];
    const paths = [...document.querySelectorAll(".sm-flow-lines path.sm-flow-edge")];

    // 1. 节点包围盒重叠检测
    const nodeBoxes = nodes.map(n => {
      const r = n.getBoundingClientRect();
      return {
        id: n.dataset.ov1Node,
        kind: n.className.match(/kind-([a-z]+)/)?.[1] || "normal",
        rect: {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2
        }
      };
    });

    const nodeOverlaps = [];
    for (let i = 0; i < nodeBoxes.length; i++) {
      for (let j = i + 1; j < nodeBoxes.length; j++) {
        const a = nodeBoxes[i].rect;
        const b = nodeBoxes[j].rect;
        const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (xOverlap > 1 && yOverlap > 1) {
          nodeOverlaps.push({ nodeA: nodeBoxes[i].id, nodeB: nodeBoxes[j].id, xOverlap, yOverlap });
        }
      }
    }

    // 2. 菱形 4 个端口小蓝点精准贴合尖角顶点检测
    const decisionAudits = [];
    nodes.filter(n => n.classList.contains("kind-decision")).forEach(n => {
      const wrapRect = n.getBoundingClientRect();
      const innerNode = n.querySelector(".sm-flow-node.kind-decision");
      const ports = [...n.querySelectorAll(".sm-flow-port")].map(p => {
        const pr = p.getBoundingClientRect();
        return {
          side: p.dataset.side,
          cx: pr.left + pr.width / 2,
          cy: pr.top + pr.height / 2,
          w: pr.width,
          h: pr.height
        };
      });

      // 菱形四个理想顶点 (尖角)
      const expectedVertices = {
        top: { x: wrapRect.left + wrapRect.width / 2, y: wrapRect.top },
        bottom: { x: wrapRect.left + wrapRect.width / 2, y: wrapRect.bottom },
        left: { x: wrapRect.left, y: wrapRect.top + wrapRect.height / 2 },
        right: { x: wrapRect.right, y: wrapRect.top + wrapRect.height / 2 }
      };

      const portDeviations = ports.map(p => {
        const expected = expectedVertices[p.side];
        const dist = Math.hypot(p.cx - expected.x, p.cy - expected.y);
        return {
          side: p.side,
          actual: { x: Math.round(p.cx), y: Math.round(p.cy) },
          expected: { x: Math.round(expected.x), y: Math.round(expected.y) },
          deviationPx: Math.round(dist * 100) / 100
        };
      });

      decisionAudits.push({
        id: n.dataset.ov1Node,
        portDeviations,
        maxDeviationPx: Math.max(...portDeviations.map(d => d.deviationPx))
      });
    });

    // 3. 连线文字居中性与节点重叠检测
    const labelAudits = labels.map(l => {
      const edgeId = l.dataset.ov1EdgeLabel;
      const lr = l.getBoundingClientRect();
      const lCenter = { x: lr.left + lr.width / 2, y: lr.top + lr.height / 2 };
      const text = l.textContent.trim();

      // 检查与任意节点的重叠
      let overlapsNode = null;
      for (const n of nodeBoxes) {
        const b = n.rect;
        const xOverlap = Math.max(0, Math.min(lr.right, b.right) - Math.max(lr.left, b.left));
        const yOverlap = Math.max(0, Math.min(lr.bottom, b.bottom) - Math.max(lr.top, b.top));
        if (xOverlap > 1 && yOverlap > 1) {
          overlapsNode = { nodeId: n.id, xOverlap, yOverlap };
          break;
        }
      }

      return {
        edgeId,
        text,
        center: { x: Math.round(lCenter.x), y: Math.round(lCenter.y) },
        rect: { width: Math.round(lr.width), height: Math.round(lr.height) },
        overlapsNode: Boolean(overlapsNode),
        overlapDetail: overlapsNode
      };
    });

    // 4. 画布平移、缩放与世界尺寸
    const worldTransform = world.style.transform;
    const worldRect = world.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();

    return {
      nodeCount: nodes.length,
      nodeOverlapsCount: nodeOverlaps.length,
      nodeOverlaps,
      decisionAudits,
      labelCount: labels.length,
      labelOverlapsCount: labelAudits.filter(l => l.overlapsNode).length,
      labelAudits,
      worldInfo: {
        styleWidth: world.style.width,
        styleHeight: world.style.height,
        transform: worldTransform,
        stageW: Math.round(stageRect.width),
        stageH: Math.round(stageRect.height)
      }
    };
  })()`);

  console.log("=== 几何度量审计结果 ===");
  console.log(JSON.stringify(auditMetrics, null, 2));
  if (auditMetrics.error) {
    throw new Error(`Audit metrics failed: ${auditMetrics.error}`);
  }
  console.log(`- 节点总数: ${auditMetrics.nodeCount}`);
  console.log(`- 节点间重叠数: ${auditMetrics.nodeOverlapsCount} (期望: 0)`);
  if (auditMetrics.nodeOverlapsCount > 0) {
    console.warn("发现节点重叠:", auditMetrics.nodeOverlaps);
  }
  console.log(`- 判定菱形端口贴合顶点最大偏差: ${auditMetrics.decisionAudits?.[0]?.maxDeviationPx} px (期望 <= 2px)`);
  console.log("  端口明细:", auditMetrics.decisionAudits[0]?.portDeviations);
  console.log(`- 连线文字总数: ${auditMetrics.labelCount}`);
  console.log(`- 连线文字与节点重叠数: ${auditMetrics.labelOverlapsCount} (期望: 0)`);
  console.log("  连线文字明细:");
  auditMetrics.labelAudits.forEach(l => {
    console.log(`    [${l.text}] 尺寸: ${l.rect.width}x${l.rect.height}, 中心: (${l.center.x}, ${l.center.y}), 重叠节点: ${l.overlapsNode}`);
  });
  console.log("- 画布尺寸与变换:", auditMetrics.worldInfo);

  console.log("=== 7. 测试节点点击防抖（位移 < 8px 零打散验证）===");
  const clickTest = await evaluate(`(() => {
    const targetNode = document.querySelector(".sm-flow-node-wrap.kind-decision") || document.querySelector(".sm-flow-node-wrap");
    if (!targetNode) return { error: "No node found" };

    // 记录点击前全部节点坐标
    const beforePositions = [...document.querySelectorAll(".sm-flow-node-wrap")].map(n => ({
      id: n.dataset.ov1Node,
      left: n.style.left,
      top: n.style.top
    }));

    // 模拟点击 (pointerdown -> pointerup，位移 2px，小于 8px 门限)
    const rect = targetNode.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    targetNode.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX, clientY, button: 0, isPrimary: true }));
    targetNode.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, cancelable: true, clientX: clientX + 2, clientY: clientY + 1, button: 0, isPrimary: true }));
    targetNode.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, clientX: clientX + 2, clientY: clientY + 1, button: 0, isPrimary: true }));

    // 记录点击后全部节点坐标
    const afterPositions = [...document.querySelectorAll(".sm-flow-node-wrap")].map(n => ({
      id: n.dataset.ov1Node,
      left: n.style.left,
      top: n.style.top
    }));

    let diffCount = 0;
    for (let i = 0; i < beforePositions.length; i++) {
      if (beforePositions[i].left !== afterPositions[i].left || beforePositions[i].top !== afterPositions[i].top) {
        diffCount++;
      }
    }

    return {
      clickedNodeId: targetNode.dataset.ov1Node,
      diffCount,
      passed: diffCount === 0,
      selectedStateId: window.__workbench.getState().ov6bSelectedStateId
    };
  })()`);
  console.log("节点点击防抖结果:", clickTest);

  console.log("=== 8. 测试无限画布缩放与平移交互 ===");
  const zoomPanTest = await evaluate(`(() => {
    const stage = document.querySelector(".sm-flow-stage");
    const world = document.querySelector(".sm-flow-world");
    const t0 = world.style.transform;

    // 模拟滚轮缩放
    stage.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -200, clientX: 500, clientY: 400 }));
    const tZoom = world.style.transform;

    // 模拟空白拖拽平移
    stage.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 200, clientY: 200, button: 0, isPrimary: true }));
    window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, cancelable: true, clientX: 250, clientY: 230, button: 0, isPrimary: true }));
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, clientX: 250, clientY: 230, button: 0, isPrimary: true }));
    const tPan = world.style.transform;

    // 点击自适应视角按钮
    const fitBtn = document.querySelector("[data-sm-canvas-fit]");
    if (fitBtn) fitBtn.click();
    const tFit = world.style.transform;

    return {
      initialTransform: t0,
      afterZoom: tZoom,
      zoomChanged: tZoom !== t0,
      afterPan: tPan,
      panChanged: tPan !== tZoom,
      afterFit: tFit
    };
  })()`);
  console.log("缩放与平移测试结果:", zoomPanTest);

  console.log("=== 9. 截图保存至 .playwright-cli/ov6b-adaptive-layout.png ===");
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "ov6b-adaptive-layout.png"), Buffer.from(screenshot.data, "base64"));
  console.log("截图保存成功!");

  console.log("=== 10. 控制台未捕获异常检查 ===");
  console.log("Uncaught Errors Count:", uncaughtErrors.length);
  if (uncaughtErrors.length > 0) {
    console.error("Uncaught Errors:", uncaughtErrors);
  }

  ws.close();
  edge.kill();
  console.log("=== 审计流程结束 ===");
}

main().catch((err) => {
  console.error("Audit Execution Error:", err);
  process.exit(1);
});

const checks = [
  { id: "ov1", model: "OV-1", title: "总体关系闭合", state: "pass", detail: "规划对象之间的总体关系可被清晰表达。", source: "阶段 P-02 与兵力 F-03", impact: ["OV-1 总体概念", "概念图关系层"] },
  { id: "ov5", model: "OV-5b", title: "关键活动责任归属", state: "issue", detail: "活动 A-07 尚未关联明确的责任对象，可能影响活动链的完整性。", source: "阶段 P-03 / 行动 A-07", sourceType: "阶段与行动", impact: ["OV-5a 活动分解", "OV-5b 活动关系", "OV-4 职责关系"] },
  { id: "ov2", model: "OV-2", title: "资源流参与方一致性", state: "pass", detail: "资源流的发起方与接收方均可回溯至规划对象。", source: "兵力 F-01、F-03", impact: ["OV-2 节点与交换"] },
  { id: "ov6a", model: "OV-6a", title: "转换条件可验证性", state: "issue", detail: "阶段 P-02 至 P-03 的转换条件缺少可观察的判定描述。", source: "阶段 P-02 / 转换 T-02", sourceType: "阶段与行动", impact: ["OV-6a 规则", "OV-6b 状态转换", "OV-6c 事件序列"] },
  { id: "ov4", model: "OV-4", title: "职责关系覆盖", state: "pass", detail: "主要职责与协同关系均已关联至相应对象。", source: "兵力与任务设计", impact: ["OV-4 职责关系"] },
  { id: "map", model: "概念图", title: "关键关系来源完整性", state: "issue", detail: "关系 R-04 仅存在于概念图，需要补充其规划来源或标记为人工补充。", source: "概念图 / 关系 R-04", sourceType: "概念图", impact: ["OV-1 总体概念", "OV-2 资源流", "OV-5b 活动关系"] },
  { id: "ov6c", model: "OV-6c", title: "关键事件时序", state: "pass", detail: "关键事件顺序与已确认阶段顺序一致。", source: "阶段 P-01 至 P-03", impact: ["OV-6c 事件序列"] }
];

const sources = [
  { id: "phase", title: "阶段与行动", version: "V1.2", count: "3 个阶段 · 9 项行动", text: "时序、行动、条件、效果和转换的事实来源。", affected: "OV-5、OV-6" },
  { id: "force", title: "兵力与任务", version: "V1.1", count: "5 个对象 · 6 项关系", text: "职责、协同与资源流参与方的事实来源。", affected: "OV-1、OV-2、OV-4" },
  { id: "map", title: "概念图", version: "V1.2", count: "12 个对象 · 8 项关系", text: "总体空间关系和研究级表达的事实来源。", affected: "OV-1、OV-2、OV-5" }
];

let selectedId = null;
let activeFilter = "all";
let revisions = [];
let activePanel = "validation";

const $ = (selector) => document.querySelector(selector);

function iconRefresh() { window.lucide?.createIcons(); }

function renderChecks() {
  const visible = checks.filter((item) => activeFilter === "all" || (activeFilter === "issue" ? item.state === "issue" : item.state === "pass"));
  $("#checks").innerHTML = visible.map((item) => `
    <article class="check ${item.state} ${item.id === selectedId ? "selected" : ""}" data-check="${item.id}" tabindex="0">
      <span class="check-marker"></span>
      <div><div class="check-title"><span class="model-tag">${item.model}</span><strong>${item.title}</strong></div><p>${item.detail}</p></div>
      <span class="check-status">${item.state === "pass" ? "通过" : "待处理"}</span>
    </article>`).join("");
  document.querySelectorAll("[data-check]").forEach((element) => {
    element.addEventListener("click", () => selectCheck(element.dataset.check));
    element.addEventListener("keydown", (event) => { if (event.key === "Enter") selectCheck(element.dataset.check); });
  });
}

function selectCheck(id) {
  selectedId = id;
  const item = checks.find((check) => check.id === id);
  if (!item) return;
  renderChecks();
  $("#detailPanel").innerHTML = `
    <div class="detail-top"><div><span class="model-tag">${item.model}</span><h3>${item.title}</h3></div><span class="state-badge">${item.state === "pass" ? "已通过" : "待处理"}</span></div>
    <p class="detail-copy">${item.detail}</p>
    <div class="mapping"><span>定位来源</span><strong>${item.source}</strong></div>
    <div class="impact"><span class="section-label">受影响的复验范围</span><ul>${item.impact.map((value) => `<li>${value}</li>`).join("")}</ul></div>
    <div class="detail-actions">${item.state === "issue" ? `<button class="button" id="reviseBtn"><i data-lucide="square-pen"></i>修订来源对象</button>` : ""}<button class="button secondary" id="traceBtn"><i data-lucide="git-branch"></i>查看追溯关系</button></div>`;
  iconRefresh();
  $("#reviseBtn")?.addEventListener("click", () => openRevision(item));
  $("#traceBtn").addEventListener("click", () => alert(`追溯链：${item.source} → ${item.model} 验证视图`));
}

function renderSources() {
  $("#sources").innerHTML = sources.map((source) => `<article class="source-card"><header><span class="model-tag">${source.version}</span><span class="check-status">已确认</span></header><h3>${source.title}</h3><p>${source.text}</p><div class="source-meta"><span>${source.count}</span><span>影响 ${source.affected}</span></div><button class="button secondary source-revise" data-source="${source.id}"><i data-lucide="square-pen"></i>手动修订</button></article>`).join("");
  document.querySelectorAll(".source-revise").forEach((button) => button.addEventListener("click", () => {
    const source = sources.find((entry) => entry.id === button.dataset.source);
    openRevision({ source: source.title, sourceType: source.title, title: `${source.title} 手动修订`, impact: [source.affected] });
  }));
  iconRefresh();
}

function renderTimeline() {
  $("#timeline").innerHTML = revisions.length ? revisions.map((item) => `<article class="timeline-entry"><time>${item.time}</time><strong>${item.title}</strong><p>${item.note || "已保存来源修订，并标记相关 OV 待复验。"}</p></article>`).join("") : `<article class="timeline-entry"><time>当前版本</time><strong>规划 V1.2 已确认</strong><p>尚无验证驱动的来源修订。</p></article>`;
}

function openRevision(item) {
  const dialog = $("#revisionDialog");
  $("#dialogTitle").textContent = `修订：${item.sourceType || item.source}`;
  $("#dialogHint").textContent = `本次修订将保留当前验证记录，并只重新计算受影响的验证视图。`;
  $("#impactList").textContent = item.impact.join("、");
  $("#revisionNote").value = "";
  dialog.dataset.title = item.title;
  dialog.dataset.impact = item.impact.join("、");
  dialog.showModal();
}

$("#revisionForm").addEventListener("close", () => {});
$("#revisionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const dialog = $("#revisionDialog");
  const submitter = event.submitter?.value;
  if (submitter !== "confirm") { dialog.close(); return; }
  revisions.unshift({ title: dialog.dataset.title, note: $("#revisionNote").value.trim(), time: "刚刚" });
  const item = checks.find((check) => check.id === selectedId);
  if (item) item.state = "pass";
  $("#revisionMetric").textContent = revisions.length;
  $("#issueMetric").textContent = checks.filter((check) => check.state === "issue").length;
  $("#passMetric").textContent = checks.filter((check) => check.state === "pass").length;
  dialog.close(); renderChecks(); renderTimeline();
  if (item) selectCheck(item.id);
});

function activatePanel(id) {
  activePanel = id;
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.panel === id));
  ["validation", "plan", "revision", "archive"].forEach((name) => $(`#${name}Panel`).classList.toggle("hidden-panel", name !== id));
  $("#pageTitle").textContent = ({ validation: "OV 验证与回改", plan: "规划对象", revision: "修订记录", archive: "验证归档" })[id];
}

function archive() {
  $("#archiveText").textContent = `已归档：规划 V1.2，${checks.filter((check) => check.state === "pass").length} 项通过，${revisions.length} 条修订记录。`;
  activatePanel("archive");
}

document.querySelectorAll(".filter").forEach((button) => button.addEventListener("click", () => { activeFilter = button.dataset.filter; document.querySelectorAll(".filter").forEach((entry) => entry.classList.toggle("active", entry === button)); renderChecks(); }));
document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => activatePanel(button.dataset.panel)));
$("#refreshBtn").addEventListener("click", () => { $("#refreshBtn").classList.add("spin"); setTimeout(() => $("#refreshBtn").classList.remove("spin"), 500); });
$("#archiveBtn").addEventListener("click", archive); $("#archiveBtnInline").addEventListener("click", archive);
$("#helpBtn").addEventListener("click", () => alert("流程：确认规划 -> 以 OV 多视角验证 -> 定位来源修订 -> 局部复验 -> 归档。"));

renderChecks(); renderSources(); renderTimeline(); iconRefresh();

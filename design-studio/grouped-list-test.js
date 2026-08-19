const STATUS_LABELS = Object.freeze({ confirmed: "已确认", pending: "待确认", conflict: "有冲突", draft: "草稿" });
const DIMENSION_LABELS = Object.freeze({ side: "阵营", phase: "阶段", type: "类型", status: "状态", role: "职责", subject: "建模对象", parent: "父任务", level: "层级" });
const VALUE_LABELS = Object.freeze({ friendly: "蓝方", hostile: "红方", joint: "联合方", neutral: "中立方", command: "指挥", support: "保障", strike: "打击", reconnaissance: "侦察", task: "任务", force: "兵力", phase: "阶段", object: "持续对象", concept: "概念层", combat: "作战层" });

const samples = [
  sample("phase-action", "阶段行动", "阶段链", ["type", "status"], [
    item("PHA-01", "准备与塑势", "建立态势优势", "confirmed", { type: "准备阶段", phase: "阶段一" }),
    item("PHA-02", "联合突击", "形成关键方向突破", "pending", { type: "实施阶段", phase: "阶段二" }),
    item("PHA-03", "控制与稳固", "巩固行动效果", "draft", { type: "稳定阶段", phase: "阶段三" })
  ]),
  sample("operational-task", "作战任务", "任务清单", ["phase", "side", "type", "status"], [
    item("TSK-101", "夺取制信息权", "阶段一 · 关键任务", "confirmed", { phase: "阶段一", side: "friendly", type: "reconnaissance" }),
    item("TSK-102", "压制关键节点", "阶段二 · 主攻任务", "pending", { phase: "阶段二", side: "friendly", type: "strike" }),
    item("TSK-201", "保持区域拒止", "阶段二 · 对抗任务", "conflict", { phase: "阶段二", side: "hostile", type: "strike" }),
    item("TSK-301", "建立联合保障走廊", "阶段三 · 协同任务", "draft", { phase: "阶段三", side: "joint", type: "support" })
  ]),
  sample("force-mission", "作战兵力", "兵力名单", ["side", "phase", "role", "level", "status"], [
    item("FOR-01", "联合指挥所", "任务筹划与协同控制", "confirmed", { side: "joint", phase: "阶段一", role: "command", level: "concept" }),
    item("FOR-02", "蓝方侦察编组", "前沿态势感知", "pending", { side: "friendly", phase: "阶段一", role: "reconnaissance", level: "combat" }),
    item("FOR-03", "蓝方火力编组", "关键节点压制", "draft", { side: "friendly", phase: "阶段二", role: "strike", level: "combat" }),
    item("FOR-04", "红方防空单元", "区域拒止", "confirmed", { side: "hostile", phase: "阶段二", role: "support", level: "combat" })
  ]),
  sample("ov1b", "任务分解 OV1b", "任务分解项", ["side", "phase", "parent", "status"], [
    item("DEC-01", "识别关键辐射源", "父任务：夺取制信息权", "confirmed", { side: "friendly", phase: "阶段一", parent: "夺取制信息权" }),
    item("DEC-02", "建立目标优先级", "父任务：夺取制信息权", "pending", { side: "friendly", phase: "阶段一", parent: "夺取制信息权" }),
    item("DEC-03", "维持防空值班", "父任务：保持区域拒止", "draft", { side: "hostile", phase: "阶段二", parent: "保持区域拒止" })
  ]),
  sample("ov2", "资源流 OV2", "作战节点", ["side", "type", "level", "status"], [
    item("NOD-01", "联合指挥节点", "指挥信息汇聚", "confirmed", { side: "joint", type: "指挥节点", level: "concept" }),
    item("NOD-02", "前沿感知节点", "目标信息输出", "pending", { side: "friendly", type: "感知节点", level: "combat" }),
    item("NOD-03", "火力执行节点", "打击指令接收", "draft", { side: "friendly", type: "执行节点", level: "combat" }),
    item("NOD-04", "对抗防御节点", "威胁告警交换", "conflict", { side: "hostile", type: "防御节点", level: "combat" })
  ]),
  sample("ov4", "组织关系 OV4", "组织关系图", ["side", "type", "status"], [
    item("ORG-01", "联合指挥关系图", "6 个角色 · 8 条关系", "confirmed", { side: "joint", type: "指挥关系" }),
    item("ORG-02", "蓝方任务编组图", "5 个角色 · 6 条关系", "pending", { side: "friendly", type: "协同关系" }),
    item("ORG-03", "红方防御体系图", "4 个角色 · 4 条关系", "draft", { side: "hostile", type: "隶属关系" })
  ]),
  sample("ov6b", "状态机 OV6b", "状态机", ["subject", "phase", "status"], [
    item("STM-01", "制信息权任务状态机", "4 状态 · 5 转换", "confirmed", { subject: "task", phase: "阶段一" }),
    item("STM-02", "联合突击阶段状态机", "3 状态 · 3 转换", "pending", { subject: "phase", phase: "阶段二" }),
    item("STM-03", "火力编组状态机", "5 状态 · 6 转换", "draft", { subject: "force", phase: "阶段二" }),
    item("STM-04", "持续监视对象状态机", "3 状态 · 2 转换", "conflict", { subject: "object", phase: "阶段三" })
  ]),
  sample("ov6c", "时序图", "时序图", ["phase", "side", "type", "status"], [
    item("SEQ-01", "阶段一联合感知时序", "7 参与方 · 12 消息", "confirmed", { phase: "阶段一", side: "joint", type: "阶段协同" }),
    item("SEQ-02", "蓝方火力请求时序", "5 参与方 · 9 消息", "pending", { phase: "阶段二", side: "friendly", type: "任务协同" }),
    item("SEQ-03", "红方防空响应时序", "4 参与方 · 7 消息", "draft", { phase: "阶段二", side: "hostile", type: "任务协同" }),
    item("SEQ-04", "稳定阶段保障时序", "6 参与方 · 8 消息", "conflict", { phase: "阶段三", side: "neutral", type: "保障协同" })
  ])
];

const elements = Object.fromEntries(["sampleSelect", "groupSelect", "filterFieldSelect", "filterValueSelect", "filterMenu", "filterBadge", "activeFilterSummary", "activeFilterText", "clearFiltersButton", "searchInput", "resetButton", "resultSummary", "listTitle", "listSubtitle", "visibleCount", "groupedList", "selectionStatus", "selectFirstButton", "detailEyebrow", "detailTitle", "detailContent"].map((id) => [id, document.querySelector(`#${id}`)]));
const viewState = { sampleId: samples[0].id, groupBy: samples[0].dimensions[0], filterField: "", filterValue: "", query: "", selectedId: samples[0].items[0]?.id || "", collapsedGroups: new Set() };

elements.sampleSelect.innerHTML = samples.map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.label)}</option>`).join("");
elements.sampleSelect.addEventListener("change", () => {
  const next = currentSample(elements.sampleSelect.value);
  viewState.sampleId = next.id;
  viewState.groupBy = next.dimensions[0] || "";
  viewState.filterField = "";
  viewState.filterValue = "";
  viewState.query = "";
  viewState.selectedId = next.items[0]?.id || "";
  viewState.collapsedGroups.clear();
  elements.searchInput.value = "";
  render();
});
elements.groupSelect.addEventListener("change", () => { viewState.groupBy = elements.groupSelect.value; viewState.collapsedGroups.clear(); render(); });
elements.filterFieldSelect.addEventListener("change", () => { viewState.filterField = elements.filterFieldSelect.value; viewState.filterValue = ""; render(); });
elements.filterValueSelect.addEventListener("change", () => {
  viewState.filterValue = elements.filterValueSelect.value;
  elements.filterMenu.open = false;
  render();
});
elements.searchInput.addEventListener("input", () => { viewState.query = elements.searchInput.value.trim().toLowerCase(); renderListAndDetail(); });
elements.resetButton.addEventListener("click", () => resetCurrentSample());
elements.clearFiltersButton.addEventListener("click", () => {
  viewState.filterField = "";
  viewState.filterValue = "";
  elements.filterMenu.open = false;
  render();
});
elements.selectFirstButton.addEventListener("click", () => {
  const first = visibleItems()[0];
  if (first) viewState.selectedId = first.id;
  renderListAndDetail();
});
elements.groupedList.addEventListener("click", (event) => {
  const groupButton = event.target.closest("[data-group]");
  if (groupButton) {
    const key = groupButton.dataset.group;
    if (viewState.collapsedGroups.has(key)) viewState.collapsedGroups.delete(key);
    else viewState.collapsedGroups.add(key);
    renderListAndDetail();
    return;
  }
  const itemButton = event.target.closest("[data-item]");
  if (!itemButton) return;
  viewState.selectedId = itemButton.dataset.item;
  renderListAndDetail();
});

render();

function render() {
  const active = currentSample();
  elements.sampleSelect.value = active.id;
  elements.groupSelect.innerHTML = [`<option value="">不分组</option>`, ...active.dimensions.map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(DIMENSION_LABELS[key] || key)}</option>`)].join("");
  elements.groupSelect.value = viewState.groupBy;
  elements.filterFieldSelect.innerHTML = [`<option value="">不筛选</option>`, ...active.dimensions.map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(DIMENSION_LABELS[key] || key)}</option>`)].join("");
  elements.filterFieldSelect.value = viewState.filterField;
  const values = viewState.filterField ? unique(active.items.map((entry) => fieldValue(entry, viewState.filterField))) : [];
  elements.filterValueSelect.innerHTML = [`<option value="">全部</option>`, ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(valueLabel(value))}</option>`)].join("");
  elements.filterValueSelect.value = viewState.filterValue;
  elements.filterValueSelect.disabled = !viewState.filterField;
  elements.filterMenu.classList.toggle("is-active", Boolean(viewState.filterField || viewState.filterValue));
  elements.filterBadge.textContent = viewState.filterValue ? "1" : "";
  elements.activeFilterSummary.hidden = !viewState.filterField;
  elements.activeFilterText.textContent = viewState.filterField
    ? `${DIMENSION_LABELS[viewState.filterField] || viewState.filterField}：${viewState.filterValue ? valueLabel(viewState.filterValue) : "全部"}`
    : "";
  renderListAndDetail();
}

function renderListAndDetail() {
  const active = currentSample();
  const visible = visibleItems();
  const selected = visible.find((entry) => entry.id === viewState.selectedId) || null;
  elements.listTitle.textContent = active.listTitle;
  elements.listSubtitle.textContent = `${DIMENSION_LABELS[viewState.groupBy] || "连续列表"} · ${active.label}`;
  elements.visibleCount.textContent = `${visible.length}/${active.items.length}`;
  elements.resultSummary.textContent = `${active.label} · ${visible.length} 条可见数据`;
  elements.groupedList.innerHTML = visible.length ? renderGroups(visible) : `<div class="list-empty">当前条件下没有数据</div>`;
  elements.selectionStatus.textContent = selected ? `已选择 ${selected.id}` : "未选择可见条目";
  elements.selectFirstButton.disabled = !visible.length;
  renderDetail(selected, active);
}

function renderGroups(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const raw = viewState.groupBy ? fieldValue(entry, viewState.groupBy) : "全部数据";
    const key = raw || "未分类";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.entries()].map(([key, items]) => {
    const collapsed = viewState.collapsedGroups.has(key);
    return `<section class="list-group ${collapsed ? "is-collapsed" : ""}">
      <header><button type="button" class="group-toggle" data-group="${escapeHtml(key)}" aria-expanded="${collapsed ? "false" : "true"}"><strong>${escapeHtml(valueLabel(key))}</strong></button><span>${items.length}</span></header>
      <div class="group-items">${items.map(renderListItem).join("")}</div>
    </section>`;
  }).join("");
}

function renderListItem(entry) {
  return `<button type="button" class="list-item ${entry.id === viewState.selectedId ? "is-selected" : ""}" data-item="${escapeHtml(entry.id)}" aria-pressed="${entry.id === viewState.selectedId ? "true" : "false"}">
    <span class="status-dot ${escapeHtml(entry.status)}" title="${escapeHtml(STATUS_LABELS[entry.status] || entry.status)}"></span>
    <span class="item-copy"><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.subtitle)}</small></span>
    <span class="item-code">${escapeHtml(entry.id)}</span>
  </button>`;
}

function renderDetail(entry, active) {
  if (!entry) {
    elements.detailEyebrow.textContent = active.id.toUpperCase();
    elements.detailTitle.textContent = "选择左侧数据";
    elements.detailContent.className = "detail-empty";
    elements.detailContent.textContent = "当前筛选结果中的条目将在这里显示。";
    return;
  }
  elements.detailEyebrow.textContent = `${active.label} · ${entry.id}`;
  elements.detailTitle.textContent = entry.title;
  elements.detailContent.className = "detail-content";
  elements.detailContent.innerHTML = `<div class="detail-grid">
    <div><span>状态</span><strong>${escapeHtml(STATUS_LABELS[entry.status] || entry.status)}</strong></div>
    ${Object.entries(entry.groups).map(([key, value]) => `<div><span>${escapeHtml(DIMENSION_LABELS[key] || key)}</span><strong>${escapeHtml(valueLabel(value))}</strong></div>`).join("")}
  </div><p class="detail-notes">${escapeHtml(entry.subtitle)}。该区域代表各业务页面保留的详情、画布或编辑器插槽。</p>`;
}

function visibleItems() {
  return currentSample().items.filter((entry) => {
    if (viewState.filterField && viewState.filterValue && fieldValue(entry, viewState.filterField) !== viewState.filterValue) return false;
    if (!viewState.query) return true;
    return [entry.id, entry.title, entry.subtitle, ...Object.values(entry.groups)].join(" ").toLowerCase().includes(viewState.query);
  });
}

function resetCurrentSample() {
  const active = currentSample();
  viewState.groupBy = active.dimensions[0] || "";
  viewState.filterField = "";
  viewState.filterValue = "";
  viewState.query = "";
  viewState.selectedId = active.items[0]?.id || "";
  viewState.collapsedGroups.clear();
  elements.filterMenu.open = false;
  elements.searchInput.value = "";
  render();
}

function currentSample(id = viewState.sampleId) { return samples.find((entry) => entry.id === id) || samples[0]; }
function fieldValue(entry, key) { return key === "status" ? entry.status : String(entry.groups[key] || ""); }
function valueLabel(value) { return STATUS_LABELS[value] || VALUE_LABELS[value] || value || "未分类"; }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function sample(id, label, listTitle, dimensions, items) { return { id, label, listTitle, dimensions, items }; }
function item(id, title, subtitle, status, groups) { return { id, title, subtitle, status, groups }; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }

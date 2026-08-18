import { escapeHtml } from "./app/domUtils.js";
import { resolveDodafProduct } from "./dodafProductStore.js";
import { listStateSources } from "./mappingProductStore.js";
import { renderProjectStorageState } from "./projectStorageView.js";

const JUDGMENT_LABELS = { pending: "待判定", accepted: "接受映射", rejected: "不适用" };
const SEMANTIC_LABELS = { triggers: "触发活动", executes: "执行活动", ends: "结束活动" };

export function renderOv1c(state = {}) {
  const model = resolveDodafProduct(state, "ov1c").model;
  const tasks = state.forceMission?.tasks || [];
  const taskById = new Map(tasks.map((item) => [String(item.id), item]));
  return renderMappingPage({
    resource: "ov1c",
    product: "OV-1c",
    eyebrow: "任务与活动映射 · OV1c",
    title: "任务活动覆盖校核",
    description: "以作战任务为权威来源，人工确认其由哪些 OV5b 活动承接；不复制任务或活动正文。",
    sourceHeading: "作战任务",
    model,
    state,
    rows: (model.mappings || []).map((item) => ({
      ...item,
      sourceLabel: taskById.get(item.taskRef)?.name || item.taskRef,
      sourceMissing: !taskById.has(item.taskRef),
      focusType: "task",
      focusId: item.taskRef,
      sourceView: "operational-task"
    }))
  });
}

export function renderOv7(state = {}) {
  const model = resolveDodafProduct(state, "ov7").model;
  const sources = listStateSources(state);
  const sourceByKey = new Map(sources.map((item) => [`${item.subjectType}:${item.sourceRef}`, item]));
  return renderMappingPage({
    resource: "ov7",
    product: "OV-7",
    eyebrow: "状态与活动映射 · OV7",
    title: "状态转换活动承接",
    description: "把状态或转换与 OV5b 活动建立稳定引用，并人工判定触发、执行或结束语义。",
    sourceHeading: "状态 / 转换",
    model,
    state,
    rows: (model.mappings || []).map((item) => {
      const source = sourceByKey.get(`${item.subjectType}:${item.sourceRef}`);
      return {
        ...item,
        sourceLabel: source ? `${source.machineLabel} · ${source.label}` : item.sourceRef,
        sourceMissing: !source,
        focusType: item.subjectType,
        focusId: item.sourceRef,
        sourceView: "ov6b"
      };
    })
  });
}

function renderMappingPage({ resource, product, eyebrow, title, description, sourceHeading, model, state, rows }) {
  const activities = state.ov5?.activities || [];
  const coverage = model.coverage || {};
  const unresolvedCount = uniqueCount([
    ...(coverage.unmappedTaskRefs || []),
    ...(coverage.unmappedSourceRefs || []),
    ...(coverage.uncoveredActivityRefs || []),
    ...(coverage.orphanTaskRefs || []),
    ...(coverage.orphanSourceRefs || []),
    ...(coverage.orphanActivityRefs || [])
  ]);
  return `<section class="surface mapping-workbench" data-dodaf-product="${escapeHtml(product)}">
    <header class="mapping-header">
      <div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>
      <div class="mapping-header-meta"><span class="mini-tag">${rows.length} 个来源</span><span class="mini-tag ${unresolvedCount ? "review" : ""}">${unresolvedCount} 项待处理</span></div>
    </header>
    ${renderProjectStorageState(state[`${resource}Storage`], { refreshAction: `refresh-project-${resource}` })}
    <div class="mapping-toolbar">
      <button type="button" class="ghost-btn" data-action="seed-dodaf-${resource}">刷新来源</button>
      <button type="button" class="primary-btn" data-action="save-dodaf-${resource}">保存映射</button>
    </div>
    ${renderDiagnostics(model.diagnostics)}
    <div class="mapping-table" role="table" aria-label="${escapeHtml(title)}">
      <div class="mapping-table-head" role="row"><span>${escapeHtml(sourceHeading)}</span><span>承接活动</span><span>${resource === "ov7" ? "关系语义" : "覆盖状态"}</span><span>人工判定</span><span>说明</span></div>
      ${rows.map((row) => renderMappingRow(row, activities, resource)).join("") || `<div class="mapping-empty">尚无可映射来源，请先完成上游任务、状态机和作战活动。</div>`}
    </div>
  </section>`;
}

function renderMappingRow(item, activities, resource) {
  const activityIds = new Set(activities.map((activity) => String(activity.id)));
  const brokenActivity = (item.activityRefs || []).some((ref) => !activityIds.has(ref));
  const conflict = item.sourceMissing || brokenActivity || item.status === "conflict";
  const activityChoices = activities.map((activity) => {
    const id = String(activity.id);
    return `<label class="mapping-activity-choice"><input type="checkbox" data-action="mapping-toggle-activity" data-resource="${resource}" data-mapping-id="${escapeHtml(item.id)}" value="${escapeHtml(id)}" ${(item.activityRefs || []).includes(id) ? "checked" : ""}><span>${escapeHtml(activity.title || id)}</span></label>`;
  }).join("");
  const brokenRefs = (item.activityRefs || []).filter((ref) => !activityIds.has(ref));
  const sourceButton = `<button type="button" class="text-link mapping-source-link" data-view="${escapeHtml(item.sourceView)}" data-focus-type="${escapeHtml(item.focusType)}" data-focus-id="${escapeHtml(item.focusId)}">${escapeHtml(item.sourceLabel)}</button>`;
  const semantic = resource === "ov7"
    ? `<select data-action="mapping-set-semantic" data-resource="ov7" data-mapping-id="${escapeHtml(item.id)}" aria-label="关系语义">${Object.entries(SEMANTIC_LABELS).map(([value, label]) => `<option value="${value}" ${item.semantic === value ? "selected" : ""}>${label}</option>`).join("")}</select>`
    : `<span class="mapping-coverage status-${escapeHtml(item.coverageStatus || "unmapped")}">${escapeHtml(item.coverageStatus === "covered" ? "已覆盖" : item.coverageStatus === "partial" ? "部分覆盖" : item.coverageStatus === "conflict" ? "引用冲突" : "未映射")}</span>`;
  return `<div class="mapping-row ${conflict ? "is-conflict" : ""}" role="row" data-mapping-id="${escapeHtml(item.id)}">
    <div class="mapping-source">${sourceButton}<small>${escapeHtml(item.focusType === "task" ? item.taskRef : `${item.subjectType} · ${item.sourceRef}`)}</small>${item.sourceMissing ? `<em>来源引用失效</em>` : ""}</div>
    <div class="mapping-activities">${activityChoices || `<span>尚无 OV5b 活动</span>`}${brokenRefs.map((ref) => `<em>失效活动：${escapeHtml(ref)}</em>`).join("")}</div>
    <div>${semantic}</div>
    <div><select data-action="mapping-set-judgment" data-resource="${resource}" data-mapping-id="${escapeHtml(item.id)}" aria-label="人工判定">${Object.entries(JUDGMENT_LABELS).map(([value, label]) => `<option value="${value}" ${item.judgment === value ? "selected" : ""}>${label}</option>`).join("")}</select><small class="mapping-status">${escapeHtml(conflict ? "有冲突" : item.status === "confirmed" ? "已确认" : "待复核")}</small></div>
    <div><textarea data-dodaf-field="${resource}.mapping.${escapeHtml(item.id)}.note" placeholder="补充映射依据">${escapeHtml(item.note || "")}</textarea></div>
  </div>`;
}

function renderDiagnostics(items = []) {
  return `<div class="mapping-diagnostics">${items.map((item) => `<div class="${escapeHtml(item.state)}"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.statusLabel)}</span><small>${escapeHtml(item.detail)}</small></div>`).join("")}</div>`;
}

function uniqueCount(values) {
  return new Set(values.filter(Boolean)).size;
}

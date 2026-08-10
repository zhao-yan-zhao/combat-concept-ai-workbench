import { getOodaFreshness } from "./oodaStore.js";
import { renderProjectStorageState } from "./projectStorageView.js";

export function renderOoda(state) {
  const sourceNames = (state.ooda.sourceActivityIds || [])
    .map((id) => state.ov5.activities.find((activity) => activity.id === id)?.title)
    .filter(Boolean)
    .join("、");

  const provenance = state.ooda.provenance?.mode === "ai" ? "AI 草案" : state.ooda.provenance?.mode === "local" ? "本地草案" : "OV-5 派生";
  const freshness = getOodaFreshness(state.ooda, state.ov5);
  return `
    <section class="surface surface-pad">
      <div class="section-heading"><div><h2>OODA 行为循环</h2><p>派生来源：${sourceNames || "待选择 OV-5 活动"}${freshness.stale ? " · 相对 OV-5 已过期" : ""}</p></div><div class="activity-toolbar"><span class="mini-tag ${state.oodaGenerating ? "review" : freshness.stale ? "review" : ""}">${state.oodaGenerating ? "生成中" : freshness.stale ? "相对 OV-5 过期" : provenance}</span><span class="mini-tag">周期估算：${state.oodaDuration || "待估算"} 分钟</span><button class="quiet-button" data-action="derive-ooda" ${state.oodaGenerating ? "disabled" : ""}>${freshness.stale ? "从 OV-5 重新派生" : "从 OV-5 重新派生"}</button><button type="button" data-action="generate-ooda" ${state.oodaGenerating ? "disabled" : ""}>${state.oodaGenerating ? "正在生成" : "AI 完善 OODA"}</button></div></div>
      ${renderProjectStorageState(state.oodaStorage, { refreshAction: "refresh-project-ooda" })}
      ${freshness.stale ? `<div class="ooda-stale-banner" role="status"><div><strong>OODA 相对 OV-5 已过期</strong><p>${escapeHtml(freshness.reason)} 可先审阅当前循环，确认后从 OV-5 重新派生或使用 AI 完善。</p></div><button type="button" data-action="derive-ooda" ${state.oodaGenerating ? "disabled" : ""}>立即重新派生</button></div>` : ""}
      <div class="ooda-board ${freshness.stale ? "is-stale" : ""}">${state.ooda.lanes.map((lane) => `
        <section class="ooda-lane" style="--lane:${lane.color}">
          <div class="ooda-lane-head"><div><h3>${lane.title}</h3><p>${lane.subtitle}</p></div><button class="lane-add" data-add-ooda="${lane.id}" title="新增 ${lane.subtitle} 节点" aria-label="新增 ${lane.subtitle} 节点">+</button></div>
          ${lane.nodes.map((node) => `<button class="ooda-card ${state.selection?.id === node.id ? "selected" : ""}" data-ooda="${node.id}"><strong>${node.title}</strong><span>${node.text} · ${node.duration}</span></button>`).join("") || `<p class="lane-empty">尚未定义节点</p>`}
        </section>
      `).join("")}</div>
    </section>
    <section class="surface surface-pad"><div class="section-heading"><div><h2>循环约束</h2><p>节点可在右侧编辑输入、输出、耗时和规则；修改后自动保存。</p></div><button class="quiet-button" data-action="recalculate">重新估算</button></div></section>
  `;
}

export function renderOodaInspector(selection) {
  return `
    <form class="activity-editor" id="oodaNodeForm">
      <label>节点名称<input name="title" value="${selection.title}"></label>
      <label>输入信息<textarea name="input" rows="2">${selection.input}</textarea></label>
      <label>输出信息<textarea name="output" rows="2">${selection.output}</textarea></label>
      <label>预计耗时<input name="duration" value="${selection.facts[1][1]}"></label>
      <label>行为说明<textarea name="text" rows="3">${selection.text}</textarea></label>
      <label>决策规则<textarea name="rule" rows="3">${selection.rule}</textarea></label>
      <label>关联装备（以顿号或逗号分隔）<input name="equipmentRefs" value="${escapeHtml((selection.equipmentRefs || []).join("、"))}" maxlength="1600"></label>
      <label>知识依据（以顿号或逗号分隔）<input name="knowledgeRefs" value="${escapeHtml((selection.knowledgeRefs || []).join("、"))}" maxlength="1600"></label>
      <div class="editor-actions"><button type="submit">保存节点</button><button type="button" class="quiet-button" data-inspector-action="delete-ooda">删除</button></div>
    </form>
  `;
}

export function selectionForOoda(nodeId, models) {
  const item = models.ooda.lanes.flatMap((lane) => lane.nodes.map((node) => ({ ...node, lane }))).find((node) => node.id === nodeId);
  if (!item) return null;
  const sourceActivity = models.ov5.activities.find((activity) => activity.id === item.sourceActivityId);
  return {
    id: item.id,
    kind: "ooda",
    title: item.title,
    status: `${item.lane.title} 节点`,
    text: item.text,
    facts: [["阶段", item.lane.subtitle], ["预计耗时", item.duration], ["关联活动", sourceActivity?.title || "手工节点"], ["关联装备", item.equipmentRefs?.join("、") || "未关联"]],
    refs: item.knowledgeRefs?.length ? item.knowledgeRefs : sourceActivity?.refs || [],
    input: item.input,
    output: item.output,
    rule: item.rule,
    equipmentRefs: item.equipmentRefs || [],
    knowledgeRefs: item.knowledgeRefs || []
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

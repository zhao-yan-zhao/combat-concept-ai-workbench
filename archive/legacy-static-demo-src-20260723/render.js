import { $, escapeHtml } from "./dom.js";
import { runStatusMeta, workflowStatusMeta, workflows } from "./data.js";
import { state } from "./state.js";
import { buildVaultSummary, normalizeKnowledgeChunk, searchKnowledge } from "./knowledge.js";
import { generateOutput } from "./generator.js";

export function renderProjectOverview() {
  const container = $("#projectOverview");
  if (!container) {
    return;
  }

  const project = state.project;
  const workflow = getCurrentWorkflow();
  const workflowState = state.workflowStates[state.workflowId];
  const status = workflowStatusMeta[workflowState.status];
  const totalRuns = state.workflowRuns.length;
  const vault = state.knowledgeVault || buildVaultSummary(state.knowledge);

  container.innerHTML = `
    <div class="project-summary">
      <p class="eyebrow">Project</p>
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.direction)}</p>
    </div>
    <div class="project-stat-grid">
      <div class="project-stat">
        <span>当前阶段</span>
        <strong>${escapeHtml(workflow.type)}</strong>
        <small>${escapeHtml(status.label)}</small>
      </div>
      <div class="project-stat">
        <span>资料规模</span>
        <strong>${vault.fileCount} 文件</strong>
        <small>${vault.chunkCount} 个知识片段</small>
      </div>
      <div class="project-stat">
        <span>运行记录</span>
        <strong>${totalRuns} 次</strong>
        <small>最近更新 ${formatDate(project.updatedAt)}</small>
      </div>
    </div>
  `;
}

export function renderWorkflowTabs(onSelect, options = {}) {
  const tabs = $("#workflowTabs");
  tabs.innerHTML = workflows
    .map((workflow) => {
      const workflowState = state.workflowStates[workflow.id];
      const status = workflowStatusMeta[workflowState.status];
      return `
        <button class="workflow-tab" data-workflow="${workflow.id}" ${options.disabled ? "disabled" : ""}>
          <span class="workflow-tab-title">
            ${escapeHtml(workflow.tab)}
            <span class="status-pill ${status.tone}">${escapeHtml(status.label)}</span>
          </span>
          <span class="workflow-tab-desc">${escapeHtml(workflow.desc)}</span>
          <span class="workflow-tab-meta">运行 ${workflowState.runCount} 次</span>
        </button>
      `;
    })
    .join("");

  tabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => onSelect(button.dataset.workflow));
  });
}

export function renderSelectedWorkflow() {
  const workflow = getCurrentWorkflow();
  const workflowState = state.workflowStates[state.workflowId];
  const status = workflowStatusMeta[workflowState.status];
  const completedSteps = getCompletedStepCount(workflowState.status);
  const pageId = getWorkflowPageId(workflow.id);

  document.body.dataset.workflow = workflow.id;
  document.body.dataset.workflowPage = pageId;

  $("#workflowType").textContent = workflow.type;
  $("#workflowTitle").textContent = workflow.title;

  document.querySelectorAll(".workflow-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.workflow === state.workflowId);
  });
  document.querySelectorAll(".workflow-page").forEach((page) => {
    page.classList.toggle("active", page.dataset.page === pageId);
  });
  moveWorkflowOutputDock(pageId);

  $("#workflowStatusPanel").innerHTML = `
    <div class="workflow-status-copy">
      <div class="workflow-status-heading">
        <span class="status-pill ${status.tone}">${escapeHtml(status.label)}</span>
        <strong>${escapeHtml(status.desc)}</strong>
      </div>
      <p>${escapeHtml(workflow.goal)}</p>
    </div>
    <div class="workflow-state-grid">
      <div>
        <span>输入</span>
        <strong>${escapeHtml(workflow.input)}</strong>
      </div>
      <div>
        <span>输出</span>
        <strong>${escapeHtml(workflow.output)}</strong>
      </div>
      <div>
        <span>最近运行</span>
        <strong>${formatDate(workflowState.lastRunAt)}</strong>
      </div>
      <div>
        <span>累计运行</span>
        <strong>${workflowState.runCount} 次</strong>
      </div>
    </div>
  `;

  $("#stepTrack").innerHTML = workflow.steps
    .map((step, index) => `
      <div class="step ${index < completedSteps ? "done" : ""} ${index === completedSteps ? "active" : ""}">
        <div class="step-number">${index + 1}</div>
        <strong>${escapeHtml(step)}</strong>
        <p>${escapeHtml(getStepHint(workflow.id, index))}</p>
      </div>
    `)
    .join("");
}

function getWorkflowPageId(workflowId) {
  return {
    scenario: "scenario",
    knowledge: "knowledge"
  }[workflowId] || "generation";
}

function moveWorkflowOutputDock(pageId) {
  const dock = $("#workflowOutputDock");
  const target = document.querySelector(`[data-output-slot="${pageId}"]`);
  if (dock && target && dock.parentElement !== target) {
    target.appendChild(dock);
  }
}

export function renderWorkflowRuns() {
  const runs = state.workflowRuns.slice(0, 8);
  $("#workflowRunList").innerHTML = runs.length
    ? runs.map((run) => {
      const workflow = workflows.find((item) => item.id === run.workflowId);
      const duration = formatDuration(run.durationMs);
      return `
        <div class="run-item ${run.workflowId === state.workflowId ? "active" : ""}">
          <div>
            <strong>${escapeHtml(workflow.tab)}</strong>
            <span>${escapeHtml(runStatusMeta[run.status] || run.status)} · ${formatDate(run.finishedAt)}${duration ? ` · ${duration}` : ""}</span>
          </div>
          <p>${escapeHtml(run.outputSummary)}</p>
        </div>
      `;
    }).join("")
    : `<div class="run-item empty"><strong>暂无运行记录</strong><p>点击“运行工作流”后，这里会记录工作流、时间、输入摘要和输出摘要。</p></div>`;
}

export function renderAnalysis() {
  $("#analysisGrid").innerHTML = Object.entries(state.analysis)
    .map(([key, value]) => `
      <div class="analysis-card">
        <strong>${escapeHtml(key)}</strong>
        <p>${escapeHtml(value)}</p>
      </div>
    `)
    .join("");
}

export function renderKnowledge() {
  const query = $("#kbSearch").value.trim();
  const normalized = state.knowledge.map(normalizeKnowledgeChunk);
  const items = query ? searchKnowledge(query, normalized, 12) : normalized.slice(0, 8);
  const vault = state.knowledgeVault || buildVaultSummary(normalized);
  $("#kbCount").textContent = `${vault.fileCount}/${vault.chunkCount}`;
  $("#kbList").innerHTML = items.length
    ? items.map(renderKnowledgeItem).join("")
    : `<div class="kb-item"><strong>未找到匹配知识</strong><p>可以换一个关键词，或导入更多 Obsidian Markdown 笔记。</p></div>`;
}

export function renderEvidence() {
  const query = Object.values(state.analysis).join(" ");
  const evidence = searchKnowledge(query, state.knowledge, 5);
  $("#evidenceScore").textContent = evidence.length ? `${evidence.length} 条命中` : "未命中";
  $("#evidenceList").innerHTML = evidence.length
    ? evidence.map((item) => `
      <div class="evidence-item">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.excerpt || item.summary || item.text.slice(0, 160))}</p>
        <div class="tag-row">
          <span class="tag">来源：${escapeHtml(item.filePath || item.name || item.title)}</span>
          <span class="tag">评分 ${item.score}</span>
          ${item.matchReasons.slice(0, 3).map((reason) => `<span class="tag">${escapeHtml(reason)}</span>`).join("")}
        </div>
      </div>
    `).join("")
    : `<div class="evidence-item"><strong>暂无依据</strong><p>导入 OBS/Obsidian 知识库后，系统会自动匹配相关条令、案例和研究笔记。</p></div>`;
}

export function renderWorkflowOutput() {
  renderEvidence();
  const workflow = getCurrentWorkflow();
  const evidence = searchKnowledge(Object.values(state.analysis).join(" "), state.knowledge, 3);
  const output = generateOutput(workflow, state.analysis, evidence);
  renderGeneratedOutput(output);
}

export function renderGeneratedOutput(output) {
  state.generation = output;
  state.output = output.markdown;
  $("#generatedOutput").innerHTML = renderGenerationHtml(output);
  renderScoreBoard(output.evaluation);
}

function renderGenerationHtml(output) {
  const schema = output.outputSchema;
  const templateMeta = `
    <h4>${escapeHtml(output.templateName)}</h4>
    <p>输出结构：${escapeHtml(schema)} · 知识依据 ${output.evidenceRefs.length} 条</p>
  `;
  const body = schema === "ConceptPlan"
    ? renderConceptPlan(output.result)
    : schema === "PlanVariant[]"
      ? renderPlanVariants(output.result)
      : schema === "WargameReview"
        ? renderWargameReview(output.result)
        : renderWorkflowBrief(output.result);
  const evaluation = output.evaluation ? renderEvaluationSummary(output.evaluation) : "";
  const evidence = renderEvidenceRefs(output.evidenceRefs);
  const mapInput = output.mapInput ? renderMapInputSummary(output.mapInput) : "";
  const steps = `<h4>下一步</h4><ul>${output.nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>`;

  return `${templateMeta}${body}${evaluation}${evidence}${mapInput}${steps}`;
}

function renderConceptPlan(plan) {
  return `
    <h4>${escapeHtml(plan.name)}</h4>
    <p><strong>风格：</strong>${escapeHtml(plan.style)}</p>
    <p>${escapeHtml(plan.coreIdea)}</p>
    <h4>任务目的</h4>
    <p>${escapeHtml(plan.objective)}</p>
    ${renderListBlock("行动阶段", plan.phases)}
    ${renderListBlock("力量协同", plan.forceCoordination)}
    ${renderListBlock("指挥控制", plan.commandControl)}
    ${renderListBlock("保障需求", plan.supportNeeds)}
    ${renderListBlock("风险控制", plan.risks)}
    ${renderListBlock("预期效果", plan.expectedEffects)}
    ${renderListBlock("关键假设", plan.assumptions)}
  `;
}

function renderPlanVariants(variants) {
  return variants.map((variant) => `
    <h4>${escapeHtml(variant.name)}</h4>
    <p><strong>类型：</strong>${escapeHtml(variant.type)}</p>
    <p>${escapeHtml(variant.summary)}</p>
    ${renderListBlock("行动阶段", variant.phases)}
    ${renderListBlock("优势", variant.strengths)}
    ${renderListBlock("不足", variant.weaknesses)}
    ${renderListBlock("资源需求", variant.resourceNeeds)}
    ${renderListBlock("风险提示", variant.riskNotes)}
  `).join("");
}

function renderWorkflowBrief(brief) {
  const sections = brief.sections ?? [];
  return `
    <h4>${escapeHtml(brief.name)}</h4>
    ${sections.map((section) => `
      <h4>${escapeHtml(section.title)}</h4>
      <p>${escapeHtml(section.text)}</p>
    `).join("")}
  `;
}

function renderWargameReview(review) {
  return `
    <h4>${escapeHtml(review.name)}</h4>
    ${review.roles.map((role) => `
      <h4>${escapeHtml(role.role)}</h4>
      ${renderListBlock("质询问题", role.questions)}
      ${renderListBlock("反制/修正动作", role.counterActions)}
      ${renderListBlock("角色判断", role.findings)}
    `).join("")}
    <h4>风险清单</h4>
    <ul>
      ${review.risks.map((risk) => `
        <li>
          <strong>${escapeHtml(risk.title)}</strong>：${escapeHtml(risk.description)}
          <br>概率：${escapeHtml(toLevelLabel(risk.probability))}；影响：${escapeHtml(toLevelLabel(risk.impact))}；缓解措施：${escapeHtml(risk.mitigation)}
        </li>
      `).join("")}
    </ul>
    <h4>修正建议</h4>
    <ul>
      ${review.revisions.map((revision) => `
        <li><strong>${escapeHtml(revision.title)}</strong>：${escapeHtml(revision.description)}</li>
      `).join("")}
    </ul>
    <h4>裁判结论</h4>
    <p>${escapeHtml(review.conclusion)}</p>
  `;
}

function renderEvaluationSummary(evaluation) {
  return `
    <h4>方案评估摘要</h4>
    <p>综合评分：${evaluation.score}（${escapeHtml(evaluation.riskLevel)}）</p>
    <ul>
      ${evaluation.metrics.map((metric) => `
        <li><strong>${escapeHtml(metric.name)} ${metric.score}</strong>：${escapeHtml(metric.rationale)}</li>
      `).join("")}
    </ul>
  `;
}

function renderMapInputSummary(mapInput) {
  return `
    <h4>mapInput 占位结构</h4>
    <p>${escapeHtml(mapInput.title)}：阶段 ${mapInput.phases.length} 个，力量 ${mapInput.forces.length} 类，行动 ${mapInput.actions.length} 项。</p>
  `;
}

function renderListBlock(title, items) {
  return `<h4>${escapeHtml(title)}</h4><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderEvidenceRefs(evidenceRefs) {
  if (!evidenceRefs.length) {
    return `<h4>知识依据</h4><p>暂无匹配依据，建议导入 OBS/Obsidian 知识库。</p>`;
  }

  return `
    <h4>知识依据</h4>
    <ul>
      ${evidenceRefs.map((item) => `
        <li><strong>${escapeHtml(item.id)} ${escapeHtml(item.title)}</strong>：${escapeHtml(item.summary)}</li>
      `).join("")}
    </ul>
  `;
}

function renderKnowledgeItem(item) {
  const tags = [
    ...item.tags.map((tag) => `#${tag}`),
    ...item.links.map((link) => `[[${link}]]`)
  ].slice(0, 5)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");
  const source = item.filePath || item.name || item.title;
  const summary = item.summary || item.text || item.content || "";
  const matchMeta = item.matchReasons?.length
    ? `<span class="tag">命中：${escapeHtml(item.matchReasons.slice(0, 2).join(" / "))}</span>`
    : "";
  return `
    <div class="kb-item">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(summary.slice(0, 120))}${summary.length > 120 ? "..." : ""}</p>
      <div class="tag-row">
        <span class="tag">来源：${escapeHtml(source)}</span>
        <span class="tag">标签 ${item.tags.length}</span>
        <span class="tag">双链 ${item.links.length}</span>
        ${matchMeta}
        ${tags}
      </div>
    </div>
  `;
}

function renderScoreBoard(evaluation) {
  $("#riskLevel").textContent = evaluation.riskLevel;
  $("#scoreBoard").innerHTML = evaluation.metrics.map((metric) => `
    <div class="score-item">
      <div class="score-head">
        <span>${escapeHtml(metric.name)}</span>
        <b>${metric.score}</b>
      </div>
      <div class="bar" style="--score:${metric.score}%"><span></span></div>
      <p>${escapeHtml(metric.rationale)}</p>
      <small>依据：${metric.evidenceRefs.length ? metric.evidenceRefs.map(escapeHtml).join("、") : "待补充"}</small>
    </div>
  `).join("");
}

function toLevelLabel(value) {
  return {
    low: "低",
    medium: "中",
    high: "高"
  }[value] || value;
}

function getCurrentWorkflow() {
  return workflows.find((item) => item.id === state.workflowId);
}

function getCompletedStepCount(status) {
  return {
    "not-started": 0,
    running: 1,
    "needs-review": 2,
    generated: 4,
    approved: 5
  }[status] || 0;
}

function formatDate(value) {
  if (!value) {
    return "未运行";
  }
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDuration(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) {
    return "";
  }
  if (duration < 1000) {
    return "<1 秒";
  }

  const seconds = Math.round(duration / 1000);
  if (seconds < 60) {
    return `${seconds} 秒`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes} 分 ${remainingSeconds} 秒` : `${minutes} 分`;
}

function getStepHint(workflowId, index) {
  const hints = {
    scenario: ["汇集任务材料", "提取核心要素", "识别主要矛盾", "列出未知条件", "形成结构化想定"],
    knowledge: ["选择 OBS 库", "解析标签双链", "匹配研究问题", "摘录可用依据", "生成引用清单"],
    concept: ["理解任务目标", "调用知识依据", "生成基本构想", "设计力量协同", "描述预期效果"],
    variants: ["设定方案类型", "展开行动路径", "估算资源依赖", "横向比较优劣", "给出推荐理由"],
    wargame: ["设定推演角色", "模拟对手反制", "识别脆弱环节", "提出修正动作", "形成评估结论"],
    output: ["固化方案结构", "设计图层关系", "形成任务清单", "生成汇报文本", "导出成果包"]
  };
  return hints[workflowId][index];
}

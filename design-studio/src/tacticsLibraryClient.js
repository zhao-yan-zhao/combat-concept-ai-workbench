/**
 * tacticsLibraryClient.js
 * M7-T7.4 战法库客户端与跨项目复用复制工具
 */

export async function fetchTacticsLibrary({ category = "", search = "" } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (search) params.set("search", search);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/tactics-library${query}`, {
    headers: { Accept: "application/json" }
  });
  if (!res.ok) {
    throw new Error(`战法库读取失败: ${res.status}`);
  }
  return res.json();
}

export async function fetchTacticDetail(id) {
  const res = await fetch(`/api/tactics-library/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" }
  });
  if (!res.ok) {
    throw new Error(`战法条目读取失败: ${res.status}`);
  }
  return res.json();
}

export async function saveCurrentProjectToLibrary(state, options = {}) {
  const brief = state.brief || {};
  const ov5 = state.ov5 || {};
  const chain = ov5.argumentChain || {};
  const tacticalCases = Array.isArray(state.tacticalCases) ? state.tacticalCases : [];

  const name = String(options.name || state.project?.title || brief.objective || "作战概念战法").trim();
  const category = String(options.category || state.project?.direction || "战法设计").trim();
  const summary = String(options.summary || brief.approach || "").trim();
  const applicableConditions = String(options.applicableConditions || brief.assumptions || "适用于多域协同攻防对抗环境").trim();
  const author = String(options.author || "作战概念研究员").trim();

  // 纯深拷贝战法模板包（复制起点）
  const recordTemplate = JSON.parse(JSON.stringify({
    brief: {
      objective: brief.objective || "",
      approach: brief.approach || "",
      assumptions: brief.assumptions || "",
      expectedEffects: brief.expectedEffects || "",
      risk: brief.risk || ""
    },
    phaseAction: state.phaseAction ? {
      phases: state.phaseAction.phases || []
    } : null,
    forceMission: state.forceMission ? {
      forces: state.forceMission.forces || [],
      combatForces: state.forceMission.combatForces || [],
      tasks: state.forceMission.tasks || []
    } : null,
    ov5: {
      activities: ov5.activities || [],
      edges: ov5.edges || [],
      argumentChain: chain
    },
    tacticalCases
  }));

  const payload = {
    name,
    category,
    summary,
    applicableConditions,
    coreApproach: summary.slice(0, 80),
    claim: chain.claim || summary,
    reasoning: chain.reasoning || summary,
    assumptions: chain.assumptions || [],
    tacticalCases,
    recordTemplate,
    sourceProjectId: state.activeProjectId || state.project?.id || "",
    author
  };

  const res = await fetch("/api/tactics-library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`存入战法库失败: ${res.status}`);
  }
  return res.json();
}

export async function deleteTacticFromLibrary(id) {
  const res = await fetch(`/api/tactics-library/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  if (!res.ok) {
    throw new Error(`删除战法失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 战法库复制作为起点（纯解耦复制，不建立脆弱联动）
 */
export function buildForkedProjectData(tacticItem, newProjectId, newTitle) {
  const template = tacticItem.recordTemplate || {};
  const clonedRecord = JSON.parse(JSON.stringify(template));

  return {
    id: String(newProjectId).trim(),
    kind: "tactic",
    title: String(newTitle).trim(),
    description: `从战法库【${tacticItem.name}】复制衍生的作战概念研究项目。`,
    record: clonedRecord,
    workflow: {
      version: 2,
      mode: "free",
      completedThrough: 0
    }
  };
}

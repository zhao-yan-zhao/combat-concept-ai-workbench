import { normalizeDodafOv1 } from "../../shared/dodaf/products.js";
import { conceptForcesToOv1Draft } from "../../shared/conceptPlanning.js";
import { layoutOv1Nodes } from "../../shared/ov1Layout.js";

const ROLE_ORDER = ['sense', 'decide', 'control', 'opponent', 'assess'];

const DEFAULT_LABELS = {
  sense: '态势感知与监视体系',
  decide: '联合指挥控制中心',
  control: '重点任务行动单元',
  opponent: '外部对象与态势影响',
  assess: '任务效果与终态'
};

const DEFAULT_EDGES = [
  { id: 'ov1-edge-sense-decide', sourceId: 'sense', targetId: 'decide', type: '信息流' },
  { id: 'ov1-edge-decide-control', sourceId: 'decide', targetId: 'control', type: '控制流' },
  { id: 'ov1-edge-opponent-decide', sourceId: 'opponent', targetId: 'decide', type: '态势变化' },
  { id: 'ov1-edge-control-assess', sourceId: 'control', targetId: 'assess', type: '反馈' },
  { id: 'ov1-edge-assess-sense', sourceId: 'assess', targetId: 'sense', type: '反馈' }
];

export function extractOv1FromOv5(ov5, { brief = {}, direction = "", forceMission = null } = {}) {
  const activities = Array.isArray(ov5?.activities) ? ov5.activities : [];
  const edges = Array.isArray(ov5?.edges) ? ov5.edges : [];

  if (!activities.length) {
    return createLocalOv1Draft({ brief, direction, forceMission });
  }

  const buckets = {
    sense: [],
    decide: [],
    control: [],
    opponent: [],
    assess: []
  };

  activities.forEach((act) => {
    const t = String(act.type || "");
    const title = String(act.title || "");
    const text = String(act.text || "");
    const combined = `${t} ${title} ${text}`;

    if (combined.includes("红方") || combined.includes("敌方") || combined.includes("对抗") || combined.includes("外部")) {
      buckets.opponent.push(act);
    } else if (t.includes("感知") || combined.includes("侦察") || combined.includes("探测") || combined.includes("搜索") || combined.includes("预警") || combined.includes("监视")) {
      buckets.sense.push(act);
    } else if (t.includes("决策") || combined.includes("指挥") || combined.includes("指控") || combined.includes("协调") || combined.includes("任务分配") || combined.includes("决策")) {
      buckets.decide.push(act);
    } else if (t.includes("评估") || combined.includes("战损") || combined.includes("毁伤") || combined.includes("反馈") || combined.includes("态势更新")) {
      buckets.assess.push(act);
    } else {
      buckets.control.push(act);
    }
  });

  const labels = {
    sense: buckets.sense.length
      ? (buckets.sense[0].title.length <= 16 ? buckets.sense[0].title : "综合态势感知体系")
      : DEFAULT_LABELS.sense,
    decide: buckets.decide.length
      ? (buckets.decide[0].title.length <= 16 ? buckets.decide[0].title : "联合指挥控制中心")
      : DEFAULT_LABELS.decide,
    control: buckets.control.length
      ? (buckets.control[0].title.length <= 16 ? buckets.control[0].title : "联合任务行动群")
      : DEFAULT_LABELS.control,
    opponent: buckets.opponent.length
      ? (buckets.opponent[0].title.length <= 16 ? buckets.opponent[0].title : "外部对抗与态势影响")
      : DEFAULT_LABELS.opponent,
    assess: buckets.assess.length
      ? (buckets.assess[0].title.length <= 16 ? buckets.assess[0].title : "任务效果与战损评估")
      : DEFAULT_LABELS.assess
  };

  const details = {
    sense: buckets.sense.length
      ? `整合 ${buckets.sense.map((a) => a.title).join("、")}。输入：${buckets.sense.map((a) => a.input).filter(Boolean).slice(0, 2).join("；") || "环境与传感器数据"}；输出：${buckets.sense.map((a) => a.output).filter(Boolean).slice(0, 2).join("；") || "态势目标包"}。`
      : `围绕“${brief.objective || "作战目标"}”获取多源战场态势，持续支撑决策分配。`,
    decide: buckets.decide.length
      ? `包含 ${buckets.decide.map((a) => a.title).join("、")}。形成协同指挥判断与授权控制，下达行动指令。`
      : `依据作战意图形成分布式协同决策与任务控制规则。`,
    control: buckets.control.length
      ? `执行 ${buckets.control.map((a) => a.title).join("、")}。输入：${buckets.control.map((a) => a.input).filter(Boolean).slice(0, 2).join("；") || "协同打击指令"}；输出：${buckets.control.map((a) => a.output).filter(Boolean).slice(0, 2).join("；") || "突击行动结果"}。`
      : `聚合关键打击、干扰与作战机动实体，达成战役战术效果。`,
    opponent: buckets.opponent.length
      ? `对应 ${buckets.opponent.map((a) => a.title).join("、")}。表征敌方兵力威胁与动态对抗反应。`
      : `外部复杂电磁环境与假想敌对抗态势，驱动我方决策调整。`,
    assess: buckets.assess.length
      ? `实施 ${buckets.assess.map((a) => a.title).join("、")}。评估行动毁伤与终态达成度，向感知与决策闭环反哺。`
      : `对作战行动进行毁伤与态势评估，形成闭环反哺循环。预期效果：${brief.expectedEffects || "达成战役预期目的"}。`
  };

  const nodes = ROLE_ORDER.map((id) => {
    return {
      id,
      label: textOf(labels[id], 60) || DEFAULT_LABELS[id],
      detail: textOf(details[id], 800),
      kind: id === "sense" ? "equipment" : id === "decide" ? "command" : id === "control" ? "action" : id === "opponent" ? "external" : "effect",
      className: id === "opponent" ? "blue" : id === "assess" ? "gold" : "",
      sourceOv5ActivityIds: buckets[id].map((a) => a.id)
    };
  });

  const concept = {
    mission: textOf(brief?.objective, 28) || "总体作战概念图",
    objective: textOf(brief?.objective, 500) || "达成预定作战构想与效果",
    scope: textOf(brief?.assumptions, 300) || "战役战术战区范围",
    phase: textOf(brief?.approach, 160) || "多阶段全过程闭环",
    expectedEffects: textOf(brief?.expectedEffects, 500),
    constraints: textOf(brief?.risk, 500)
  };

  const model = {
    version: 1,
    provenance: {
      mode: "derived",
      note: `自底向上从 Step 04 作战活动网络（${activities.length} 个活动、${edges.length} 条关联）提炼生成的高层总体概念图。`,
      generatedAt: new Date().toISOString()
    },
    concept,
    nodes: layoutOv1Nodes(nodes, DEFAULT_EDGES),
    edges: DEFAULT_EDGES.map((e) => ({ ...e }))
  };

  return asDm2Ov1(model);
}

export function createAiOv1Draft({ brief, direction, draft, forceMission }) {
  const forceSeed = forceMission?.forces?.length ? conceptForcesToOv1Draft(forceMission, brief) : null;
  const forceNodes = new Map(Array.isArray(forceSeed?.nodes) ? forceSeed.nodes.map((node) => [node?.id, node]) : []);
  const generated = new Map(Array.isArray(draft?.nodes) ? draft.nodes.map((node) => [node?.id, node]) : []);
  const hasSubjectForces = Boolean(forceSeed?.researchSubjectSide && forceNodes.size);
  const details = buildAiDetails({ brief, direction, draft, forceMission, forceSeed });
  const labels = labelsFromForceSeed(forceSeed);

  // When research-subject concept forces exist, expand one OV-1 node per concept force.
  // AI free-form 5-role sketches must not collapse or rename those equipment nodes.
  if (hasSubjectForces) {
    const seedNodes = Array.isArray(forceSeed.nodes) ? forceSeed.nodes : [];
    const edges = normalizeEdges(forceSeed.edges, seedNodes);
    const fallbackPositions = new Map(layoutOv1Nodes(seedNodes, edges).map((node) => [node.id, node]));
    return asDm2Ov1({
      version: 1,
      provenance: {
        mode: draft && !forceSeedEqualsDraft(forceSeed, draft) ? "ai" : "local",
        note: "按研究主体概念兵力装备展开的 OV-1 草案（一概念兵力一节点，标签=装备名称），需人工复核。",
        generatedAt: new Date().toISOString()
      },
      concept: normalizeConcept(forceSeed.concept || draft?.concept, brief),
      nodes: seedNodes.map((forceNode, index) => {
        const id = textOf(forceNode.id, 80) || `ov1-force-${index + 1}`;
        const kind = validKind(forceNode.kind, forceNode.kind || "equipment");
        // Keep inherited force positions; only missing coordinates use the shared layout.
        const fallback = fallbackPositions.get(id) || {};
        return {
          id,
          label: labelOf(forceNode.label, labels[id] || `概念装备${index + 1}`),
          detail: textOf(forceNode.detail, 800) || details[id] || "",
          category: textOf(forceNode.category, 80) || kindLabel(kind, id),
          kind,
          className: forceNode.className
            || (kind === "external" ? "blue" : kind === "effect" ? "gold" : ""),
          x: textOf(forceNode.x, 16) || fallback.x,
          y: textOf(forceNode.y, 16) || fallback.y,
          sourceConceptForceIds: Array.isArray(forceNode.sourceConceptForceIds) ? forceNode.sourceConceptForceIds : []
        };
      }),
      edges
    });
  }

  const hasAllRoles = ROLE_ORDER.every((id) => generated.has(id));
  if (!hasAllRoles) {
    return createOv1Draft({
      details,
      direction,
      labels,
      provenance: { mode: "ai", note: "AI 根据当前简报生成的 OV-1 草案，需人工复核。" },
      concept: normalizeConcept(draft?.concept, brief)
    });
  }
  const edges = normalizeEdges(draft?.edges);
  const nodes = ROLE_ORDER.map((id) => {
    const node = generated.get(id) || {};
    return {
      id,
      label: labelOf(node.label, DEFAULT_LABELS[id]),
      detail: textOf(node.detail, 800) || details[id],
      category: textOf(node.category, 80) || kindLabel(node.kind, id),
      kind: validKind(node.kind, id),
      className: id === "opponent" ? "blue" : id === "assess" ? "gold" : ""
    };
  });
  return asDm2Ov1({
    version: 1,
    provenance: { mode: "ai", note: "AI 根据当前简报生成的 OV-1 草案，需人工复核。", generatedAt: new Date().toISOString() },
    concept: normalizeConcept(draft?.concept, brief),
    nodes: layoutOv1Nodes(nodes, edges),
    edges
  });
}

function forceSeedEqualsDraft(forceSeed, draft) {
  if (!forceSeed?.nodes?.length || !draft?.nodes?.length) return false;
  if (forceSeed.nodes.length !== draft.nodes.length) return false;
  const rightById = new Map(draft.nodes.map((node) => [node.id, node]));
  return forceSeed.nodes.every((left) => {
    const right = rightById.get(left.id);
    return right && textOf(left.label, 60) === textOf(right.label, 60);
  });
}

export function createLocalOv1Draft({ brief, direction, forceMission }) {
  if (forceMission?.forces?.length) {
    const forceSeed = conceptForcesToOv1Draft(forceMission, brief);
    const seeded = createAiOv1Draft({
      brief,
      direction,
      draft: forceSeed,
      forceMission
    });
    return asDm2Ov1({
      ...seeded,
      provenance: {
        mode: "local",
        note: "按已确认概念兵力生成的本地 OV-1 草案，需人工复核。",
        generatedAt: new Date().toISOString()
      }
    });
  }
  return createOv1Draft({
    details: buildLocalDetails({ brief, direction }),
    direction,
    labels: DEFAULT_LABELS,
    provenance: { mode: 'local', note: 'AI 服务不可用时按当前简报生成的本地 OV-1 草案。' }
  });
}

export function applyAiOv1Draft(model, { brief, direction, draft }) {
  const details = buildAiDetails({ brief, direction, draft });
  return applyDetails(model, details);
}

export function applyLocalOv1Draft(model, { brief, direction }) {
  return applyDetails(model, buildLocalDetails({ brief, direction }));
}

function buildAiDetails({ brief, direction, draft, forceSeed }) {
  const forceDetails = detailsFromForceSeed(forceSeed);
  if (forceDetails) {
    const expectedEffects = textOf(draft?.expectedEffects || brief?.expectedEffects, 220);
    return withExpectedEffects(forceDetails, expectedEffects);
  }
  const coreIdea = textOf(draft?.coreIdea || draft?.summary || brief?.approach, 260);
  const objective = textOf(draft?.objective || brief?.objective, 220);
  const phases = toList(draft?.phases);
  const risks = toList(draft?.risks);
  const focus = textOf(phases[0] || coreIdea, 220);
  const control = textOf(phases[1] || objective, 220);
  const risk = textOf(risks[0] || brief?.risk, 220);
  const expectedEffects = textOf(draft?.expectedEffects || brief?.expectedEffects, 220);
  const directionLabel = textOf(direction, 60) || "当前概念方向";
  return withExpectedEffects({
    sense: `围绕“${objective}”组织多源态势获取，优先支撑${focus}。`,
    decide: `依据${directionLabel}形成协同判断与授权边界，将“${coreIdea}”转化为可复核的决策条件。`,
    control: `围绕${control}保持重点通道或任务区域的持续控制，并明确资源与时序约束。`,
    opponent: `重点监测对手可能改变闭环效率的机动、干扰或欺骗因素；当前需复核：${risk}。`,
    assess: `以任务达成、风险可控和信息闭环为评估维度，将结果反馈至下一轮感知与决策。`
  }, expectedEffects);
}

function labelsFromForceSeed(forceSeed) {
  const labels = { ...DEFAULT_LABELS };
  for (const node of forceSeed?.nodes || []) {
    if (node?.id && node?.label) labels[node.id] = textOf(node.label, 60) || labels[node.id];
  }
  return labels;
}

function detailsFromForceSeed(forceSeed) {
  if (!forceSeed?.nodes?.length) return null;
  const details = {};
  for (const node of forceSeed.nodes) {
    if (!node?.id) continue;
    details[node.id] = textOf(node.detail, 800) || textOf(node.label, 120);
  }
  return Object.keys(details).length ? details : null;
}

function buildLocalDetails({ brief, direction }) {
  const objective = textOf(brief?.objective, 220) || "当前作战目标";
  const approach = textOf(brief?.approach, 260) || "概念简报中的核心思路";
  const risk = textOf(brief?.risk, 220) || "对手适应性与信息不确定性";
  const expectedEffects = textOf(brief?.expectedEffects, 220);
  const directionLabel = textOf(direction, 60) || "当前概念方向";
  return withExpectedEffects({
    sense: `围绕“${objective}”汇聚海空、电磁与行动态势，为${directionLabel}提供持续信息基础。`,
    decide: `依据${approach}组织协同判断、行动授权和资源调度。`,
    control: `将关键资源和行动边界组织为可持续控制状态，服务于“${objective}”。`,
    opponent: `持续观察对手可能通过机动、干扰或信息欺骗改变任务态势的行为。重点风险：${risk}。`,
    assess: `以任务达成、风险和资源连续性评估效果，并将结论反馈至下一轮概念修订。`
  }, expectedEffects);
}

function withExpectedEffects(details, expectedEffects) {
  const effects = textOf(expectedEffects, 220);
  return effects ? { ...details, assess: `${details.assess} 预期效果：${effects}。` } : details;
}

function createOv1Draft({ details, direction, labels, provenance, concept }) {
  const model = {
    version: 1,
    provenance: { ...provenance, generatedAt: new Date().toISOString() },
    nodes: ROLE_ORDER.map((id) => {
      return {
        id,
        label: textOf(labels[id], 60) || DEFAULT_LABELS[id],
        detail: textOf(details[id], 800) || `请补充${DEFAULT_LABELS[id]}的说明。`,
        kind: id === "sense" ? "equipment" : id === "decide" ? "command" : id === "control" ? "action" : id === "opponent" ? "external" : "effect",
        className: id === "opponent" ? "blue" : id === "assess" ? "gold" : ""
      };
    }),
    edges: DEFAULT_EDGES.map((edge) => ({ ...edge }))
  };
  model.nodes = layoutOv1Nodes(model.nodes, model.edges);
  if (concept) model.concept = concept;
  return asDm2Ov1(model);
}

function asDm2Ov1(model) {
  try {
    return normalizeDodafOv1(model);
  } catch {
    return model;
  }
}

function normalizeConcept(value, brief) {
  const concept = value && typeof value === 'object' ? value : {};
  // Mission is the canvas caption — keep it short; long prose goes to objective.
  const rawMission = textOf(concept.mission, 80);
  const mission = rawMission && rawMission.length > 28
    ? `${rawMission.split(/[。！？；;\n]/)[0].trim().slice(0, 18)}${rawMission.length > 18 ? "…" : ""}`
    : rawMission;
  return {
    mission: mission || textOf(brief?.researchIntent, 28) || "高层作战概念图",
    objective: textOf(concept.objective || brief?.objective, 500),
    scope: textOf(concept.scope || brief?.assumptions, 300),
    phase: textOf(concept.phase || '总体概念评估', 160),
    expectedEffects: textOf(concept.expectedEffects || brief?.expectedEffects, 500),
    constraints: textOf(concept.constraints || brief?.risk, 500)
  };
}

function normalizeEdges(value, nodes = []) {
  const allowed = new Set(
    (Array.isArray(nodes) && nodes.length ? nodes : ROLE_ORDER.map((id) => ({ id }))).map((node) => node.id || node)
  );
  const types = new Set(['信息流', '控制流', '态势变化', '反馈']);
  const edges = Array.isArray(value) ? value : [];
  const normalized = edges.map((edge, index) => ({
    id: textOf(edge?.id, 80) || `ov1-ai-edge-${index + 1}`,
    sourceId: textOf(edge?.sourceId, 80),
    targetId: textOf(edge?.targetId, 80),
    type: types.has(edge?.type) ? edge.type : '信息流'
  })).filter((edge) => allowed.has(edge.sourceId) && allowed.has(edge.targetId) && edge.sourceId !== edge.targetId);
  if (normalized.length) return normalized;
  // Multi-node force drafts may already be complete; only fall back to classic 5-role edges for legacy AI drafts.
  if (allowed.size && ![...allowed].every((id) => ROLE_ORDER.includes(id))) return [];
  return DEFAULT_EDGES.map((edge) => ({ ...edge }));
}

function validKind(value, id) {
  if (['equipment', 'command', 'action', 'external', 'environment', 'effect'].includes(value)) return value;
  const fallback = id === 'sense' ? 'equipment'
    : id === 'decide' ? 'command'
      : id === 'control' ? 'action'
        : id === 'opponent' ? 'external'
          : id === 'assess' ? 'effect'
            : 'equipment';
  return fallback;
}

function kindLabel(kind, id) {
  return ({ equipment: '装备/平台', command: '指挥节点', action: '关键动作', external: '外部对象', environment: '环境要素', effect: '预期效果' })[validKind(kind, id)];
}

function applyDetails(model, details) {
  return asDm2Ov1({
    ...model,
    nodes: model.nodes.map((node) => ({ ...node, detail: textOf(details[node.id], 800) || node.detail }))
  });
}

function toList(value) {
  return Array.isArray(value) ? value.map((item) => textOf(item, 220)).filter(Boolean) : [];
}

function labelOf(value, fallback) {
  const text = textOf(value, 80).replace(/[。；，、：:]/g, ' ').trim();
  if (!text) return fallback;
  // Equipment names need more room than abstract duty titles.
  return text.length > 36 ? `${text.slice(0, 36)}…` : text;
}

function textOf(value, limit) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

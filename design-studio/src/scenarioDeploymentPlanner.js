const MIN_SEPARATION = 11;
const ROLE_LAYOUTS = {
  sensor: { area: "coverage", offset: [-28, 6], label: "覆盖区前沿感知" },
  command: { area: "coverage", offset: [-12, 22], label: "覆盖区内协同控制" },
  action: { area: "window", offset: [32, -12], label: "行动窗口机动单元" },
  support: { area: "window", offset: [2, 12], label: "行动窗口后方保障" },
  opponent: { area: "coverage", offset: [19, 2], label: "对手态势参照" }
};

export function planScenarioDeployment(scenario) {
  const entities = Array.isArray(scenario?.entities) ? scenario.entities : [];
  const areas = new Map((Array.isArray(scenario?.areas) ? scenario.areas : []).map((area) => [area.id, area]));
  const proposed = entities.map((entity, index) => proposePosition(entity, index, areas));
  const separated = enforceSeparation(proposed);
  const diagnostics = buildDiagnostics(entities, separated, areas);
  return {
    version: 1,
    mode: "role-area-layout-v1",
    coordinateReference: "abstract-percent-grid",
    generatedAt: new Date().toISOString(),
    state: "suggested",
    adjustedEntityIds: separated.filter((item) => hasChanged(item.position, item.previousPosition)).map((item) => item.id),
    placements: separated.map(({ id, role, position, reason }) => ({ id, role, position, reason })),
    diagnostics
  };
}

export function applyScenarioDeploymentPlan(scenario, plan = planScenarioDeployment(scenario)) {
  if (!scenario || !plan) return scenario;
  const positions = new Map((plan.placements || []).map((placement) => [placement.id, placement.position]));
  return {
    ...scenario,
    updatedAt: new Date().toISOString(),
    deploymentPlan: plan,
    entities: scenario.entities.map((entity) => positions.has(entity.id) ? { ...entity, position: positions.get(entity.id) } : entity)
  };
}

function proposePosition(entity, index, areas) {
  const previousPosition = normalizePosition(entity?.position);
  const layout = ROLE_LAYOUTS[entity?.role] || { area: "coverage", offset: [0, 0], label: "区域约束布局" };
  const anchor = normalizePosition(areas.get(layout.area)?.position || previousPosition);
  const spread = index > Object.keys(ROLE_LAYOUTS).length ? [(index % 3) * 6, (index % 2) * 6] : [0, 0];
  return {
    id: String(entity?.id || ""),
    role: String(entity?.role || "unknown"),
    previousPosition,
    position: normalizePosition([anchor[0] + layout.offset[0] + spread[0], anchor[1] + layout.offset[1] + spread[1]]),
    reason: layout.label
  };
}

function enforceSeparation(placements) {
  return placements.map((placement, index, all) => {
    const position = [...placement.position];
    for (const prior of all.slice(0, index)) {
      if (distance(position, prior.position) >= MIN_SEPARATION) continue;
      position[0] = clamp(position[0] + MIN_SEPARATION);
      position[1] = clamp(position[1] + (index % 2 ? 4 : -4));
    }
    return { ...placement, position };
  });
}

function buildDiagnostics(entities, placements, areas) {
  const byId = new Map(placements.map((placement) => [placement.id, placement]));
  const pairs = [];
  for (let index = 0; index < placements.length; index += 1) {
    for (let next = index + 1; next < placements.length; next += 1) pairs.push([placements[index], placements[next]]);
  }
  const tooClose = pairs.filter(([left, right]) => distance(left.position, right.position) < MIN_SEPARATION);
  const coverage = areas.get("coverage");
  const sensor = entities.find((entity) => entity.role === "sensor");
  const sensorPlacement = byId.get(sensor?.id);
  return [
    {
      id: "abstract-grid",
      state: placements.every((placement) => placement.position.every((value) => value >= 0 && value <= 100)) ? "ready" : "attention",
      label: "抽象坐标边界",
      detail: "所有建议均位于 0-100 的研究网格内，不代表真实地理坐标。"
    },
    {
      id: "entity-separation",
      state: tooClose.length ? "review" : "ready",
      label: "实体最小间距",
      detail: tooClose.length ? `${tooClose.length} 组实体仍低于 ${MIN_SEPARATION}% 的抽象间距，需人工复核。` : `实体间距均不低于 ${MIN_SEPARATION}% 的抽象阈值。`
    },
    {
      id: "coverage-alignment",
      state: !coverage || !sensorPlacement ? "review" : distance(sensorPlacement.position, normalizePosition(coverage.position)) <= 38 ? "ready" : "review",
      label: "感知覆盖区对齐",
      detail: !coverage || !sensorPlacement ? "缺少覆盖区或感知实体，无法检查对齐。" : "感知实体已依据覆盖区锚点布置；范围参数仍需研究人员按任务资料复核。"
    }
  ];
}

function normalizePosition(value) {
  return [clamp(value?.[0]), clamp(value?.[1])];
}

function clamp(value) {
  const parsed = Number(value);
  return Math.min(100, Math.max(0, Number.isFinite(parsed) ? Math.round(parsed) : 50));
}

function distance(left, right) {
  return Math.hypot(Number(left?.[0] || 0) - Number(right?.[0] || 0), Number(left?.[1] || 0) - Number(right?.[1] || 0));
}

function hasChanged(left, right) {
  return left[0] !== right[0] || left[1] !== right[1];
}

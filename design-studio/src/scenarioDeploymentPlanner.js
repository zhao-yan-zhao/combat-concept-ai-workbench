const MIN_SEPARATION = 11;

/**
 * 战术角色基准梯次配置规范 (M8-T8.7)
 * 基于抽象威胁轴线归一化向量展开：
 * - 前沿感知 (sensor/radar/recon/aew)：迎向威胁来源，前推预警纵深；
 * - 指控中心 (command/c2)：后置纵深安全区；
 * - 机动打击 (action/shooter/strike)：居中阵位机动突破；
 * - 后方保障 (support/supply)：后方侧翼安全展开；
 * - 对手参照 (opponent/red)：威胁源头参照阵位。
 */
const TACTICAL_ROLE_OFFSETS = {
  sensor: { axisOffset: 24, lateralOffset: -6, label: "前沿感知节点迎头前推部署" },
  command: { axisOffset: -16, lateralOffset: 10, label: "指挥控制中心后置防御纵深" },
  action: { axisOffset: 8, lateralOffset: -14, label: "战术打击机动力量居中配置" },
  support: { axisOffset: -22, lateralOffset: -12, label: "保障支援要素后方侧翼展开" },
  opponent: { axisOffset: 36, lateralOffset: 0, label: "对手威胁参照阵位" }
};

export function planScenarioDeployment(scenario) {
  const entities = Array.isArray(scenario?.entities) ? scenario.entities : [];
  const areas = new Map((Array.isArray(scenario?.areas) ? scenario.areas : []).map((area) => [area.id, area]));
  const threatAxis = resolveThreatAxis(scenario);

  const proposed = entities.map((entity, index) => proposeTacticalPosition(entity, index, areas, threatAxis));
  const relaxed = applyForceRelaxationAndGravity(proposed, scenario);
  const diagnostics = buildTacticalDiagnostics(entities, relaxed, areas, threatAxis);

  return {
    version: 1,
    mode: "role-area-layout-v1",
    algorithm: "threat-axis-gravity-layout-v2",
    coordinateReference: "abstract-percent-grid",
    generatedAt: new Date().toISOString(),
    state: "suggested",
    threatAxis: {
      unitAxis: threatAxis.unitAxis,
      threatCenter: threatAxis.threatCenter
    },
    adjustedEntityIds: relaxed.filter((item) => hasChanged(item.position, item.previousPosition)).map((item) => item.id),
    placements: relaxed.map(({ id, role, position, reason }) => ({ id, role, position, reason })),
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

/**
 * 推导威胁轴线向量 (Threat Axis Vector)
 */
function resolveThreatAxis(scenario) {
  const entities = Array.isArray(scenario?.entities) ? scenario.entities : [];
  const areas = Array.isArray(scenario?.areas) ? scenario.areas : [];

  const opponentEntities = entities.filter((e) => {
    const role = String(e.role || "").toLowerCase();
    return role === "opponent" || role.startsWith("red") || role.includes("敌") || role.includes("对手");
  });

  const threatAreas = areas.filter((a) => {
    const type = String(a.type || a.id || "").toLowerCase();
    return /threat|target|strike|red|对手|目标|威胁/.test(type);
  });

  let threatCenter = [80, 45];
  if (opponentEntities.length > 0) {
    const sumX = opponentEntities.reduce((sum, e) => sum + normalizeCoord(e.position?.[0]), 0);
    const sumY = opponentEntities.reduce((sum, e) => sum + normalizeCoord(e.position?.[1]), 0);
    threatCenter = [sumX / opponentEntities.length, sumY / opponentEntities.length];
  } else if (threatAreas.length > 0) {
    const sumX = threatAreas.reduce((sum, a) => sum + normalizeCoord(a.position?.[0]), 0);
    const sumY = threatAreas.reduce((sum, a) => sum + normalizeCoord(a.position?.[1]), 0);
    threatCenter = [sumX / threatAreas.length, sumY / threatAreas.length];
  }

  const blueEntities = entities.filter((e) => !opponentEntities.includes(e));
  let blueBase = [28, 48];
  if (blueEntities.length > 0) {
    const sumX = blueEntities.reduce((sum, e) => sum + normalizeCoord(e.position?.[0]), 0);
    const sumY = blueEntities.reduce((sum, e) => sum + normalizeCoord(e.position?.[1]), 0);
    const avgX = sumX / blueEntities.length;
    const avgY = sumY / blueEntities.length;
    if (avgX > 1 || avgY > 1) {
      blueBase = [avgX, avgY];
    }
  }

  const dx = threatCenter[0] - blueBase[0];
  const dy = threatCenter[1] - blueBase[1];
  const length = Math.hypot(dx, dy) || 1;
  const unitAxis = [dx / length, dy / length];
  const unitNormal = [-unitAxis[1], unitAxis[0]];

  return {
    blueBase,
    threatCenter,
    unitAxis,
    unitNormal
  };
}

function proposeTacticalPosition(entity, index, areasMap, threatAxis) {
  const previousPosition = normalizePosition(entity?.position);
  const role = String(entity?.role || "unknown").toLowerCase();

  const roleKey = Object.keys(TACTICAL_ROLE_OFFSETS).find((k) => role.includes(k)) || "action";
  const layout = TACTICAL_ROLE_OFFSETS[roleKey];
  const { blueBase, threatCenter, unitAxis, unitNormal } = threatAxis;

  let basePos = [...blueBase];
  if (roleKey === "opponent") {
    basePos = [...threatCenter];
  } else if (areasMap.has("coverage") && (roleKey === "sensor" || roleKey === "command")) {
    const covPos = normalizePosition(areasMap.get("coverage").position);
    basePos = [covPos[0] - 8 * unitAxis[0], covPos[1] - 8 * unitAxis[1]];
  } else if (areasMap.has("window") && (roleKey === "action" || roleKey === "support")) {
    const winPos = normalizePosition(areasMap.get("window").position);
    basePos = [...winPos];
  }

  const spreadOffset = (index % 3 - 1) * 7;
  const targetX = basePos[0] + layout.axisOffset * unitAxis[0] + (layout.lateralOffset + spreadOffset) * unitNormal[0];
  const targetY = basePos[1] + layout.axisOffset * unitAxis[1] + (layout.lateralOffset + spreadOffset) * unitNormal[1];

  return {
    id: String(entity?.id || ""),
    role: String(entity?.role || "unknown"),
    previousPosition,
    position: [clamp(targetX), clamp(targetY)],
    reason: `${layout.label} (基于威胁轴线梯度配置)`
  };
}

/**
 * 力导向松弛与 OV-2 协同引力微调
 */
function applyForceRelaxationAndGravity(placements, scenario) {
  const edges = Array.isArray(scenario?.ov2?.edges) ? scenario.ov2.edges : [];
  const collabPairs = new Set();
  edges.forEach((e) => {
    if (e.from && e.to) collabPairs.add(`${e.from}->${e.to}`);
  });

  const positions = placements.map((p) => [...p.position]);
  const n = positions.length;

  for (let iter = 0; iter < 4; iter++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = positions[i][0] - positions[j][0];
        const dy = positions[i][1] - positions[j][1];
        const d = Math.hypot(dx, dy) || 0.1;

        // 1. 防区疏散排斥力 (d < MIN_SEPARATION)
        if (d < MIN_SEPARATION) {
          const push = (MIN_SEPARATION - d) * 0.55;
          const nx = (dx / d) * push;
          const ny = (dy / d) * push;
          positions[i][0] = clamp(positions[i][0] + nx);
          positions[i][1] = clamp(positions[i][1] + ny);
          positions[j][0] = clamp(positions[j][0] - nx);
          positions[j][1] = clamp(positions[j][1] - ny);
        }

        // 2. 协同引力约束 (若有通信协同且距离超标)
        const isCollab = collabPairs.has(`${placements[i].id}->${placements[j].id}`) ||
                         collabPairs.has(`${placements[j].id}->${placements[i].id}`);
        if (isCollab && d > 38) {
          const pull = (d - 38) * 0.2;
          const nx = (dx / d) * pull;
          const ny = (dy / d) * pull;
          positions[i][0] = clamp(positions[i][0] - nx);
          positions[i][1] = clamp(positions[i][1] - ny);
          positions[j][0] = clamp(positions[j][0] + nx);
          positions[j][1] = clamp(positions[j][1] + ny);
        }
      }
    }
  }

  return placements.map((p, idx) => ({
    ...p,
    position: positions[idx]
  }));
}

function buildTacticalDiagnostics(entities, placements, areas, threatAxis) {
  const byId = new Map(placements.map((placement) => [placement.id, placement]));
  const pairs = [];
  for (let index = 0; index < placements.length; index += 1) {
    for (let next = index + 1; next < placements.length; next += 1) pairs.push([placements[index], placements[next]]);
  }
  const tooClose = pairs.filter(([left, right]) => distance(left.position, right.position) < MIN_SEPARATION);
  const coverage = areas.get("coverage");
  const sensor = entities.find((entity) => String(entity.role).includes("sensor"));
  const sensorPlacement = byId.get(sensor?.id);

  return [
    {
      id: "abstract-grid",
      state: placements.every((placement) => placement.position.every((value) => value >= 0 && value <= 100)) ? "ready" : "attention",
      label: "抽象坐标边界",
      detail: "所有建议阵位均严格位于 0-100 的研究网格内，不涉及真实经纬度与敏感地理信息。"
    },
    {
      id: "entity-separation",
      state: tooClose.length ? "review" : "ready",
      label: "实体最小间距",
      detail: tooClose.length ? `${tooClose.length} 组实体仍低于 ${MIN_SEPARATION}% 的安全防区疏散阈值，需人工复核。` : `实体防区疏散间距均达到 ${MIN_SEPARATION}% 的安全阈值，有效规避面杀伤聚集风险。`
    },
    {
      id: "coverage-alignment",
      state: !coverage || !sensorPlacement ? "review" : distance(sensorPlacement.position, normalizePosition(coverage.position)) <= 40 ? "ready" : "review",
      label: "感知覆盖区对齐",
      detail: !coverage || !sensorPlacement ? "缺少覆盖区或感知实体，无法检查对齐。" : `感知实体已根据威胁主轴 [${threatAxis.unitAxis.map(v => v.toFixed(2)).join(", ")}] 与覆盖区锚点完成前沿迎头对齐配置。`
    }
  ];
}

function normalizePosition(value) {
  return [clamp(value?.[0]), clamp(value?.[1])];
}

function normalizeCoord(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 50;
}

function clamp(value) {
  const parsed = Number(value);
  return Math.min(95, Math.max(5, Number.isFinite(parsed) ? Math.round(parsed) : 50));
}

function distance(left, right) {
  return Math.hypot(Number(left?.[0] || 0) - Number(right?.[0] || 0), Number(left?.[1] || 0) - Number(right?.[1] || 0));
}

function hasChanged(left, right) {
  return left[0] !== right[0] || left[1] !== right[1];
}

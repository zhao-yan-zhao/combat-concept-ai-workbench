const STORAGE_PREFIX = "combat-concept-project-concept-map-v1";
const MAP_ITEM_TYPES = new Set(["symbol", "line", "area", "plot", "text"]);
const REFERENCE_STATUSES = new Set(["empty", "draft", "confirmed"]);
const REFERENCE_ROLES = new Set(["environment", "external", "equipment", "command", "action", "effect"]);
const PHASES = [{ id: "recon", name: "侦察" }, { id: "deployment", name: "展开" }, { id: "assault", name: "突击" }, { id: "support", name: "保障" }];
/** Slot offsets in degrees relative to theater center (WGS84 Earth lon/lat, not abstract 0,0). */
const SLOT_OFFSETS_DEG = {
  northwest: [-0.55, 0.42],
  north: [0, 0.55],
  northeast: [0.55, 0.42],
  west: [-0.65, 0],
  center: [0, 0],
  east: [0.65, 0],
  southwest: [-0.55, -0.42],
  south: [0, -0.55],
  southeast: [0.55, -0.42]
};
/** Legacy alias — offsets only; must be applied on a real theater center. */
const SLOTS = SLOT_OFFSETS_DEG;
const CMO_BY_ROLE = { sense: "radar", command: "HQ", maneuver: "ACV", air: "AirGroup", airDefense: "airdef_mis", surface: "SurfaceGroup", support: "AirBase", external: "radar" };
const SPATIAL_MODE_EARTH = "earth-wgs84-layout";

export function createEmptyConceptMap() {
  return {
    version: 2,
    title: "",
    context: "",
    boundMapProjectId: "",
    document: { version: 4, items: [], view: {}, operation: { phases: [] } },
    draft: createEmptyDraft(),
    reference: createEmptyReference(),
    summary: { itemCount: 0, layers: [], typeCounts: {} }
  };
}
export function loadConceptMap(projectId) { try { return normalizeConceptMap(JSON.parse(localStorage.getItem(storageKey(projectId)) || "null")); } catch { return createEmptyConceptMap(); } }
export function persistConceptMap(value, projectId) { const normalized = normalizeConceptMap(value); try { const serialized = JSON.stringify(normalized); if (serialized.length <= 700 * 1024) localStorage.setItem(storageKey(projectId), serialized); } catch { /* server resource remains durable */ } return normalized; }

/**
 * Apply a drawing-tool document into conceptMap storage.
 * Document item lon/lat is the durable source of truth for force positions.
 */
export function applyMapDocumentToConceptMap(map, document, options = {}) {
  const current = normalizeConceptMap(map);
  const nextDocument = syncItemPositionFields(normalizeDocument(document));
  const placements = extractForcePlacements(nextDocument);
  const importedAt = options.importedAt || new Date().toISOString();
  return normalizeConceptMap({
    ...current,
    title: clean(options.title, 180) || current.title,
    boundMapProjectId: clean(options.boundMapProjectId, 120) || current.boundMapProjectId,
    document: nextDocument,
    draft: {
      ...current.draft,
      status: current.draft?.status === "generated" ? "generated" : "imported",
      importedAt,
      placements
    },
    reference: options.keepReference
      ? current.reference
      : {
        ...current.reference,
        status: "draft",
        confirmedAt: ""
      }
  });
}

/** Symbol/force placements taken from the drawing document (WGS84). */
export function extractForcePlacements(document) {
  const items = Array.isArray(document?.items) ? document.items : [];
  return items
    .filter((item) => item && item.type === "symbol"
      && Number.isFinite(Number(item.lon))
      && Number.isFinite(Number(item.lat)))
    .slice(0, 120)
    .map((item) => ({
      itemId: clean(item.id, 160),
      conceptForceId: clean(item.assignment?.conceptForceId, 80),
      name: clean(item.assignment?.conceptForceName || item.name, 80),
      lon: clampLon(Number(item.lon)),
      lat: clampLat(Number(item.lat)),
      phaseId: clean(item.assignment?.phaseId, 48)
    }))
    .filter((item) => item.itemId);
}

/** Mirror item lon/lat into assignment so stored meta stays consistent after drag. */
export function syncItemPositionFields(document) {
  const source = document && typeof document === "object" ? document : {};
  const items = (Array.isArray(source.items) ? source.items : []).map((item) => {
    if (!item || typeof item !== "object") return item;
    if (!Number.isFinite(Number(item.lon)) || !Number.isFinite(Number(item.lat))) return item;
    const lon = clampLon(Number(item.lon));
    const lat = clampLat(Number(item.lat));
    const assignment = item.assignment && typeof item.assignment === "object"
      ? { ...item.assignment, lon, lat }
      : item.assignment;
    return { ...item, lon, lat, assignment };
  });
  return { ...source, items };
}

export function normalizeConceptMap(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const document = syncItemPositionFields(normalizeDocument(input.document));
  const layers = [...new Set(document.items.map((item) => clean(item.layer, 120)).filter(Boolean))].slice(0, 80);
  const typeCounts = document.items.reduce((result, item) => ({ ...result, [item.type]: Number(result[item.type] || 0) + 1 }), {});
  const reference = normalizeConceptMapReference(input.reference);
  const draft = normalizeDraft(input.draft);
  if (!draft.placements.length && document.items.length) {
    draft.placements = extractForcePlacements(document);
  }
  return {
    version: 2,
    title: clean(input.title, 180),
    context: clean(input.context, 6000),
    boundMapProjectId: clean(input.boundMapProjectId, 120),
    document,
    draft,
    reference,
    summary: { itemCount: document.items.length, layers, typeCounts }
  };
}

/** Ensure 1 research project ↔ 1 map-tool project id. */
export function ensureConceptMapBinding(map, workbenchProjectId, title = "") {
  const current = normalizeConceptMap(map);
  const bound = clean(current.boundMapProjectId, 120)
    || `workbench-${String(workbenchProjectId || "default").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 72) || "default"}`;
  return normalizeConceptMap({
    ...current,
    boundMapProjectId: bound,
    title: clean(title, 180) || current.title || "作战概念图"
  });
}

/**
 * Compile an initial concept-map plan from confirmed force-mission + phase-action.
 * - Map operation.phases come from phase-action (drawing tool stage switcher).
 * - Concept forces are deployed and assigned to those real phase ids.
 * - Optional AI plan may only enrich title/summary/areas/text.
 */
export function buildConceptMapPlanFromPlanning(state = {}, aiPlan = null) {
  const brief = state.brief || {};
  const conceptForces = Array.isArray(state.forceMission?.forces) ? state.forceMission.forces : [];
  const phaseActionPhases = Array.isArray(state.phaseAction?.phases) ? state.phaseAction.phases : [];
  const ai = aiPlan && typeof aiPlan === "object" ? aiPlan : null;
  const forceCap = 36;

  const theater = resolveTheaterCenter(brief);
  const phases = buildMapPhasesFromPlanning(phaseActionPhases, ai);
  const phaseIdSet = new Set(phases.map((phase) => phase.phaseId));
  const defaultPhaseId = phases[0]?.phaseId || "deployment";

  let forces = conceptForces.slice(0, forceCap).map((force, index) => {
    const platform = pickEquipmentPlatform(force.platforms);
    const equipment = platform?.name || "";
    const equipmentBasis = platformBasis(platform);
    const slot = Object.hasOwn(SLOT_OFFSETS_DEG, clean(force.slot, 20))
      ? clean(force.slot, 20)
      : (force.side === "hostile"
        ? ["northeast", "east", "southeast", "north", "center"][index % 5]
        : ["northwest", "west", "southwest", "south", "center"][index % 5]);
    return {
      id: force.id,
      name: force.name,
      side: force.side || "friendly",
      role: force.role || "maneuver",
      group: force.group || "概念编组",
      task: `${force.task || "研究级概念任务"}${equipment ? ` · 装备：${equipment}` : ""}${equipmentBasis ? `（依据：${equipmentBasis}）` : ""}`.trim(),
      // Map onto drawing-tool phase ids (aligned with phase-action).
      phaseIds: resolveForcePhaseIds(force, phaseActionPhases, phases, defaultPhaseId),
      slot,
      platform: platform || null
    };
  });
  // Drawing-tool phase list can show 8 stages while only early ones have objects —
  // ensure every stage gets at least one concept-force placement.
  forces = ensureEveryPhaseHasForces(forces, phases, phaseActionPhases);

  const forceIds = new Set(forces.map((force) => force.id));
  const forceById = new Map(forces.map((force) => [force.id, force]));
  const conceptRelations = (Array.isArray(state.forceMission?.relations) ? state.forceMission.relations : [])
    .filter((item) => forceIds.has(item.fromForceId) && forceIds.has(item.toForceId) && item.fromForceId !== item.toForceId)
    .slice(0, 24)
    .map((item) => ({
      fromForceId: item.fromForceId,
      toForceId: item.toForceId,
      type: item.type === "information" ? "information" : "coordination",
      phaseId: sharedRelationPhaseId(forceById.get(item.fromForceId), forceById.get(item.toForceId), defaultPhaseId)
    }));
  const synthesized = !conceptRelations.length && forces.length > 1
    ? forces.slice(0, -1).map((force, index) => ({
      fromForceId: force.id,
      toForceId: forces[index + 1].id,
      type: "coordination",
      phaseId: sharedRelationPhaseId(force, forces[index + 1], defaultPhaseId)
    }))
    : [];

  // Synthesize relations from state.ov1 if forceMission.relations is sparse
  const ov1Relations = [];
  if (!conceptRelations.length && Array.isArray(state.ov1?.edges) && Array.isArray(state.ov1?.nodes)) {
    const nodeById = new Map(state.ov1.nodes.map((n) => [n.id, n]));
    for (const edge of state.ov1.edges) {
      const srcNode = nodeById.get(edge.sourceId);
      const tgtNode = nodeById.get(edge.targetId);
      const srcForceId = srcNode?.sourceConceptForceIds?.[0];
      const tgtForceId = tgtNode?.sourceConceptForceIds?.[0];
      if (srcForceId && tgtForceId && srcForceId !== tgtForceId && forceIds.has(srcForceId) && forceIds.has(tgtForceId)) {
        ov1Relations.push({
          fromForceId: srcForceId,
          toForceId: tgtForceId,
          type: edge.type === "控制流" ? "effect" : edge.type === "信息流" ? "information" : "coordination",
          phaseId: sharedRelationPhaseId(forceById.get(srcForceId), forceById.get(tgtForceId), defaultPhaseId)
        });
      }
    }
  }

  const firstPhaseId = phases[0]?.phaseId || defaultPhaseId;
  const midPhaseId = phases[Math.min(1, phases.length - 1)]?.phaseId || firstPhaseId;
  const lastPhaseId = phases.at(-1)?.phaseId || firstPhaseId;

  // Ingest operational task areas from Step 03
  const taskAreas = (Array.isArray(state.forceMission?.tasks) ? state.forceMission.tasks : [])
    .filter((task) => task.area?.name && task.area.name !== "待人工明确" && (task.area.points || []).some((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)))
    .slice(0, 16)
    .map((task, index) => {
      const validPoints = (task.area.points || []).filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
      const avgLat = validPoints.reduce((acc, p) => acc + Number(p.latitude), 0) / (validPoints.length || 1);
      const avgLon = validPoints.reduce((acc, p) => acc + Number(p.longitude), 0) / (validPoints.length || 1);
      const phaseId = phaseIdSet.has(clean(task.phaseId, 48)) ? clean(task.phaseId, 48) : firstPhaseId;
      return {
        id: `task-area-${task.id}`,
        name: clean(task.area.name, 12) || clean(task.name, 12) || `任务区${index + 1}`,
        phaseId,
        slot: task.side === "hostile" ? "northeast" : "southwest",
        lat: Number.isFinite(avgLat) ? avgLat : undefined,
        lon: Number.isFinite(avgLon) ? avgLon : undefined,
        points: validPoints.map((p) => ({ lat: Number(p.latitude), lon: Number(p.longitude) })),
        geometryType: task.area.geometryType || "circle",
        radiusNm: Number(task.area.radiusNm) || 60,
        type: task.area.type || "patrol",
        side: task.side || "friendly",
        note: clean(task.objective, 120) || clean(task.expectedEffect, 120) || "作战任务区域"
      };
    });

  const areas = Array.isArray(ai?.areas) && ai.areas.length
    ? ai.areas.map((area, index) => ({
      ...area,
      phaseId: phaseIdSet.has(clean(area?.phaseId, 48))
        ? clean(area.phaseId, 48)
        : (index === 0 ? firstPhaseId : lastPhaseId)
    }))
    : taskAreas.length
      ? taskAreas
      : [
        { id: "assessment-area", name: "概念评估区域", phaseId: firstPhaseId, slot: "north", note: clean(phases[0]?.objective, 120) || "研究级态势关注范围" },
        { id: "action-area", name: "概念行动区域", phaseId: midPhaseId, slot: "east", note: clean(phases[Math.min(1, phases.length - 1)]?.objective, 120) || "行动关系人工修订位置" }
      ];

  const phaseCoverage = phases.map((phase) => {
    const count = forces.filter((force) => force.phaseIds.includes(phase.phaseId)).length;
    return `${phase.name}:${count}`;
  }).join(" · ");

  const ov1ConceptSummary = clean(state.ov1?.concept?.mission, 120)
    ? `总体图构想：${clean(state.ov1.concept.mission, 120)}。`
    : "";
  const areaSummary = taskAreas.length ? `任务空域与区域（${taskAreas.length} 处）；` : "";

  return {
    // Keep plan title short — long research objectives must not become map canvas text.
    title: clean(ai?.title, 24) || shortMapTitle(brief),
    summary: clean(ai?.summary, 600)
      || (forces.length
        ? `${ov1ConceptSummary}由已确认概念兵力（${forces.length}）按 ${phases.length} 个作战阶段部署（${phaseCoverage}）；${areaSummary}中心 ${theater.label}。`
        : "缺少已确认概念兵力；请先完成兵力与任务中的概念兵力草案。"),
    theater,
    phases,
    forces: forces.length ? forces : undefined,
    areas,
    relations: (conceptRelations.length ? conceptRelations : (ov1Relations.length ? ov1Relations : synthesized)),
    questions: normalizeStringList(ai?.questions, 8, 240).length
      ? normalizeStringList(ai.questions, 8, 240)
      : [
        forces.length
          ? "在绘制工具中按阶段切换，核对各阶段概念兵力是否齐全、落位是否合理。"
          : "缺少概念兵力，请返回兵力与任务补全。",
        "跨阶段兵力会在多个阶段各出现一次军标，便于阶段筛选；确认后仍只把 研究参考语义下传。"
      ]
  };
}

export function createInitialConceptMapDraft({ brief = {}, plan = null, previousPlacements = [] } = {}) {
  const generatedAt = new Date().toISOString();
  const normalizedPlan = normalizeInitialPlan(plan, brief);
  const theater = normalizedPlan.theater || resolveTheaterCenter(brief);
  const phaseNameById = new Map(normalizedPlan.phases.map((phase) => [phase.phaseId, phase.name]));
  const itemPositions = new Map();
  // Expand multi-phase concept forces into one symbol per phase so the drawing tool
  // stage switcher shows the correct force set for each upstream phase.
  const forceItems = [];
  // Cap below map document item limit (300); multi-phase expansion needs headroom.
  let symbolBudget = 260;
  // Prefer previously saved drawing positions (after independent-tool edits).
  const placementByForcePhase = new Map();
  const placementByForce = new Map();
  (Array.isArray(previousPlacements) ? previousPlacements : []).forEach((entry) => {
    if (!entry || !Number.isFinite(Number(entry.lon)) || !Number.isFinite(Number(entry.lat))) return;
    const forceId = clean(entry.conceptForceId, 80);
    const phaseId = clean(entry.phaseId, 48);
    const point = { lon: clampLon(Number(entry.lon)), lat: clampLat(Number(entry.lat)) };
    if (forceId && phaseId) placementByForcePhase.set(`${forceId}::${phaseId}`, point);
    if (forceId && !placementByForce.has(forceId)) placementByForce.set(forceId, point);
  });

  normalizedPlan.forces.forEach((force, index) => {
    const slotPosition = earthPoint(theater, force.slot, index);
    const forceDefault = placementByForce.get(force.id) || slotPosition;
    itemPositions.set(force.id, forceDefault);
    const platform = force.platform || pickEquipmentPlatform(force.platforms);
    const phaseIds = force.phaseIds?.length ? force.phaseIds : [normalizedPlan.phases[0]?.phaseId || "deployment"];
    for (const phaseId of phaseIds) {
      if (symbolBudget <= 0) break;
      symbolBudget -= 1;
      const phaseLabel = phaseNameById.get(phaseId) || phaseId;
      const multi = phaseIds.length > 1;
      // Map tool renders item.name as the on-canvas label — keep it short.
      const mapName = shortForceMapLabel(force, { phaseLabel, multi });
      const position = placementByForcePhase.get(`${force.id}::${phaseId}`) || forceDefault;
      forceItems.push({
        id: multi ? `initial-force-${force.id}--${phaseId}` : `initial-force-${force.id}`,
        type: "symbol",
        name: mapName,
        layer: `概念兵力/${sideLabel(force.side)}`,
        symbol: "unit",
        color: cmoColor(force.side),
        lon: position.lon,
        lat: position.lat,
        height: 0,
        visible: true,
        locked: false,
        symbolProvider: "cmo",
        sourceName: cmoSourceName(force.role, force.side),
        assignment: assignment(
          phaseId,
          // Property panel only: short task, not full research prose.
          clean(force.task || mapName, 40),
          clean(force.group, 20) || "概念编组",
          "",
          "",
          {
            lon: position.lon,
            lat: position.lat,
            spatialMode: SPATIAL_MODE_EARTH,
            theater: theater.label,
            equipment: platform?.name || "",
            equipmentBasis: platformBasis(platform),
            cmoId: Number(platform?.cmoId) || 0,
            domain: platform?.domain || "",
            conceptForceId: force.id,
            conceptForceName: clean(force.name, 80),
            phaseIds: phaseIds.join(",")
          }
        )
      });
    }
  });
  const areaItems = normalizedPlan.areas.map((area, index) => {
    const hasCoord = Number.isFinite(Number(area.lon)) && Number.isFinite(Number(area.lat));
    const position = hasCoord
      ? { lon: Number(area.lon), lat: Number(area.lat) }
      : earthPoint(theater, area.slot, index + 2);
    const radiusMeters = (Number(area.radiusNm) > 0 ? Math.round(Number(area.radiusNm) * 1852) : 180000);
    const color = area.side === "hostile" ? "#f87171" : area.side === "friendly" ? "#38bdf8" : "#fbbf24";
    const shape = area.geometryType === "polygon" ? "polygon" : area.geometryType === "corridor" ? "corridor" : "circle";
    const points = Array.isArray(area.points) && area.points.length >= 2
      ? area.points.map((p) => ({ lon: Number(p.lon), lat: Number(p.lat), height: 0 }))
      : undefined;
    return {
      id: `initial-area-${area.id}`,
      type: "area",
      name: clean(area.name, 12) || `区域${index + 1}`,
      layer: "概念区域",
      color,
      lon: position.lon,
      lat: position.lat,
      height: 0,
      shape,
      ...(points ? { points } : {}),
      radius: radiusMeters,
      minorRadius: radiusMeters,
      width: radiusMeters * 2,
      height: radiusMeters * 2,
      fill: true,
      style: "solid",
      visible: true,
      locked: false,
      assignment: assignment(area.phaseId, clean(area.note, 40), "概念区域", "", area.id, {
        lon: position.lon,
        lat: position.lat,
        spatialMode: SPATIAL_MODE_EARTH,
        theater: theater.label
      })
    };
  });
  const relationItems = normalizedPlan.relations.map((relation, index) => {
    const from = itemPositions.get(relation.fromForceId);
    const to = itemPositions.get(relation.toForceId);
    const relationLabel = relation.type === "information" ? "信息" : relation.type === "effect" ? "效果" : "协同";
    return from && to
      ? {
        id: `initial-relation-${index + 1}`,
        type: "line",
        name: relationLabel,
        layer: "高层关系",
        color: relation.type === "effect" ? "#fbbf24" : "#67e8f9",
        style: "solid",
        width: 2,
        arrow: true,
        arrowSize: 1,
        points: [from, to],
        visible: true,
        locked: false,
        assignment: assignment(relation.phaseId, relationLabel, "高层关系", "", "")
      }
      : null;
  }).filter(Boolean);
  // No long title/objective prose on the canvas — drawing tool already has a phase panel.
  const annotationItems = [];
  const reference = createConceptMapReferenceFromPlan(normalizedPlan, brief, generatedAt);
  return normalizeConceptMap({
    title: normalizedPlan.title,
    document: {
      version: 4,
      items: [...annotationItems, ...areaItems, ...relationItems, ...forceItems],
      view: {
        camera: {
          lon: theater.lon,
          lat: theater.lat,
          height: Math.max(900000, Number(theater.cameraHeight) || 1800000),
          headingDeg: 0,
          pitchDeg: -65
        }
      },
      operation: {
        activePhaseId: normalizedPlan.phases[0]?.phaseId || "recon",
        phases: normalizedPlan.phases.map((phase, index) => ({
          id: phase.phaseId,
          name: clean(phase.name, 30) || `阶段${index + 1}`,
          color: phaseColor(phase.phaseId, index),
          timeLabel: clean(phase.timeLabel || phase.objective, 60),
          visible: true
        }))
      },
      source: {
        type: "workbench-initial-concept-map",
        spatialMode: SPATIAL_MODE_EARTH,
        theater: { label: theater.label, lon: theater.lon, lat: theater.lat },
        cmoCatalogVersion: "controlled-cmo-role-map-v1"
      }
    },
    draft: {
      status: "generated",
      generatedAt,
      sourceBrief: compactBriefSource(brief),
      spatialMode: SPATIAL_MODE_EARTH,
      theater: { label: theater.label, lon: theater.lon, lat: theater.lat },
      plan: planSummary(normalizedPlan)
    },
    reference,
    context: conceptMapReferenceOverview(reference)
  });
}

export function createConceptMapReferenceFromBrief(brief = {}, { generatedAt = new Date().toISOString(), source = "brief" } = {}) { return createConceptMapReferenceFromPlan(normalizeInitialPlan(null, brief), brief, generatedAt, source); }

function createConceptMapReferenceFromPlan(plan, brief, generatedAt, source = "brief-initial-plan") {
  const theater = plan.theater || resolveTheaterCenter(brief);
  const phaseLabel = (phaseId) => {
    const phase = plan.phases.find((item) => item.phaseId === phaseId);
    return phase ? phase.name : phaseName(phaseId);
  };
  return normalizeConceptMapReference({
    status: "draft",
    source,
    generatedAt,
    entities: plan.forces.map((force) => ({
      id: force.id,
      role: referenceRole(force.role),
      label: force.name,
      note: clean(`${force.task || ""}${force.phaseIds?.length ? ` · 阶段：${force.phaseIds.map(phaseLabel).join("、")}` : ""}`, 900)
    })),
    relations: plan.relations.map((relation, index) => ({
      id: `relation-${index + 1}`,
      from: forceName(plan, relation.fromForceId),
      type: relation.type,
      to: forceName(plan, relation.toForceId),
      note: phaseLabel(relation.phaseId)
    })),
    activities: plan.phases.map((phase) => ({
      id: `activity-${phase.phaseId}`,
      title: phase.name,
      purpose: phase.objective
    })),
    constraints: splitLines(brief.assumptions).concat([
      `初图落点使用 WGS84 地球坐标，研究中心：${theater.label}（${theater.lon.toFixed(2)}°E, ${theater.lat.toFixed(2)}°N）。`,
      `作战阶段沿用上游阶段与行动（${plan.phases.map((phase) => phase.name).join("→") || "默认四阶段"}），概念兵力按阶段挂接。`,
      "固定装备须有 CMO 目录依据（cmoId/国别/类别）；无依据的关键词装备不得当作定型平台。",
      "坐标与军标仍需人工在绘制工具中复核修订。"
    ]),
    questions: [...splitLines(brief.risk), ...plan.questions]
  });
}

export function updateConceptMapReference(map, form = {}, { confirmed = false } = {}) {
  const current = normalizeConceptMap(map); const previous = current.reference;
  const reference = normalizeConceptMapReference({ ...previous, status: confirmed ? "confirmed" : "draft", confirmedAt: confirmed ? new Date().toISOString() : "", entities: parseEntities(form.entities, previous.entities), relations: parseRelations(form.relations, previous.relations), activities: parseActivities(form.activities, previous.activities), constraints: splitLines(form.constraints), questions: splitLines(form.questions) });
  return normalizeConceptMap({ ...current, reference, context: conceptMapReferenceOverview(reference) });
}

export function prepareImportedConceptMap({ map, document, title = "", brief = {} }) {
  const current = normalizeConceptMap(map); const generatedAt = new Date().toISOString();
  const reference = current.reference.entities.length ? normalizeConceptMapReference({ ...current.reference, status: "draft", source: "manual-map-import", confirmedAt: "" }) : createConceptMapReferenceFromBrief(brief, { generatedAt, source: "manual-map-import" });
  return normalizeConceptMap({ ...current, title: clean(title, 180) || current.title, document, draft: { ...current.draft, status: "imported", importedAt: generatedAt }, reference, context: conceptMapReferenceOverview(reference) });
}

export function createInitialConceptMapArtifact(map, projectTitle = "concept-map") { const normalized = normalizeConceptMap(map); if (!normalized.document.items.length || normalized.draft.status !== "generated") return null; const safeTitle = clean(projectTitle, 80).replace(/[\\/:*?"<>|]+/g, "-") || "concept-map"; return { filename: `${safeTitle}-initial-concept-map.json`, mime: "application/json;charset=utf-8", label: "初始作战概念图 JSON", content: `${JSON.stringify(normalized.document, null, 2)}\n` }; }
export function isCurrentConceptMap(map, storage = {}) { return Boolean(map?.document?.items?.length && map?.reference?.status === "confirmed" && !storage?.stale); }
export function conceptMapReferenceOverview(reference = {}) { const normalized = normalizeConceptMapReference(reference); const entities = normalized.entities.slice(0, 6).map((item) => item.label).filter(Boolean); const activities = normalized.activities.slice(0, 4).map((item) => item.title).filter(Boolean); return [entities.length ? `关键实体：${entities.join("、")}` : "", activities.length ? `活动候选：${activities.join("、")}` : "", normalized.constraints.length ? `约束：${normalized.constraints.slice(0, 2).join("；")}` : "", normalized.questions.length ? `待确认：${normalized.questions.slice(0, 2).join("；")}` : ""].filter(Boolean).join("；").slice(0, 6000); }
export function conceptMapContextForDownstream(map, storage = {}) { if (!isCurrentConceptMap(map, storage)) return "未确认概念图研究参考；不要假定地理态势、图层或标绘对象。"; const ref = normalizeConceptMapReference(map.reference); return [`已确认概念图研究参考（${Number(map.summary?.itemCount || 0)} 个地图对象）。`, ref.entities.length && `关键实体：${ref.entities.map((item) => `${item.label}${item.note ? `（${item.note}）` : ""}`).join("；")}`, ref.relations.length && `高层关系：${ref.relations.map((item) => `${item.from} -${item.type}-> ${item.to}`).join("；")}`, ref.activities.length && `活动候选：${ref.activities.map((item) => `${item.title}${item.purpose ? `（${item.purpose}）` : ""}`).join("；")}`, ref.constraints.length && `研究约束：${ref.constraints.join("；")}`, ref.questions.length && `待确认项：${ref.questions.join("；")}`, "仅作为研究级实体/关系骨架，不推断未写明的坐标、军标文件、性能或行动细节。"].filter(Boolean).join("\n"); }

export function normalizeConceptMapReference(value) { const input = value && typeof value === "object" && !Array.isArray(value) ? value : {}; const status = REFERENCE_STATUSES.has(clean(input.status, 24)) ? clean(input.status, 24) : "empty"; return { version: 1, status, source: clean(input.source, 80), generatedAt: clean(input.generatedAt, 80), confirmedAt: status === "confirmed" ? clean(input.confirmedAt, 80) : "", entities: normalizeEntities(input.entities), relations: normalizeRelations(input.relations), activities: normalizeActivities(input.activities), constraints: normalizeStringList(input.constraints, 18, 900), questions: normalizeStringList(input.questions, 18, 900) }; }

function normalizeInitialPlan(value, brief) {
  const input = value && typeof value === "object" ? value : {};
  const fallback = fallbackPlan(brief);
  const theater = input.theater && Number.isFinite(Number(input.theater.lon)) && Number.isFinite(Number(input.theater.lat))
    ? {
      label: clean(input.theater.label, 80) || "研究区域",
      lon: clampLon(Number(input.theater.lon)),
      lat: clampLat(Number(input.theater.lat)),
      cameraHeight: Math.max(400000, Number(input.theater.cameraHeight) || 1800000)
    }
    : resolveTheaterCenter(brief);
  // Prefer upstream phase-action phases (custom ids). Fall back to classic four stages.
  const inputPhases = Array.isArray(input.phases) ? input.phases : [];
  const phases = (inputPhases.length
    ? inputPhases.slice(0, 12).map((phase, index) => normalizePlanPhase(phase, index))
    : fallback.phases.map((phase, index) => normalizePlanPhase(phase, index))
  ).filter(Boolean);
  const validPhases = phases.length ? phases : fallback.phases.map((phase, index) => normalizePlanPhase(phase, index));
  const phaseIdSet = new Set(validPhases.map((phase) => phase.phaseId));
  const defaultPhaseId = validPhases[0]?.phaseId || "deployment";
  const forces = (Array.isArray(input.forces) ? input.forces : fallback.forces).slice(0, 36)
    .map((item, index) => normalizeForce(item, index, phaseIdSet, defaultPhaseId))
    .filter(Boolean);
  const validForces = forces.length ? forces : fallback.forces.map((item, index) => normalizeForce(item, index, phaseIdSet, defaultPhaseId)).filter(Boolean);
  const forceIds = new Set(validForces.map((force) => force.id));
  const areas = (Array.isArray(input.areas) ? input.areas : fallback.areas).slice(0, 16)
    .map((item, index) => normalizeArea(item, index, phaseIdSet, defaultPhaseId))
    .filter(Boolean);
  const relations = (Array.isArray(input.relations) ? input.relations : fallback.relations).slice(0, 24)
    .map((item, index) => normalizeRelation(item, index, forceIds, phaseIdSet, defaultPhaseId))
    .filter(Boolean);
  return {
    title: clean(input.title, 80) || fallback.title,
    summary: clean(input.summary, 600) || fallback.summary,
    theater,
    phases: validPhases,
    forces: validForces,
    areas: areas.length ? areas : fallback.areas.map((item, index) => normalizeArea(item, index, phaseIdSet, defaultPhaseId)).filter(Boolean),
    relations: relations.length ? relations : fallback.relations.map((item, index) => normalizeRelation(item, index, forceIds, phaseIdSet, defaultPhaseId)).filter(Boolean),
    questions: normalizeStringList(input.questions, 8, 240)
  };
}

/** Build drawing-tool stages from confirmed phase-action (max 12). */
function buildMapPhasesFromPlanning(phaseActionPhases = [], aiPlan = null) {
  const ordered = Array.isArray(phaseActionPhases) ? phaseActionPhases.filter((phase) => clean(phase?.id, 48) || clean(phase?.name, 80)) : [];
  if (!ordered.length) {
    return PHASES.map((phase) => ({
      phaseId: phase.id,
      sourceId: phase.id,
      name: phase.name,
      objective: `${phase.name}阶段的研究级概念安排`,
      timeLabel: ""
    }));
  }
  const aiPhases = Array.isArray(aiPlan?.phases) ? aiPlan.phases : [];
  return ordered.slice(0, 12).map((phase, index) => {
    const sourceId = clean(phase.id, 48);
    const phaseId = sanitizePhaseId(sourceId, index);
    const aiHit = aiPhases.find((item) => sanitizePhaseId(clean(item?.phaseId, 48), index) === phaseId
      || clean(item?.phaseId, 48) === sourceId);
    return {
      phaseId,
      sourceId: sourceId || phaseId,
      name: clean(phase.name, 30) || `阶段${index + 1}`,
      objective: clean(aiHit?.objective, 240) || clean(phase.objective, 240) || "阶段作战目标",
      timeLabel: clean(phase.timeWindow || phase.timeRange || phase.window, 60)
    };
  });
}

function sanitizePhaseId(raw, index = 0) {
  const cleaned = clean(raw, 48).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || `phase-${index + 1}`;
}

/** Map any upstream phase id/name token onto drawing-tool phaseId. */
function buildPhaseIdAliasMap(mapPhases = [], phaseActionPhases = []) {
  const alias = new Map();
  mapPhases.forEach((phase, index) => {
    const upstream = phaseActionPhases[index] || {};
    const keys = [
      phase.phaseId,
      phase.sourceId,
      clean(upstream.id, 48),
      sanitizePhaseId(clean(upstream.id, 48), index),
      clean(upstream.name, 48),
      `phase-${index + 1}`,
      String(index + 1)
    ];
    keys.filter(Boolean).forEach((key) => alias.set(key, phase.phaseId));
  });
  return alias;
}

/**
 * Resolve which drawing-tool stages a concept force belongs to.
 * Prefer force.phaseIds; also honor phase.forceIds from phase-action.
 */
function resolveForcePhaseIds(force, phaseActionPhases = [], mapPhases = [], defaultPhaseId = "deployment") {
  const alias = buildPhaseIdAliasMap(mapPhases, phaseActionPhases);
  const orderedIds = mapPhases.map((phase) => phase.phaseId).filter(Boolean);
  const mapToken = (raw) => alias.get(clean(raw, 48)) || alias.get(sanitizePhaseId(clean(raw, 48))) || "";

  const fromForce = (Array.isArray(force?.phaseIds) ? force.phaseIds : []).map(mapToken).filter(Boolean);
  const fromPhaseLists = (Array.isArray(phaseActionPhases) ? phaseActionPhases : [])
    .filter((phase) => Array.isArray(phase?.forceIds) && phase.forceIds.includes(force?.id))
    .map((phase, index) => mapPhases[index]?.phaseId || mapToken(phase.id))
    .filter(Boolean);
  const isCross = /跨阶段|全程|持续/.test(`${force?.name || ""}${force?.group || ""}${force?.notes || ""}`);
  const merged = [...new Set([...fromForce, ...fromPhaseLists])];
  if (isCross && orderedIds.length) return orderedIds.slice(0, 12);
  if (merged.length) return orderedIds.length ? orderedIds.filter((id) => merged.includes(id)) : merged.slice(0, 12);
  // Unassigned continuous units: place on all stages so late phases are not empty.
  if (orderedIds.length > 1 && (force?.role === "command" || force?.role === "support" || force?.role === "sense")) {
    return orderedIds.slice(0, 12);
  }
  return orderedIds[0] ? [orderedIds[0]] : (defaultPhaseId ? [defaultPhaseId] : ["deployment"]);
}

/**
 * Guarantee every drawing-tool stage has ≥1 concept force.
 * Empty late stages are filled by phase.forceIds, cross-phase units, then role anchors.
 */
function ensureEveryPhaseHasForces(forces = [], mapPhases = [], phaseActionPhases = []) {
  if (!mapPhases.length || !forces.length) return forces;
  const next = forces.map((force) => ({
    ...force,
    phaseIds: [...(Array.isArray(force.phaseIds) ? force.phaseIds : [])]
  }));
  const byId = new Map(next.map((force) => [force.id, force]));
  const alias = buildPhaseIdAliasMap(mapPhases, phaseActionPhases);

  // 1) Honor explicit phase.forceIds from phase-action.
  (Array.isArray(phaseActionPhases) ? phaseActionPhases : []).forEach((phase, index) => {
    const phaseId = mapPhases[index]?.phaseId || alias.get(clean(phase?.id, 48));
    if (!phaseId) return;
    (Array.isArray(phase.forceIds) ? phase.forceIds : []).forEach((forceId) => {
      const force = byId.get(forceId);
      if (force && !force.phaseIds.includes(phaseId)) force.phaseIds.push(phaseId);
    });
  });

  // 2) For still-empty stages, extend a few anchor forces from earlier stages.
  const anchors = next.filter((force) => ["command", "sense", "support", "maneuver", "airDefense"].includes(force.role));
  mapPhases.forEach((phase, index) => {
    const hasForce = next.some((force) => force.phaseIds.includes(phase.phaseId));
    if (hasForce) return;
    const pool = (anchors.length ? anchors : next).slice(0, 4);
    // Prefer forces already on the previous stage for continuity.
    const prevId = mapPhases[index - 1]?.phaseId;
    const prevPool = prevId ? next.filter((force) => force.phaseIds.includes(prevId)).slice(0, 4) : [];
    const chosen = (prevPool.length ? prevPool : pool).slice(0, 3);
    chosen.forEach((force) => {
      if (!force.phaseIds.includes(phase.phaseId)) force.phaseIds.push(phase.phaseId);
    });
  });

  return next;
}

function sharedRelationPhaseId(fromForce, toForce, defaultPhaseId) {
  const left = Array.isArray(fromForce?.phaseIds) ? fromForce.phaseIds : [];
  const right = Array.isArray(toForce?.phaseIds) ? toForce.phaseIds : [];
  const shared = left.find((id) => right.includes(id));
  return shared || left[0] || right[0] || defaultPhaseId;
}

function normalizePlanPhase(item, index) {
  const phaseId = clean(item?.phaseId || item?.id, 48).replace(/[^a-zA-Z0-9_-]+/g, "-") || `phase-${index + 1}`;
  const name = clean(item?.name, 30) || PHASES[index]?.name || `阶段${index + 1}`;
  return {
    phaseId,
    name,
    objective: clean(item?.objective, 240) || `${name}阶段目标`,
    timeLabel: clean(item?.timeLabel || item?.timeWindow, 60)
  };
}
function fallbackPlan(brief = {}) { const objective = clean(brief.objective || brief.researchIntent, 80) || "作战概念研究"; return { title: `${objective}初始作战概念图`.slice(0, 80), summary: "基于概念简报形成的抽象研究级初图，需人工复核。", phases: PHASES.map((phase) => ({ phaseId: phase.id, name: phase.name, objective: `${phase.name}阶段的研究级概念安排` })), forces: [{ id: "sense", name: "概念感知单元", side: "friendly", role: "sense", group: "态势形成", task: "形成研究级态势输入", phaseIds: ["recon"], slot: "northwest" }, { id: "command", name: "概念指挥协同单元", side: "friendly", role: "command", group: "指挥协同", task: "组织概念级协同", phaseIds: ["deployment", "assault"], slot: "center" }, { id: "maneuver", name: "概念行动单元", side: "friendly", role: "maneuver", group: "概念行动", task: "支撑行动方案比较", phaseIds: ["assault"], slot: "east" }, { id: "support", name: "概念保障单元", side: "friendly", role: "support", group: "持续保障", task: "支撑过程连续性复核", phaseIds: ["support"], slot: "south" }, { id: "external", name: "外部态势对象", side: "unknown", role: "external", group: "外部环境", task: "表达外部约束与不确定性", phaseIds: ["recon"], slot: "west" }], areas: [{ id: "assessment-area", name: "概念评估区域", phaseId: "recon", slot: "north", note: "用于表达研究级态势关注范围" }, { id: "action-area", name: "概念行动区域", phaseId: "assault", slot: "east", note: "用于表达行动关系的人工修订位置" }], relations: [{ fromForceId: "sense", toForceId: "command", type: "information", phaseId: "recon" }, { fromForceId: "command", toForceId: "maneuver", type: "coordination", phaseId: "assault" }, { fromForceId: "support", toForceId: "maneuver", type: "coordination", phaseId: "support" }], questions: ["人工复核概念兵力、阶段关系和抽象布局。"] }; }
function normalizeForce(item, index, phaseIdSet = new Set(PHASES.map((phase) => phase.id)), defaultPhaseId = "deployment") {
  const id = clean(item?.id, 60).replace(/[^a-zA-Z0-9_-]+/g, "-") || `force-${index + 1}`;
  const side = ["friendly", "hostile", "neutral", "unknown"].includes(clean(item?.side, 20)) ? clean(item.side, 20) : "friendly";
  const role = Object.hasOwn(CMO_BY_ROLE, clean(item?.role, 30)) ? clean(item.role, 30) : "maneuver";
  const phaseIds = (Array.isArray(item?.phaseIds) ? item.phaseIds : [])
    .map((phaseId) => clean(phaseId, 48))
    .filter((phaseId) => phaseIdSet.has(phaseId))
    .slice(0, 12);
  if (!clean(item?.name, 120)) return null;
  const platform = item?.platform || pickEquipmentPlatform(item?.platforms);
  const fallbackPhase = phaseIdSet.has(defaultPhaseId) ? defaultPhaseId : ([...phaseIdSet][0] || "deployment");
  return {
    id,
    name: clean(item.name, 120),
    side,
    role,
    group: clean(item.group, 120) || "概念编组",
    task: clean(item.task, 240) || "研究级概念任务",
    phaseIds: phaseIds.length ? phaseIds : [fallbackPhase],
    slot: Object.hasOwn(SLOT_OFFSETS_DEG, clean(item.slot, 20)) ? clean(item.slot, 20) : "center",
    platform: platform || null,
    platforms: platform ? [platform] : []
  };
}
function normalizeArea(item, index, phaseIdSet = new Set(PHASES.map((phase) => phase.id)), defaultPhaseId = "deployment") {
  const rawPhase = clean(item?.phaseId, 48);
  const fallbackPhase = phaseIdSet.has(defaultPhaseId) ? defaultPhaseId : ([...phaseIdSet][0] || "deployment");
  const phaseId = phaseIdSet.has(rawPhase) ? rawPhase : fallbackPhase;
  const lat = Number.isFinite(Number(item?.lat)) ? Number(item.lat) : undefined;
  const lon = Number.isFinite(Number(item?.lon)) ? Number(item.lon) : undefined;
  const points = Array.isArray(item?.points) && item.points.length
    ? item.points.map((p) => ({ lat: Number(p.lat), lon: Number(p.lon) }))
    : undefined;
  return clean(item?.name, 120)
    ? {
      id: clean(item?.id, 60).replace(/[^a-zA-Z0-9_-]+/g, "-") || `area-${index + 1}`,
      name: clean(item.name, 120),
      phaseId,
      slot: Object.hasOwn(SLOT_OFFSETS_DEG, clean(item.slot, 20)) ? clean(item.slot, 20) : "center",
      lat,
      lon,
      points,
      geometryType: clean(item?.geometryType, 30) || "circle",
      radiusNm: Number(item?.radiusNm) || 60,
      type: clean(item?.type, 30) || "patrol",
      side: clean(item?.side, 20) || "friendly",
      note: clean(item.note, 240) || "研究级概念区域"
    }
    : null;
}
function normalizeRelation(item, index, forceIds, phaseIdSet = new Set(PHASES.map((phase) => phase.id)), defaultPhaseId = "deployment") {
  const rawPhase = clean(item?.phaseId, 48);
  const fallbackPhase = phaseIdSet.has(defaultPhaseId) ? defaultPhaseId : ([...phaseIdSet][0] || "deployment");
  const phaseId = phaseIdSet.has(rawPhase) ? rawPhase : fallbackPhase;
  const type = ["information", "coordination", "effect"].includes(clean(item?.type, 20)) ? clean(item.type, 20) : "coordination";
  return forceIds.has(item?.fromForceId) && forceIds.has(item?.toForceId) && item.fromForceId !== item.toForceId
    ? { id: `relation-${index + 1}`, fromForceId: item.fromForceId, toForceId: item.toForceId, type, phaseId }
    : null;
}
function normalizeDocument(value) { const source = value && typeof value === "object" && !Array.isArray(value) ? clone(value) : {}; const version = Number.isInteger(Number(source.version)) ? Number(source.version) : 4; const items = (Array.isArray(source.items) ? source.items : []).filter((item) => item && typeof item === "object" && clean(item.id, 160) && MAP_ITEM_TYPES.has(clean(item.type, 32))).slice(0, 300); return { ...source, version: Math.max(2, Math.min(4, version)), items }; }
function createEmptyDraft() {
  return {
    status: "empty",
    generatedAt: "",
    importedAt: "",
    sourceBrief: {},
    spatialMode: "",
    theater: null,
    plan: {},
    placements: []
  };
}
function createEmptyReference() {
  return {
    version: 1,
    status: "empty",
    source: "",
    generatedAt: "",
    confirmedAt: "",
    entities: [],
    relations: [],
    activities: [],
    constraints: [],
    questions: []
  };
}
function normalizeDraft(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = ["empty", "generated", "imported"].includes(clean(input.status, 24)) ? clean(input.status, 24) : "empty";
  const theaterRaw = input.theater && typeof input.theater === "object" ? input.theater : null;
  const theater = theaterRaw
    && Number.isFinite(Number(theaterRaw.lon))
    && Number.isFinite(Number(theaterRaw.lat))
    ? {
      label: clean(theaterRaw.label, 80) || "研究区域",
      lon: clampLon(Number(theaterRaw.lon)),
      lat: clampLat(Number(theaterRaw.lat))
    }
    : null;
  return {
    status,
    generatedAt: clean(input.generatedAt, 80),
    importedAt: clean(input.importedAt, 80),
    sourceBrief: compactBriefSource(input.sourceBrief),
    spatialMode: clean(input.spatialMode, 80),
    theater,
    plan: normalizePlanSummary(input.plan),
    placements: normalizePlacements(input.placements)
  };
}

function normalizePlacements(value) {
  return (Array.isArray(value) ? value : [])
    .slice(0, 120)
    .map((item) => ({
      itemId: clean(item?.itemId, 160),
      conceptForceId: clean(item?.conceptForceId, 80),
      name: clean(item?.name, 80),
      lon: clampLon(Number(item?.lon)),
      lat: clampLat(Number(item?.lat)),
      phaseId: clean(item?.phaseId, 48)
    }))
    .filter((item) => item.itemId && Number.isFinite(item.lon) && Number.isFinite(item.lat));
}
function normalizePlanSummary(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    summary: clean(input.summary, 600),
    phases: (Array.isArray(input.phases) ? input.phases : []).slice(0, 12).map((phase) => ({
      phaseId: clean(phase?.phaseId, 48),
      name: clean(phase?.name, 80),
      objective: clean(phase?.objective, 240)
    })),
    forceCount: Math.max(0, Math.min(36, Number(input.forceCount) || 0)),
    areaCount: Math.max(0, Math.min(8, Number(input.areaCount) || 0)),
    relationCount: Math.max(0, Math.min(24, Number(input.relationCount) || 0))
  };
}
function planSummary(plan) { return { summary: plan.summary, phases: plan.phases, forceCount: plan.forces.length, areaCount: plan.areas.length, relationCount: plan.relations.length }; }
function normalizeEntities(value) { const seen = new Set(); return (Array.isArray(value) ? value : []).slice(0, 18).map((item, index) => ({ id: clean(item?.id, 80) || `entity-${index + 1}`, role: REFERENCE_ROLES.has(clean(item?.role, 40)) ? clean(item.role, 40) : "external", label: clean(item?.label, 160), note: clean(item?.note, 900) })).filter((item) => item.label && !seen.has(item.id) && (seen.add(item.id), true)); }
function normalizeRelations(value) { return (Array.isArray(value) ? value : []).slice(0, 24).map((item, index) => ({ id: clean(item?.id, 80) || `relation-${index + 1}`, from: clean(item?.from, 160), type: clean(item?.type, 120), to: clean(item?.to, 160), note: clean(item?.note, 900) })).filter((item) => item.from && item.type && item.to); }
function normalizeActivities(value) { return (Array.isArray(value) ? value : []).slice(0, 16).map((item, index) => ({ id: clean(item?.id, 80) || `activity-${index + 1}`, title: clean(item?.title, 160), purpose: clean(item?.purpose, 900) })).filter((item) => item.title); }
function parseEntities(value, fallback) { return typeof value !== "string" ? fallback : splitLines(value).map((line, index) => { const [role, label, note] = line.split("|").map((part) => clean(part, 900)); return { id: `entity-${index + 1}`, role, label, note }; }); }
function parseRelations(value, fallback) { return typeof value !== "string" ? fallback : splitLines(value).map((line, index) => { const [from, type, to, note] = line.split("|").map((part) => clean(part, 900)); return { id: `relation-${index + 1}`, from, type, to, note }; }); }
function parseActivities(value, fallback) { return typeof value !== "string" ? fallback : splitLines(value).map((line, index) => { const [title, purpose] = line.split("|").map((part) => clean(part, 900)); return { id: `activity-${index + 1}`, title, purpose }; }); }
/**
 * Resolve a WGS84 theater center from the research brief.
 * Never use abstract (0,0) — map tools expect real Earth coordinates.
 */
export function resolveTheaterCenter(brief = {}) {
  const text = [
    brief.objective,
    brief.researchIntent,
    brief.approach,
    brief.assumptions,
    brief.expectedEffects,
    brief.risk
  ].filter(Boolean).join(" ");

  const theaters = [
    { re: /吕宋|Luzon|菲律宾|Philippine|巴拉望|Palawan|苏比克|Subic/i, label: "吕宋岛/菲律宾海区域", lon: 121.05, lat: 15.55, cameraHeight: 1600000 },
    { re: /台海|台湾海峡|Taiwan Strait|台湾以东|巴士海峡|Bashi/i, label: "台湾海峡周边", lon: 120.2, lat: 23.6, cameraHeight: 1400000 },
    { re: /南海|南中国海|South China Sea|西沙|南沙|Spratly|Paracel/i, label: "南海研究区域", lon: 114.2, lat: 12.1, cameraHeight: 2200000 },
    { re: /东海|East China Sea|钓鱼岛|尖阁|冲绳|Okinawa/i, label: "东海研究区域", lon: 125.0, lat: 27.8, cameraHeight: 1600000 },
    { re: /朝鲜半岛|黄海|Korea|West Sea/i, label: "黄海/朝鲜半岛周边", lon: 124.5, lat: 36.5, cameraHeight: 1400000 },
    { re: /波斯湾|霍尔木兹|Gulf|Hormuz|Arabian/i, label: "海湾研究区域", lon: 54.0, lat: 26.0, cameraHeight: 1400000 },
    { re: /波罗的|黑海|Baltic|Black Sea/i, label: "欧洲近海研究区域", lon: 28.0, lat: 43.5, cameraHeight: 1600000 }
  ];
  for (const theater of theaters) {
    if (theater.re.test(text)) {
      return {
        label: theater.label,
        lon: clampLon(theater.lon),
        lat: clampLat(theater.lat),
        cameraHeight: theater.cameraHeight
      };
    }
  }
  // Research default for US IAMD / WestPac-style briefs without explicit place names.
  if (/防空反导|IAMD|导弹防御|预警|反导|AMD/i.test(text)) {
    return { label: "西太平洋研究区域（默认）", lon: 121.0, lat: 16.0, cameraHeight: 1800000 };
  }
  return { label: "西太平洋研究区域（默认）", lon: 121.0, lat: 16.0, cameraHeight: 1800000 };
}

/** Map abstract slot → Earth lon/lat around theater center (degrees, WGS84). */
function earthPoint(theater, slot, index = 0) {
  const centerLon = clampLon(Number(theater?.lon) || 121);
  const centerLat = clampLat(Number(theater?.lat) || 16);
  const base = SLOT_OFFSETS_DEG[slot] || SLOT_OFFSETS_DEG.center;
  const jitter = ((index % 3) - 1) * 0.05;
  return {
    lon: clampLon(round(centerLon + base[0] + jitter)),
    lat: clampLat(round(centerLat + base[1] - jitter * 0.6)),
    height: 0
  };
}

function pickEquipmentPlatform(platforms = []) {
  const list = Array.isArray(platforms) ? platforms : [];
  // Prefer catalog-backed platforms (cmoId > 0); never invent fixed equipment without basis.
  const catalog = list.find((item) => item?.name && Number(item.cmoId) > 0);
  if (catalog) {
    return {
      name: clean(catalog.name, 160),
      domain: clean(catalog.domain, 20) || "aircraft",
      cmoId: Math.trunc(Number(catalog.cmoId)) || 0,
      country: clean(catalog.country, 80),
      category: clean(catalog.category, 80),
      basis: clean(catalog.basis, 240) || platformBasis(catalog)
    };
  }
  const named = list.find((item) => item?.name);
  if (!named) return null;
  return {
    name: clean(named.name, 160),
    domain: clean(named.domain, 20) || "",
    cmoId: 0,
    country: clean(named.country, 80),
    category: clean(named.category, 80),
    basis: clean(named.basis, 240) || "无 CMO 目录编号，仅作概念关键词，不得当作定型装备"
  };
}

function platformBasis(platform) {
  if (!platform) return "";
  if (clean(platform.basis, 240)) return clean(platform.basis, 240);
  const cmoId = Number(platform.cmoId) || 0;
  if (cmoId > 0) {
    const parts = [
      "CMO DB3K 目录",
      platform.domain ? `域=${platform.domain}` : "",
      `ID=${cmoId}`,
      platform.country ? `国别=${platform.country}` : "",
      platform.category ? `类别=${platform.category}` : ""
    ].filter(Boolean);
    return parts.join(" · ");
  }
  return clean(platform.name, 80) ? "无 CMO 目录编号，仅作概念关键词" : "";
}

function clampLon(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-180, Math.min(180, n));
}

function clampLat(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-85, Math.min(85, n));
}

function cmoSourceName(role, side) { const stem = CMO_BY_ROLE[role] || "ACV"; const variant = side === "hostile" ? "hostile" : side === "neutral" ? "neutral" : side === "unknown" ? "unknown" : "friendly"; if (stem === "HQ" || stem === "ACV") return `${stem}_${variant}_rectangle_.png`; return `${stem}_${variant}.png`; }
function cmoColor(side) { return ({ friendly: "#FF3F34", hostile: "#35A7FF", neutral: "#5BD6A2", unknown: "#FFD166" })[side] || "#9AB4C7"; }
function assignment(phaseId, task, group, direction, areaId, extra = {}) {
  return {
    phaseId,
    task,
    group,
    direction,
    areaId,
    ...extra
  };
}
const PHASE_PALETTE = ["#35A7FF", "#5BD6A2", "#FF6B5E", "#FFD166", "#B68CFF", "#5BC0BE", "#F4A261", "#E76F51", "#2A9D8F", "#E9C46A", "#264653", "#9AB4C7"];
function phaseColor(id, index = 0) {
  const byId = ({ recon: "#35A7FF", deployment: "#5BD6A2", assault: "#FF6B5E", support: "#FFD166" })[id];
  if (byId) return byId;
  return PHASE_PALETTE[Math.abs(Number(index) || 0) % PHASE_PALETTE.length];
}
function phaseName(id) { return PHASES.find((phase) => phase.id === id)?.name || clean(id, 30) || "概念阶段"; }
function forceName(plan, id) { return plan.forces.find((force) => force.id === id)?.name || "概念实体"; }

/** Short title for plan metadata / optional UI — never paste full research objectives onto the globe. */
function shortMapTitle(brief = {}) {
  const raw = clean(brief.objective || brief.researchIntent, 40);
  if (!raw) return "作战概念图";
  const clipped = raw.length > 16 ? `${raw.slice(0, 16)}…` : raw;
  return clean(`${clipped}概念图`, 20) || "作战概念图";
}

/**
 * On-canvas symbol label for combat-map-web (entity.label.text = item.name).
 * Keep ≤ ~10 Chinese chars so labels do not pile up.
 */
function shortForceMapLabel(force = {}, { phaseLabel = "", multi = false } = {}) {
  const roleShort = ({
    sense: "感知",
    command: "指挥",
    maneuver: "行动",
    air: "空中",
    airDefense: "防空",
    surface: "水面",
    support: "保障",
    external: "外部"
  })[force.role] || "单元";
  let body = clean(force.name, 40)
    .replace(/^(蓝方|红方|对方|友方)[·•.\-—]*/g, "")
    .replace(/跨阶段/g, "")
    .trim();
  if (!body || body.length > 8) body = roleShort;
  else if (body.length > 8) body = body.slice(0, 8);
  const side = force.side === "hostile" ? "红" : force.side === "friendly" ? "蓝" : force.side === "neutral" ? "中" : "";
  let label = side ? `${side}·${body}` : body;
  if (multi && phaseLabel) {
    const shortPhase = clean(phaseLabel, 4);
    if (shortPhase) label = `${label}/${shortPhase}`;
  }
  return clean(label, 12) || roleShort;
}
function sideLabel(side) { return ({ friendly: "友方", hostile: "对方", neutral: "中立", unknown: "未知" })[side] || "概念"; }
function referenceRole(role) { return ({ sense: "equipment", command: "command", maneuver: "action", air: "equipment", airDefense: "equipment", surface: "equipment", support: "equipment", external: "external" })[role] || "external"; }
function compactBriefSource(brief = {}) { const input = brief && typeof brief === "object" ? brief : {}; return { objective: clean(input.objective, 240), approach: clean(input.approach, 400), assumptions: clean(input.assumptions, 400), expectedEffects: clean(input.expectedEffects, 400), risk: clean(input.risk, 400) }; }
function splitLines(value) { return String(value || "").split(/\r?\n/).map((item) => clean(item, 900)).filter(Boolean).slice(0, 24); }
function normalizeStringList(value, maximumItems, maximumLength) { return (Array.isArray(value) ? value : []).map((item) => clean(item, maximumLength)).filter(Boolean).slice(0, maximumItems); }
function round(value) { return Math.round(Number(value) * 1000000) / 1000000; }
function storageKey(projectId) { return `${STORAGE_PREFIX}:${String(projectId || "default")}`; }
function clean(value, maximum) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

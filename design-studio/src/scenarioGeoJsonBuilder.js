const CIRCLE_SEGMENTS = 16;

export function buildScenarioGeoJson(scenario) {
  const entities = Array.isArray(scenario?.entities) ? scenario.entities : [];
  const areas = Array.isArray(scenario?.areas) ? scenario.areas : [];
  return {
    type: "FeatureCollection",
    properties: {
      scenarioId: String(scenario?.id || ""),
      generatedAt: String(scenario?.generatedAt || ""),
      updatedAt: String(scenario?.updatedAt || scenario?.generatedAt || ""),
      coordinateReference: "abstract-percent-grid",
      coordinateUnit: "percent",
      deploymentPlan: scenario?.deploymentPlan ? {
        mode: String(scenario.deploymentPlan.mode || ""),
        state: String(scenario.deploymentPlan.state || ""),
        adjustedEntityCount: Array.isArray(scenario.deploymentPlan.adjustedEntityIds) ? scenario.deploymentPlan.adjustedEntityIds.length : 0
      } : null,
      deploymentReview: scenario?.deploymentReview ? {
        bridgeOrigin: String(scenario.deploymentReview.bridgeOrigin || ""),
        exchangeId: String(scenario.deploymentReview.exchangeId || ""),
        changeId: String(scenario.deploymentReview.changeId || ""),
        receivedAt: String(scenario.deploymentReview.receivedAt || "")
      } : null,
      timeline: (Array.isArray(scenario?.timeline) ? scenario.timeline : []).map((event) => ({
        id: String(event?.id || ""),
        time: String(event?.time || ""),
        title: String(event?.title || ""),
        sourceNodeId: String(event?.sourceNodeId || "")
      }))
    },
    features: [
      ...entities.map(entityFeature),
      ...areas.map(areaFeature)
    ]
  };
}

function entityFeature(entity) {
  return {
    type: "Feature",
    id: String(entity?.id || ""),
    properties: {
      featureType: "entity",
      label: String(entity?.label || ""),
      role: String(entity?.role || ""),
      className: String(entity?.className || ""),
      sourceActivityId: String(entity?.sourceActivityId || ""),
      sourceOodaIds: Array.isArray(entity?.sourceOodaIds) ? entity.sourceOodaIds.map(String) : [],
      sourceKnowledgeRefs: Array.isArray(entity?.sourceKnowledgeRefs) ? entity.sourceKnowledgeRefs.map(String).slice(0, 16) : []
    },
    geometry: { type: "Point", coordinates: positionOf(entity?.position) }
  };
}

function areaFeature(area) {
  const center = positionOf(area?.position);
  const radius = Math.min(18, Math.max(2, Number(area?.size || 0) / 16));
  return {
    type: "Feature",
    id: String(area?.id || ""),
    properties: {
      featureType: "area",
      label: String(area?.label || ""),
      areaType: String(area?.type || ""),
      displaySize: Number(area?.size || 0),
      abstractRadiusPercent: radius
    },
    geometry: { type: "Polygon", coordinates: [ring(center, radius)] }
  };
}

function ring([x, y], radius) {
  const points = Array.from({ length: CIRCLE_SEGMENTS }, (_, index) => {
    const angle = (Math.PI * 2 * index) / CIRCLE_SEGMENTS;
    return [clamp(x + Math.cos(angle) * radius), clamp(y + Math.sin(angle) * radius)];
  });
  return [...points, points[0]];
}

function positionOf(value) {
  return [clamp(value?.[0]), clamp(value?.[1])];
}

function clamp(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

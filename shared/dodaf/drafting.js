/**
 * Industrial drafting component library for DoDAF 2.02 / DM2 operational views.
 * Maps entity/edge types → color, icon glyph, stroke style, CSS token.
 */

import { OV1_KIND_TO_DM2 } from "./constants.js";
import { clean } from "./util.js";

/** DM2 entity visual tokens (type → color / icon / shape). */
export const DM2_ENTITY_STYLES = Object.freeze({
  Activity: { key: "activity", label: "活动 Activity", color: "#2f6f9f", fill: "#eaf3fa", icon: "◇", shape: "rounded" },
  Performer: { key: "performer", label: "执行者 Performer", color: "#3d6b5c", fill: "#eef6f2", icon: "▣", shape: "rect" },
  Organization: { key: "organization", label: "组织 Organization", color: "#287a73", fill: "#edf8f6", icon: "⌂", shape: "rect" },
  PersonType: { key: "person-type", label: "人员类型 PersonType", color: "#4a6d8c", fill: "#eef3f8", icon: "☺", shape: "rect" },
  System: { key: "system", label: "系统/装备 System", color: "#3b779f", fill: "#edf5fb", icon: "⬡", shape: "rect" },
  ResourceFlow: { key: "resource-flow", label: "资源流 ResourceFlow", color: "#6b5b95", fill: "#f3f0f9", icon: "⇄", shape: "chip" },
  Information: { key: "information", label: "信息 Information", color: "#187a57", fill: "#eef8f3", icon: "ℹ", shape: "chip" },
  Materiel: { key: "materiel", label: "物资 Materiel", color: "#8a6d3b", fill: "#f8f3ea", icon: "▦", shape: "chip" },
  Rule: { key: "rule", label: "规则 Rule", color: "#8b5a2b", fill: "#faf3ea", icon: "§", shape: "note" },
  State: { key: "state", label: "状态 State", color: "#2a72a8", fill: "#eef6fc", icon: "○", shape: "pill" },
  Event: { key: "event", label: "事件 Event", color: "#a65b2a", fill: "#faf0e8", icon: "▸", shape: "flag" },
  Location: { key: "location", label: "位置 Location", color: "#6f8668", fill: "#f1f6ee", icon: "⌖", shape: "dashed" },
  Measure: { key: "measure", label: "度量/效果 Measure", color: "#b98222", fill: "#fff7dc", icon: "★", shape: "badge" },
  Condition: { key: "condition", label: "条件 Condition", color: "#7a6aa6", fill: "#f0effa", icon: "?", shape: "note" },
  Capability: { key: "capability", label: "能力 Capability", color: "#3c7ca9", fill: "#edf5fb", icon: "◎", shape: "rounded" }
});

/** OV-1 kind aliases → same visual system. */
export const OV1_KIND_STYLES = Object.freeze({
  equipment: { ...DM2_ENTITY_STYLES.System, label: "装备/平台", ov1Kind: "equipment" },
  command: { ...DM2_ENTITY_STYLES.Organization, label: "指挥节点", ov1Kind: "command" },
  action: { ...DM2_ENTITY_STYLES.Activity, label: "关键动作", ov1Kind: "action" },
  external: { ...DM2_ENTITY_STYLES.Performer, color: "#7a6aa6", fill: "#f0effa", label: "外部对象", ov1Kind: "external" },
  environment: { ...DM2_ENTITY_STYLES.Location, label: "环境要素", ov1Kind: "environment" },
  effect: { ...DM2_ENTITY_STYLES.Measure, label: "预期效果", ov1Kind: "effect" },
  participant: { ...DM2_ENTITY_STYLES.Performer, label: "作战主体", ov1Kind: "participant" }
});

/** Edge / flow visual tokens (workbench + DM2 relation). */
export const EDGE_STYLES = Object.freeze({
  "信息流": { key: "information", label: "信息流", color: "#187a57", dash: "", width: 1.8, marker: "info" },
  "控制流": { key: "control", label: "控制流", color: "#2d604a", dash: "", width: 2.1, marker: "control" },
  "态势变化": { key: "situation", label: "态势变化", color: "#2a72a8", dash: "4 3", width: 1.7, marker: "sit" },
  "反馈": { key: "feedback", label: "反馈", color: "#ad7a19", dash: "2 3", width: 1.7, marker: "fb" },
  information: { key: "information", label: "信息流", color: "#187a57", dash: "", width: 1.8, marker: "info" },
  control: { key: "control", label: "控制流", color: "#2d604a", dash: "", width: 2.1, marker: "control" },
  resource: { key: "resource", label: "资源流", color: "#6b5b95", dash: "5 3", width: 1.8, marker: "res" },
  needline: { key: "needline", label: "Needline", color: "#5c4d8a", dash: "", width: 1.9, marker: "need" },
  resourceFlow: { key: "resource-flow", label: "ResourceFlow", color: "#6b5b95", dash: "5 3", width: 1.8, marker: "res" },
  relationship: { key: "relationship", label: "关系", color: "#294f63", dash: "", width: 1.8, marker: "rel" },
  responsibleFor: { key: "responsible", label: "责任关系", color: "#287a73", dash: "3 2", width: 1.7, marker: "resp" },
  activityPartOfActivity: { key: "part-of", label: "活动分解", color: "#2f6f9f", dash: "2 2", width: 1.5, marker: "part" },
  stateTransition: { key: "transition", label: "状态转换", color: "#2a72a8", dash: "", width: 1.8, marker: "trans" },
  coordination: { key: "coordination", label: "协同", color: "#3c7ca9", dash: "4 2", width: 1.6, marker: "coord" },
  default: { key: "default", label: "关系", color: "#294f63", dash: "", width: 1.8, marker: "rel" }
});

/** Per-product legend sets (which tokens to show). */
export const PRODUCT_LEGEND = Object.freeze({
  "OV-1": {
    entities: ["equipment", "command", "action", "external", "environment", "effect"],
    edges: ["信息流", "控制流", "态势变化", "反馈"]
  },
  "OV-2": {
    entities: ["Performer", "System", "Organization", "ResourceFlow"],
    edges: ["needline", "信息流", "控制流", "resource"]
  },
  "OV-3": {
    entities: ["Activity", "ResourceFlow", "Information"],
    edges: ["information", "control", "resource"]
  },
  "OV-4": {
    entities: ["Organization", "Performer", "PersonType"],
    edges: ["responsibleFor", "coordination"]
  },
  "OV-5a": {
    entities: ["Activity"],
    edges: ["activityPartOfActivity"]
  },
  "OV-5b": {
    entities: ["Activity"],
    edges: ["信息流", "控制流", "resourceFlow"]
  },
  "OV-6a": {
    entities: ["Rule", "Condition", "Activity"],
    edges: []
  },
  "OV-6b": {
    entities: ["State"],
    edges: ["stateTransition"]
  },
  "OV-6c": {
    entities: ["Event", "Activity", "State"],
    edges: ["beforeAfter"]
  }
});

export function resolveEntityStyle({ dm2Type, kind, type } = {}) {
  const ov1Kind = clean(kind, 40);
  if (ov1Kind && OV1_KIND_STYLES[ov1Kind]) return OV1_KIND_STYLES[ov1Kind];
  const dm2 = clean(dm2Type, 40);
  if (dm2 && DM2_ENTITY_STYLES[dm2]) return DM2_ENTITY_STYLES[dm2];
  if (ov1Kind && OV1_KIND_TO_DM2[ov1Kind] && DM2_ENTITY_STYLES[OV1_KIND_TO_DM2[ov1Kind]]) {
    return { ...DM2_ENTITY_STYLES[OV1_KIND_TO_DM2[ov1Kind]], ov1Kind };
  }
  // OV-5 activity type labels are free text — map common Chinese types.
  const activityType = clean(type, 40);
  if (activityType) {
    if (/感知|观察|监视|sense|observe/i.test(activityType)) return { ...DM2_ENTITY_STYLES.Activity, color: "#2a72a8", fill: "#eef6fc", label: activityType };
    if (/决策|判断|decide/i.test(activityType)) return { ...DM2_ENTITY_STYLES.Organization, label: activityType };
    if (/行动|控制|act|control/i.test(activityType)) return { ...DM2_ENTITY_STYLES.Activity, color: "#3c7ca9", fill: "#edf5fb", label: activityType };
    if (/评估|assess/i.test(activityType)) return { ...DM2_ENTITY_STYLES.Measure, label: activityType };
  }
  return DM2_ENTITY_STYLES.Performer;
}

export function resolveEdgeStyle(typeOrDm2) {
  const key = clean(typeOrDm2, 80);
  if (EDGE_STYLES[key]) return EDGE_STYLES[key];
  const lower = key.toLowerCase();
  if (lower.includes("control") || key.includes("控制")) return EDGE_STYLES["控制流"];
  if (lower.includes("resource") || key.includes("资源")) return EDGE_STYLES.resource;
  if (lower.includes("feedback") || key.includes("反馈")) return EDGE_STYLES["反馈"];
  if (lower.includes("need")) return EDGE_STYLES.needline;
  if (lower.includes("info") || key.includes("信息")) return EDGE_STYLES["信息流"];
  return EDGE_STYLES.default;
}

export function entityCssClass(style) {
  const token = style?.ov1Kind || style?.key || "performer";
  return `dodaf-entity dodaf-entity--${token}`;
}

export function edgeCssClass(style) {
  return `dodaf-edge dodaf-edge--${style?.key || "default"}`;
}

export function entityInlineStyle(style) {
  if (!style) return "";
  return `border-left-color:${style.color};background:${style.fill};--dodaf-entity-color:${style.color};--dodaf-entity-fill:${style.fill}`;
}

export function edgeInlineStyle(style) {
  if (!style) return "";
  return `stroke:${style.color};stroke-width:${style.width || 1.8};${style.dash ? `stroke-dasharray:${style.dash};` : ""}--dodaf-edge-color:${style.color}`;
}

export function getProductLegendSpec(product) {
  const spec = PRODUCT_LEGEND[product] || { entities: [], edges: [] };
  const entities = (spec.entities || []).map((key) => {
    if (OV1_KIND_STYLES[key]) return { id: key, ...OV1_KIND_STYLES[key] };
    if (DM2_ENTITY_STYLES[key]) return { id: key, ...DM2_ENTITY_STYLES[key] };
    return null;
  }).filter(Boolean);
  const edges = (spec.edges || []).map((key) => {
    const style = resolveEdgeStyle(key);
    return { id: key, ...style };
  });
  return { product, entities, edges };
}

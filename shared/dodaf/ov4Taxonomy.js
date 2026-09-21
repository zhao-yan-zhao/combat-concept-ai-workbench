export const OV4_ORGANIZATION_CATEGORIES = [
  "战区指挥机关", "军种/战区军种", "战区作战部队", "联合作战任务部队",
  "专业作战力量", "信息支援力量", "后勤保障力量", "外部/对手组织", "其他"
];

export const OV4_ECHELON_CATEGORIES = ["战区级", "战役方向级", "任务编组级", "基础作战单元", "未明确"];

export const OV4_RELATION_CATEGORIES = [
  "上下级隶属", "作战指挥", "作战控制", "行政控制", "配属",
  "协同", "支援保障", "信息报送", "其他"
];

export function inferOv4OrganizationCategory({ label = "", role = "", layer = "" } = {}) {
  const text = `${label} ${role}`.toLowerCase();
  if (/敌|红方|对手|外部|hostile|external/.test(text)) return "外部/对手组织";
  if (/战区|联合.*指挥|指挥所|command/.test(text)) return "战区指挥机关";
  if (/军种|陆军|海军|空军|火箭军/.test(text)) return "军种/战区军种";
  if (/信息|情报|侦察|预警|通信|网电|sense|isr/.test(text)) return "信息支援力量";
  if (/保障|后勤|运输|卫勤|补给|维修|support|logistic/.test(text)) return "后勤保障力量";
  if (/电子|特战|防空|网络|太空|专业/.test(text)) return "专业作战力量";
  if (layer === "combat") return "战区作战部队";
  if (/任务|编组|群|队/.test(text)) return "联合作战任务部队";
  return "其他";
}

export function inferOv4EchelonCategory({ label = "", layer = "" } = {}) {
  const text = String(label).toLowerCase();
  if (/战区|联合.*指挥/.test(text)) return "战区级";
  if (/方向|战役|军团|集团军/.test(text)) return "战役方向级";
  if (/任务|编组|集群|群|支队|分队/.test(text)) return "任务编组级";
  if (layer === "combat" || /营|连|排|班|舰|机组|单元/.test(text)) return "基础作战单元";
  return "未明确";
}

export function inferOv4RelationCategory(value = "") {
  const text = String(value).toLowerCase();
  if (/隶属|上下级|subordin|parent/.test(text)) return "上下级隶属";
  if (/作战控制|opcon/.test(text)) return "作战控制";
  if (/行政控制|adcon/.test(text)) return "行政控制";
  if (/指挥|command/.test(text)) return "作战指挥";
  if (/配属|attach/.test(text)) return "配属";
  if (/保障|支援|support|logistic/.test(text)) return "支援保障";
  if (/信息|情报|态势|上报|通报|information|report/.test(text)) return "信息报送";
  if (/协同|协调|coordination|coordinat/.test(text)) return "协同";
  return "其他";
}

export function ov4RelationStyleKey(category = "") {
  return ({ "上下级隶属": "subordinate", "作战指挥": "command", "作战控制": "control", "行政控制": "admin", "配属": "attached", "协同": "coordination", "支援保障": "support", "信息报送": "information" })[category] || "other";
}

export function ov4RelationShortLabel(category = "", type = "") {
  return ({
    "上下级隶属": "隶属",
    "作战指挥": "指挥",
    "作战控制": "控制",
    "行政控制": "行政",
    "配属": "配属",
    "协同": "协同",
    "支援保障": "保障",
    "信息报送": "上报",
    "其他": "关系"
  })[category] || ({ command: "指挥", support: "保障", information: "上报", coordination: "协同" })[type] || "关系";
}

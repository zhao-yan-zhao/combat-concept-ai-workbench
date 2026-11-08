/**
 * 一致性问题定位与自动修复引擎 (M6-T6.4)
 *
 * 职责：
 * 1. 为验证检出的一致性规则问题 (Issues) 丰富目标视图与要素定位元数据
 * 2. 识别可自动修复的问题，生成规范的修复建议 (Repair Plan)
 * 3. 执行确定性模型修复并保持要素结构完整
 */

import { addEdge } from "./ov5Store.js";

/**
 * 视图与要素映射字典
 */
export const VIEW_TARGET_CONFIG = {
  ov5: { label: "OV-5 作战活动分解", viewId: "ov5" },
  ov1: { label: "OV-1 总体概念图", viewId: "ov1" },
  ooda: { label: "OODA 决策循环", viewId: "ooda" },
  scenario: { label: "想定态势与实体", viewId: "scenario" },
  validation: { label: "设计验证与对抗闭环", viewId: "validation" },
  "phase-action": { label: "阶段与行动链", viewId: "phase-action" },
  "force-mission": { label: "力量与任务编成", viewId: "force-mission" }
};

/**
 * 为 issues 丰富定位与自动修复元数据
 */
export function enrichIssuesWithLocatorAndRepair(issues, models = {}) {
  const ov5 = models.ov5Model || models.ov5 || {};
  const ooda = models.oodaModel || models.ooda || {};
  const scenario = models.scenario || {};
  const ov1 = models.ov1Model || models.ov1 || {};

  const activityMap = new Map((ov5.activities || []).map((a) => [a.id, a]));
  const entityMap = new Map((scenario.entities || []).map((e) => [e.id, e]));
  const oodaNodeMap = new Map((ooda.lanes || []).flatMap((l) => l.nodes || []).map((n) => [n.id, n]));
  const ov1NodeMap = new Map((ov1.nodes || []).map((n) => [n.id, n]));

  return issues.map((issue) => {
    let targetView = "ov5";
    let targetElementId = issue.sourceId || "";
    let targetElementName = "";
    let repairable = false;
    let repairPlan = null;

    // 1. 根据 issue 标题与关联 sourceId 精准推导目标视图
    // 优先匹配 OODA，避免 "OODA 输入输出待定义" 被错误归入 ov5
    if (issue.title.includes("OODA")) {
      targetView = "ooda";
      const oodaNode = oodaNodeMap.get(targetElementId);
      targetElementName = oodaNode?.title || oodaNode?.id || "OODA 决策节点";

      if (issue.title.includes("输入输出")) {
        repairable = true;
        repairPlan = {
          type: "fill-ooda-io",
          label: "补全决策输入输出",
          description: `为决策节点“${targetElementName}”填充规范的感知输入与判定输出。`,
          targetId: targetElementId
        };
      } else if (issue.title.includes("时序待补充") || issue.title.includes("未计算的耗时")) {
        repairable = true;
        repairPlan = {
          type: "fill-ooda-duration",
          label: "补充默认响应时延 (5分钟)",
          description: "为无耗时记录的 OODA 节点统一配置默认评估时延（5分钟），以便核算闭环时效。",
          targetId: targetElementId
        };
      }
    } else if (issue.title.includes("假设")) {
      targetView = "ov5";
      targetElementName = `关键假设 (${targetElementId})`;
      const firstAct = (ov5.activities || [])[0];
      if (issue.title.includes("未关联活动") && firstAct) {
        repairable = true;
        repairPlan = {
          type: "link-assumption-activity",
          label: `关联至活动 [${firstAct.title || firstAct.name}]`,
          description: `为关键假设绑定支撑活动“${firstAct.title || firstAct.name}”，建立机理依存关系。`,
          targetId: targetElementId,
          activityId: firstAct.id
        };
      } else if (issue.title.includes("缺少失效推论")) {
        repairable = true;
        repairPlan = {
          type: "fill-assumption-iffalse",
          label: "补充标准失效后果推论",
          description: "为该关键假设补充规范的失效推论：核心战术通联中断，协同延误严重增加，导致突防窗口丧失。",
          targetId: targetElementId
        };
      }
    } else if (issue.title.includes("反制")) {
      targetView = "validation";
      targetElementName = `对手反制 (${targetElementId})`;
      repairable = true;
      repairPlan = {
        type: "fill-countermeasure-response",
        label: "补充标准抗干扰与机动应对",
        description: "为该对手反制补充标准战术应对措施：启用跳频跳时多信道冗余，并在末段实施大过载佯动机动规避拦截。",
        targetId: targetElementId
      };
    } else if (issue.title.includes("活动") || issue.title.includes("输入输出")) {
      targetView = "ov5";
      const act = activityMap.get(targetElementId);
      targetElementName = act?.title || act?.id || "活动要素";

      if (issue.title.includes("输入输出")) {
        repairable = true;
        repairPlan = {
          type: "fill-activity-io",
          label: "补全标准规范输入输出",
          description: `为活动“${targetElementName}”填充符合作战机理的标准输入（态势感知数据流）与输出（战术协同控制流）。`,
          targetId: targetElementId
        };
      } else if (issue.title.includes("活动关联缺失")) {
        const firstAct = (ov5.activities || [])[0];
        if (firstAct && firstAct.id !== targetElementId) {
          repairable = true;
          repairPlan = {
            type: "link-activity-upstream",
            label: `连接至前序活动 [${firstAct.title}]`,
            description: `自动添加从前序活动“${firstAct.title}”到“${targetElementName}”的信息协同流，消除孤立活动。`,
            targetId: targetElementId,
            sourceActivityId: firstAct.id
          };
        }
      }
    } else if (issue.title.includes("想定") || issue.title.includes("实体")) {
      targetView = "scenario";
      const entity = entityMap.get(targetElementId);
      targetElementName = entity?.label || entity?.id || "想定作战实体";

      if (issue.title.includes("实体来源不完整") || issue.title.includes("未关联 OV-5")) {
        const firstAct = (ov5.activities || [])[0];
        if (firstAct) {
          repairable = true;
          repairPlan = {
            type: "link-entity-activity",
            label: `绑定至主责活动 [${firstAct.title}]`,
            description: `将未关联来源的作战实体绑定至“${firstAct.title}”，完成跨视图追溯链闭环。`,
            targetId: targetElementId,
            activityId: firstAct.id
          };
        }
      }
    } else if (issue.title.includes("追溯") || issue.title.includes("OV-1")) {
      targetView = "ov1";
      const ov1Node = ov1NodeMap.get(targetElementId);
      targetElementName = ov1Node?.label || ov1Node?.id || "OV-1 概念节点";
    }

    return {
      ...issue,
      targetView,
      targetViewLabel: VIEW_TARGET_CONFIG[targetView]?.label || targetView,
      targetElementId,
      targetElementName,
      repairable,
      repairPlan
    };
  });
}

/**
 * 执行具体的一致性修复操作，返回修改后的状态切片
 */
export function applyIssueRepair(state, issue) {
  if (!issue?.repairPlan) {
    throw new Error("该问题没有可执行的自动修复方案");
  }

  const { type, targetId, sourceActivityId, activityId } = issue.repairPlan;

  if (type === "fill-activity-io") {
    const activities = (state.ov5?.activities || []).map((act) => {
      if (act.id !== targetId) return act;
      return {
        ...act,
        input: !act.input || act.input === "待定义" ? "态势感知与情报数据流" : act.input,
        output: !act.output || act.output === "待定义" ? "战术协同与控制指令流" : act.output
      };
    });
    state.ov5 = { ...state.ov5, activities };
    return { modifiedDomain: "ov5", detail: `已为活动补全规范输入输出流。` };
  }

  if (type === "link-activity-upstream") {
    if (sourceActivityId && targetId) {
      if (!Array.isArray(state.ov5.edges)) {
        state.ov5.edges = [];
      }
      const edgeExists = state.ov5.edges.some((e) => e.sourceId === sourceActivityId && e.targetId === targetId);
      if (!edgeExists) {
        addEdge(state.ov5, sourceActivityId, targetId, "信息流", {
          payload: "战术目标指示",
          condition: "目标截获"
        });
      }
      return { modifiedDomain: "ov5", detail: `已建立活动间的前序协同关系。` };
    }
  }

  if (type === "fill-ooda-io") {
    const lanes = (state.ooda?.lanes || []).map((lane) => ({
      ...lane,
      nodes: (lane.nodes || []).map((node) => {
        if (node.id !== targetId) return node;
        return {
          ...node,
          input: !node.input || node.input === "待定义" ? "态势感知信息" : node.input,
          output: !node.output || node.output === "待定义" ? "行动处置决策" : node.output
        };
      })
    }));
    state.ooda = { ...state.ooda, lanes };
    return { modifiedDomain: "ooda", detail: `已为决策节点填充规范输入输出。` };
  }

  if (type === "fill-ooda-duration") {
    const lanes = (state.ooda?.lanes || []).map((lane) => ({
      ...lane,
      nodes: (lane.nodes || []).map((node) => {
        if (!node.duration || node.duration === "待估算") {
          return { ...node, duration: "5m" };
        }
        return node;
      })
    }));
    state.ooda = { ...state.ooda, lanes };
    return { modifiedDomain: "ooda", detail: `已为决策节点填充默认时延指标。` };
  }

  if (type === "link-entity-activity") {
    if (state.scenario?.entities?.length && activityId) {
      const entities = state.scenario.entities.map((ent) => {
        if (!ent.sourceActivityId && ent.role !== "opponent") {
          return { ...ent, sourceActivityId: activityId };
        }
        return ent;
      });
      state.scenario = { ...state.scenario, entities };
      return { modifiedDomain: "scenario", detail: `已将实体关联至主责活动。` };
    }
  }

  if (type === "link-assumption-activity") {
    if (state.ov5?.argumentChain?.assumptions && activityId) {
      const assumptions = state.ov5.argumentChain.assumptions.map((asm) => {
        if (asm.id === targetId) {
          const refs = Array.isArray(asm.activityRefs) ? [...asm.activityRefs] : [];
          if (!refs.includes(activityId)) refs.push(activityId);
          return { ...asm, activityRefs: refs };
        }
        return asm;
      });
      state.ov5.argumentChain = { ...state.ov5.argumentChain, assumptions };
      return { modifiedDomain: "ov5", detail: `已为关键假设关联支撑活动。` };
    }
  }

  if (type === "fill-assumption-iffalse") {
    if (state.ov5?.argumentChain?.assumptions) {
      const assumptions = state.ov5.argumentChain.assumptions.map((asm) => {
        if (asm.id === targetId) {
          return {
            ...asm,
            ifFalse: "核心战术通联中断，协同延误严重增加，导致突防打击窗口丧失。"
          };
        }
        return asm;
      });
      state.ov5.argumentChain = { ...state.ov5.argumentChain, assumptions };
      return { modifiedDomain: "ov5", detail: `已为关键假设补全失效推论说明。` };
    }
  }

  if (type === "fill-countermeasure-response") {
    if (state.validationResult?.redTeamReview?.findings) {
      const findings = state.validationResult.redTeamReview.findings.map((f) => {
        if (f.id === targetId) {
          return {
            ...f,
            responseMode: "counteract",
            ourResponse: "启用跳频跳时多信道冗余通联，并在突防阶段实施大过载佯动机动，化解对手反制拦截。"
          };
        }
        return f;
      });
      state.validationResult.redTeamReview = { ...state.validationResult.redTeamReview, findings };
      return { modifiedDomain: "validation", detail: "已为对手反制自动补全战术应对措施。" };
    }
  }

  throw new Error(`未知的修复类型: ${type}`);
}

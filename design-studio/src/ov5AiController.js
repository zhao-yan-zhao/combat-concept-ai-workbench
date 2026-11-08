import { generateWithAi, isAiOutput } from "../../shared/aiClient.js";
import { selectEvidenceForAi } from "./evidenceSelectionStore.js";
import { applyAiOv5Draft, createLocalOv5Draft } from "./ov5DraftStore.js";
import { addEdge, deriveActivitiesFromTasks, persistOv5Model } from "./ov5Store.js";
import { deriveOodaFromOv5, evaluateOodaLoopHealth } from "./oodaStore.js";
import { countUnmappedOv5Activities } from "./ov5Ov1Linker.js";
import { planningAnalysisForDownstream } from "./planningContext.js";
import { selectionFor } from "./ui.js";
import {
  normalizeArgumentChain,
  addAssumptionToChain,
  removeAssumptionFromChain,
  updateAssumptionInChain,
  saveArgumentChain
} from "./argumentChainStore.js";
import {
  PRESET_TACTICAL_CASES,
  normalizeTacticalCase,
  applyCaseToArgumentChain
} from "./tacticalCaseStore.js";

export function createOv5AiController({ getState, render, notify, invalidateDerivedArtifacts, syncOv5, syncOoda }) {
  return {
    generateOv5: (options) => generateOv5(getState(), options),
    deriveFromTasks: () => deriveFromTasks(getState()),
    summarizeUpstreamContext: () => summarizeUpstreamContextForOv5(getState()),
    handleAction(action, source) {
      if (action === "set-ov5-view") {
        const state = getState();
        state.ov5ViewMode = source?.dataset?.mode || "kill-web";
        render();
        return true;
      }
      if (action === "add-chain-assumption") {
        const state = getState();
        const chain = normalizeArgumentChain(state.ov5?.argumentChain, state.brief || {});
        addAssumptionToChain(chain);
        saveArgumentChain(state, chain);
        persistOv5Model(state.ov5);
        if (typeof syncOv5 === "function") syncOv5();
        notify?.("已新增关键假设条目");
        render();
        return true;
      }
      if (action === "remove-chain-assumption") {
        const state = getState();
        const asmId = source?.dataset?.assumptionId;
        if (asmId) {
          const chain = normalizeArgumentChain(state.ov5?.argumentChain, state.brief || {});
          removeAssumptionFromChain(chain, asmId);
          saveArgumentChain(state, chain);
          persistOv5Model(state.ov5);
          if (typeof syncOv5 === "function") syncOv5();
          notify?.("已删除关键假设");
          render();
        }
        return true;
      }
      if (action === "toggle-assumption-confidence") {
        const state = getState();
        const asmId = source?.dataset?.assumptionId;
        if (asmId) {
          const chain = normalizeArgumentChain(state.ov5?.argumentChain, state.brief || {});
          const item = chain.assumptions.find((a) => a.id === asmId);
          if (item) {
            const nextConf = item.confidence === "低" ? "中" : item.confidence === "中" ? "高" : "低";
            updateAssumptionInChain(chain, asmId, { confidence: nextConf });
            saveArgumentChain(state, chain);
            persistOv5Model(state.ov5);
            if (typeof syncOv5 === "function") syncOv5();
            notify?.(`已将假设置信度调整为: ${nextConf}`);
            render();
          }
        }
        return true;
      }
      if (action === "select-link-assumption-activity") {
        const state = getState();
        const asmId = source?.dataset?.assumptionId;
        const actId = source?.value;
        if (asmId && actId) {
          const chain = normalizeArgumentChain(state.ov5?.argumentChain, state.brief || {});
          const item = chain.assumptions.find((a) => a.id === asmId);
          if (item) {
            const refs = Array.isArray(item.activityRefs) ? [...item.activityRefs] : [];
            if (!refs.includes(actId)) refs.push(actId);
            updateAssumptionInChain(chain, asmId, { activityRefs: refs });
            saveArgumentChain(state, chain);
            persistOv5Model(state.ov5);
            if (typeof syncOv5 === "function") syncOv5();
            notify?.("已为假设关联支撑活动");
            render();
          }
        }
        return true;
      }
      if (action === "unlink-assumption-activity") {
        const state = getState();
        const asmId = source?.dataset?.assumptionId;
        const actId = source?.dataset?.activityId;
        if (asmId && actId) {
          const chain = normalizeArgumentChain(state.ov5?.argumentChain, state.brief || {});
          const item = chain.assumptions.find((a) => a.id === asmId);
          if (item) {
            const refs = (item.activityRefs || []).filter((id) => id !== actId);
            updateAssumptionInChain(chain, asmId, { activityRefs: refs });
            saveArgumentChain(state, chain);
            persistOv5Model(state.ov5);
            if (typeof syncOv5 === "function") syncOv5();
            notify?.("已解除活动关联");
            render();
          }
        }
        return true;
      }
      if (action === "save-argument-chain") {
        const state = getState();
        const form = typeof document !== "undefined" ? document.getElementById("argumentChainForm") : null;
        if (form) {
          const data = new FormData(form);
          const claim = data.get("claim");
          const reasoning = data.get("reasoning");
          const chain = normalizeArgumentChain(state.ov5?.argumentChain, state.brief || {});
          if (claim !== null) chain.claim = String(claim).trim();
          if (reasoning !== null) chain.reasoning = String(reasoning).trim();

          // 同步输入框内容
          if (typeof document !== "undefined") {
            const inputs = document.querySelectorAll(".assumption-input-text");
            inputs.forEach((input) => {
              const aid = input.dataset.assumptionId;
              const field = input.dataset.field;
              if (aid && field) {
                updateAssumptionInChain(chain, aid, { [field]: input.value });
              }
            });
          }

          saveArgumentChain(state, chain);
          persistOv5Model(state.ov5);
          if (typeof syncOv5 === "function") syncOv5();
          notify?.("已成功保存论证链与假设设定");
          render();
        }
        return true;
      }
      if (action === "search-tactical-cases") {
        const state = getState();
        const inputEl = typeof document !== "undefined" ? document.getElementById("tacticalCaseSearchInput") : null;
        state.tacticalCaseSearchQuery = inputEl?.value?.trim() || "";
        notify?.(state.tacticalCaseSearchQuery ? `已按「${state.tacticalCaseSearchQuery}」检索历史战例` : "已展示全部历史战例");
        render();
        return true;
      }
      if (action === "apply-case-to-argument-chain") {
        const state = getState();
        const caseId = source?.dataset?.caseId;
        const allCases = [...PRESET_TACTICAL_CASES, ...(state.tacticalCases || [])];
        const targetCase = allCases.find((c) => c.id === caseId);
        if (targetCase) {
          applyCaseToArgumentChain(state, targetCase);
          persistOv5Model(state.ov5);
          if (typeof syncOv5 === "function") syncOv5();
          notify?.(`已将战例【${targetCase.caseName}】引用至制胜论证链支撑证据！`);
          render();
        }
        return true;
      }
      if (action === "add-custom-tactical-case") {
        const state = getState();
        const nameEl = typeof document !== "undefined" ? document.getElementById("customCaseName") : null;
        const appEl = typeof document !== "undefined" ? document.getElementById("customCaseApplicable") : null;
        const unappEl = typeof document !== "undefined" ? document.getElementById("customCaseUnapplicable") : null;
        const simEl = typeof document !== "undefined" ? document.getElementById("customCaseSimilarity") : null;

        const caseName = nameEl?.value?.trim();
        if (!caseName) {
          notify?.("请输入战例名称");
          return true;
        }

        const newCase = normalizeTacticalCase({
          id: `custom-case-${Date.now().toString(36)}`,
          caseName,
          similarityPoint: simEl?.value?.trim() || "攻防对抗机理具备借鉴价值",
          applicableLessons: appEl?.value?.split(/[;\n]/).map((s) => s.trim()).filter(Boolean),
          unapplicableLessons: unappEl?.value?.split(/[;\n]/).map((s) => s.trim()).filter(Boolean)
        });

        if (!Array.isArray(state.tacticalCases)) state.tacticalCases = [];
        state.tacticalCases.push(newCase);
        notify?.(`已添加自定义战例：${caseName}`);
        render();
        return true;
      }
      if (action === "delete-tactical-case") {
        const state = getState();
        const caseId = source?.dataset?.caseId;
        if (caseId && Array.isArray(state.tacticalCases)) {
          state.tacticalCases = state.tacticalCases.filter((c) => c.id !== caseId);
          notify?.("已移除自定义战例卡");
          render();
        }
        return true;
      }
      if (action === "toggle-ov5-stress") {
        const state = getState();
        const nodeId = source?.dataset?.node;
        state.ov5StressedNodeId = state.ov5StressedNodeId === nodeId ? null : nodeId;
        render();
        return true;
      }
      if (action === "clear-ov5-stress") {
        const state = getState();
        state.ov5StressedNodeId = null;
        render();
        return true;
      }
      if (action === "auto-fill-fallbacks") {
        void autoFillFallbacks(getState());
        return true;
      }
      if (action === "redteam-mechanism-challenge") {
        void runRedTeamChallenge(getState());
        return true;
      }
      if (action === "generate-ov5") {
        const state = getState();
        if (state.ov5Generating) return true;
        if (state.ov5?.activities?.length && typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm("将根据当前概念简报、作战任务、兵力与资源流契约重建 OV-5，并同步派生 OODA。已有 OV-5 与 OODA 的人工编辑会被替换。是否继续？")) return true;
        void generateOv5(state, { force: true, silent: false });
        return true;
      }
      if (action === "derive-activities-from-tasks") {
        void deriveFromTasks(getState());
        return true;
      }
      if (action === "auto-fix-feedback-loop") {
        void autoFixFeedbackLoop(getState());
        return true;
      }
      if (action === "change-activity-autonomy") {
        const state = getState();
        const actId = source?.dataset?.activity;
        const level = source?.dataset?.level;
        const act = (state.ov5?.activities || []).find((a) => a.id === actId);
        if (act && level) {
          act.autonomy = level;
          persistOv5Model(state.ov5);
          state.ooda = deriveOodaFromOv5(state.ov5);
          invalidateDerivedArtifacts();
          void syncOv5?.(state.ov5, { source: "manual" });
          notify(`已将「${act.title}」自主决策等级更新为 ${level}`);
          render();
        }
        return true;
      }
      if (action === "preset-stress-domain") {
        const state = getState();
        const domain = source?.dataset?.domain;
        const target = (state.ov5?.activities || []).find((a) => a.domain === domain || String(a.title).includes(domain) || String(a.resources).includes(domain))
          || (state.ov5?.activities || [])[0];
        if (target) {
          state.ov5StressedNodeId = target.id;
          render();
          notify(`已注入「${domain}域」对抗压制战损场景（扰动节点：${target.title}）`);
        } else {
          notify(`当前活动网络中暂无作战活动`);
        }
        return true;
      }
      if (action === "preset-stress-type") {
        const state = getState();
        const type = source?.dataset?.type;
        const target = (state.ov5?.activities || []).find((a) => String(a.type).includes(type) || String(a.title).includes(type))
          || (state.ov5?.activities || [])[0];
        if (target) {
          state.ov5StressedNodeId = target.id;
          render();
          notify(`已注入「${type}核心节点」战损瘫痪场景（扰动节点：${target.title}）`);
        } else {
          notify(`未找到「${type}」类型的核心活动`);
        }
        return true;
      }
      if (action === "edit-activity") {
        const state = getState();
        const actId = source?.dataset?.activityId || source?.dataset?.activity;
        if (actId) {
          const act = (state.ov5?.activities || []).find((a) => a.id === actId);
          state.selection = selectionFor("activity", actId, { ov5: state.ov5, ov1: state.ov1 })
            || (act ? { id: act.id, kind: "activity", title: act.title } : { id: actId, kind: "activity" });
          state.ov5LeftMode = "editor";
          render();
          if (act?.title) {
            notify(`已载入「${act.title}」编辑表单`);
          }
        }
        return true;
      }
      if (action === "toggle-ov5-left-mode") {
        const state = getState();
        state.ov5LeftMode = state.ov5LeftMode === "tree" ? "editor" : "tree";
        render();
        return true;
      }
      if (action === "close-ov5-activity-editor") {
        const state = getState();
        state.selection = null;
        state.ov5LeftMode = "tree";
        render();
        return true;
      }
      return false;
    }
  };

  async function autoFillFallbacks(state) {
    const activities = state.ov5?.activities || [];
    if (!activities.length) return;
    let filled = 0;
    activities.forEach((act) => {
      if (!act.resilienceFallback) {
        filled += 1;
        const type = String(act.type || "");
        const domain = String(act.domain || "");
        if (type.includes("感知") || domain.includes("太空")) {
          act.resilienceFallback = "天基受干扰时，自动降级至战区高空无人侦察机自组网接力，维持连续态势追踪。";
        } else if (type.includes("决策") || type.includes("控制")) {
          act.resilienceFallback = "主指控所战损时，交战授权与协同规划自适应下沉至编队浮动预备长机承接。";
        } else if (type.includes("行动") || type.includes("突击")) {
          act.resilienceFallback = "直连制导数据链断开时，攻击单元启动自主交战规则(ROE)，由弹载传感器末端自主寻的。";
        } else {
          act.resilienceFallback = "通信阻断时，通过机间战术自组网进行多跳中继，确保协同闭环不中断。";
        }
      }
    });
    persistOv5Model(state.ov5);
    state.ooda = deriveOodaFromOv5(state.ov5);
    invalidateDerivedArtifacts();
    await syncOv5?.(state.ov5, { source: "manual" });
    notify(`已为 ${filled} 项作战活动自动补齐抗毁降级自愈机制，单点断链风险已消除`);
    render();
  }

  async function runRedTeamChallenge(state) {
    const activities = state.ov5?.activities || [];
    if (!activities.length) {
      notify("暂无作战活动，无法发起红方质询");
      return;
    }
    const stressedNode = activities.find((a) => a.id === state.ov5StressedNodeId);
    const health = evaluateOodaLoopHealth(state.ov5);
    const latency = health.latencyBudget?.formattedTotal || "待估算";

    let challenge = "";
    if (stressedNode) {
      challenge = `【针对战损节点「${stressedNode.title}」的对抗质询】：红方通过高功率宽带微波与电子压制使该节点失效。当前下游活动依赖已受阻，蓝方降级旁路（${stressedNode.resilienceFallback || "未配置"}）是否已经过抗电磁脉冲(EMP)加固？指挥授权转移至备用节点的时间窗口是否满足战场突变要求？`;
    } else {
      const spof = health.bottlenecks?.[0];
      const targetAct = spof || activities[Math.floor(activities.length / 2)];
      challenge = `【红方关键因果质询】：全链累积时延约为 ${latency}。红方将在「${targetAct.title}」处施加分布式杂波干扰与网络欺骗。若敌防御反应窗口小于当前时延预算，该概念如何保证先敌完成“感知-打击-反哺”全闭环？是否存在非卫星中继的强突防通信手段？`;
    }

    state.ov5RedTeamChallenge = challenge;
    notify("红方已完成机理对抗质询，见右侧透镜面板");
    render();
  }

  async function deriveFromTasks(state) {
    const tasks = state.forceMission?.tasks || state.forceMissionPlan?.tasks || [];
    if (!tasks.length) {
      notify("上游尚未确认作战任务，请先在「任务与兵力」阶段添加并确认任务");
      return;
    }
    const derived = deriveActivitiesFromTasks(tasks, { forceMission: state.forceMission, existingModel: state.ov5 });
    state.ov5 = derived;
    persistOv5Model(state.ov5);
    state.ooda = deriveOodaFromOv5(state.ov5);
    state.selection = null;
    invalidateDerivedArtifacts();
    await syncOv5?.(state.ov5, { source: "derived" });
    await syncOoda?.(state.ooda, { source: "derived" });
    notify(`已从上游 ${tasks.length} 项任务派生 ${derived.activities.length} 个作战活动与初始因果链路`);
    render();
  }

  async function autoFixFeedbackLoop(state) {
    const model = state.ov5;
    const activities = Array.isArray(model?.activities) ? model.activities : [];
    if (activities.length < 2) {
      notify("活动数量不足，无法构建反馈闭环");
      return;
    }

    const health = evaluateOodaLoopHealth(model);
    const hasFeedbackGap = health.diagnostics.some((d) => d.code === "NO_FEEDBACK_LOOP");
    if (!hasFeedbackGap) {
      notify("当前作战活动网络已具备有效的反馈闭环，无需修补");
      return;
    }

    const lastAct = [...activities].reverse().find((a) => {
      const t = String(a.type || "");
      const title = String(a.title || "");
      return t.includes("行动") || t.includes("控制") || t.includes("评估") || title.includes("打击") || title.includes("突击");
    }) || activities[activities.length - 1];

    const firstTarget = activities.find((a) => {
      const t = String(a.type || "");
      const title = String(a.title || "");
      return (t.includes("感知") || t.includes("识别") || t.includes("决策") || title.includes("侦察") || title.includes("探测")) && a.id !== lastAct.id;
    }) || activities.find((a) => a.id !== lastAct.id);

    if (!firstTarget) {
      notify("未找到合适的反馈目标活动");
      return;
    }

    addEdge(state.ov5, lastAct.id, firstTarget.id, "信息流", {
      payload: "战损评估与态势更新反馈",
      condition: "打击/行动后回传"
    });
    persistOv5Model(state.ov5);
    state.ooda = deriveOodaFromOv5(state.ov5);
    invalidateDerivedArtifacts();
    await syncOv5?.(state.ov5, { source: "manual" });
    await syncOoda?.(state.ooda, { source: "derived" });
    notify(`已自动建立从「${lastAct.title}」到「${firstTarget.title}」的闭环反馈连线`);
    render();
  }

  async function generateOv5(state, options = {}) {
    const { force = false, silent = false } = options;
    state.ov5Generating = true;
    render();
    const evidenceSelection = await selectEvidenceForAi({
      query: `${state.brief?.objective || ""} ${state.brief?.approach || ""} ${state.brief?.expectedEffects || ""}`,
      knowledge: state.knowledge,
      knowledgeStorage: state.knowledgeStorage,
      limit: 3
    });
    const evidence = evidenceSelection.items;
    const upstream = summarizeUpstreamContextForOv5(state);
    const planning = planningAnalysisForDownstream(state);

    try {
      const response = await generateWithAi({
        workflowId: "concept",
        workflow: { id: "concept", title: "作战活动模型生成", outputSchema: "ConceptPlan" },
        analysis: {
          "任务目标": state.brief?.objective || "当前概念目标",
          "核心思路": state.brief?.approach || "当前概念思路",
          "预期效果": planning["规划预期效果"] || state.brief?.expectedEffects || "待明确的研究级效果",
          "主要矛盾": state.brief?.risk || "信息不确定性和资源连续性",
          ...planning,
          "概念方向": state.direction,
          "作战阶段时序": upstream.phasesText,
          "已确认作战任务": upstream.tasksText,
          "参战兵力与平台": upstream.forcesText,
          "资源流交换契约(OV-2/OV-3)": upstream.exchangesText,
          "操作节点清单": upstream.nodesText,
          "建模要求": "以已确认作战任务、参战兵力、资源流矩阵与作战阶段为直接上游输入，生成感知、识别、决策、行动、控制和评估六类研究级活动及信息、控制、反馈因果衔接。确保活动形成杀伤网闭环（打击后有反馈回路连接至感知/决策）；保持抽象、可审阅和可追溯；不提供具体行动步骤、目标选择、武器用法或规避建议。"
        },
        evidence
      });
      if (!isAiOutput(response)) throw new Error("AI OV-5 响应不完整");
      state.ov5 = applyAiOv5Draft({
        brief: state.brief,
        direction: state.direction,
        draft: response.result,
        evidence,
        evidenceSelection: evidenceSelection.provenance,
        ov1: state.ov1,
        tasks: upstream.tasks,
        forces: upstream.forces
      });
      const unmapped = countUnmappedOv5Activities(state.ov5, state.ov1);
      if (!silent) {
        notify(unmapped ? `AI 已基于任务、兵力与资源流契约构建 OV-5（${unmapped} 个活动待核对 OV-1），并派生 OODA` : "AI 已基于任务、兵力与资源流契约构建 OV-5，并派生待复核 OODA");
      }
    } catch {
      state.ov5 = createLocalOv5Draft({
        brief: state.brief,
        direction: state.direction,
        evidence,
        evidenceSelection: evidenceSelection.provenance,
        ov1: state.ov1,
        tasks: upstream.tasks,
        forces: upstream.forces
      });
      if (!silent) notify("已基于上游任务、兵力与资源流契约生成本地 OV-5 并派生 OODA");
    } finally {
      persistOv5Model(state.ov5);
      state.ooda = deriveOodaFromOv5(state.ov5);
      state.selection = null;
      invalidateDerivedArtifacts();
      await syncOv5?.(state.ov5, { source: state.ov5.provenance?.mode === "ai" ? "ai" : "local-ai-fallback" });
      await syncOoda?.(state.ooda, { source: "derived" });
      state.ov5Generating = false;
      render();
    }
  }
}

export function summarizeUpstreamContextForOv5(state = {}) {
  // 1. 作战任务 Tasks
  const tasks = state.forceMission?.tasks || state.forceMissionPlan?.tasks || [];
  const tasksText = tasks.map((t, idx) => {
    const areaName = t.area?.name ? `空域: ${t.area.name}` : "";
    const effect = t.expectedEffect ? `效果: ${t.expectedEffect}` : "";
    const obj = t.objective ? `目的: ${t.objective}` : "";
    const extra = [areaName, effect, obj].filter(Boolean).join("，");
    return `${idx + 1}. ${t.name || t.id}（类型: ${t.missionType || "通用"}${extra ? `，${extra}` : ""}` + `）`;
  }).join("；\n") || "尚未定义具体作战任务";

  // 2. 参战兵力与平台 Forces
  const forces = [...(state.forceMission?.forces || state.forceMissionPlan?.forces || []), ...(state.forceMission?.combatForces || state.forceMissionPlan?.combatForces || [])];
  const forcesText = forces.slice(0, 16).map((f) => {
    const domain = f.domain || f.layer || "空/海/地";
    const platform = f.platformType || f.group || "";
    const role = f.role || "";
    const weapon = f.weapons ? `武器: ${f.weapons}` : "";
    const desc = [domain, role, platform, weapon].filter(Boolean).join("，");
    return `${f.name || f.id}（${desc || "主战单元"}）`;
  }).join("；\n") || "尚未定义参战兵力";

  // 3. 资源流矩阵与交换契约 OV-2 / OV-3
  const exchanges = state.ov3?.exchanges || state.ov2?.exchanges || [];
  const exchangesText = exchanges.slice(0, 16).map((e) => {
    const src = e.source || e.producer || "源主体";
    const tgt = e.target || e.consumer || "宿主体";
    const payload = e.payload || e.informationElement || e.resource || "态势/协同信息";
    const freq = e.frequency || e.duration || "";
    return `${src} -> ${tgt}（载荷: ${payload}${freq ? `，时延/频度: ${freq}` : ""}` + `）`;
  }).join("；\n") || "尚未定义资源流交换契约";

  // 4. 作战阶段 Phases
  const phases = state.phaseAction?.phases || [];
  const phasesText = phases.map((p, idx) => {
    const window = p.timing || p.duration || "";
    const act = p.coreAction || p.description || "";
    return `阶段${idx + 1}: ${p.name || p.id}${window ? ` [${window}]` : ""}${act ? ` - ${act}` : ""}`;
  }).join("；\n") || "尚未划分作战阶段";

  // 5. 操作节点 Nodes
  const nodes = (state.ov2?.nodes || []).map((n) => n.name || n.title || n.id).filter(Boolean).slice(0, 12);
  const nodesText = nodes.join("、") || "操作节点沿用参战兵力划分";

  return {
    tasks,
    forces,
    exchanges,
    phases,
    tasksText,
    forcesText,
    exchangesText,
    phasesText,
    nodesText
  };
}

import { escapeHtml } from "./app/domUtils.js";

/**
 * Renders the unified branch pipeline bar for:
 * 作战兵力 (主线) → 组织关系 (OV-4) → 资源流 (OV-2) → 资源流矩阵 (OV-3)
 */
export function renderForceResourceSubflowBar(state = {}, currentViewId = "force-mission") {
  const forceMission = state.forceMission || {};
  const conceptCount = (forceMission.forces || []).length;
  const combatCount = (forceMission.combatForces || []).length;
  const totalForces = conceptCount + combatCount;

  const ov4 = state.ov4 || {};
  const ov4RelationsCount = (ov4.relations || []).length;

  const ov2 = state.ov2 || {};
  const ov2ExchangesCount = (ov2.exchanges || []).length;

  const ov3 = state.ov3 || {};
  const ov3ExchangesCount = (ov3.exchanges || []).length;

  const isMainline = currentViewId === "force-mission";

  if (isMainline) {
    const nextUnfinishedView = !ov4RelationsCount
      ? "ov4"
      : !ov2ExchangesCount
        ? "ov2"
        : !ov3ExchangesCount
          ? "ov3"
          : "ov4";
    const nextBtnLabel = !ov4RelationsCount
      ? "进入组织关系 (OV-4) →"
      : !ov2ExchangesCount
        ? "进入资源流 (OV-2) →"
        : !ov3ExchangesCount
          ? "进入资源流矩阵 (OV-3) →"
          : "查看体系关系与流 →";

    return `
      <nav class="subflow-pipeline-bar is-mainline" aria-label="兵力关联体系流程">
        <div class="subflow-pipeline-lead">
          <span class="subflow-pipeline-tag">体系关联流程</span>
          <strong class="subflow-pipeline-title">组织关系与资源网络</strong>
        </div>
        <div class="subflow-pipeline-steps">
          <div class="subflow-pipeline-pill is-main-active" title="作战兵力（当前主线）">
            <span class="subflow-pill-index">主</span>
            <span class="subflow-pill-name">作战兵力</span>
            <span class="subflow-pill-meta">${totalForces} 兵力</span>
          </div>
          <span class="subflow-pipeline-arrow" aria-hidden="true">→</span>
          <button type="button" class="subflow-pipeline-pill ${ov4RelationsCount ? "is-ready" : "is-pending"}" data-related-model="true" data-view="ov4" title="组织关系图 (OV-4)">
            <span class="subflow-pill-index">1</span>
            <span class="subflow-pill-name">组织关系 OV-4</span>
            <span class="subflow-pill-meta">${ov4RelationsCount ? `${ov4RelationsCount} 条关系` : "待生成"}</span>
          </button>
          <span class="subflow-pipeline-arrow" aria-hidden="true">→</span>
          <button type="button" class="subflow-pipeline-pill ${ov2ExchangesCount ? "is-ready" : "is-pending"}" data-related-model="true" data-view="ov2" title="作战资源流 (OV-2)">
            <span class="subflow-pill-index">2</span>
            <span class="subflow-pill-name">资源流 OV-2</span>
            <span class="subflow-pill-meta">${ov2ExchangesCount ? `${ov2ExchangesCount} 条流` : "待生成"}</span>
          </button>
          <span class="subflow-pipeline-arrow" aria-hidden="true">→</span>
          <button type="button" class="subflow-pipeline-pill ${ov3ExchangesCount ? "is-ready" : "is-pending"}" data-related-model="true" data-view="ov3" title="资源流矩阵 (OV-3)">
            <span class="subflow-pill-index">3</span>
            <span class="subflow-pill-name">资源流矩阵 OV-3</span>
            <span class="subflow-pill-meta">${ov3ExchangesCount ? `${ov3ExchangesCount} 矩阵项` : "待投影"}</span>
          </button>
        </div>
        <div class="subflow-pipeline-actions">
          <button type="button" class="quiet-button subflow-pipeline-cta" data-related-model="true" data-view="${nextUnfinishedView}">
            ${escapeHtml(nextBtnLabel)}
          </button>
        </div>
      </nav>
    `;
  }

  // Inside subflow view: OV-4, OV-2, or OV-3
  let nextAction = "";
  let nextActionLabel = "";
  if (currentViewId === "ov4") {
    nextAction = "save-and-advance-ov2";
    nextActionLabel = "保存并进入资源流 (OV-2) →";
  } else if (currentViewId === "ov2") {
    nextAction = "save-and-advance-ov3";
    nextActionLabel = "保存并进入资源流矩阵 (OV-3) →";
  } else if (currentViewId === "ov3") {
    nextAction = "save-and-advance-ov3";
    nextActionLabel = "保存并完成兵力与资源流 →";
  }

  return `
    <nav class="subflow-pipeline-bar in-subflow" aria-label="兵力关联流程进度">
      <div class="subflow-pipeline-lead">
        <button type="button" class="subflow-back-btn quiet-button" data-action="return-force-mission" title="返回作战兵力主步骤">← 返回作战兵力</button>
      </div>
      <div class="subflow-pipeline-steps">
        ${currentViewId === "ov4"
          ? `<span class="subflow-pipeline-pill is-current" aria-current="step">
              <span class="subflow-pill-index">1</span>
              <span class="subflow-pill-name">组织关系 OV-4</span>
              <span class="subflow-pill-meta">${ov4RelationsCount ? `${ov4RelationsCount} 关系` : "编辑中"}</span>
            </span>`
          : `<button type="button" class="subflow-pipeline-pill ${ov4RelationsCount ? "is-ready" : "is-pending"}" data-related-model="true" data-view="ov4" title="组织关系 (OV-4)">
              <span class="subflow-pill-index">1</span>
              <span class="subflow-pill-name">组织关系 OV-4</span>
              <span class="subflow-pill-meta">${ov4RelationsCount ? `${ov4RelationsCount} 关系` : "待补充"}</span>
            </button>`}
        <span class="subflow-pipeline-arrow" aria-hidden="true">→</span>
        ${currentViewId === "ov2"
          ? `<span class="subflow-pipeline-pill is-current" aria-current="step">
              <span class="subflow-pill-index">2</span>
              <span class="subflow-pill-name">资源流 OV-2</span>
              <span class="subflow-pill-meta">${ov2ExchangesCount ? `${ov2ExchangesCount} 流` : "编辑中"}</span>
            </span>`
          : `<button type="button" class="subflow-pipeline-pill ${ov2ExchangesCount ? "is-ready" : "is-pending"}" data-related-model="true" data-view="ov2" title="资源流 (OV-2)">
              <span class="subflow-pill-index">2</span>
              <span class="subflow-pill-name">资源流 OV-2</span>
              <span class="subflow-pill-meta">${ov2ExchangesCount ? `${ov2ExchangesCount} 流` : "下一步"}</span>
            </button>`}
        <span class="subflow-pipeline-arrow" aria-hidden="true">→</span>
        ${currentViewId === "ov3"
          ? `<span class="subflow-pipeline-pill is-current" aria-current="step">
              <span class="subflow-pill-index">3</span>
              <span class="subflow-pill-name">资源流矩阵 OV-3</span>
              <span class="subflow-pill-meta">${ov3ExchangesCount ? `${ov3ExchangesCount} 矩阵项` : "投影中"}</span>
            </span>`
          : `<button type="button" class="subflow-pipeline-pill ${ov3ExchangesCount ? "is-ready" : "is-pending"}" data-related-model="true" data-view="ov3" title="资源流矩阵 (OV-3)">
              <span class="subflow-pill-index">3</span>
              <span class="subflow-pill-name">资源流矩阵 OV-3</span>
              <span class="subflow-pill-meta">${ov3ExchangesCount ? `${ov3ExchangesCount} 矩阵项` : "待投影"}</span>
            </button>`}
      </div>
      <div class="subflow-pipeline-actions">
        <button type="button" class="primary-btn subflow-next-btn" data-action="${nextAction}">${escapeHtml(nextActionLabel)}</button>
      </div>
    </nav>
  `;
}

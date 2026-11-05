import { buildExportArtifact, buildExportArtifactFromPayload, buildReportPayload } from "../../reportBuilder.js";
import { saveReportTemplate } from "../../reportTemplateStore.js";
import { deleteReportVersion, saveReportVersion } from "../../reportVersionStore.js";
import { requestReportDocx, requestReportPdf, requestReportPptx } from "../../reportDocumentClient.js";
import { createReportIntegrity, verifyReportIntegrity } from "../../reportIntegrity.js";
import { downloadBlob } from "../domUtils.js";

/**
 * Bind report export, template selection, and version archive events.
 */
export function bindReportEvents(ctx) {
  const { addEventListenerOnce, render, state } = ctx;

  document.querySelectorAll("[data-export]").forEach((button) => {
    addEventListenerOnce(button, "click", () => {
      const exportType = button.dataset.export;
      if (exportType === "docx") {
        void exportWordReport(ctx);
        return;
      }
      if (exportType === "pdf") {
        void exportPdfReport(ctx);
        return;
      }
      if (exportType === "pptx") {
        void exportPptxReport(ctx);
        return;
      }
      exportArtifact(exportType, ctx);
    }, "export:click");
  });

  document.querySelectorAll("[data-report-template]").forEach((control) => {
    addEventListenerOnce(control, "change", () => {
      state.reportTemplate = saveReportTemplate(control.value);
      render();
    }, "report-template:change");
  });

  document.querySelectorAll("[data-version-export]").forEach((button) => {
    addEventListenerOnce(button, "click", () => {
      exportReportVersion(button.dataset.versionExport, button.dataset.versionId, ctx);
    }, "version-export:click");
  });

  document.querySelectorAll("[data-version-verify]").forEach((button) => {
    addEventListenerOnce(button, "click", () => {
      void verifyArchivedReportVersion(button.dataset.versionVerify, ctx);
    }, "version-verify:click");
  });

  document.querySelectorAll("[data-version-delete]").forEach((button) => {
    addEventListenerOnce(button, "click", () => {
      deleteArchivedReportVersion(button.dataset.versionDelete, ctx);
    }, "version-delete:click");
  });

  const saveVersionBtn = document.getElementById("saveVersionBtn");
  if (saveVersionBtn) {
    addEventListenerOnce(saveVersionBtn, "click", () => {
      void saveCurrentReportVersion(ctx);
    }, "save-version:click");
  }
}

/**
 * Handle report-related actions from data-action or menu dispatch.
 */
export function handleReportAction(action, source, ctx) {
  if (action === "export-scenario-geojson") {
    exportArtifact("geojson", ctx);
    return true;
  }
  if (action === "save-report-version") {
    void saveCurrentReportVersion(ctx);
    return true;
  }
  return false;
}

export function exportArtifact(type, ctx) {
  const { downloadArtifact } = ctx;
  const artifact = buildExportArtifact(type, exportContext(ctx));
  downloadArtifact(artifact);
}

export async function exportWordReport(ctx) {
  return exportWordReportPayload(buildReportPayload(exportContext(ctx)), ctx);
}

export async function exportWordReportPayload(payload, ctx) {
  const { showToast, downloadArtifact } = ctx;
  showToast("正在生成 Word 报告…");
  try {
    const document = await requestReportDocx(payload);
    downloadBlob(document.blob, document.filename);
    showToast("Word 报告已生成");
  } catch (error) {
    const artifact = buildExportArtifactFromPayload("rtf", payload);
    downloadArtifact(artifact);
    showToast("Word 服务不可用，已生成兼容 RTF 报告");
  }
}

export async function exportPdfReport(ctx) {
  return exportPdfReportPayload(buildReportPayload(exportContext(ctx)), ctx);
}

export async function exportPdfReportPayload(payload, ctx) {
  const { showToast, writePrintableReport } = ctx;
  const printWindow = window.open("", "_blank");
  if (printWindow) writePrintableReport(printWindow, payload, true);
  showToast("正在生成 PDF 报告…");
  try {
    const document = await requestReportPdf(payload);
    printWindow?.close();
    downloadBlob(document.blob, document.filename);
    showToast("PDF 报告已生成");
  } catch (error) {
    if (!printWindow) {
      showToast("PDF 服务不可用，请允许弹窗后重试");
      return;
    }
    writePrintableReport(printWindow, payload);
    printWindow.focus();
    showToast("PDF 服务不可用，已打开可打印报告");
  }
}

export async function exportPptxReport(ctx) {
  return exportPptxReportPayload(buildReportPayload(exportContext(ctx)), ctx);
}

export async function exportPptxReportPayload(payload, ctx) {
  const { showToast } = ctx;
  showToast("正在生成 PPTX 研究汇报…");
  try {
    const document = await requestReportPptx(payload);
    downloadBlob(document.blob, document.filename);
    showToast("PPTX 研究汇报已生成");
  } catch (error) {
    showToast("PPTX 服务不可用，请在活动桌面会话中启动 Workbench server 后重试");
  }
}

export function exportReportVersion(type, versionId, ctx) {
  const { state, showToast, downloadArtifact } = ctx;
  const version = state.reportVersions.find((item) => item.id === versionId);
  if (!version) {
    showToast("未找到该报告版本");
    return;
  }
  if (type === "docx") {
    exportWordReportPayload(version.payload, ctx);
    return;
  }
  if (type === "pdf") {
    exportPdfReportPayload(version.payload, ctx);
    return;
  }
  if (type === "pptx") {
    exportPptxReportPayload(version.payload, ctx);
    return;
  }
  downloadArtifact(buildExportArtifactFromPayload(type, version.payload));
}

export async function verifyArchivedReportVersion(versionId, ctx) {
  const { state, showToast } = ctx;
  const version = state.reportVersions.find((item) => item.id === versionId);
  if (!version) return showToast("未找到该报告版本");
  const result = await verifyReportIntegrity(version.payload);
  if (result.status === "verified") return showToast("报告归档 SHA-256 清单匹配");
  if (result.status === "mismatch") return showToast("报告归档内容与 SHA-256 清单不匹配");
  showToast("该报告归档未保存 SHA-256 清单");
}

export async function saveCurrentReportVersion(ctx) {
  const {
    state,
    updateBusyOverlay,
    getBusyOverlayState,
    $,
    waitForPaint,
    settleBusyTransition,
    projectReportArchiveSyncController,
    showToast,
    render
  } = ctx;

  if (state.reportArchiving || state.workflowModeSwitching) return;
  state.reportArchiving = true;
  updateBusyOverlay(getBusyOverlayState());
  const saveVersionButton = $("#saveVersionBtn");
  if (saveVersionButton) {
    saveVersionButton.disabled = true;
    saveVersionButton.classList.add("is-busy");
    saveVersionButton.textContent = "保存中…";
  }
  $("#studioShell")?.classList.add("is-mode-switching");
  await waitForPaint();
  try {
    const payload = buildReportPayload(exportContext(ctx));
    payload.reportIntegrity = await createReportIntegrity(payload);
    state.reportVersions = saveReportVersion(payload, state.reportVersions);
    const newest = state.reportVersions[0];
    void projectReportArchiveSyncController.save(newest, { source: "report-archive" });
    await settleBusyTransition(260);
    showToast(`报告版本 ${newest.label} 已归档`);
  } catch (error) {
    showToast(error?.message || "报告归档校验失败");
  } finally {
    state.reportArchiving = false;
    if (saveVersionButton) {
      saveVersionButton.disabled = false;
      saveVersionButton.classList.remove("is-busy");
      saveVersionButton.textContent = "保存版本";
    }
    render();
  }
}

export function deleteArchivedReportVersion(versionId, ctx) {
  const { state, showToast, projectReportArchiveSyncController, render } = ctx;
  const version = state.reportVersions.find((item) => item.id === versionId);
  if (!version) {
    showToast("未找到该报告版本");
    return;
  }
  if (!window.confirm(`确定删除报告版本 ${version.label}？此操作不可撤销。`)) return;
  state.reportVersions = deleteReportVersion(version.id, state.reportVersions);
  void projectReportArchiveSyncController.remove(version.id, { source: "manual" });
  showToast(`报告版本 ${version.label} 已删除`);
  render();
}

export function exportContext(ctx) {
  const { state, project } = ctx;
  return {
    project,
    brief: state.brief,
    inspiration: state.inspiration,
    direction: state.direction,
    forceMission: state.forceMission,
    ov1: state.ov1,
    ov1b: state.ov1b,
    ov1c: state.ov1c,
    ov2: state.ov2,
    ov3: state.ov3,
    ov4: state.ov4,
    ov5a: state.ov5a,
    ov5: state.ov5,
    ov6a: state.ov6a,
    ov6b: state.ov6b,
    ov6c: state.ov6c,
    ov7: state.ov7,
    ooda: state.ooda,
    scenario: state.scenario,
    validationResult: state.validationResult,
    knowledge: state.knowledge,
    knowledgeCitationApprovals: state.knowledgeCitationApprovals,
    deployment: state.deployment,
    modelSnapshots: state.modelSnapshots,
    modelComparison: state.modelComparison,
    reportTemplate: state.reportTemplate,
    collaboration: state.collaboration,
    projectRepository: {
      projectRevision: state.projectRevision,
      brief: state.projectStorage,
      ov1: state.ov1Storage,
      ov1b: state.ov1bStorage,
      ov1c: state.ov1cStorage,
      ov2: state.ov2Storage,
      ov3: state.ov3Storage,
      ov4: state.ov4Storage,
      ov5a: state.ov5aStorage,
      ov5: state.ov5Storage,
      ov6a: state.ov6aStorage,
      ov6b: state.ov6bStorage,
      ov6c: state.ov6cStorage,
      ov7: state.ov7Storage,
      architecture: state.architectureStorage,
      ooda: state.oodaStorage,
      scenario: state.scenarioStorage,
      validation: state.validationStorage,
      knowledge: state.knowledgeStorage,
      reportArchives: state.reportStorage,
      modelSnapshots: state.modelSnapshotStorage
    }
  };
}

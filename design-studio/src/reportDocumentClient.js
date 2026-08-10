export async function requestReportDocx(payload) {
  return requestReportDocument("docx", payload);
}

export async function requestReportPdf(payload) {
  return requestReportDocument("pdf", payload);
}

export async function requestReportPptx(payload) {
  return requestReportDocument("pptx", payload);
}

async function requestReportDocument(format, payload) {
  const label = format === "pdf" ? "PDF" : format === "pptx" ? "PPTX" : "Word";
  const response = await fetch(`/api/report-${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload })
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error(`正式 ${label} 导出需要通过 Workbench server 启动。`);
    throw new Error((await response.text()).trim() || `${label} 报告生成失败。`);
  }
  return {
    blob: await response.blob(),
    filename: reportDocumentFilename(payload, format) || fileNameFromHeader(response.headers.get("content-disposition")) || `combat-concept-research-report.${format}`
  };
}

function reportDocumentFilename(payload, format) {
  const label = String(payload?.reportVersion?.label || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return label ? `combat-concept-research-report-${label}.${format}` : "";
}

function fileNameFromHeader(header) {
  const match = String(header || "").match(/filename="?([^";]+)"?/i);
  return match ? match[1] : "";
}

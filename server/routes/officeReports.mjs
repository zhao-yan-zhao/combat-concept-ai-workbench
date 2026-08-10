import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readJson, runProcess, send } from "../httpUtils.mjs";

export function createOfficeReportHandlers(runtime) {
  const { root } = runtime;

  async function handleReportDocx(request, response) {
    await handleReportDocument(request, response, {
      extension: "docx",
      outputFormat: "docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
  }

  async function handleReportPdf(request, response) {
    await handleReportDocument(request, response, {
      extension: "pdf",
      outputFormat: "pdf",
      script: "generate-report-docx.ps1",
      contentType: "application/pdf"
    });
  }

  async function handleReportPptx(request, response) {
    await handleReportDocument(request, response, {
      extension: "pptx",
      script: "generate-report-pptx.ps1",
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    });
  }

  async function handleReportDocument(request, response, format) {
    const input = await readJson(request);
    if (!input?.payload || typeof input.payload !== "object") {
      send(response, 400, "缺少报告数据。", "text/plain;charset=utf-8");
      return;
    }
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "combat-concept-report-"));
    const inputPath = join(temporaryDirectory, "report-payload.json");
    const filename = `combat-concept-research-report.${format.extension}`;
    const outputPath = join(temporaryDirectory, filename);
    try {
      await writeFile(inputPath, JSON.stringify(input.payload), "utf8");
      const scriptArguments = [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(root, "scripts", format.script || "generate-report-docx.ps1"),
        "-InputPath",
        inputPath,
        "-OutputPath",
        outputPath
      ];
      if (format.outputFormat) scriptArguments.push("-OutputFormat", format.outputFormat);
      await runProcess("powershell.exe", scriptArguments);
      const content = await readFile(outputPath);
      response.writeHead(200, {
        "Content-Type": format.contentType,
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store"
      });
      response.end(content);
    } catch (error) {
      if (isOfficeComUnavailable(error)) {
        send(
          response,
          503,
          "正式报告导出需要在具有活动桌面会话的 Windows 用户环境中运行 Office 报告服务。",
          "text/plain;charset=utf-8"
        );
        return;
      }
      throw error;
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }

  function isOfficeComUnavailable(error) {
    const message = String(error?.message || error);
    return message.includes("Office COM requires an active interactive desktop session")
      || message.includes("0x80070520");
  }

  return { handleReportDocx, handleReportPdf, handleReportPptx };
}

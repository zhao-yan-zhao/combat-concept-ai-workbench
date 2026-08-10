import { buildReportPayload } from "./reportBuilder.js";
import { buildObsidianArchive } from "./obsidianArchiveBuilder.js";
import { writeObsidianArchive } from "./obsidianArchiveClient.js";
import { saveObsidianArchiveRecord } from "./obsidianArchiveStore.js";

export function createObsidianArchiveController({ getState, render, notify, project }) {
  return {
    handleAction(action) {
      if (action !== "archive-obsidian") return false;
      const state = getState();
      if (state.obsidianArchiveWriting) return true;
      void archiveCurrentReport();
      return true;
    }
  };

  async function archiveCurrentReport() {
    const state = getState();
    state.obsidianArchiveWriting = true;
    render();
    try {
      const payload = buildReportPayload({
        project,
        brief: state.brief,
        inspiration: state.inspiration,
        direction: state.direction,
        ov1: state.ov1,
        ov5: state.ov5,
        ooda: state.ooda,
        scenario: state.scenario,
        validationResult: state.validationResult,
        knowledge: state.knowledge,
        deployment: state.deployment
      });
      const archive = buildObsidianArchive(payload);
      const result = await writeObsidianArchive(archive);
      state.obsidianArchive = saveObsidianArchiveRecord({
        ...result,
        archivedAt: new Date().toISOString()
      });
      notify(`已写入 Obsidian Vault：${result.fileCount || 1} 篇结构化笔记`);
    } catch (error) {
      if (error?.name === "AbortError") {
        notify("已取消选择 Obsidian Vault");
      } else {
        notify(error?.message || "写入 Obsidian Vault 失败");
      }
    } finally {
      state.obsidianArchiveWriting = false;
      render();
    }
  }
}

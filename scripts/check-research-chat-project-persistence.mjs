/**
 * Acceptance: step research chats persist in the project repository.
 * Run: node scripts/check-research-chat-project-persistence.mjs
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import {
  applyRemoteResearchChats,
  captureResearchChatsModel
} from "../design-studio/src/researchChatProjectSync.js";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-research-chats-"));
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json") });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await repository.createProject({ id: "chat-demo", title: "Chat Demo" });

  const model = {
    version: 1,
    phaseAction: {
      version: 1,
      messages: [
        { id: "w1", role: "assistant", topic: "welcome", source: "local", text: "欢迎", createdAt: "2026-08-11T00:00:00.000Z" },
        { id: "u1", role: "user", topic: "revision", source: "", text: "合并第 2、3 阶段", createdAt: "2026-08-11T00:00:01.000Z" },
        { id: "a1", role: "assistant", topic: "revision", source: "ai", text: "已合并阶段。", createdAt: "2026-08-11T00:00:02.000Z" },
        { id: "pending", role: "assistant", topic: "revision", source: "", text: "", pending: true, createdAt: "2026-08-11T00:00:03.000Z" }
      ]
    },
    forceMission: {
      messages: [
        { id: "fu1", role: "user", topic: "revision", text: "补充护航", createdAt: "2026-08-11T00:01:00.000Z" },
        { id: "fa1", role: "assistant", topic: "revision", source: "error", text: "本地建议", createdAt: "2026-08-11T00:01:01.000Z" }
      ]
    },
    ruleLibrary: {
      messages: [
        { id: "ru1", role: "user", topic: "revision", text: "新增约束", createdAt: "2026-08-11T00:02:00.000Z" },
        { id: "ra1", role: "assistant", topic: "revision", source: "cancelled", text: "已停止生成", createdAt: "2026-08-11T00:02:01.000Z" }
      ]
    }
  };

  const saved = await repository.saveResearchChats("chat-demo", {
    model,
    source: "test"
  });
  assert(saved.exists && saved.resourceRevision === 1, "research chats save should create resource");
  assert(saved.model.phaseAction.messages.length === 3, "pending bubbles must be stripped");
  assert(saved.model.forceMission.messages.at(-1).source === "error", "error source must persist");
  assert(saved.model.ruleLibrary.messages.at(-1).source === "cancelled", "cancelled source must persist");
  assert(saved.revision === 0, "chat-only save must not bump project revision");

  const unchanged = await repository.saveResearchChats("chat-demo", {
    model: saved.model,
    source: "test"
  });
  assert(unchanged.resourceRevision === 1, "identical chat model must not bump resource revision");

  // Brief revision path stays independent.
  const brief = await repository.saveBrief("chat-demo", {
    direction: "demo",
    source: "manual",
    brief: {
      researchIntent: "研究",
      objective: "目标",
      approach: "思路",
      assumptions: "假设",
      expectedEffects: "效果",
      risk: "风险"
    },
    inspiration: {
      stage: 1,
      messages: [
        { id: "i1", role: "user", topic: "consultation", text: "简报问题", source: "", createdAt: "2026-08-11T00:03:00.000Z" },
        { id: "i2", role: "assistant", topic: "consultation", text: "简报答复", source: "ai", createdAt: "2026-08-11T00:03:01.000Z" }
      ]
    }
  });
  assert(brief.revision === 1 && brief.inspiration.messages.length === 2, "brief inspiration still persists");
  assert(brief.inspiration.messages[1].source === "ai", "inspiration ai source retained");

  const reopened = createFileProjectRepository({ filePath: join(directory, "projects.json") });
  const restored = await reopened.getResearchChats("chat-demo");
  assert(restored.exists && restored.model.phaseAction.messages[1].text.includes("合并"), "research chats must survive reload");
  assert(restored.model.forceMission.messages.length === 2, "force chat must reload");

  // Client capture / apply helpers
  const state = {
    phaseActionChat: { messages: [{ role: "assistant", topic: "welcome", text: "本地欢迎", source: "local" }] },
    forceMissionChat: { messages: [] },
    ruleLibraryChat: { messages: [] }
  };
  const applied = applyRemoteResearchChats(state, restored.model, { projectId: "chat-demo", force: false });
  assert(applied, "empty/welcome local should accept remote chats");
  const captured = captureResearchChatsModel(state);
  assert(hasUser(captured.phaseAction), "capture should include user turns after apply");

  // Local draft wins when it already has user turns
  const localRich = {
    phaseActionChat: {
      messages: [
        { role: "user", topic: "revision", text: "本地未同步改动", source: "" },
        { role: "assistant", topic: "revision", text: "本地答复", source: "local" }
      ]
    },
    forceMissionChat: state.forceMissionChat,
    ruleLibraryChat: state.ruleLibraryChat
  };
  const kept = applyRemoteResearchChats(localRich, restored.model, { projectId: "chat-demo", force: false });
  assert(!kept || localRich.phaseActionChat.messages.some((m) => String(m.text).includes("本地未同步")), "local draft with user turns should not be overwritten without force");

  console.log("Research chat project persistence acceptance passed.");
} finally {
  repository.close();
  await rm(directory, { recursive: true, force: true });
}

function hasUser(session) {
  return (session?.messages || []).some((message) => message?.role === "user");
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function loadAiPromptData({ configPath }) {
  try {
    const raw = JSON.parse(await readFile(configPath, "utf8"));
    return {
      overrides: normalizeOverrides(raw?.overrides),
      history: normalizeHistory(raw?.history)
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { overrides: {}, history: {} };
    }
    throw new Error(`AI prompt config could not be loaded: ${error.message}`);
  }
}

export async function loadAiPromptOverrides({ configPath }) {
  const data = await loadAiPromptData({ configPath });
  return data.overrides;
}

export async function saveAiPromptOverrides({ configPath, value, note = "" }) {
  const nextOverrides = normalizeOverrides(value?.overrides ?? value);
  const { overrides: prevOverrides, history: currentHistory } = await loadAiPromptData({ configPath });

  const history = { ...currentHistory };

  // 检测发生变更或新增的提示词，生成历史版本快照
  for (const [id, content] of Object.entries(nextOverrides)) {
    const prevContent = prevOverrides[id];
    if (prevContent !== content) {
      const list = Array.isArray(history[id]) ? [...history[id]] : [];
      const nextVersion = (list[0]?.version || list.length) + 1;
      const record = {
        versionId: `v${nextVersion}_${Date.now()}`,
        version: nextVersion,
        timestamp: new Date().toISOString(),
        content,
        charCount: content.length,
        note: String(note || "").trim().slice(0, 100) || (prevContent ? `修订版本 v${nextVersion}` : `初始自定义版本 v1`)
      };
      list.unshift(record);
      if (list.length > 30) list.length = 30;
      history[id] = list;
    }
  }

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(
    configPath,
    `${JSON.stringify({ version: 1, overrides: nextOverrides, history }, null, 2)}\n`,
    "utf8"
  );
  return nextOverrides;
}

export async function rollbackAiPromptVersion({ configPath, promptId, versionId }) {
  const pid = String(promptId || "").trim();
  const vid = String(versionId || "").trim();
  if (!pid || !vid) {
    const error = new Error("缺少 promptId 或 versionId 参数");
    error.statusCode = 400;
    throw error;
  }

  const { overrides, history } = await loadAiPromptData({ configPath });
  const list = history[pid] || [];
  const target = list.find((item) => item.versionId === vid || String(item.version) === vid);

  if (!target) {
    const error = new Error(`未找到提示词 [${pid}] 的版本 [${vid}]`);
    error.statusCode = 404;
    throw error;
  }

  const nextOverrides = { ...overrides, [pid]: target.content };
  const nextList = [...list];
  const nextVersion = (nextList[0]?.version || nextList.length) + 1;
  const rollbackRecord = {
    versionId: `v${nextVersion}_${Date.now()}`,
    version: nextVersion,
    timestamp: new Date().toISOString(),
    content: target.content,
    charCount: target.content.length,
    note: `回退到版本 v${target.version}`
  };
  nextList.unshift(rollbackRecord);
  if (nextList.length > 30) nextList.length = 30;
  history[pid] = nextList;

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(
    configPath,
    `${JSON.stringify({ version: 1, overrides: nextOverrides, history }, null, 2)}\n`,
    "utf8"
  );

  return {
    overrides: nextOverrides,
    history,
    rolledBack: rollbackRecord
  };
}

export function normalizeOverrides(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const [id, content] of Object.entries(value)) {
    const key = String(id || "").trim().slice(0, 160);
    const text = String(content ?? "").trim();
    if (key && text) result[key] = text.slice(0, 100000);
  }
  return result;
}

export function normalizeHistory(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const [id, list] of Object.entries(value)) {
    const key = String(id || "").trim().slice(0, 160);
    if (!key || !Array.isArray(list)) continue;
    result[key] = list
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        versionId: String(item.versionId || ""),
        version: Number(item.version) || 1,
        timestamp: String(item.timestamp || new Date().toISOString()),
        content: String(item.content || "").slice(0, 100000),
        charCount: Number(item.charCount) || String(item.content || "").length,
        note: String(item.note || "").slice(0, 120)
      }))
      .slice(0, 30);
  }
  return result;
}

import { importKnowledgeVault, searchEvidence } from "./knowledgeStore.js";
import { canReviewSensitiveKnowledge } from "../../server/knowledgeSensitivityAccess.mjs";

export function createKnowledgeController({ getState, render, notify, invalidateRedTeam, syncKnowledge, searchProjectKnowledge, loadCitationApprovals, createCitationApproval, revokeCitationApproval }) {
  return {
    async hydrateCitationApprovals() {
      const state = getState();
      if (!canReviewSensitiveKnowledge(state.collaboration?.session?.actor) || !loadCitationApprovals) return;
      try { state.knowledgeCitationApprovals = (await loadCitationApprovals()).approvals || []; render(); } catch { state.knowledgeCitationApprovals = []; }
    },
    bindStatic(input) {
      input?.addEventListener("change", async () => {
        if (!input.files?.length) return;
        const state = getState();
        try {
          state.knowledge = await importKnowledgeVault(input.files);
        state.knowledgeQuery = "";
        state.knowledgeResults = null;
        state.knowledgeSearch = { mode: "local", retrievalMode: "hybrid", includeSensitive: false, detail: "本地关键词检索，默认排除敏感片段" };
          invalidateRedTeam?.();
          void syncKnowledge?.(state.knowledge, { source: "obsidian-import" });
          notify(`已连接 Obs 知识库：${state.knowledge.summary.fileCount} 篇笔记`);
          render();
        } catch {
          notify("知识库导入失败，请检查 Markdown 文件");
        } finally {
          input.value = "";
        }
      });
    },

    bind(root) {
      root.querySelector("#knowledgeSearchForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        const form = new FormData(event.currentTarget);
        state.knowledgeQuery = String(form.get("query") || "").trim();
        const retrievalMode = normalizeRetrievalMode(form.get("mode"));
        const requestedSensitiveReview = form.get("includeSensitive") === "on";
        const includeSensitive = requestedSensitiveReview && canReviewSensitiveKnowledge(state.collaboration?.session?.actor);
        if (requestedSensitiveReview && !includeSensitive) notify("敏感片段复核需要登录负责人账号");
        state.knowledgeResults = state.knowledgeQuery ? searchEvidence(state.knowledgeQuery, state.knowledge, 4, { includeSensitive }) : null;
        state.knowledgeSearch = { mode: "local", retrievalMode, includeSensitive, detail: includeSensitive ? "本地检索包含敏感片段；AI 和报告仍默认排除" : "本地关键词候选，默认排除敏感片段" };
        render();
        void requestRemoteSearch(state.knowledgeQuery, retrievalMode, includeSensitive);
      });
      root.querySelector("#sensitiveCitationApprovalForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const state = getState(); const values = new FormData(event.currentTarget);
        try {
          const result = await createCitationApproval?.({ documentId: values.get("documentId"), reason: values.get("reason"), expectedRevision: state.projectRevision });
          state.knowledgeCitationApprovals = result?.approvals || state.knowledgeCitationApprovals;
          state.projectRevision = result?.revision || state.projectRevision;
          notify("敏感片段报告引用授权已记录"); render();
        } catch (error) { notify(error?.status === 409 ? "项目已更新，请刷新后再授权" : "敏感引用授权失败，仅负责人可操作"); }
      });
      root.querySelectorAll("[data-revoke-sensitive-citation]").forEach((button) => button.addEventListener("click", async () => {
        const state = getState();
        const reason = window.prompt("撤销理由（将恢复默认排除）");
        if (!reason) return;
        try {
          const result = await revokeCitationApproval?.(button.dataset.revokeSensitiveCitation, { reason, expectedRevision: state.projectRevision });
          state.knowledgeCitationApprovals = result?.approvals || state.knowledgeCitationApprovals;
          state.projectRevision = result?.revision || state.projectRevision;
          notify("敏感片段报告引用授权已撤销"); render();
        } catch { notify("敏感引用撤销失败，请确认负责人身份和项目修订"); }
      }));
    },

    handleAction(action, input) {
      if (action !== "connect-knowledge") return false;
      input?.click();
      return true;
    }
  };

  async function requestRemoteSearch(query, retrievalMode, includeSensitive) {
    if (!query || !searchProjectKnowledge) return;
    const state = getState();
    if (state.knowledgeStorage?.mode !== "server") return;
    state.knowledgeSearch = { mode: "checking", retrievalMode, includeSensitive, detail: "正在查询项目知识库" };
    render();
    try {
      const response = await searchProjectKnowledge(query, 4, retrievalMode, includeSensitive);
      if (getState().knowledgeQuery !== query || getState().knowledgeSearch?.retrievalMode !== retrievalMode || getState().knowledgeSearch?.includeSensitive !== includeSensitive) return;
      state.knowledgeResults = response.results || [];
      const activeMode = normalizeRetrievalMode(response.index?.mode || retrievalMode);
      const excluded = Number(response.index?.sensitiveExcludedCount || 0);
      state.knowledgeSearch = { mode: "server", retrievalMode: activeMode, includeSensitive, detail: `${retrievalLabel(activeMode, response.index?.backend)} · r${response.revision || 0}${externalVectorLabel(response.index?.externalVector)}${excluded ? ` · 已排除 ${excluded} 个敏感片段` : ""}` };
    } catch (error) {
      if (getState().knowledgeQuery !== query || getState().knowledgeSearch?.retrievalMode !== retrievalMode || getState().knowledgeSearch?.includeSensitive !== includeSensitive) return;
      state.knowledgeSearch = { mode: "fallback", retrievalMode, includeSensitive, detail: error?.status === 403 ? "敏感片段复核需要登录负责人账号" : "服务端不可用，已保留本地关键词结果" };
    }
    render();
  }
}

function normalizeRetrievalMode(value) {
  return ["keyword", "vector", "hybrid"].includes(value) ? value : "hybrid";
}

function retrievalLabel(mode, backend) {
  if (backend === "external-vector" || backend === "external-vector-local-sensitive-review") return "服务端外部向量检索";
  if (backend === "hybrid-rrf-external-vector") return "服务端混合检索（外部向量）";
  return ({ keyword: "服务端关键词索引", vector: "服务端本地稀疏向量", hybrid: "服务端混合检索" })[mode] || "服务端索引";
}

function externalVectorLabel(provenance) {
  if (provenance?.status === "used") return " · 外部向量候选";
  if (provenance?.status === "fallback") return " · 外部不可用，已使用本地回退";
  return "";
}

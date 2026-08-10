import { addOodaNode, deleteOodaNode, deriveOodaFromOv5, getOodaDuration, normalizeEquipmentRefs, normalizeKnowledgeRefs, updateOodaNode } from "./oodaStore.js";

export function createOodaController({ getState, getModels, render, selectOoda, notify, invalidateDerivedArtifacts, syncOoda }) {
  return {
    bind(root) {
      root.querySelectorAll("[data-add-ooda]").forEach((button) => {
        button.addEventListener("click", () => {
          const state = getState();
          const node = addOodaNode(state.ooda, button.dataset.addOoda);
          invalidateDerivedArtifacts();
          void syncOoda?.(state.ooda, { source: "manual" });
          selectOoda(node.id);
          notify("已新增 OODA 节点，请在右侧补充属性");
          render();
        });
      });

      root.querySelector("#oodaNodeForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        const formData = new FormData(event.currentTarget);
        const node = updateOodaNode(state.ooda, state.selection.id, {
          title: formData.get("title").trim() || "未命名节点",
          input: formData.get("input").trim() || "待定义",
          output: formData.get("output").trim() || "待定义",
          duration: formData.get("duration").trim() || "待估算",
          text: formData.get("text").trim() || "补充该节点的行为说明。",
          rule: formData.get("rule").trim() || "待定义",
          equipmentRefs: normalizeEquipmentRefs(formData.get("equipmentRefs")),
          knowledgeRefs: normalizeKnowledgeRefs(formData.get("knowledgeRefs"))
        });
        invalidateDerivedArtifacts();
        void syncOoda?.(state.ooda, { source: "manual" });
        selectOoda(node.id);
        notify("OODA 节点已保存到本地");
        render();
      });

      root.querySelectorAll("[data-inspector-action=delete-ooda]").forEach((button) => {
        button.addEventListener("click", () => {
          const state = getState();
          const deleted = deleteOodaNode(state.ooda, state.selection?.id);
          if (deleted) invalidateDerivedArtifacts();
          if (deleted) void syncOoda?.(state.ooda, { source: "manual" });
          state.selection = null;
          notify(deleted ? "OODA 节点已删除" : "未找到 OODA 节点");
          render();
        });
      });
    },

    handleAction(action) {
      const state = getState();
      if (action === "derive-ooda") {
        state.ooda = deriveOodaFromOv5(state.ov5);
        invalidateDerivedArtifacts();
        void syncOoda?.(state.ooda, { source: "derived" });
        state.selection = null;
        notify("已根据当前 OV-5 活动重新派生 OODA");
        render();
        return true;
      }
      if (action === "recalculate") {
        notify(`OODA 周期已重新估算：${getOodaDuration(state.ooda) || "待估算"} 分钟`);
        render();
        return true;
      }
      return false;
    }
  };
}

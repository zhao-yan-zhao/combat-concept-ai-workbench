import { addOv1Edge, addOv1Node, autoLayoutOv1, deleteOv1Edge, deleteOv1Node, updateOv1Concept, updateOv1Node } from "./ov1Store.js";
import { resetOv1Camera } from "./ov1ConceptMapController.js";

export function createOv1Controller({ getState, render, notify, selectNode, invalidateValidation, syncOv1 }) {
  return {
    bind(root) {
      root.querySelector("#ov1ConceptForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        state.ov1 = updateOv1Concept(state.ov1, Object.fromEntries(new FormData(event.currentTarget).entries()));
        invalidateValidation?.();
        void syncOv1?.(state.ov1, { source: "concept-summary" });
        state.ov1Dialog = null;
        state.ov1ToolsOpen = true;
        state.ov1PanelMode = "context";
        state.ov1PanelOpen = true;
        state.ov1InspectorCollapsed = false;
        notify("OV-1 任务摘要已保存");
        render();
      });
      root.querySelector("#ov1NodeForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        const data = new FormData(event.currentTarget);
        const next = updateOv1Node(state.ov1, data.get("nodeId"), {
          label: data.get("label"),
          detail: data.get("detail"),
          category: data.get("category"), kind: data.get("kind"), responsibility: data.get("responsibility"), input: data.get("input"), output: data.get("output"), constraints: data.get("constraints"), expectedEffects: data.get("expectedEffects"), evidenceRefs: data.get("evidenceRefs"),
          x: data.get("x"),
          y: data.get("y")
        });
        if (!next) {
          notify("请填写有效的 OV-1 节点名称和说明");
          return;
        }
        state.ov1 = next;
        invalidateValidation?.();
        void syncOv1?.(next, { source: "manual" });
        selectNode(data.get("nodeId"), { open: true });
        notify("OV-1 节点已保存到本地");
        render();
      });

      root.querySelector("#ov1EdgeForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const state = getState();
        const data = new FormData(event.currentTarget);
        const next = addOv1Edge(state.ov1, {
          sourceId: data.get("sourceId"),
          targetId: data.get("targetId"),
          type: data.get("type")
        });
        if (!next) {
          notify("该 OV-1 关系无效或已存在");
          return;
        }
        state.ov1 = next;
        invalidateValidation?.();
        void syncOv1?.(next, { source: "manual" });
        notify("OV-1 关系已保存到本地");
        render();
      });

      root.querySelectorAll("[data-ov1-edge-remove]").forEach((button) => {
        button.addEventListener("click", () => {
          const state = getState();
          const removedId = button.dataset.ov1EdgeRemove;
          const next = deleteOv1Edge(state.ov1, removedId);
          if (!next) return;
          state.ov1 = next;
          if (state.ov1PanelEdgeId === removedId) state.ov1PanelEdgeId = null;
          invalidateValidation?.();
          void syncOv1?.(next, { source: "manual" });
          notify("OV-1 关系已移除");
          render();
        });
      });

      // Keep the focused relation row visible after opening from a canvas edge click.
      root.querySelector(".relation-row.is-selected")?.scrollIntoView({ block: "nearest", behavior: "smooth" });

      root.querySelectorAll("[data-inspector-action=delete-ov1]").forEach((button) => {
        button.addEventListener("click", () => {
          const state = getState();
          const nodeId = state.selection?.id;
          const impacts = state.ov5.activities.filter((item) => (item.sourceOv1NodeIds || []).includes(nodeId));
          const impactNote = impacts.length ? `\n将使 ${impacts.length} 项 OV-5 活动的来源引用失效：${impacts.map((item) => `“${item.title}”`).join("、")}。` : "";
          if (!nodeId || !window.confirm(`确定删除当前 OV-1 节点及其关联关系？${impactNote}`)) return;
          const next = deleteOv1Node(state.ov1, nodeId);
          if (!next) {
            notify("OV-1 至少需要保留一个节点");
            return;
          }
          state.ov1 = next;
          invalidateValidation?.();
          void syncOv1?.(next, { source: "manual" });
          state.selection = null;
          state.ov1Dialog = null;
          state.ov1PanelNodeId = null;
          state.ov1PanelMode = "context";
          notify("OV-1 节点及其关联已删除");
          render();
        });
      });
    },

    handleAction(action) {
      if (action === "auto-layout-ov1") {
        const state = getState();
        state.ov1 = autoLayoutOv1(state.ov1);
        resetOv1Camera();
        void syncOv1?.(state.ov1, { source: "auto-layout" });
        notify("已按概念网络重排节点布局（首屏）");
        render();
        return true;
      }
      if (action !== "add-ov1-node") return false;
      const state = getState();
      const next = addOv1Node(state.ov1);
      if (!next) return true;
      state.ov1 = next;
      invalidateValidation?.();
      void syncOv1?.(next, { source: "manual" });
      const node = next.nodes[next.nodes.length - 1];
      selectNode(node.id, { open: true });
      notify("已新增 OV-1 节点，请在侧栏补充说明与位置");
      render();
      return true;
    }
  };
}

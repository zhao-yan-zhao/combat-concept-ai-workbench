export function createTraceabilityController({ getState, getModels, selectionFor, render, notify }) {
  return {
    bind(root) {
      root.querySelectorAll("[data-trace-jump-kind]").forEach((button) => {
        button.addEventListener("click", () => jump(button.dataset.traceJumpKind, button.dataset.traceJumpId, button.dataset.traceJumpView));
      });
    }
  };

  function jump(kind, id, view) {
    const state = getState();
    const selection = selectionFor(kind, id, getModels());
    if (!selection) {
      notify("该追溯对象已不存在，请复核模型关联");
      return;
    }
    state.activeView = view;
    state.selection = selection;
    render();
    notify(`已定位到${selection.title}`);
  }
}

export const VIEW_SCROLL_PRESERVE_SELECTORS = [
  ".ai-prompt-list",
  ".grouped-list-items",
  ".ov1b-decomposition-scroll",
  ".force-mission-main-stage",
  ".force-mission-phase-list",
  ".force-roster-list",
  ".force-concept-detail-body",
  ".force-composition-table-wrap",
  ".phase-detail-body",
  ".phase-chain-list",
  ".phase-main-stage",
  ".phase-chat-dock .research-chat-body",
  ".phase-chat-dock .phase-review-chat-messages",
  // State machine workbench: keep list/editor position when switching machines
  ".sm-machine-list",
  ".sm-editor",
  ".sm-state-list",
  ".sm-transition-list",
  ".sm-editor-dock",
  ".sm-chat-dock .research-chat-body",
  ".sm-main-panel"
];

/** Inner content panes reset on phase change; outer reading position stays. */
export const VIEW_SCROLL_PHASE_RESET_SELECTORS = [
  ".phase-detail-body",
  ".force-roster-list",
  ".force-composition-table-wrap"
];

export function captureViewScroll(root) {
  if (!root) return [];
  const snapshots = [];
  for (const selector of VIEW_SCROLL_PRESERVE_SELECTORS) {
    root.querySelectorAll(selector).forEach((node, index) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.scrollTop || node.scrollLeft) {
        snapshots.push({
          selector,
          index,
          top: node.scrollTop,
          left: node.scrollLeft
        });
      }
    });
  }
  const workspace = document.querySelector(".studio-workspace");
  if (workspace instanceof HTMLElement && (workspace.scrollTop || workspace.scrollLeft)) {
    snapshots.push({
      selector: ".studio-workspace",
      index: 0,
      top: workspace.scrollTop,
      left: workspace.scrollLeft,
      global: true
    });
  }
  return snapshots;
}

export function restoreViewScroll(root, snapshots = [], { resetInnerPhaseScroll = false } = {}) {
  const apply = () => {
    for (const item of snapshots) {
      if (resetInnerPhaseScroll && VIEW_SCROLL_PHASE_RESET_SELECTORS.includes(item.selector)) {
        continue;
      }
      const scope = item.global ? document : root;
      if (!scope) continue;
      const nodes = scope.querySelectorAll(item.selector);
      const node = nodes[item.index];
      if (!(node instanceof HTMLElement)) continue;
      node.scrollTop = item.top;
      node.scrollLeft = item.left;
    }
    if (resetInnerPhaseScroll && root) {
      for (const selector of VIEW_SCROLL_PHASE_RESET_SELECTORS) {
        root.querySelectorAll(selector).forEach((node) => {
          if (node instanceof HTMLElement) {
            node.scrollTop = 0;
            node.scrollLeft = 0;
          }
        });
      }
    }
  };
  apply();
  // Second pass after layout/paint (expanded detail, dual columns).
  requestAnimationFrame(apply);
}

export function captureViewFocus(root) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active)) return null;
  if (!active.matches("input, textarea, select")) return null;
  const scope = active.closest("form[id]") || root;
  const controls = [...scope.querySelectorAll("input, textarea, select")];
  const index = controls.indexOf(active);
  if (index < 0) return null;
  return {
    scopeId: scope instanceof HTMLElement ? scope.id : "",
    index,
    tagName: active.tagName,
    type: active.getAttribute("type") || "",
    id: active.id || "",
    name: active.getAttribute("name") || "",
    value: active.value,
    checked: "checked" in active ? active.checked : undefined,
    selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
    selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
    selectionDirection: active.selectionDirection || "none"
  };
}

export function restoreViewFocus(root, snapshot, state = {}) {
  if (!snapshot) return;
  const scope = snapshot.scopeId ? root.querySelector(`#${CSS.escape(snapshot.scopeId)}`) : root;
  if (!scope) return;
  const controls = [...scope.querySelectorAll("input, textarea, select")];
  let target = snapshot.id ? scope.querySelector(`#${CSS.escape(snapshot.id)}`) : null;
  if (!target && snapshot.name) {
    const candidates = [...scope.querySelectorAll(`[name="${CSS.escape(snapshot.name)}"]`)];
    target = candidates.find((item) => item.tagName === snapshot.tagName && (item.getAttribute("type") || "") === snapshot.type) || null;
  }
  if (!target) target = controls[snapshot.index] || null;
  if (!(target instanceof HTMLElement) || target.tagName !== snapshot.tagName) return;
  if ("value" in target && (!state.briefDraftReveal || snapshot.scopeId !== "briefEditorForm")) {
    target.value = snapshot.value;
  }
  if (snapshot.checked !== undefined && "checked" in target) target.checked = snapshot.checked;
  target.focus({ preventScroll: true });
  if (snapshot.selectionStart !== null && typeof target.setSelectionRange === "function") {
    const end = Math.min(snapshot.selectionEnd ?? snapshot.selectionStart, target.value.length);
    target.setSelectionRange(Math.min(snapshot.selectionStart, end), end, snapshot.selectionDirection);
  }
}

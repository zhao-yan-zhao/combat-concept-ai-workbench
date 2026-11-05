/**
 * Domain State Actions (OV-5 pilot for Phase 3).
 * Encapsulates direct state mutations into structured action functions.
 */
import { selectionFor } from "../ui.js";

export function createStateActions({ state, getModels, render, showToast }) {
  /**
   * General patch setter for state fields.
   */
  function setState(patch) {
    if (patch && typeof patch === "object") {
      Object.assign(state, patch);
    }
    return state;
  }

  /**
   * Set OV-5 workbench left sidebar mode ('editor' | 'library' | 'templates').
   */
  function setOv5LeftMode(mode) {
    state.ov5LeftMode = mode;
  }

  /**
   * Select an OV-5 activity and switch left mode to editor.
   */
  function selectOv5Activity(activityId) {
    const models = getModels ? getModels() : { ov5: state.ov5 };
    state.selection = selectionFor("activity", activityId, models);
    state.ov5LeftMode = "editor";
  }

  /**
   * Clear current selection.
   */
  function clearSelection() {
    state.selection = null;
  }

  return {
    setState,
    setOv5LeftMode,
    selectOv5Activity,
    clearSelection
  };
}

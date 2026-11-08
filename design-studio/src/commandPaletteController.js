import { renderCommandPaletteHtml, filterCommands } from "./commandPaletteView.js";

/**
 * 全局命令面板控制器
 */
export function createCommandPaletteController({
  state,
  $,
  showToast,
  navigateToResearchView,
  handleAction
}) {
  let dialogElement = null;

  function getDialog() {
    if (!dialogElement) {
      dialogElement = $("#commandPaletteDialog");
    }
    return dialogElement;
  }

  function renderDialog() {
    const dialog = getDialog();
    if (!dialog) return;

    if (!state.commandPaletteOpen) {
      if (dialog.open) {
        try { dialog.close(); } catch {}
      }
      dialog.innerHTML = "";
      dialog.classList.remove("is-open");
      return;
    }

    dialog.innerHTML = renderCommandPaletteHtml({
      query: state.commandPaletteQuery || "",
      selectedIndex: state.commandPaletteSelectedIndex || 0,
      state
    });

    if (!dialog.open) {
      if (typeof dialog.showModal === "function") {
        try { dialog.showModal(); } catch { dialog.setAttribute("open", ""); }
      } else {
        dialog.setAttribute("open", "");
      }
    }
    dialog.classList.add("is-open");

    const input = dialog.querySelector("#commandPaletteInput");
    if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }

    const activeItem = dialog.querySelector(".command-palette-item.is-active");
    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest" });
    }
  }

  function open() {
    state.commandPaletteOpen = true;
    state.commandPaletteQuery = "";
    state.commandPaletteSelectedIndex = 0;
    renderDialog();
  }

  function close() {
    state.commandPaletteOpen = false;
    renderDialog();
  }

  function toggle() {
    if (state.commandPaletteOpen) {
      close();
    } else {
      open();
    }
  }

  async function executeItem(item) {
    if (!item) return;
    close();

    const { type, view, action, elementId, exampleKind } = item;

    if (type === "nav") {
      if (view) {
        await navigateToResearchView(view);
      }
    } else if (type === "action") {
      if (action === "load-example-project") {
        const dummyBtn = document.createElement("button");
        dummyBtn.dataset.exampleKind = exampleKind || "tactic";
        await handleAction(action, dummyBtn);
      } else if (action === "open-validation-view") {
        await navigateToResearchView("validation");
      } else if (action) {
        await handleAction(action);
      }
    } else if (type === "element") {
      if (view) {
        await navigateToResearchView(view);
      }
    }
  }

  function onInput(event) {
    state.commandPaletteQuery = event.target.value;
    state.commandPaletteSelectedIndex = 0;
    renderDialog();
  }

  function onKeyDown(event) {
    if (!state.commandPaletteOpen) return;

    const matches = filterCommands(state.commandPaletteQuery || "", state);
    if (!matches.length) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      return;
    }

    let currentIndex = state.commandPaletteSelectedIndex || 0;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      currentIndex = (currentIndex + 1) % matches.length;
      state.commandPaletteSelectedIndex = currentIndex;
      renderDialog();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      currentIndex = (currentIndex - 1 + matches.length) % matches.length;
      state.commandPaletteSelectedIndex = currentIndex;
      renderDialog();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const selectedItem = matches[currentIndex];
      if (selectedItem) {
        executeItem(selectedItem);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function bindEvents() {
    const dialog = getDialog();
    if (!dialog) return;

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        close();
        return;
      }
      const closeBtn = event.target.closest('[data-action="close-command-palette"]');
      if (closeBtn) {
        close();
        return;
      }
      const itemEl = event.target.closest(".command-palette-item");
      if (itemEl) {
        const index = Number(itemEl.dataset.commandIndex);
        const matches = filterCommands(state.commandPaletteQuery || "", state);
        const item = matches[index];
        if (item) executeItem(item);
      }
    });

    dialog.addEventListener("input", (event) => {
      if (event.target.id === "commandPaletteInput") {
        onInput(event);
      }
    });

    dialog.addEventListener("keydown", onKeyDown);
  }

  return {
    open,
    close,
    toggle,
    render: renderDialog,
    bindEvents,
    handleAction(action) {
      if (action === "open-command-palette") {
        open();
        return true;
      }
      if (action === "close-command-palette") {
        close();
        return true;
      }
      if (action === "toggle-command-palette") {
        toggle();
        return true;
      }
      return false;
    }
  };
}

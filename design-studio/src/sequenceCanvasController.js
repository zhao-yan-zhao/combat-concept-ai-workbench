/**
 * Mount open-source sequence diagram engines into the 时序校验 workbench.
 * Mermaid (mermaid-js) + js-sequence-diagrams (bramp) + research workbench HTML.
 * UML/Mermaid modes: editable DSL textarea with live preview; Apply writes model.
 */

import {
  dslForEngine,
  resolveSequenceDiagramEngine,
  sequenceToJsSequence,
  sequenceToMermaid,
  sequenceToPlantUml
} from "./sequenceDiagramDsl.js";

const SCRIPT_CHAIN = {
  mermaid: ["./vendor/sequence/mermaid-10.9.1.min.js"],
  "js-sequence": [
    "./vendor/sequence/underscore-1.13.6.min.js",
    "./vendor/sequence/raphael-2.3.0.min.js",
    "./vendor/sequence/js-sequence-diagrams-2.0.1.min.js"
  ]
};

const loaded = new Set();
const loading = new Map();
let mermaidReady = false;
const previewTimers = new WeakMap();

export function createSequenceCanvasController() {
  return {
    bind(root = document) {
      const hosts = root.querySelectorAll("[data-sequence-diagram-host]");
      hosts.forEach((host) => {
        const sequenceId = host.getAttribute("data-sequence-id") || "";
        const engine = resolveSequenceDiagramEngine(host.getAttribute("data-engine") || "workbench");
        if (engine === "workbench") return;
        const source = resolveDiagramSource(root, host, sequenceId, engine);
        void renderIntoHost(host, engine, source);
      });

      root.querySelectorAll("[data-seq-dsl-editor]").forEach((editor) => {
        if (editor.dataset.bound === "1") return;
        editor.dataset.bound = "1";
        editor.addEventListener("input", () => schedulePreview(editor, root));
        editor.addEventListener("keydown", (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            const applyBtn = root.querySelector(
              `[data-action="ov6c-apply-dsl"][data-sequence-id="${cssAttr(editor.dataset.sequenceId || "")}"]`
            ) || root.querySelector('[data-action="ov6c-apply-dsl"]');
            applyBtn?.click();
          }
        });
      });

      // Interactive canvas: keep focus after field re-render targets, stop nested tool clicks bubbling badly.
      const canvas = root.querySelector("[data-seq-canvas]");
      if (canvas && canvas.dataset.bound !== "1") {
        canvas.dataset.bound = "1";
        canvas.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            const cancel = root.querySelector('[data-action="ov6c-cancel-connect"]');
            if (cancel) cancel.click();
          }
        });
        canvas.querySelectorAll(".seq-message-name-input, .seq-lifeline-name input").forEach((input) => {
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              input.blur();
            }
            event.stopPropagation();
          });
          input.addEventListener("click", (event) => event.stopPropagation());
        });
      }
    }
  };
}

function resolveDiagramSource(root, host, sequenceId, engine) {
  const editor = root.querySelector(
    `[data-seq-dsl-editor][data-sequence-id="${cssEscape(sequenceId)}"][data-engine="${engine}"]`
  ) || root.querySelector(`[data-seq-dsl-editor][data-sequence-id="${cssEscape(sequenceId)}"]`);
  if (editor && typeof editor.value === "string") return editor.value;

  const sourceEl = root.querySelector(`[data-sequence-dsl="${cssEscape(sequenceId)}"][data-engine="${engine}"]`)
    || root.querySelector(`[data-sequence-dsl="${cssEscape(sequenceId)}"]`);
  return sourceEl?.textContent || host.getAttribute("data-dsl") || "";
}

function schedulePreview(editor, root) {
  const previous = previewTimers.get(editor);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    const sequenceId = editor.dataset.sequenceId || "";
    const engine = resolveSequenceDiagramEngine(editor.dataset.engine || "js-sequence");
    const host = root.querySelector(
      `[data-sequence-diagram-host][data-sequence-id="${cssEscape(sequenceId)}"][data-engine="${engine}"]`
    ) || root.querySelector(`[data-sequence-diagram-host][data-sequence-id="${cssEscape(sequenceId)}"]`);
    if (!host) return;
    void renderIntoHost(host, engine, editor.value || "");
  }, 280);
  previewTimers.set(editor, timer);
}

async function renderIntoHost(host, engine, source) {
  if (!host) return;
  const token = String(Date.now());
  host.dataset.renderToken = token;
  host.dataset.renderState = "loading";
  host.innerHTML = `<div class="seq-diagram-status">正在加载 ${engineLabel(engine)}…</div>`;
  try {
    if (engine === "workbench") {
      host.dataset.renderState = "workbench";
      host.innerHTML = "";
      return;
    }
    if (engine === "js-sequence") {
      await ensureScripts(SCRIPT_CHAIN["js-sequence"]);
      if (host.dataset.renderToken !== token) return;
      const Diagram = window.Diagram;
      if (!Diagram?.parse) throw new Error("js-sequence-diagrams 未加载");
      host.innerHTML = "";
      const diagram = Diagram.parse(source || "A->B: empty");
      diagram.drawSVG(host, { theme: "simple" });
      host.dataset.renderState = "ready";
      return;
    }
    await ensureScripts(SCRIPT_CHAIN.mermaid);
    if (host.dataset.renderToken !== token) return;
    const mermaid = window.mermaid;
    if (!mermaid?.render) throw new Error("Mermaid 未加载");
    if (!mermaidReady) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "dark",
        sequence: { actorMargin: 48, messageMargin: 28, mirrorActors: false }
      });
      mermaidReady = true;
    }
    const id = `seq-mmd-${Math.random().toString(36).slice(2, 10)}`;
    const { svg } = await mermaid.render(id, source || "sequenceDiagram\n  A->>B: empty");
    if (host.dataset.renderToken !== token) return;
    host.innerHTML = svg;
    host.dataset.renderState = "ready";
  } catch (error) {
    if (host.dataset.renderToken !== token) return;
    host.dataset.renderState = "error";
    host.innerHTML = `<div class="seq-diagram-status is-error">
      <strong>${engineLabel(engine)} 渲染失败</strong>
      <p>${escapeHtml(error?.message || String(error))}</p>
      <pre class="seq-dsl-fallback">${escapeHtml(source || "")}</pre>
    </div>`;
  }
}

function ensureScripts(urls = []) {
  return urls.reduce((chain, url) => chain.then(() => loadScript(url)), Promise.resolve());
}

function loadScript(src) {
  if (loaded.has(src)) return Promise.resolve();
  if (loading.has(src)) return loading.get(src);
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-sequence-vendor="${cssAttr(src)}"]`);
    if (existing) {
      loaded.add(src);
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.sequenceVendor = src;
    script.onload = () => {
      loaded.add(src);
      loading.delete(src);
      resolve();
    };
    script.onerror = () => {
      loading.delete(src);
      reject(new Error(`无法加载 ${src}`));
    };
    document.head.appendChild(script);
  });
  loading.set(src, promise);
  return promise;
}

function engineLabel(engine) {
  if (engine === "js-sequence") return "js-sequence-diagrams";
  if (engine === "workbench") return "研究画布";
  return "Mermaid";
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(String(value || ""));
  return String(value || "").replace(/"/g, '\\"');
}

function cssAttr(value) {
  return String(value || "").replace(/"/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export {
  sequenceToMermaid,
  sequenceToJsSequence,
  sequenceToPlantUml,
  dslForEngine
};

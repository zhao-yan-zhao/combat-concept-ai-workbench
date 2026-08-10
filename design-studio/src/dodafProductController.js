import {
  DODAF_PRODUCT_KEYS,
  resolveDodafProduct,
  saveLocalDodafProduct,
  seedDodafProduct,
  updateProductField
} from "./dodafProductStore.js";
import { createProjectModelSyncController } from "./projectModelSyncController.js";
import { mergeProductsIntoArchitecture } from "../../shared/dodaf/architectureWriteback.js";
import { applyOv5aToOv5b, applyOv5bToOv5a, syncOv5ActivityPair } from "../../shared/dodaf/ov5ActivitySync.js";
import { persistOv5Model } from "./ov5Store.js";
import {
  exportProjectArchitecture,
  importProjectArchitecture,
  loadProjectArchitecture,
  loadProjectOv2,
  loadProjectOv3,
  loadProjectOv4,
  loadProjectOv5a,
  loadProjectOv6a,
  loadProjectOv6b,
  loadProjectOv6c,
  saveProjectArchitecture,
  saveProjectOv2,
  saveProjectOv3,
  saveProjectOv4,
  saveProjectOv5a,
  saveProjectOv6a,
  saveProjectOv6b,
  saveProjectOv6c
} from "./projectBriefClient.js";

const LOADERS = {
  ov2: loadProjectOv2, ov3: loadProjectOv3, ov4: loadProjectOv4, ov5a: loadProjectOv5a,
  ov6a: loadProjectOv6a, ov6b: loadProjectOv6b, ov6c: loadProjectOv6c
};
const SAVERS = {
  ov2: saveProjectOv2, ov3: saveProjectOv3, ov4: saveProjectOv4, ov5a: saveProjectOv5a,
  ov6a: saveProjectOv6a, ov6b: saveProjectOv6b, ov6c: saveProjectOv6c
};
const LABELS = {
  ov2: "OV-2", ov3: "OV-3", ov4: "OV-4", ov5a: "OV-5a",
  ov6a: "OV-6a", ov6b: "OV-6b", ov6c: "OV-6c"
};

export function createDodafProductController({
  projectId,
  getState,
  render,
  notify,
  downloadArtifact,
  syncOv5 = null,
  projectTitle = () => "Operational Architecture",
  onSaved = null
}) {
  const syncControllers = Object.fromEntries(DODAF_PRODUCT_KEYS.map((resource) => {
    const applyRemote = (remote, { force = false } = {}) => {
      const state = getState();
      if (!remote?.model || remote.stale) return false;
      if (!force && state[`${resource}Storage`]?.localSaved && state[resource]) return false;
      if (force && state[resource] && !window.confirm(`服务端 ${LABELS[resource]} 修订 r${remote.revision} 将覆盖当前产品。是否继续？`)) return false;
      state[resource] = saveLocalDodafProduct(resource, remote.model, projectId);
      return true;
    };
    return [resource, createProjectModelSyncController({
      projectId,
      resource,
      storageKey: `${resource}Storage`,
      resourceLabel: LABELS[resource],
      load: LOADERS[resource],
      save: SAVERS[resource],
      getState,
      render,
      notify,
      applyRemote,
      onSaved,
      conflictRecovery: {
        capture: () => getState()[resource],
        restore: (model) => {
          getState()[resource] = saveLocalDodafProduct(resource, model, projectId);
        }
      }
    })];
  }));

  let fileInput = null;
  const api = {
    async hydrateAll() {
      for (const resource of DODAF_PRODUCT_KEYS) {
        await syncControllers[resource].hydrate();
      }
      try {
        const remote = await loadProjectArchitecture(projectId);
        const state = getState();
        if (remote?.exists && remote.model) {
          state.architecture = remote.model;
          state.architectureStorage = {
            status: "ready",
            mode: "server",
            label: "Architecture 已同步",
            revision: remote.revision,
            resourceRevision: remote.resourceRevision,
            localSaved: false
          };
          state.projectRevision = Math.max(Number(state.projectRevision || 0), Number(remote.revision || 0));
        } else {
          state.architectureStorage = { status: "ready", mode: "server", label: "Architecture 尚未保存", localSaved: false };
        }
      } catch {
        getState().architectureStorage = { status: "offline", mode: "local", label: "Architecture 存储不可用" };
      }
    },

    async syncResource(resource, model, { source = "manual", writeArchitecture = true } = {}) {
      if (resource === "architecture") {
        await persistArchitecture(model, source);
        return;
      }
      if (!DODAF_PRODUCT_KEYS.includes(resource) || !model) return;
      const state = getState();
      state[resource] = saveLocalDodafProduct(resource, model, projectId);
      await syncControllers[resource].sync(state[resource], { source });
      if (writeArchitecture) await writebackArchitecture(source);
    },

    async syncAllFromState({ source = "manual" } = {}) {
      const state = getState();
      for (const resource of DODAF_PRODUCT_KEYS) {
        if (state[resource]) await api.syncResource(resource, state[resource], { source, writeArchitecture: false });
      }
      await writebackArchitecture(source);
    },

    /** Call after OV-5b activity edits so OV-5a hierarchy stays aligned. */
    async syncFromOv5b({ source = "manual" } = {}) {
      const state = getState();
      if (!state.ov5) return;
      const pair = syncOv5ActivityPair({ ov5: state.ov5, ov5a: state.ov5a, source: "ov5" });
      state.ov5 = persistOv5Model(pair.ov5);
      state.ov5a = saveLocalDodafProduct("ov5a", pair.ov5a, projectId);
      if (syncOv5) await syncOv5(state.ov5, { source });
      await syncControllers.ov5a.sync(state.ov5a, { source: `${source}-ov5b-sync` });
      await writebackArchitecture(source);
    },

    ensureFileInput() {
      if (fileInput) return fileInput;
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json,.xml,application/json,text/xml,application/xml";
      fileInput.hidden = true;
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        fileInput.value = "";
        if (file) void importArchitectureFile(file);
      });
      document.body.appendChild(fileInput);
      return fileInput;
    },

    handleAction(action) {
      for (const resource of DODAF_PRODUCT_KEYS) {
        if (syncControllers[resource].handleAction(action)) return true;
      }

      if (action?.startsWith("seed-dodaf-")) {
        const resource = action.replace("seed-dodaf-", "");
        if (!DODAF_PRODUCT_KEYS.includes(resource)) return false;
        void seedAndSave(resource);
        return true;
      }

      if (action?.startsWith("save-dodaf-")) {
        const resource = action.replace("save-dodaf-", "");
        if (!DODAF_PRODUCT_KEYS.includes(resource)) return false;
        void saveProduct(resource);
        return true;
      }

      if (action === "sync-ov5a-from-ov5b") {
        void api.syncFromOv5b({ source: "manual-sync" }).then(() => {
          notify("已将 OV-5b 活动层级同步到 OV-5a");
          render();
        });
        return true;
      }

      if (action === "sync-ov5b-from-ov5a") {
        void syncOv5aIntoOv5b("manual-sync").then(() => {
          notify("已将 OV-5a 分解树写回 OV-5b parentId/标题");
          render();
        });
        return true;
      }

      if (action === "export-architecture-json" || action === "export-architecture-xml") {
        void exportArchitecture(action.endsWith("xml") ? "xml" : "json");
        return true;
      }

      if (action === "import-architecture-file") {
        api.ensureFileInput().click();
        return true;
      }

      if (action === "import-architecture-json") {
        void importArchitecturePrompt("json");
        return true;
      }

      return false;
    },

    handleFieldChange(fieldPath, value) {
      if (!fieldPath?.startsWith("ov")) return false;
      const [resource, ...rest] = fieldPath.split(".");
      if (!DODAF_PRODUCT_KEYS.includes(resource)) return false;
      const state = getState();
      const resolved = resolveDodafProduct(state, resource);
      const path = rest.join(".");
      // OV-5a parent edits: path like tree.<id>.parentId
      if (resource === "ov5a" && path.startsWith("tree.") && path.endsWith(".parentId")) {
        const activityId = path.split(".")[1];
        state.ov5a = saveLocalDodafProduct("ov5a", setTreeParent(resolved.model, activityId, value), projectId);
        void syncOv5aIntoOv5b("manual-edit");
        render();
        return true;
      }
      state[resource] = saveLocalDodafProduct(resource, updateProductField(resolved.model, resource, path, value), projectId);
      void syncControllers[resource].sync(state[resource], { source: "manual-edit" }).then(() => writebackArchitecture("manual-edit"));
      render();
      return true;
    }
  };

  return api;

  async function seedAndSave(resource) {
    const state = getState();
    if (state[resource] && !window.confirm(`重新种子将覆盖当前 ${LABELS[resource]} 手改内容。是否继续？`)) return;
    if (resource === "ov5a") {
      const pair = syncOv5ActivityPair({ ov5: state.ov5, ov5a: null, source: "ov5" });
      state.ov5a = saveLocalDodafProduct("ov5a", pair.ov5a, projectId);
    } else {
      state[resource] = saveLocalDodafProduct(resource, seedDodafProduct(resource, state), projectId);
    }
    await syncControllers[resource].sync(state[resource], { source: "seed" });
    await writebackArchitecture("seed");
    notify(`已从上游生成 ${LABELS[resource]} 种子并提交保存`);
    render();
  }

  async function saveProduct(resource) {
    const state = getState();
    if (resource === "ov5a") {
      await syncOv5aIntoOv5b("manual");
      notify("已保存 OV-5a，并同步写回 OV-5b");
      render();
      return;
    }
    const resolved = resolveDodafProduct(state, resource);
    state[resource] = saveLocalDodafProduct(resource, resolved.model, projectId);
    await syncControllers[resource].sync(state[resource], { source: "manual" });
    await writebackArchitecture("manual");
    notify(`正在保存 ${LABELS[resource]}…`);
    render();
  }

  async function syncOv5aIntoOv5b(source) {
    const state = getState();
    const resolved = resolveDodafProduct(state, "ov5a");
    const pair = syncOv5ActivityPair({ ov5: state.ov5, ov5a: resolved.model, source: "ov5a" });
    state.ov5 = persistOv5Model(pair.ov5);
    state.ov5a = saveLocalDodafProduct("ov5a", pair.ov5a, projectId);
    if (syncOv5) await syncOv5(state.ov5, { source: `${source}-ov5a-sync` });
    await syncControllers.ov5a.sync(state.ov5a, { source });
    await writebackArchitecture(source);
  }

  async function writebackArchitecture(source = "manual") {
    const state = getState();
    const products = {
      ov1: state.ov1,
      ov2: state.ov2,
      ov3: state.ov3,
      ov4: state.ov4,
      ov5a: state.ov5a,
      ov5: state.ov5,
      ov6a: state.ov6a,
      ov6b: state.ov6b,
      ov6c: state.ov6c
    };
    const next = mergeProductsIntoArchitecture(state.architecture, products, {
      projectId,
      title: typeof projectTitle === "function" ? projectTitle() : projectTitle
    });
    await persistArchitecture(next, `${source}-architecture-writeback`);
  }

  async function persistArchitecture(model, source) {
    const state = getState();
    state.architecture = model;
    try {
      const result = await saveProjectArchitecture(projectId, {
        model,
        source,
        expectedRevision: state.projectRevision
      });
      state.projectRevision = result.revision;
      try { await onSaved?.({ resource: "architecture", source, remote: result }); } catch {}
      state.architectureStorage = {
        status: "ready",
        mode: "server",
        label: `Architecture r${result.revision}`,
        revision: result.revision,
        resourceRevision: result.resourceRevision,
        localSaved: false
      };
    } catch (error) {
      notify(error.message || "Architecture 保存失败");
    }
  }

  async function exportArchitecture(format) {
    try {
      // Refresh architecture library before export so package includes latest product entities.
      await writebackArchitecture("export");
      const result = await exportProjectArchitecture(projectId, format);
      if (format === "xml") {
        const body = result.body || result;
        downloadArtifact({
          filename: `${projectId}-architecture-exchange.xml`,
          mimeType: "application/xml",
          content: typeof body === "string" ? body : String(body)
        });
      } else {
        downloadArtifact({
          filename: `${projectId}-architecture-exchange.json`,
          mimeType: "application/json",
          content: JSON.stringify(result.package || result, null, 2)
        });
      }
      notify(`已导出 DoDAF 架构包（${format.toUpperCase()}）`);
    } catch (error) {
      notify(error.message || "架构包导出失败");
    }
  }

  async function importArchitectureFile(file) {
    try {
      const text = await file.text();
      const name = String(file.name || "").toLowerCase();
      const format = name.endsWith(".xml") || text.trimStart().startsWith("<") ? "xml" : "json";
      let packageModel = null;
      let body = text;
      if (format === "json") {
        packageModel = JSON.parse(text);
        body = undefined;
      }
      await applyImport({ package: packageModel, body, format });
    } catch (error) {
      notify(error.message || "架构包文件导入失败");
    }
  }

  async function importArchitecturePrompt(format) {
    const raw = window.prompt("粘贴 DoDAF 架构交换包 JSON（也可使用「从文件导入」）：");
    if (!raw) return;
    try {
      const packageModel = JSON.parse(raw);
      await applyImport({ package: packageModel, format });
    } catch (error) {
      notify(error.message || "架构包导入失败");
    }
  }

  async function applyImport({ package: packageModel, body, format = "json" }) {
    const state = getState();
    if (!window.confirm("导入将按 replace-products 覆盖当前 OV 产品与 architecture。是否继续？")) return;
    const result = await importProjectArchitecture(projectId, {
      package: packageModel,
      body,
      format,
      mergeStrategy: "replace-products",
      source: "import-file",
      expectedRevision: state.projectRevision
    });
    state.projectRevision = result.revision;
    try { await onSaved?.({ resource: "architecture", source: "import-file", remote: result }); } catch {}
    for (const [resource, payload] of Object.entries(result.resources || {})) {
      if (!payload?.model) continue;
      if (resource === "architecture") {
        state.architecture = payload.model;
        state.architectureStorage = {
          status: "ready",
          mode: "server",
          label: `Architecture r${result.revision}`,
          revision: result.revision,
          resourceRevision: payload.resourceRevision,
          localSaved: false
        };
      } else if (DODAF_PRODUCT_KEYS.includes(resource)) {
        state[resource] = saveLocalDodafProduct(resource, payload.model, projectId);
      } else if (resource === "ov1" || resource === "ov5") {
        state[resource] = payload.model;
      }
    }
    if (result.resources?.ov1?.model) state.ov1 = result.resources.ov1.model;
    if (result.resources?.ov5?.model) {
      state.ov5 = persistOv5Model(result.resources.ov5.model);
      if (syncOv5) await syncOv5(state.ov5, { source: "import" });
    }
    notify(`已导入架构包：${(result.imported || []).join(", ")}`);
    render();
  }
}

function setTreeParent(model, activityId, parentId) {
  const flat = [];
  const walk = (nodes, parent = "") => {
    for (const node of nodes || []) {
      flat.push({ id: String(node.id), title: node.title, type: node.type, parentId: parent });
      walk(node.children, String(node.id));
    }
  };
  walk(model.tree || []);
  const id = String(activityId);
  const nextParent = String(parentId || "");
  const byId = new Map(flat.map((node) => [node.id, { ...node, children: [] }]));
  if (!byId.has(id)) return model;
  if (nextParent === id) return model;
  byId.get(id).parentId = nextParent && byId.has(nextParent) ? nextParent : "";
  const roots = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node);
    else roots.push(node);
  }
  const toTree = (node) => ({
    id: node.id,
    title: node.title,
    type: node.type,
    children: (node.children || []).map(toTree)
  });
  return { ...model, tree: roots.map(toTree) };
}

import { getAiServiceConfig, saveAiServiceConfig } from "./aiConfigClient.js";
import { getCmoDatabaseConfig, probeCmoDatabase, saveCmoDatabaseConfig } from "./cmoCatalogClient.js";
import { loadCollaborationSession } from "./projectBriefClient.js";
import { applyTheme, getThemeConfig, saveThemeConfig } from "./themeConfigClient.js";

const root = document.querySelector("#adminRoot");
const toast = document.querySelector("#toast");
let state = {
  status: "loading",
  session: null,
  config: null,
  theme: null,
  cmo: null,
  saving: false,
  themeSaving: false,
  cmoSaving: false,
  cmoProbe: null
};

function render() {
  const actor = state.session?.actor;
  if (state.status === "loading") { root.innerHTML = `<section class="surface surface-pad"><p>正在验证管理员身份...</p></section>`; return; }
  if (!state.session?.authenticated || !actor?.roles?.includes("lead")) { root.innerHTML = `<section class="surface surface-pad admin-denied"><h2>无管理权限</h2><p>请使用负责人账号登录工作台后再进入本页。</p><a class="quiet-button" href="./">返回工作台</a></section>`; return; }
  const config = state.config || {};
  const writable = Boolean(config.configurationWrite?.enabled);
  root.innerHTML = `<section class="surface surface-pad admin-ai-panel"><div class="section-heading"><div><h2>AI 服务</h2><p>当前负责人：${escapeHtml(actor.label)}</p></div><span class="status-tag ${config.configured ? "" : "review"}">${config.configured ? "AI 已就绪" : "密钥未配置"}</span></div><div class="admin-status-grid"><div><span>运行模式</span><b>${escapeHtml(config.mode || "unknown")}</b></div><div><span>密钥来源</span><b>服务进程环境变量</b></div><div><span>配置写入</span><b>${writable ? "负责人可修改" : "部署策略已禁用"}</b></div></div><form id="adminAiConfigForm" class="ai-config-form"><label><span>服务地址</span><input name="baseUrl" type="url" value="${escapeAttribute(config.baseUrl || "https://api.openai.com/v1")}" required></label><label><span>模型</span><input name="model" value="${escapeAttribute(config.model || "")}" required maxlength="120"></label><div class="admin-key-notice">不在此页面填写或保存 API Key。请由部署管理员设置 <code>OPENAI_API_KEY</code> 后重启服务。</div><div class="editor-actions"><button class="quiet-button" type="button" data-action="refresh">刷新状态</button><button type="submit" ${state.saving || !writable ? "disabled" : ""}>${state.saving ? "正在保存" : "保存配置"}</button></div></form></section>`;
  root.innerHTML = root.innerHTML.replace('<div class="admin-key-notice">', '<label><span>API Key</span><input name="apiKey" type="password" autocomplete="new-password" minlength="16" maxlength="2048" placeholder="仅用于更新本机加密密钥；不会回显"></label><div class="admin-key-notice">');
  root.insertAdjacentHTML("beforeend", renderCmoPanel(state.cmo, writable, state.cmoProbe));
  root.insertAdjacentHTML("beforeend", renderThemePanel(state.theme, writable));
  root.querySelector("#adminAiConfigForm")?.addEventListener("submit", save);
  root.querySelector("#adminCmoConfigForm")?.addEventListener("submit", saveCmo);
  root.querySelector("#adminThemeForm")?.addEventListener("submit", saveTheme);
  root.querySelector("[data-action='theme-reset']")?.addEventListener("click", resetThemeForm);
  root.querySelector("[data-action='refresh']")?.addEventListener("click", load);
  root.querySelector("[data-action='cmo-probe']")?.addEventListener("click", probeCmo);
}

async function load() {
  state = { ...state, status: "loading" }; render();
  try {
    const [session, config, themeResponse, cmo] = await Promise.all([
      loadCollaborationSession(),
      getAiServiceConfig(),
      getThemeConfig(),
      getCmoDatabaseConfig()
    ]);
    state = { ...state, status: "ready", session, config, theme: themeResponse.theme, cmo, cmoProbe: null };
    applyTheme(themeResponse.theme);
  } catch { state = { ...state, status: "unavailable" }; }
  render();
}

async function save(event) {
  event.preventDefault(); state = { ...state, saving: true }; render();
  try { const values = new FormData(event.currentTarget); const config = await saveAiServiceConfig({ baseUrl: values.get("baseUrl"), model: values.get("model"), apiKey: values.get("apiKey") }); state = { ...state, config }; notify("AI 服务配置已保存"); } catch (error) { notify(error.message || "AI 服务配置保存失败"); }
  state = { ...state, saving: false }; render();
}

function notify(message) { toast.textContent = message; toast.classList.add("show"); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => toast.classList.remove("show"), 2200); }
function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character])); }
function escapeAttribute(value) { return escapeHtml(value); }

function renderCmoPanel(cmo = {}, writable, probe = null) {
  const status = cmo.status || {};
  const open = Boolean(status.open);
  const counts = status.platformCounts || {};
  const countText = open
    ? `飞机 ${counts.aircraft || 0} · 舰船 ${counts.ship || 0} · 潜艇 ${counts.submarine || 0} · 地面 ${counts.ground || 0}`
    : "未打开";
  const probeText = probe
    ? (probe.ok
      ? `探测成功：${probe.databaseLabel || "CMO DB"} · 飞机 ${probe.aircraftCount || 0} · 舰船 ${probe.shipCount || 0}`
      : `探测失败：${probe.error || "未知错误"}`)
    : "";
  return `<section class="surface surface-pad admin-cmo-panel">
    <div class="section-heading">
      <div>
        <h2>CMO 装备数据库</h2>
        <p>配置 Command: Modern Operations 的 DB3K（.db3）路径，供「兵力与任务」检索平台类型。只读打开，不写回仿真库。</p>
      </div>
      <span class="status-tag ${open ? "" : "review"}">${open ? "已连接" : "未连接"}</span>
    </div>
    <div class="admin-status-grid">
      <div><span>库说明</span><b>${escapeHtml(status.databaseLabel || "—")}</b></div>
      <div><span>解析路径</span><b>${escapeHtml(status.resolvedPath || "—")}</b></div>
      <div><span>平台规模</span><b>${escapeHtml(countText)}</b></div>
      <div><span>任务类型</span><b>${escapeHtml(String(status.missionTypeCount || 0))} 类（CMO 对齐）</b></div>
    </div>
    <form id="adminCmoConfigForm" class="ai-config-form">
      <label><span>启用</span>
        <select name="enabled" ${writable ? "" : "disabled"}>
          <option value="true" ${cmo.enabled !== false ? "selected" : ""}>启用</option>
          <option value="false" ${cmo.enabled === false ? "selected" : ""}>禁用</option>
        </select>
      </label>
      <label><span>数据库路径</span>
        <input name="databasePath" value="${escapeAttribute(cmo.databasePath || "data/DB3K_510.db3")}" maxlength="500" ${writable ? "" : "disabled"} placeholder="相对项目根目录或绝对路径，如 data/DB3K_510.db3">
      </label>
      <p class="admin-key-notice">默认使用项目内 <code>data/DB3K_510.db3</code>。可指向本机 CMO 安装目录中的 DB3K 文件；路径变更后点「探测」验证，再保存。</p>
      ${probeText ? `<p class="planning-meta">${escapeHtml(probeText)}</p>` : ""}
      <div class="editor-actions">
        <button class="quiet-button" type="button" data-action="cmo-probe" ${!writable || state.cmoSaving ? "disabled" : ""}>探测连接</button>
        <button type="submit" ${state.cmoSaving || !writable ? "disabled" : ""}>${state.cmoSaving ? "正在保存" : "保存数据库配置"}</button>
      </div>
    </form>
  </section>`;
}

function renderThemePanel(theme = {}, writable) {
  const fields = [
    ["background", "工作区背景"], ["panel", "面板底色"], ["text", "主文字"],
    ["muted", "辅助文字"], ["primary", "主操作色"], ["accent", "强调色"]
  ];
  return `<section class="surface surface-pad admin-theme-panel"><div class="section-heading"><div><h2>主题配色</h2><p>全站样式由 styles.css 统一定义；此处仅覆盖主题变量。</p></div><span class="status-tag">当前主题</span></div><form id="adminThemeForm" class="theme-config-form">${fields.map(([name, label]) => `<label><span>${label}</span><input name="${name}" type="color" value="${escapeAttribute(theme[name] || "#020617")}" ${writable ? "" : "disabled"}></label>`).join("")}<div class="editor-actions"><button class="quiet-button" type="button" data-action="theme-reset" ${writable ? "" : "disabled"}>恢复默认</button><button type="submit" ${state.themeSaving || !writable ? "disabled" : ""}>${state.themeSaving ? "正在保存" : "保存配色"}</button></div></form></section>`;
}

async function saveCmo(event) {
  event.preventDefault();
  state = { ...state, cmoSaving: true }; render();
  try {
    const values = new FormData(event.currentTarget);
    const cmo = await saveCmoDatabaseConfig({
      enabled: values.get("enabled") !== "false",
      databasePath: values.get("databasePath")
    });
    state = { ...state, cmo, cmoProbe: null };
    notify(cmo.status?.open ? "CMO 数据库配置已保存并连接" : "配置已保存，但数据库未打开，请检查路径");
  } catch (error) {
    notify(error.message || "CMO 数据库配置保存失败");
  }
  state = { ...state, cmoSaving: false }; render();
}

async function probeCmo() {
  const input = root.querySelector("#adminCmoConfigForm [name='databasePath']");
  const databasePath = input?.value || state.cmo?.databasePath || "";
  try {
    const result = await probeCmoDatabase(databasePath);
    state = { ...state, cmoProbe: result };
    notify(result.ok ? "探测成功" : "探测失败");
  } catch (error) {
    state = { ...state, cmoProbe: { ok: false, error: error.message || "探测失败" } };
    notify(error.message || "探测失败");
  }
  render();
}

async function saveTheme(event) {
  event.preventDefault();
  state = { ...state, themeSaving: true }; render();
  try {
    const values = new FormData(event.currentTarget);
    const response = await saveThemeConfig(Object.fromEntries(["background", "panel", "text", "muted", "primary", "accent"].map((name) => [name, values.get(name)])));
    state = { ...state, theme: response.theme };
    applyTheme(response.theme);
    notify("主题配色已保存");
  } catch (error) { notify(error.message || "主题配色保存失败"); }
  state = { ...state, themeSaving: false }; render();
}

function resetThemeForm() {
  const defaults = { background: "#020617", panel: "#0e1a17", text: "#e6fff5", muted: "#a8bdb4", primary: "#3b82f6", accent: "#22d3ee" };
  Object.entries(defaults).forEach(([name, value]) => {
    const input = root.querySelector(`#adminThemeForm [name="${name}"]`);
    if (input) input.value = value;
  });
}

void load();

import { createDeploymentMessage, deploymentMessageTypes, isDeploymentMessage } from "./src/deploymentProtocol.js";

const map = document.querySelector("#toolMap");
const status = document.querySelector("#toolStatus");
const selectedLabel = document.querySelector("#selectedEntity");
const parentOrigin = document.referrer ? new URL(document.referrer).origin : window.location.origin;
let deploymentData = null;
let exchange = null;
let selectedEntityId = "";

window.addEventListener("message", (event) => {
  if (event.origin !== parentOrigin || !isDeploymentMessage(event.data, deploymentMessageTypes.load)) return;
  deploymentData = event.data.payload?.deploymentData || null;
  exchange = event.data.payload?.exchange || null;
  selectedEntityId = deploymentData?.entities?.[0]?.id || "";
  status.textContent = deploymentData ? "已加载" : "等待数据";
  render();
});

window.parent.postMessage(createDeploymentMessage(deploymentMessageTypes.ready), parentOrigin);

map.addEventListener("click", (event) => {
  const entityId = event.target.closest("[data-entity]")?.dataset.entity;
  if (!entityId) return;
  selectedEntityId = entityId;
  render();
});

document.querySelectorAll("[data-nudge]").forEach((button) => {
  button.addEventListener("click", () => nudge(button.dataset.nudge));
});

function nudge(rawDelta) {
  if (!deploymentData || !selectedEntityId) return;
  const [x, y] = rawDelta.split(",").map(Number);
  const entity = deploymentData.entities.find((item) => item.id === selectedEntityId);
  if (!entity) return;
  entity.position = [clamp(entity.position[0] + x), clamp(entity.position[1] + y)];
  window.parent.postMessage(createDeploymentMessage(deploymentMessageTypes.change, {
    scenarioId: deploymentData.scenarioId,
    exchangeId: exchange?.id || "",
    changeId: createChangeId(),
    changes: [{ entityId: entity.id, position: entity.position }]
  }), parentOrigin);
  render();
}

function render() {
  if (!deploymentData) {
    map.innerHTML = `<p>等待工作台推送态势。</p>`;
    selectedLabel.textContent = "选择实体";
    return;
  }
  const selected = deploymentData.entities.find((item) => item.id === selectedEntityId);
  selectedLabel.textContent = selected ? selected.label : "选择实体";
  map.innerHTML = deploymentData.entities.map((entity) => `
    <button class="tool-entity ${entity.role} ${entity.id === selectedEntityId ? "selected" : ""}" data-entity="${entity.id}" style="left:${entity.position[0]}%;top:${entity.position[1]}%">${glyph(entity.role)}</button>
  `).join("");
}

function glyph(role) {
  return { sensor: "感", command: "指", action: "行", support: "保", opponent: "蓝" }[role] || "单";
}

function clamp(value) {
  return Math.min(96, Math.max(4, value));
}

function createChangeId() {
  return globalThis.crypto?.randomUUID?.() || `deployment-change-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

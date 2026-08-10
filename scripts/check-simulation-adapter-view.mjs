import { renderSimulationAdapter } from "../design-studio/src/simulationAdapterView.js";

const html = renderSimulationAdapter({
  scenario: { simulation: { runs: [{ id: "run-local", adapter: { id: "local-abstract-grid", name: "本地抽象网格评估", version: "v1" }, packageId: "package-local", submittedAt: "2026-07-14T00:00:00.000Z", status: "result-recorded", result: { status: "completed", summary: "Abstract run", metrics: [{ label: "区域覆盖一致性", value: 48, unit: "%" }] } }] } },
  simulationAdapterSettings: {}
});
assert(html.includes("运行本地抽象评估") && html.includes("区域覆盖一致性") && html.includes("48") && html.includes("simulation-run-metrics"), "Simulation adapter view did not render local-run metrics");
const returnForm = renderSimulationAdapter({ scenario: { simulation: { runs: [{ id: "manual-run", input: { inputFingerprint: "sim-input-expected" }, adapter: { id: "manual", name: "Manual", version: "v1" }, packageId: "package-manual", submittedAt: "2026-07-14T00:00:00.000Z", status: "exported", result: null }] } }, simulationAdapterSettings: {} });
assert(returnForm.includes('name="inputFingerprint"') && returnForm.includes("从已导出的抽象输入 JSON 粘贴") && !returnForm.includes('type="hidden" name="inputFingerprint"'), "Manual return form did not require explicit input-fingerprint provenance");
console.log("Simulation adapter view acceptance passed: local metrics rendered.");

function assert(condition, message) { if (!condition) throw new Error(message); }

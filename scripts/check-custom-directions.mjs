import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDirectionProposals, normalizeCustomDirections } from "../design-studio/src/directionProposalStore.js";
import { createInspirationSession } from "../design-studio/src/inspirationStore.js";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

const custom = normalizeCustomDirections([
  { title: "弹性协同", text: "按信息变化调整协同节奏。", basis: "研究假设与资源边界。" },
  { title: "弹性协同", text: "Duplicate", basis: "Duplicate" },
  { title: "缺少依据", text: "This must be excluded." }
]);
assert(custom.length === 1 && custom[0].custom, "Custom directions were not normalized or deduplicated");
const proposals = buildDirectionProposals({ session: createInspirationSession(), fallbackDirections: [{ title: "默认方向", text: "Default" }], customDirections: custom });
assert(proposals.some((item) => item.title === "弹性协同"), "Custom direction was not included with default proposals");

const directory = await mkdtemp(join(tmpdir(), "combat-concept-custom-directions-"));
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json") });
const brief = { objective: "Research target", approach: "Reviewable approach", assumptions: "Abstract inputs", risk: "Evidence gap" };
try {
  const saved = await repository.saveBrief("default", { brief, direction: custom[0].title, directions: custom, source: "manual" });
  assert(saved.directions.length === 1 && saved.directions[0].basis === custom[0].basis, "Repository did not return the custom direction");
  const reopened = createFileProjectRepository({ filePath: join(directory, "projects.json") });
  const restored = await reopened.getBrief("default");
  assert(restored.direction === "弹性协同" && restored.directions[0].title === "弹性协同", "Custom direction did not survive repository reload");
  console.log("Custom directions acceptance passed: normalize, proposal, persistence, and reload.");
} finally {
  repository.close();
  await rm(directory, { recursive: true, force: true });
}

function assert(condition, message) { if (!condition) throw new Error(message); }

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-inspiration-persistence-"));
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json") });
const brief = { objective: "Study boundary", approach: "Traceable review", assumptions: "Abstract inputs", risk: "Incomplete evidence" };
try {
  const initial = await repository.saveBrief("default", {
    direction: "Reviewable concept",
    source: "manual",
    brief,
    inspiration: {
      stage: 2,
      totalStages: 6,
      completed: false,
      summary: "Research idea and environment are recorded.",
      messages: [
        { role: "assistant", topic: "idea", source: "local", text: "Describe the research idea.", createdAt: "2026-07-15T00:00:00.000Z", ignored: "not persisted" },
        { role: "user", topic: "idea", source: "remote", text: "Review a resilient decision loop.", createdAt: "2026-07-15T00:00:01.000Z" }
      ]
    }
  });
  assert(initial.revision === 1 && initial.inspiration?.messages.length === 2, "Brief save did not return the inspiration snapshot");
  assert(!Object.hasOwn(initial.inspiration.messages[0], "ignored") && initial.inspiration.messages[1].source === "", "Inspiration snapshot did not remove unsupported fields or source values");

  const unchanged = await repository.saveBrief("default", { direction: initial.direction, source: "manual", brief, inspiration: initial.inspiration });
  assert(unchanged.revision === 1, "Unchanged brief and inspiration snapshot created a revision");

  const expanded = await repository.saveBrief("default", {
    direction: initial.direction,
    source: "manual",
    expectedRevision: 1,
    brief,
    inspiration: {
      stage: 6,
      totalStages: 9,
      completed: true,
      summary: "Completed trace.",
      messages: Array.from({ length: 18 }, (_, index) => ({ role: index % 2 ? "user" : "assistant", topic: "supplement", source: "local", text: `Message ${index + 1}`, createdAt: `2026-07-15T00:00:${String(index).padStart(2, "0")}.000Z` }))
    }
  });
  assert(expanded.revision === 2 && expanded.inspiration.messages.length === 16 && expanded.inspiration.totalStages === 6 && expanded.inspiration.completed, "Inspiration snapshot bounds were not enforced");

  const reopened = createFileProjectRepository({ filePath: join(directory, "projects.json") });
  const restored = await reopened.getBrief("default");
  assert(restored.inspiration?.summary === "Completed trace." && restored.inspiration.messages[0].text === "Message 3", "Inspiration snapshot did not survive project repository reload");
  console.log("Project inspiration persistence acceptance passed: bounded brief-linked trace, revision control, and reload.");
} finally {
  repository.close();
  await rm(directory, { recursive: true, force: true });
}

function assert(condition, message) { if (!condition) throw new Error(message); }

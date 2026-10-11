import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { purgeProjectClientStorage } from "../design-studio/src/clientStoragePurge.js";
import { createRuntime } from "../server/createRuntime.mjs";
import { createRequestHandler } from "../server/createRequestHandler.mjs";

const directory = await mkdtemp(join(tmpdir(), "combat-concept-reset-test-"));
const filePath = join(directory, "projects.json");
const databasePath = join(directory, "projects.sqlite");
let tick = 0;

// Test SQLite mode repository
const repository = createFileProjectRepository({
  filePath,
  databasePath,
  now: () => `2026-10-11T00:00:0${++tick}.000Z`
});

let testServer = null;

try {
  console.log("1. Initializing SQLite test project with brief and models...");
  await repository.saveBrief("default", {
    direction: "全域协同",
    source: "manual",
    brief: {
      researchIntent: "验证意图",
      objective: "建立制空制海综合优势",
      approach: "分布式杀伤网",
      assumptions: "全域通信连通",
      expectedEffects: "压制敌方雷达",
      risk: "电子干扰"
    }
  });

  await repository.savePhaseActionConcept("default", {
    source: "manual",
    model: {
      phases: [
        { id: "phase-1", name: "塑势", actions: ["早期预警", "部署巡逻"] },
        { id: "phase-2", name: "突击", actions: ["远程打击"] }
      ]
    }
  });

  await repository.saveForceMissionPlan("default", {
    source: "manual",
    model: {
      forces: [{ id: "force-1", name: "无人侦察机编队" }],
      tasks: [{ id: "task-1", name: "战区侦察" }]
    }
  });

  await repository.saveOv1("default", {
    source: "manual",
    model: {
      title: "高层作战概念",
      nodes: [{ id: "node-1", label: "指挥所" }]
    }
  });

  // Verify resources exist before reset
  const briefBefore = await repository.getBrief("default");
  assert.equal(briefBefore.brief.objective, "建立制空制海综合优势");
  const phaseBefore = await repository.getPhaseActionConcept("default");
  assert.equal(phaseBefore.exists, true);
  const forceBefore = await repository.getForceMissionPlan("default");
  assert.equal(forceBefore.exists, true);
  const ov1Before = await repository.getOv1("default");
  assert.equal(ov1Before.exists, true);

  console.log("2. Executing repository.resetProject('default')...");
  const resetResult = await repository.resetProject("default", {
    source: "web-ui"
  });
  assert.equal(resetResult.reset, true);
  assert.equal(resetResult.projectId, "default");

  console.log("3. Verifying all design resources are cleared...");
  const briefAfter = await repository.getBrief("default");
  assert.equal(briefAfter.brief.objective, "待补充");
  assert.equal(briefAfter.brief.researchIntent, "");
  assert.equal(briefAfter.direction, "未选择方向");
  assert.deepEqual(briefAfter.directions, []);

  const phaseAfter = await repository.getPhaseActionConcept("default");
  assert.equal(phaseAfter.exists, false);
  assert.equal(phaseAfter.model, null);

  const forceAfter = await repository.getForceMissionPlan("default");
  assert.equal(forceAfter.exists, false);
  assert.equal(forceAfter.model, null);

  const ov1After = await repository.getOv1("default");
  assert.equal(ov1After.exists, false);
  assert.equal(ov1After.model, null);

  // Check audit trail contains project.reset
  const audits = await repository.listAudit("default", 10);
  assert.ok(audits.entries.some((e) => e.action === "project.reset"), "Audit trail must record project.reset");

  // Re-open repository to test persistence survives reload
  repository.close();
  const reopened = createFileProjectRepository({
    filePath,
    databasePath,
    now: () => `2026-10-11T00:00:0${++tick}.000Z`
  });
  const reopenedBrief = await reopened.getBrief("default");
  assert.equal(reopenedBrief.brief.objective, "待补充");
  const reopenedPhase = await reopened.getPhaseActionConcept("default");
  assert.equal(reopenedPhase.exists, false);
  reopened.close();

  console.log("4. Verifying purgeProjectClientStorage...");
  const fakeStore = new Map();
  fakeStore.set("combat-concept-client-storage-epoch", "wipe-2026-08-11-full-3");
  fakeStore.set("concept-studio-brief-v1", '{"brief":"default"}');
  fakeStore.set("concept-studio-brief-v1:p2", '{"brief":"p2"}');
  fakeStore.set("concept-studio-phase-action-v1:default", '{"phases":[]}');
  fakeStore.set("concept-studio-phase-action-v1:p2", '{"phases":[]}');

  // Attach mock global localStorage
  globalThis.localStorage = {
    length: fakeStore.size,
    key(i) { return Array.from(fakeStore.keys())[i]; },
    removeItem(k) { fakeStore.delete(k); },
    getItem(k) { return fakeStore.get(k); }
  };
  Object.defineProperty(globalThis.localStorage, "length", {
    get: () => fakeStore.size
  });

  const removed = purgeProjectClientStorage("default");
  assert.ok(removed.includes("concept-studio-brief-v1"));
  assert.ok(removed.includes("concept-studio-phase-action-v1:default"));
  assert.equal(fakeStore.has("concept-studio-brief-v1:p2"), true, "p2 draft should be kept");
  assert.equal(fakeStore.has("concept-studio-phase-action-v1:p2"), true, "p2 phase should be kept");

  console.log("5. Verifying POST /api/projects/:id/reset over HTTP...");
  const runtime = await createRuntime();
  const handler = createRequestHandler(runtime);
  testServer = createServer(handler);
  await new Promise((resolve) => testServer.listen(0, "127.0.0.1", resolve));
  const port = testServer.address().port;

  const httpRes = await fetch(`http://127.0.0.1:${port}/api/projects/default/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  assert.equal(httpRes.status, 200, `POST /api/projects/default/reset must return 200, got ${httpRes.status}`);
  const httpBody = await httpRes.json();
  assert.equal(httpBody.reset, true);
  assert.equal(httpBody.projectId, "default");

  console.log("PASS: check-project-reset succeeded with SQLite durability and HTTP API verification!");
} finally {
  repository.close?.();
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }
  await rm(directory, { recursive: true, force: true });
}

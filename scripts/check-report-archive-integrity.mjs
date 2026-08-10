import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileProjectRepository } from "../server/projectRepository.mjs";
import { createReportIntegrity } from "../server/projectReportIntegrity.mjs";

const directory = await mkdtemp(join(tmpdir(), "combat-report-integrity-"));
const repository = createFileProjectRepository({ filePath: join(directory, "projects.json") });
const payload = { project: { title: "Integrity" }, reportTemplate: { id: "research-standard" }, generatedAt: "2026-07-15T00:00:00.000Z" };
payload.reportIntegrity = await createReportIntegrity(payload);

try {
  const saved = await repository.createReportArchive("default", { item: { id: "report-version-integrity", title: "Integrity", payload } });
  assert(saved.item?.payload?.reportIntegrity?.digest === payload.reportIntegrity.digest, "Repository did not retain a valid report integrity manifest");
  let rejected = null;
  try {
    await repository.createReportArchive("default", { item: { id: "report-version-tampered", title: "Tampered", payload: { ...payload, project: { title: "Changed" } } } });
  } catch (error) { rejected = error; }
  assert(rejected?.message.includes("integrity manifest"), "Repository accepted a report archive with mismatched integrity manifest");
  console.log("Report archive integrity acceptance passed: valid manifest retained and tampered payload rejected.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

function assert(condition, message) { if (!condition) throw new Error(message); }

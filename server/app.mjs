import http from "node:http";
import { createRuntime } from "./createRuntime.mjs";
import { createRequestHandler } from "./createRequestHandler.mjs";
import { ensureConceptMapToolStarted } from "./conceptMapToolProcess.mjs";

const runtime = await createRuntime();
const handleRequest = createRequestHandler(runtime);
const server = http.createServer(handleRequest);
let stopping = false;

server.listen(runtime.port, "127.0.0.1", () => {
  console.log(`Workbench server: http://127.0.0.1:${runtime.port}/`);
  // Concept drawing tool is a separate process; do not couple lifecycle to workbench.
  void ensureConceptMapToolStarted().then((result) => {
    if (result.status === "started") {
      console.log(`Concept map tool: http://${result.host}:${result.port}/ (started pid=${result.pid || "?"})`);
      return;
    }
    if (result.status === "already-running") {
      console.log(`Concept map tool: http://${result.host}:${result.port}/ (already running)`);
      return;
    }
    if (result.status === "disabled") {
      console.log("Concept map tool: auto-start disabled (CONCEPT_MAP_TOOL_ENABLED=false)");
      return;
    }
    console.warn(`Concept map tool: ${result.status}${result.detail ? ` — ${result.detail}` : ""}`);
  }).catch((error) => {
    console.warn(`Concept map tool: failed to start — ${error?.message || error}`);
  });
});

server.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => { void shutdown(signal === "SIGINT" ? 130 : 0); });
}

async function shutdown(exitCode) {
  if (stopping) return;
  stopping = true;
  // Leave the concept drawing tool running; processes must not affect each other.
  server.close(() => process.exit(exitCode));
  setTimeout(() => process.exit(exitCode), 2000).unref();
}

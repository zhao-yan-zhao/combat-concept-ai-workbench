import { generateMockOutput } from "../../shared/generator.js";
import { readJson, send, sendJson } from "../httpUtils.mjs";
import { randomUUID } from "node:crypto";

export function createAiHandlers(runtime) {
  const { getAiApiKey, getAiServiceConfig, localIdentity, openAi } = runtime;
  const { callOpenAi, streamOpenAi, callOpenAiRedTeam, mergeAiDraft } = openAi;
  const generationJobs = new Map();

  async function handleCreateGenerateJob(request, response) {
    if (!getAiApiKey()) {
      send(response, 503, "未配置 OPENAI_API_KEY，已由前端回退到 Demo 生成。", "text/plain;charset=utf-8");
      return;
    }
    const payload = await readJson(request);
    const binding = await resolveJobBinding(request, payload);
    const job = {
      id: randomUUID(),
      input: payload.input,
      ...binding,
      events: [],
      listeners: new Set(),
      done: false,
      createdAt: Date.now()
    };
    generationJobs.set(job.id, job);
    void runGenerationJob(job);
    sendJson(response, 202, { jobId: job.id, status: "running" });
  }

  async function handleGenerateJobStream(request, response, jobId, after = 0, metadata = {}) {
    const job = generationJobs.get(jobId);
    if (!job) {
      sendJson(response, 404, { error: "Generation job not found or expired" });
      return;
    }
    const binding = await resolveJobBinding(request, metadata);
    if (job.projectId !== binding.projectId || job.scope !== binding.scope || job.ownerKey !== binding.ownerKey) {
      sendJson(response, 403, { error: "Generation job does not belong to this project, user, or step" });
      return;
    }
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    const write = (event) => response.write(`id: ${event.sequence}\ndata: ${JSON.stringify(event.payload)}\n\n`);
    job.events.filter((event) => event.sequence > after).forEach(write);
    if (job.done) {
      response.end();
      return;
    }
    const listener = { write, end: () => response.end() };
    job.listeners.add(listener);
    response.on("close", () => job.listeners.delete(listener));
  }

  async function runGenerationJob(job) {
    const input = job.input;
    const base = generateMockOutput({
      workflow: input.workflow,
      analysis: input.analysis || {},
      evidence: input.evidence || []
    });
    publish(job, { type: "start", jobId: job.id, model: getAiServiceConfig().model });
    try {
      let lastAssembled = "";
      for await (const chunk of streamOpenAi(input, base)) {
        if (chunk.type === "delta") {
          lastAssembled = chunk.assembled || (lastAssembled + (chunk.text || ""));
          publish(job, {
            type: "delta",
            text: chunk.text || "",
            assembled: lastAssembled,
            preview: extractAdvicePreview(lastAssembled)
          });
        } else if (chunk.type === "done") {
          publish(job, { type: "done", output: mergeAiDraft(base, chunk.draft) });
        }
      }
    } catch (error) {
      try {
        const aiDraft = await callOpenAi(input, base);
        publish(job, { type: "done", output: mergeAiDraft(base, aiDraft), fallback: "sync" });
      } catch (fallbackError) {
        publish(job, { type: "error", message: String(fallbackError?.message || error?.message || "AI 流式生成失败") });
      }
    } finally {
      job.done = true;
      for (const listener of job.listeners) listener.end();
      job.listeners.clear();
      setTimeout(() => generationJobs.delete(job.id), 10 * 60 * 1000).unref?.();
    }
  }

  function publish(job, payload) {
    const event = { sequence: job.events.length + 1, payload };
    job.events.push(event);
    for (const listener of job.listeners) listener.write(event);
  }

  async function resolveJobBinding(request, value) {
    const projectId = normalizeBindingValue(value?.projectId, "projectId", 160);
    const scope = normalizeBindingValue(value?.scope, "scope", 80);
    const session = localIdentity ? await localIdentity.getSession(request) : null;
    if (session?.authenticated && session.actor?.id) {
      return { projectId, scope, ownerKey: `actor:${session.actor.id}` };
    }
    const clientId = normalizeBindingValue(request.headers["x-workbench-client-id"], "clientId", 128);
    return { projectId, scope, ownerKey: `client:${clientId}` };
  }

  async function handleGenerate(request, response) {
    if (!getAiApiKey()) {
      send(response, 503, "未配置 OPENAI_API_KEY，已由前端回退到 Demo 生成。", "text/plain;charset=utf-8");
      return;
    }

    try {
      const input = await readJson(request);
      const base = generateMockOutput({
        workflow: input.workflow,
        analysis: input.analysis || {},
        evidence: input.evidence || []
      });
      const aiDraft = await callOpenAi(input, base);
      const output = mergeAiDraft(base, aiDraft);
      send(response, 200, JSON.stringify(output), "application/json;charset=utf-8");
    } catch (error) {
      const status = Number(error?.statusCode) || 500;
      const message = String(error?.message || "AI 生成失败").slice(0, 1200);
      send(response, status, message, "text/plain;charset=utf-8");
    }
  }

  /** SSE stream: start → delta* → done|error */
  async function handleGenerateStream(request, response) {
    if (!getAiApiKey()) {
      send(response, 503, "未配置 OPENAI_API_KEY，已由前端回退到 Demo 生成。", "text/plain;charset=utf-8");
      return;
    }

    const input = await readJson(request);
    const base = generateMockOutput({
      workflow: input.workflow,
      analysis: input.analysis || {},
      evidence: input.evidence || []
    });

    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    const writeEvent = (payload) => {
      response.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    writeEvent({ type: "start", model: getAiServiceConfig().model });
    try {
      let lastAssembled = "";
      for await (const chunk of streamOpenAi(input, base)) {
        if (chunk.type === "delta") {
          lastAssembled = chunk.assembled || (lastAssembled + (chunk.text || ""));
          writeEvent({
            type: "delta",
            text: chunk.text || "",
            assembled: lastAssembled,
            preview: extractAdvicePreview(lastAssembled)
          });
          continue;
        }
        if (chunk.type === "done") {
          const output = mergeAiDraft(base, chunk.draft);
          writeEvent({ type: "done", output });
        }
      }
    } catch (error) {
      // Fall back to non-stream call so clients still get a complete payload when possible.
      try {
        const aiDraft = await callOpenAi(input, base);
        const output = mergeAiDraft(base, aiDraft);
        writeEvent({ type: "done", output, fallback: "sync" });
      } catch (fallbackError) {
        writeEvent({
          type: "error",
          message: String(fallbackError?.message || error?.message || "AI 流式生成失败")
        });
      }
    }
    response.end();
  }

  async function handleRedTeam(request, response) {
    if (!getAiApiKey()) {
      send(response, 503, "未配置 OPENAI_API_KEY，客户端将回退到本地规则质询。", "text/plain;charset=utf-8");
      return;
    }

    const input = await readJson(request);
    const review = await callOpenAiRedTeam(input);
    sendJson(response, 200, {
      provider: "openai",
      model: getAiServiceConfig().model,
      review: {
        ...review,
        mode: "ai",
        generatedAt: new Date().toISOString()
      }
    });
  }

  return { handleGenerate, handleGenerateStream, handleCreateGenerateJob, handleGenerateJobStream, handleRedTeam };
}

/** Best-effort preview of summary/coreIdea while JSON is still streaming. */
function extractAdvicePreview(buffer) {
  const text = String(buffer || "");
  const complete = text.match(/"(?:answer|summary|coreIdea)"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (complete) return unescapeJsonString(complete[1]);
  const partial = text.match(/"(?:answer|summary|coreIdea)"\s*:\s*"((?:\\.|[^"\\])*)$/);
  if (partial) return unescapeJsonString(partial[1]);
  return "";
}

function unescapeJsonString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return String(value || "")
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\");
  }
}

function normalizeBindingValue(value, label, maximum) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum || !/^[a-zA-Z0-9._:-]+$/.test(normalized)) {
    const error = new Error(`Invalid generation job ${label}`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

export async function generateWithAi(input) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `AI 接口返回 ${response.status}`);
  }

  return response.json();
}

/**
 * Stream AI generation via SSE.
 * @param {object} input same as generateWithAi
 * @param {{ onDelta?: (payload: { text: string, assembled: string, preview: string }) => void, onStart?: (payload: object) => void, signal?: AbortSignal }} [options]
 * @returns {Promise<object>} final output (same shape as generateWithAi)
 */
export async function generateWithAiStream(input, options = {}) {
  if (options.durable) return generateWithDurableAiStream(input, options);
  const { onDelta, onStart, onThinking, signal } = options;
  const response = await fetch("/api/generate/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    },
    body: JSON.stringify(input),
    signal
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `AI 流式接口返回 ${response.status}`);
  }

  return readAiStreamResponse(response, input, { onDelta, onStart, onThinking, signal });
}

async function generateWithDurableAiStream(input, options = {}) {
  const { onDelta, onStart, onThinking, onJob, signal, resumeJobId = "", projectId, scope } = options;
  const binding = normalizeJobBinding(projectId, scope);
  const clientId = getWorkbenchClientId();
  let jobId = String(resumeJobId || "").trim();
  if (!jobId) {
    const created = await fetch("/api/generate/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Workbench-Client-Id": clientId
      },
      body: JSON.stringify({ input, ...binding }),
      signal
    });
    if (!created.ok) throw new Error(await created.text() || `AI 任务创建失败 (${created.status})`);
    const payload = await created.json();
    jobId = String(payload?.jobId || "").trim();
    if (!jobId) throw new Error("AI 任务未返回可重连标识");
    onJob?.({ jobId });
  }
  const query = new URLSearchParams(binding);
  const response = await fetch(`/api/generate/jobs/${encodeURIComponent(jobId)}/stream?${query}`, {
    method: "GET",
    headers: { Accept: "text/event-stream", "X-Workbench-Client-Id": clientId },
    signal
  });
  if (!response.ok) throw new Error(await response.text() || `AI 任务重连失败 (${response.status})`);
  return readAiStreamResponse(response, input, { onDelta, onStart, signal });
}

function normalizeJobBinding(projectId, scope) {
  const normalizedProjectId = String(projectId || "").trim();
  const normalizedScope = String(scope || "").trim();
  if (!normalizedProjectId || !normalizedScope) {
    throw new Error("持久生成任务缺少项目或步骤标识");
  }
  return { projectId: normalizedProjectId, scope: normalizedScope };
}

function getWorkbenchClientId() {
  const storageKey = "combat-concept-workbench-client-id";
  try {
    let value = String(globalThis.localStorage?.getItem(storageKey) || "").trim();
    if (!/^[a-zA-Z0-9_-]{16,128}$/.test(value)) {
      value = globalThis.crypto?.randomUUID?.() || `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      globalThis.localStorage?.setItem(storageKey, value);
    }
    return value;
  } catch {
    return globalThis.crypto?.randomUUID?.() || `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

async function readAiStreamResponse(response, input, { onDelta, onStart, onThinking, signal } = {}) {

  // Gateway returned plain JSON (non-SSE).
  const contentType = String(response.headers.get("content-type") || "");
  if (contentType.includes("application/json")) {
    return response.json();
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    // Fallback if stream reader unavailable.
    return generateWithAi(input);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalOutput = null;
  let streamError = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() || "";
    for (const part of parts) {
      const dataLines = part.split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      if (!dataLines.length) continue;
      const raw = dataLines.join("\n");
      if (!raw || raw === "[DONE]") continue;
      let event;
      try {
        event = JSON.parse(raw);
      } catch {
        continue;
      }
      if (event.type === "start") {
        onStart?.(event);
        continue;
      }
      if (event.type === "thinking") {
        onThinking?.(event);
        onDelta?.({
          thinking: event.text || "",
          thinkingAssembled: event.assembled || ""
        });
        continue;
      }
      if (event.type === "delta") {
        onDelta?.({
          text: event.text || "",
          assembled: event.assembled || "",
          preview: event.preview || ""
        });
        continue;
      }
      if (event.type === "done" && event.output) {
        finalOutput = event.output;
        continue;
      }
      if (event.type === "error") {
        streamError = event.message || "AI 流式生成失败";
      }
    }
  }

  if (finalOutput) return finalOutput;
  if (streamError) throw new Error(streamError);
  // Last resort: non-stream request.
  return generateWithAi(input);
}

export async function getAiHealth() {
  const response = await fetch("/api/health", {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`AI 健康检查返回 ${response.status}`);
  }

  return response.json();
}

export function isAiOutput(value) {
  return Boolean(
    value
    && typeof value === "object"
    && value.result
    && value.outputSchema
    && value.markdown
    && value.evaluation
  );
}

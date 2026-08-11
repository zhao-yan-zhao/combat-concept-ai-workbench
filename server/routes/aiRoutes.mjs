import { generateMockOutput } from "../../shared/generator.js";
import { readJson, send, sendJson } from "../httpUtils.mjs";

export function createAiHandlers(runtime) {
  const { getAiApiKey, getAiServiceConfig, openAi } = runtime;
  const { callOpenAi, streamOpenAi, callOpenAiRedTeam, mergeAiDraft } = openAi;

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

  return { handleGenerate, handleGenerateStream, handleRedTeam };
}

/** Best-effort preview of summary/coreIdea while JSON is still streaming. */
function extractAdvicePreview(buffer) {
  const text = String(buffer || "");
  const complete = text.match(/"(?:summary|coreIdea)"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (complete) return unescapeJsonString(complete[1]);
  const partial = text.match(/"(?:summary|coreIdea)"\s*:\s*"((?:\\.|[^"\\])*)$/);
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

import { spawn } from "node:child_process";

export async function readJson(request, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let timer = null;
    let settled = false;

    function cleanup() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      request.removeListener("data", onData);
      request.removeListener("end", onEnd);
      request.removeListener("error", onError);
      request.removeListener("close", onClose);
    }

    function onData(chunk) {
      chunks.push(chunk);
    }

    function onEnd() {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        const text = Buffer.concat(chunks).toString("utf8").trim();
        resolve(text ? JSON.parse(text) : {});
      } catch (err) {
        const parseError = new Error(`JSON 解析失败: ${err.message}`);
        parseError.statusCode = 400;
        reject(parseError);
      }
    }

    function onError(err) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    }

    function onClose() {
      if (settled) return;
      settled = true;
      cleanup();
      if (!request.readableEnded) {
        const err = new Error("请求连接在读取完成前关闭");
        err.statusCode = 400;
        reject(err);
      } else {
        onEnd();
      }
    }

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        const err = new Error(`读取请求体超时（超过 ${timeoutMs}ms）`);
        err.statusCode = 408;
        reject(err);
      }, timeoutMs);
    }

    request.on("data", onData);
    request.on("end", onEnd);
    request.on("error", onError);
    request.on("close", onClose);

    if (request.readableEnded) {
      onEnd();
    } else {
      request.resume();
    }
  });
}

export function decodeProjectId(value) {
  const projectId = decodeURIComponent(value || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(projectId)) throw new Error("项目标识无效");
  return projectId;
}

export function decodeHistoryItemId(value) {
  const itemId = decodeURIComponent(value || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,179}$/.test(itemId)) throw new Error("历史条目标识无效");
  return itemId;
}

export function decodeCollaborationUsername(value) {
  const username = decodeURIComponent(value || "");
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) throw new Error("协同用户名无效");
  return username;
}

export function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: false });
    let errorOutput = "";
    child.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(errorOutput.trim() || `Word 报告生成进程退出码 ${code}`));
    });
  });
}

export function send(response, status, body, contentType, headers = {}) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    ...headers
  });
  response.end(body);
}

export function sendJson(response, status, data, headers = {}) {
  send(response, status, JSON.stringify(data), "application/json;charset=utf-8", headers);
}

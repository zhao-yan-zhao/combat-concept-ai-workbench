import { spawn } from "node:child_process";

export async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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

import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { send } from "./httpUtils.mjs";

export function createStaticFileServer({ root, mimeTypes }) {
  return async function serveStatic(pathname, response, headOnly) {
    const requestedPath = pathname === "/"
      ? "/design-studio/index.html"
      : pathname === "/favicon.ico"
        ? "/design-studio/favicon.svg"
        : decodeURIComponent(pathname);
    const cleanPath = requestedPath.endsWith("/") ? `${requestedPath}index.html` : requestedPath;
    const target = normalize(join(root, cleanPath));
    if (!target.startsWith(root)) {
      send(response, 403, "Forbidden", "text/plain;charset=utf-8");
      return;
    }
    try {
      const content = await readFile(target);
      send(response, 200, headOnly ? "" : content, mimeTypes[extname(target)] || "application/octet-stream");
    } catch {
      send(response, 404, "File not found", "text/plain;charset=utf-8");
    }
  };
}

import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function toUrl(pathOrUrl) {
  if (pathOrUrl instanceof URL) return pathOrUrl;
  if (typeof pathOrUrl === "string" && (pathOrUrl.startsWith("file:") || pathOrUrl.startsWith("http:") || pathOrUrl.startsWith("https:"))) {
    return new URL(pathOrUrl);
  }
  return pathToFileURL(pathOrUrl);
}

export async function readFullCss(cssPath = new URL("../design-studio/styles.css", import.meta.url)) {
  const fileUrl = toUrl(cssPath);
  const content = await readFile(fileUrl, "utf8");
  const imports = [...content.matchAll(/@import\s+["'](\.\/styles\/[^"']+)["'];/g)];
  if (imports.length === 0) return content;
  let full = content;
  for (const match of imports) {
    const subUrl = new URL(match[1], fileUrl);
    full += "\n" + (await readFile(subUrl, "utf8"));
  }
  return full;
}

export function readFullCssSync(cssPath = new URL("../design-studio/styles.css", import.meta.url)) {
  const fileUrl = toUrl(cssPath);
  const content = readFileSync(fileUrl, "utf8");
  const imports = [...content.matchAll(/@import\s+["'](\.\/styles\/[^"']+)["'];/g)];
  if (imports.length === 0) return content;
  let full = content;
  for (const match of imports) {
    const subUrl = new URL(match[1], fileUrl);
    full += "\n" + readFileSync(subUrl, "utf8");
  }
  return full;
}

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn } from "node:child_process";

export function createAiSecretStore({ filePath } = {}) {
  if (!filePath) throw new Error("AI secret file path is required");
  return {
    async load() {
      try {
        const record = JSON.parse(await readFile(filePath, "utf8"));
        return await unprotect(record?.protectedValue);
      } catch (error) {
        if (error?.code === "ENOENT") return "";
        throw new Error("Stored AI key cannot be decrypted for this Windows user");
      }
    },
    async save(value) {
      const key = normalizeKey(value);
      const protectedValue = await protect(key);
      await mkdir(dirname(filePath), { recursive: true });
      const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temporary, `${JSON.stringify({ version: 1, protectedValue, updatedAt: new Date().toISOString() })}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, filePath);
      return true;
    }
  };
}

function normalizeKey(value) {
  const key = String(value || "").trim();
  if (key.length < 16 || key.length > 2048 || /[\r\n]/.test(key)) throw new Error("API Key format is invalid");
  return key;
}

function protect(value) { return runDpapi("protect", value); }
function unprotect(value) { return runDpapi("unprotect", String(value || "")); }

function runDpapi(mode, input) {
  const prefix = "$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;";
  const script = mode === "protect"
    ? `${prefix}$v=[Console]::In.ReadToEnd();$b=[Text.Encoding]::UTF8.GetBytes($v);[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))`
    : `${prefix}$v=[Console]::In.ReadToEnd();$b=[Convert]::FromBase64String($v);[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))`;
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = ""; let error = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", () => reject(new Error("Windows DPAPI is unavailable")));
    child.on("close", (code) => code === 0 && output.trim() ? resolve(output.trim()) : reject(new Error(error.trim() || "Windows DPAPI operation failed")));
    child.stdin.end(input, "utf8");
  });
}

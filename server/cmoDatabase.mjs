/**
 * Read-only access to Command: Modern Operations (CMO) DB3K SQLite catalogs.
 * DB3 files are standard SQLite with Data* platform tables and Enum* lookups.
 */

import { access } from "node:fs/promises";
import { isAbsolute, join, normalize } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { listCmoMissionTypes } from "../shared/cmoMissionTypes.js";

const DOMAIN_TABLES = Object.freeze({
  aircraft: "DataAircraft",
  ship: "DataShip",
  submarine: "DataSubmarine",
  ground: "DataGroundUnit",
  facility: "DataFacility",
  satellite: "DataSatellite"
});

const DOMAIN_CATEGORY_ENUM = Object.freeze({
  aircraft: "EnumAircraftCategory",
  ship: "EnumShipCategory",
  submarine: "EnumSubmarineCategory",
  ground: "EnumGroundUnitCategory",
  facility: "EnumFacilityCategory",
  satellite: "EnumSatelliteCategory"
});

export const DEFAULT_CMO_DATABASE_CONFIG = Object.freeze({
  enabled: true,
  databasePath: "data/DB3K_510.db3"
});

export function createCmoDatabaseService({ root, configPath }) {
  let config = { ...DEFAULT_CMO_DATABASE_CONFIG };
  let database = null;
  let openedPath = "";

  async function loadConfig() {
    try {
      config = normalizeCmoDatabaseConfig(JSON.parse(await readFile(configPath, "utf8")));
    } catch {
      config = { ...DEFAULT_CMO_DATABASE_CONFIG };
    }
    reopenIfNeeded();
    return getPublicConfig();
  }

  async function saveConfig(value) {
    config = normalizeCmoDatabaseConfig(value);
    await mkdir(dirname(configPath), { recursive: true });
    const temporaryPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await rename(temporaryPath, configPath);
    reopenIfNeeded();
    return getPublicConfig();
  }

  function getConfig() {
    return { ...config };
  }

  function getPublicConfig() {
    const status = getStatus();
    return {
      ...config,
      resolvedPath: status.resolvedPath,
      status
    };
  }

  function resolveDatabasePath(relativeOrAbsolute = config.databasePath) {
    const raw = String(relativeOrAbsolute || "").trim() || DEFAULT_CMO_DATABASE_CONFIG.databasePath;
    if (isAbsolute(raw)) return normalize(raw);
    return normalize(join(root, raw));
  }

  function reopenIfNeeded() {
    close();
    if (!config.enabled) return;
    const path = resolveDatabasePath();
    try {
      database = new DatabaseSync(path, { readOnly: true });
      openedPath = path;
      // Touch a known table to fail fast on non-CMO sqlite files.
      database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='DataAircraft' LIMIT 1").get();
    } catch {
      close();
    }
  }

  function close() {
    if (database) {
      try { database.close(); } catch { /* ignore */ }
    }
    database = null;
    openedPath = "";
  }

  function getStatus() {
    const resolvedPath = resolveDatabasePath();
    const open = Boolean(database);
    let tableCount = 0;
    let platformCounts = null;
    let databaseLabel = "";
    if (open) {
      try {
        tableCount = database.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table'").get()?.c || 0;
        platformCounts = Object.fromEntries(
          Object.entries(DOMAIN_TABLES).map(([domain, table]) => {
            try {
              return [domain, database.prepare(`SELECT COUNT(*) AS c FROM [${table}]`).get()?.c || 0];
            } catch {
              return [domain, 0];
            }
          })
        );
        const management = database.prepare("SELECT Description FROM ManagementDatabase ORDER BY ID LIMIT 1").get();
        databaseLabel = String(management?.Description || "");
      } catch {
        /* keep defaults */
      }
    }
    return {
      enabled: Boolean(config.enabled),
      configuredPath: config.databasePath,
      resolvedPath,
      open,
      openedPath: open ? openedPath : "",
      tableCount,
      platformCounts,
      databaseLabel,
      missionTypeCount: listCmoMissionTypes().length
    };
  }

  async function probePath(candidatePath) {
    const resolved = resolveDatabasePath(candidatePath);
    try {
      await access(resolved);
      const probe = new DatabaseSync(resolved, { readOnly: true });
      try {
        const aircraft = probe.prepare("SELECT COUNT(*) AS c FROM DataAircraft").get()?.c || 0;
        const ships = probe.prepare("SELECT COUNT(*) AS c FROM DataShip").get()?.c || 0;
        const label = probe.prepare("SELECT Description FROM ManagementDatabase ORDER BY ID LIMIT 1").get()?.Description || "";
        return {
          ok: true,
          resolvedPath: resolved,
          aircraftCount: aircraft,
          shipCount: ships,
          databaseLabel: String(label || "")
        };
      } finally {
        probe.close();
      }
    } catch (error) {
      return {
        ok: false,
        resolvedPath: resolved,
        error: error?.message || "无法打开数据库"
      };
    }
  }

  function ensureOpen() {
    if (!config.enabled) {
      const error = new Error("CMO 数据库已禁用");
      error.statusCode = 503;
      throw error;
    }
    if (!database) {
      reopenIfNeeded();
    }
    if (!database) {
      const error = new Error(`无法打开 CMO 数据库：${resolveDatabasePath()}`);
      error.statusCode = 503;
      throw error;
    }
    return database;
  }

  function listMissionTypes() {
    return listCmoMissionTypes();
  }

  function listCountries({ limit = 80, q = "" } = {}) {
    const db = ensureOpen();
    const query = String(q || "").trim();
    const max = clamp(limit, 1, 200);
    if (query) {
      return db.prepare(`
        SELECT ID AS id, Description AS name
        FROM EnumOperatorCountry
        WHERE Description LIKE ? ESCAPE '\\'
        ORDER BY Description
        LIMIT ?
      `).all(`%${escapeLike(query)}%`, max);
    }
    return db.prepare(`
      SELECT ID AS id, Description AS name
      FROM EnumOperatorCountry
      ORDER BY Description
      LIMIT ?
    `).all(max);
  }

  function searchPlatforms({
    q = "",
    domain = "",
    country = "",
    countryId = 0,
    limit = 20
  } = {}) {
    const db = ensureOpen();
    const query = String(q || "").trim();
    const max = clamp(limit, 1, 50);
    const domains = domain && DOMAIN_TABLES[domain]
      ? [domain]
      : Object.keys(DOMAIN_TABLES);
    const countryFilter = String(country || "").trim();
    const countryIdNum = Number(countryId) > 0 ? Math.trunc(Number(countryId)) : 0;
    const results = [];

    for (const domainKey of domains) {
      if (results.length >= max) break;
      const remaining = max - results.length;
      const table = DOMAIN_TABLES[domainKey];
      const categoryEnum = DOMAIN_CATEGORY_ENUM[domainKey];
      const params = [];
      const where = ["1=1"];
      if (query) {
        where.push("(p.Name LIKE ? ESCAPE '\\' OR IFNULL(p.Comments,'') LIKE ? ESCAPE '\\')");
        const like = `%${escapeLike(query)}%`;
        params.push(like, like);
      }
      if (countryIdNum) {
        where.push("p.OperatorCountry = ?");
        params.push(countryIdNum);
      } else if (countryFilter) {
        where.push("IFNULL(c.Description,'') LIKE ? ESCAPE '\\'");
        params.push(`%${escapeLike(countryFilter)}%`);
      }
      params.push(remaining);
      const sql = `
        SELECT
          p.ID AS cmoId,
          p.Name AS name,
          IFNULL(c.Description, '') AS country,
          IFNULL(cat.Description, '') AS category,
          IFNULL(p.YearCommissioned, 0) AS yearCommissioned,
          IFNULL(p.YearDecommissioned, 0) AS yearDecommissioned
        FROM [${table}] p
        LEFT JOIN EnumOperatorCountry c ON c.ID = p.OperatorCountry
        LEFT JOIN [${categoryEnum}] cat ON cat.ID = p.Category
        WHERE ${where.join(" AND ")}
        ORDER BY p.Name
        LIMIT ?
      `;
      const rows = db.prepare(sql).all(...params);
      for (const row of rows) {
        results.push({
          domain: domainKey,
          cmoId: Number(row.cmoId) || 0,
          name: String(row.name || ""),
          country: String(row.country || ""),
          category: String(row.category || ""),
          yearCommissioned: Number(row.yearCommissioned) || 0,
          yearDecommissioned: Number(row.yearDecommissioned) || 0
        });
      }
    }
    return results;
  }

  function getPlatform(domain, cmoId) {
    const db = ensureOpen();
    const table = DOMAIN_TABLES[domain];
    if (!table) return null;
    const categoryEnum = DOMAIN_CATEGORY_ENUM[domain];
    const id = Math.trunc(Number(cmoId) || 0);
    if (!id) return null;
    const row = db.prepare(`
      SELECT
        p.ID AS cmoId,
        p.Name AS name,
        IFNULL(c.Description, '') AS country,
        IFNULL(cat.Description, '') AS category,
        IFNULL(p.YearCommissioned, 0) AS yearCommissioned,
        IFNULL(p.YearDecommissioned, 0) AS yearDecommissioned,
        IFNULL(p.Comments, '') AS comments
      FROM [${table}] p
      LEFT JOIN EnumOperatorCountry c ON c.ID = p.OperatorCountry
      LEFT JOIN [${categoryEnum}] cat ON cat.ID = p.Category
      WHERE p.ID = ?
      LIMIT 1
    `).get(id);
    if (!row) return null;
    return {
      domain,
      cmoId: Number(row.cmoId) || 0,
      name: String(row.name || ""),
      country: String(row.country || ""),
      category: String(row.category || ""),
      yearCommissioned: Number(row.yearCommissioned) || 0,
      yearDecommissioned: Number(row.yearDecommissioned) || 0,
      comments: String(row.comments || "").slice(0, 200)
    };
  }

  /**
   * Compact catalog hint for AI drafting: mission types + a few platform samples
   * matched by free-text keywords from brief/phase content.
   */
  function buildGenerationHint({ keywords = [], limit = 12 } = {}) {
    const missionTypes = listCmoMissionTypes();
    const status = getStatus();
    if (!status.open) {
      return {
        available: false,
        reason: status.enabled ? "数据库未打开" : "数据库已禁用",
        missionTypes,
        platforms: []
      };
    }
    const terms = (Array.isArray(keywords) ? keywords : [])
      .map((item) => String(item || "").trim())
      .filter((item) => item.length >= 2)
      .slice(0, 6);
    const platforms = [];
    const seen = new Set();
    for (const term of terms) {
      if (platforms.length >= limit) break;
      for (const hit of searchPlatforms({ q: term, limit: Math.min(4, limit - platforms.length) })) {
        const key = `${hit.domain}:${hit.cmoId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        platforms.push(hit);
        if (platforms.length >= limit) break;
      }
    }
    return {
      available: true,
      databaseLabel: status.databaseLabel,
      missionTypes,
      platforms: platforms.map((item) => ({
        domain: item.domain,
        cmoId: item.cmoId,
        name: item.name,
        country: item.country,
        category: item.category
      }))
    };
  }

  return {
    loadConfig,
    saveConfig,
    getConfig,
    getPublicConfig,
    getStatus,
    probePath,
    listMissionTypes,
    listCountries,
    searchPlatforms,
    getPlatform,
    buildGenerationHint,
    resolveDatabasePath,
    close
  };
}

export function normalizeCmoDatabaseConfig(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const databasePath = String(input.databasePath || DEFAULT_CMO_DATABASE_CONFIG.databasePath).trim()
    || DEFAULT_CMO_DATABASE_CONFIG.databasePath;
  // Prevent path traversal weirdness in stored relative paths; absolute paths are allowed for custom installs.
  if (!isAbsolute(databasePath) && databasePath.includes("..")) {
    throw Object.assign(new Error("相对路径不得包含 .."), { statusCode: 400 });
  }
  return {
    enabled: input.enabled === false ? false : true,
    databasePath: normalize(databasePath)
  };
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function escapeLike(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

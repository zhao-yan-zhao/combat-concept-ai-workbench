import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPublicAiServiceConfig, loadAiServiceConfig, saveAiServiceConfig } from "./aiServiceConfig.mjs";
import { createFileProjectRepository } from "./projectRepository.mjs";
import { listKnowledgeRetrievalModes, resolveKnowledgeRetrievalMode } from "./projectKnowledgeRetrieval.mjs";
import { createExternalVectorRetrievalAdapter } from "./projectExternalVectorRetrieval.mjs";
import { createLocalIdentityAdapter } from "./projectLocalIdentity.mjs";
import { setCollaborationIdentityPolicy } from "./projectCollaborationPolicy.mjs";
import { createProjectWriteAuthorizer } from "./projectWriteAccess.mjs";
import { registerProjectWriteActor } from "./projectWriteAuditActor.mjs";
import { createAiConfigWriteAuthorizer } from "./projectAiConfigWriteAccess.mjs";
import { createAiSecretStore } from "./projectAiSecretStore.mjs";
import { createStaticFileServer } from "./staticFiles.mjs";
import { readJson } from "./httpUtils.mjs";
import { createOpenAiClient } from "./openaiClient.mjs";
import { loadThemeConfig, saveThemeConfig } from "./themeConfig.mjs";
import { createCmoDatabaseService } from "./cmoDatabase.mjs";

const mimeTypes = {
  ".html": "text/html;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".js": "text/javascript;charset=utf-8",
  ".mjs": "text/javascript;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".md": "text/markdown;charset=utf-8",
  ".svg": "image/svg+xml"
};

export async function createRuntime() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const port = Number(process.env.PORT || 8792);
  const aiConfigPath = process.env.AI_SERVICE_CONFIG_PATH || join(root, "ai-service-config.json");
  const themeConfigPath = process.env.THEME_CONFIG_PATH || join(root, "data", "theme-config.json");
  const cmoDatabaseConfigPath = process.env.CMO_DATABASE_CONFIG_PATH || join(root, "data", "cmo-database-config.json");
  let aiServiceConfig = await loadAiServiceConfig({ configPath: aiConfigPath });
  let themeConfig = await loadThemeConfig({ configPath: themeConfigPath });
  const cmoDatabase = createCmoDatabaseService({ root, configPath: cmoDatabaseConfigPath });
  await cmoDatabase.loadConfig();
  const aiSecretStore = createAiSecretStore({ filePath: process.env.AI_SECRET_STORE_PATH || join(root, "data", "ai-service-secret.json") });
  let storedAiApiKey = await aiSecretStore.load();
  const knowledgeRetrievalMode = resolveKnowledgeRetrievalMode(process.env.KNOWLEDGE_RETRIEVAL_MODE, "hybrid");
  const externalVectorAdapter = createExternalVectorRetrievalAdapter({
    endpoint: process.env.KNOWLEDGE_EXTERNAL_VECTOR_ENDPOINT,
    token: process.env.KNOWLEDGE_EXTERNAL_VECTOR_TOKEN,
    timeoutMs: process.env.KNOWLEDGE_EXTERNAL_VECTOR_TIMEOUT_MS
  });
  // All durable project/collaboration data defaults to SQLite.
  // Opt out only for tests: PROJECT_STORAGE_MODE=file or COLLABORATION_IDENTITY_STORAGE_MODE=file.
  const projectFilePath = process.env.PROJECT_DATA_PATH || join(root, "data", "projects.json");
  const projectDatabasePath = process.env.PROJECT_STORAGE_MODE === "file"
    ? ""
    : (process.env.PROJECT_DB_PATH || join(root, "data", "projects.sqlite"));
  const identityFilePath = process.env.COLLABORATION_LOCAL_IDENTITY_PATH || join(root, "data", "collaboration-identities.json");
  const identityDatabasePath = process.env.COLLABORATION_IDENTITY_STORAGE_MODE === "file"
    ? ""
    : (process.env.COLLABORATION_LOCAL_IDENTITY_DB_PATH || join(root, "data", "collaboration-identities.sqlite"));
  const localIdentity = createLocalIdentityAdapter({
    filePath: identityFilePath,
    databasePath: identityDatabasePath,
    sessionSecret: process.env.COLLABORATION_LOCAL_SESSION_SECRET,
    secureCookies: process.env.COLLABORATION_LOCAL_SECURE_COOKIE === "true"
  });
  setCollaborationIdentityPolicy(localIdentity.getStatus());
  const projectWriteAuthorizer = createProjectWriteAuthorizer({ enabled: process.env.COLLABORATION_PROJECT_WRITE_AUTH === "true", authenticate: (request) => localIdentity.authenticate(request) });
  const aiConfigWriteAuthorizer = createAiConfigWriteAuthorizer({ enabled: process.env.AI_SERVICE_CONFIG_WRITE !== "false", authenticate: (request) => localIdentity.authenticate(request) });
  const projectRepository = createFileProjectRepository({
    filePath: projectFilePath,
    databasePath: projectDatabasePath,
    knowledgeRetrievalMode,
    externalVectorAdapter
  });
  const serveStatic = createStaticFileServer({ root, mimeTypes });

  const getAiApiKey = () => process.env.OPENAI_API_KEY || storedAiApiKey;
  const getAiApiKeySource = () => (process.env.OPENAI_API_KEY ? "server-environment" : storedAiApiKey ? "windows-dpapi" : "not-configured");
  const getAiServiceConfig = () => aiServiceConfig;
  const getAiConfigResponse = () => ({
    ...getPublicAiServiceConfig(aiServiceConfig, getAiApiKey(), getAiApiKeySource()),
    configurationWrite: aiConfigWriteAuthorizer.getStatus()
  });

  const openAi = createOpenAiClient({ getAiServiceConfig, getAiApiKey });

  async function readAuthorizedProjectInput(request) {
    const input = await readJson(request);
    const actor = await projectWriteAuthorizer.authorize(request);
    if (actor) registerProjectWriteActor(input, actor);
    return input;
  }

  return {
    root,
    port,
    aiConfigPath,
    themeConfigPath,
    cmoDatabaseConfigPath,
    cmoDatabase,
    aiSecretStore,
    knowledgeRetrievalMode,
    externalVectorAdapter,
    localIdentity,
    projectWriteAuthorizer,
    aiConfigWriteAuthorizer,
    projectRepository,
    serveStatic,
    getAiApiKey,
    getAiApiKeySource,
    getAiServiceConfig,
    getAiConfigResponse,
    getThemeConfig: () => themeConfig,
    setAiServiceConfig(value) { aiServiceConfig = value; },
    setThemeConfig(value) { themeConfig = value; },
    setStoredAiApiKey(value) { storedAiApiKey = value; },
    readAuthorizedProjectInput,
    openAi,
    saveAiServiceConfig,
    saveThemeConfig,
    getPublicAiServiceConfig,
    listKnowledgeRetrievalModes
  };
}

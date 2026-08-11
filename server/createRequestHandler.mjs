import { decodeCollaborationUsername, decodeHistoryItemId, decodeProjectId, readJson, send, sendJson } from "./httpUtils.mjs";
import { saveAiServiceConfig } from "./aiServiceConfig.mjs";
import { createCollaborationAuthHandlers } from "./routes/collaborationAuth.mjs";
import { createProjectResourceHandlers } from "./routes/projectResources.mjs";
import { createAiHandlers } from "./routes/aiRoutes.mjs";
import { createOfficeReportHandlers } from "./routes/officeReports.mjs";

export function createRequestHandler(runtime) {
  const auth = createCollaborationAuthHandlers(runtime);
  const projects = createProjectResourceHandlers(runtime);
  const ai = createAiHandlers(runtime);
  const office = createOfficeReportHandlers(runtime);
  const {
    localIdentity,
    projectRepository,
    projectWriteAuthorizer,
    aiConfigWriteAuthorizer,
    aiConfigPath,
    themeConfigPath,
    cmoDatabase,
    aiSecretStore,
    knowledgeRetrievalMode,
    externalVectorAdapter,
    listKnowledgeRetrievalModes,
    getPublicAiServiceConfig,
    getAiApiKey,
    getAiApiKeySource,
    getAiConfigResponse,
    getThemeConfig,
    setAiServiceConfig,
    setThemeConfig,
    setStoredAiApiKey,
    serveStatic
  } = runtime;

  return async function handleRequest(request, response) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (url.pathname === "/api/collaboration/auth/session" && request.method === "GET") {
        await auth.handleCollaborationSession(request, response);
        return;
      }
      if (url.pathname === "/api/collaboration/auth/setup" && request.method === "POST") {
        await auth.handleCollaborationSetup(request, response);
        return;
      }
      if (url.pathname === "/api/collaboration/auth/login" && request.method === "POST") {
        await auth.handleCollaborationLogin(request, response);
        return;
      }
      if (url.pathname === "/api/collaboration/auth/register" && request.method === "POST") {
        await auth.handleCollaborationRegister(request, response);
        return;
      }
      if (url.pathname === "/api/collaboration/auth/logout" && request.method === "POST") {
        sendJson(response, 200, { ok: true }, { "Set-Cookie": localIdentity.logoutCookie() });
        return;
      }
      if (url.pathname === "/api/collaboration/auth/accounts" && (request.method === "GET" || request.method === "POST")) {
        await auth.handleCollaborationAccounts(request, response);
        return;
      }
      if (url.pathname === "/api/collaboration/auth/security-events" && request.method === "GET") {
        await auth.handleCollaborationSecurityEvents(request, response, url.searchParams.get("limit"));
        return;
      }
      const collaborationAccountMatch = url.pathname.match(/^\/api\/collaboration\/auth\/accounts\/([^/]+)$/);
      if (collaborationAccountMatch && request.method === "PATCH") {
        await auth.handleCollaborationAccountUpdate(request, response, decodeCollaborationUsername(collaborationAccountMatch[1]));
        return;
      }
      if (url.pathname === "/api/projects" && (request.method === "GET" || request.method === "POST")) {
        await projects.handleProjects(request, response, url);
        return;
      }
      const projectMetaMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (projectMetaMatch && (request.method === "PATCH" || request.method === "DELETE")) {
        const projectId = decodeProjectId(projectMetaMatch[1]);
        if (request.method === "DELETE") await projects.handleProjectDelete(request, response, projectId);
        else await projects.handleProjectMeta(request, response, projectId);
        return;
      }
      const projectBriefMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/brief$/);
      if (projectBriefMatch && (request.method === "GET" || request.method === "PUT")) {
        await projects.handleProjectBrief(request, response, decodeProjectId(projectBriefMatch[1]));
        return;
      }
      const projectAuditMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/audit$/);
      if (projectAuditMatch && request.method === "GET") {
        await projects.handleProjectAudit(request, response, decodeProjectId(projectAuditMatch[1]), url.searchParams.get("limit"));
        return;
      }
      const projectCollaborationMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/collaboration$/);
      if (projectCollaborationMatch && request.method === "GET") {
        await projects.handleProjectCollaboration(response, decodeProjectId(projectCollaborationMatch[1]));
        return;
      }
      const projectCollaborationReviewMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/collaboration\/reviews$/);
      if (projectCollaborationReviewMatch && request.method === "POST") {
        await projects.handleProjectCollaborationReview(request, response, decodeProjectId(projectCollaborationReviewMatch[1]));
        return;
      }
      const projectCollaborationDecisionMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/collaboration\/reviews\/([^/]+)\/decision$/);
      if (projectCollaborationDecisionMatch && request.method === "POST") {
        await projects.handleProjectCollaborationDecision(request, response, decodeProjectId(projectCollaborationDecisionMatch[1]), decodeHistoryItemId(projectCollaborationDecisionMatch[2]));
        return;
      }
      const architectureExportMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/architecture\/export$/);
      if (architectureExportMatch && request.method === "GET") {
        await projects.handleArchitectureExport(request, response, decodeProjectId(architectureExportMatch[1]), url.searchParams.get("format") || "json");
        return;
      }
      const architectureImportMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/architecture\/import$/);
      if (architectureImportMatch && request.method === "POST") {
        await projects.handleArchitectureImport(request, response, decodeProjectId(architectureImportMatch[1]));
        return;
      }
      const projectArchitectureMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/architecture$/);
      if (projectArchitectureMatch && (request.method === "GET" || request.method === "PUT")) {
        await projects.handleProjectArchitecture(request, response, decodeProjectId(projectArchitectureMatch[1]));
        return;
      }
      const projectForceMissionMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/force-mission-plan$/);
      if (projectForceMissionMatch && (request.method === "GET" || request.method === "PUT")) {
        await projects.handleProjectForceMissionPlan(request, response, decodeProjectId(projectForceMissionMatch[1]));
        return;
      }
      const projectPhaseActionMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/phase-action-concept$/);
      if (projectPhaseActionMatch && (request.method === "GET" || request.method === "PUT")) {
        await projects.handleProjectPhaseActionConcept(request, response, decodeProjectId(projectPhaseActionMatch[1]));
        return;
      }
      const projectConceptMapMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/concept-map$/);
      if (projectConceptMapMatch && (request.method === "GET" || request.method === "PUT")) {
        await projects.handleProjectConceptMap(request, response, decodeProjectId(projectConceptMapMatch[1]));
        return;
      }
      const projectConceptGraphicMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/concept-graphic-plan$/);
      if (projectConceptGraphicMatch && (request.method === "GET" || request.method === "PUT")) {
        await projects.handleProjectConceptGraphicPlan(request, response, decodeProjectId(projectConceptGraphicMatch[1]));
        return;
      }
      const projectOvResourceMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/(ov1|ov2|ov3|ov4|ov5a|ov5|ov6a|ov6b|ov6c)$/);
      if (projectOvResourceMatch && (request.method === "GET" || request.method === "PUT")) {
        const resource = projectOvResourceMatch[2];
        const handler = {
          ov1: projects.handleProjectOv1,
          ov2: projects.handleProjectOv2,
          ov3: projects.handleProjectOv3,
          ov4: projects.handleProjectOv4,
          ov5a: projects.handleProjectOv5a,
          ov5: projects.handleProjectOv5,
          ov6a: projects.handleProjectOv6a,
          ov6b: projects.handleProjectOv6b,
          ov6c: projects.handleProjectOv6c
        }[resource];
        await handler(request, response, decodeProjectId(projectOvResourceMatch[1]));
        return;
      }
      const projectOodaMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/ooda$/);
      if (projectOodaMatch && (request.method === "GET" || request.method === "PUT")) {
        await projects.handleProjectOoda(request, response, decodeProjectId(projectOodaMatch[1]));
        return;
      }
      const projectScenarioMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/scenario$/);
      if (projectScenarioMatch && (request.method === "GET" || request.method === "PUT")) {
        await projects.handleProjectScenario(request, response, decodeProjectId(projectScenarioMatch[1]));
        return;
      }
      const projectValidationMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/validation$/);
      if (projectValidationMatch && (request.method === "GET" || request.method === "PUT")) {
        await projects.handleProjectValidation(request, response, decodeProjectId(projectValidationMatch[1]));
        return;
      }
      const projectKnowledgeSearchMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/knowledge\/search$/);
      if (projectKnowledgeSearchMatch && request.method === "GET") {
        await projects.handleProjectKnowledgeSearch(request, response, decodeProjectId(projectKnowledgeSearchMatch[1]), url.searchParams.get("q"), url.searchParams.get("limit"), url.searchParams.get("mode"), url.searchParams.get("includeSensitive") === "true");
        return;
      }
      const projectKnowledgeCitationApprovalMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/knowledge\/sensitivity-approvals\/([^/]+)$/);
      if (projectKnowledgeCitationApprovalMatch && request.method === "DELETE") {
        await projects.handleKnowledgeCitationApprovalDelete(request, response, decodeProjectId(projectKnowledgeCitationApprovalMatch[1]), decodeHistoryItemId(projectKnowledgeCitationApprovalMatch[2]));
        return;
      }
      const projectKnowledgeCitationApprovalsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/knowledge\/sensitivity-approvals$/);
      if (projectKnowledgeCitationApprovalsMatch && (request.method === "GET" || request.method === "POST")) {
        await projects.handleKnowledgeCitationApprovals(request, response, decodeProjectId(projectKnowledgeCitationApprovalsMatch[1]));
        return;
      }
      const projectKnowledgeMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/knowledge$/);
      if (projectKnowledgeMatch && (request.method === "GET" || request.method === "PUT")) {
        await projects.handleProjectKnowledge(request, response, decodeProjectId(projectKnowledgeMatch[1]));
        return;
      }
      const projectReportsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/reports$/);
      if (projectReportsMatch && (request.method === "GET" || request.method === "POST")) {
        await projects.handleProjectReports(request, response, decodeProjectId(projectReportsMatch[1]));
        return;
      }
      const projectReportItemMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/reports\/([^/]+)$/);
      if (projectReportItemMatch && request.method === "DELETE") {
        await projects.handleProjectReportDelete(request, response, decodeProjectId(projectReportItemMatch[1]), decodeHistoryItemId(projectReportItemMatch[2]));
        return;
      }
      const projectSnapshotsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/model-snapshots$/);
      if (projectSnapshotsMatch && (request.method === "GET" || request.method === "POST")) {
        await projects.handleProjectSnapshots(request, response, decodeProjectId(projectSnapshotsMatch[1]));
        return;
      }
      const projectSnapshotItemMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/model-snapshots\/([^/]+)$/);
      if (projectSnapshotItemMatch && request.method === "DELETE") {
        await projects.handleProjectSnapshotDelete(request, response, decodeProjectId(projectSnapshotItemMatch[1]), decodeHistoryItemId(projectSnapshotItemMatch[2]));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/generate") {
        await ai.handleGenerate(request, response);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/generate/stream") {
        await ai.handleGenerateStream(request, response);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/red-team") {
        await ai.handleRedTeam(request, response);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/report-docx") {
        await office.handleReportDocx(request, response);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/report-pdf") {
        await office.handleReportPdf(request, response);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/report-pptx") {
        await office.handleReportPptx(request, response);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          ok: true,
          ...getPublicAiServiceConfig(runtime.getAiServiceConfig(), getAiApiKey(), getAiApiKeySource()),
          projectRepository: {
            mode: projectRepository.getStatus().storage,
            durable: projectRepository.getStatus().storage === "sqlite",
            conceptBrief: true, forceMissionPlan: true, phaseActionConcept: true, conceptMap: true, conceptGraphicPlan: true,
            ov1: true, ov2: true, ov3: true, ov4: true, ov5a: true, ov5: true, ov6a: true, ov6b: true, ov6c: true,
            architecture: true,
            ooda: true, scenario: true, validation: true, knowledge: true, reportArchives: true, modelSnapshots: true, collaboration: true,
            resources: ["brief", "forceMissionPlan", "phaseActionConcept", "conceptMap", "conceptGraphicPlan", "ov1", "ov2", "ov3", "ov4", "ov5a", "ov5", "ov6a", "ov6b", "ov6c", "architecture", "ooda", "scenario", "validation", "knowledge", "reportArchives", "modelSnapshots", "collaboration", "audit"]
          },
          knowledgeRetrieval: { defaultMode: knowledgeRetrievalMode, modes: listKnowledgeRetrievalModes(), externalVector: externalVectorAdapter.getStatus() },
          collaborationIdentity: localIdentity.getStatus(),
          projectWriteAuthorization: projectWriteAuthorizer.getStatus(),
          aiConfigurationWrite: aiConfigWriteAuthorizer.getStatus(),
          cmoDatabase: cmoDatabase.getStatus()
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/cmo-database-config") {
        sendJson(response, 200, {
          ...cmoDatabase.getPublicConfig(),
          configurationWrite: aiConfigWriteAuthorizer.getStatus()
        });
        return;
      }
      if (request.method === "PUT" && url.pathname === "/api/cmo-database-config") {
        try {
          await aiConfigWriteAuthorizer.authorize(request);
          const input = await readJson(request);
          const next = await cmoDatabase.saveConfig(input);
          sendJson(response, 200, {
            ...next,
            configurationWrite: aiConfigWriteAuthorizer.getStatus()
          });
        } catch (error) {
          send(response, error.statusCode || 400, error.message, "text/plain;charset=utf-8");
        }
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/cmo-database-config/probe") {
        try {
          await aiConfigWriteAuthorizer.authorize(request);
          const input = await readJson(request);
          const result = await cmoDatabase.probePath(input?.databasePath || cmoDatabase.getConfig().databasePath);
          sendJson(response, 200, result);
        } catch (error) {
          send(response, error.statusCode || 400, error.message, "text/plain;charset=utf-8");
        }
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/cmo-catalog/status") {
        sendJson(response, 200, cmoDatabase.getStatus());
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/cmo-catalog/mission-types") {
        sendJson(response, 200, { items: cmoDatabase.listMissionTypes() });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/cmo-catalog/countries") {
        try {
          const items = cmoDatabase.listCountries({
            q: url.searchParams.get("q") || "",
            limit: url.searchParams.get("limit") || 80
          });
          sendJson(response, 200, { items });
        } catch (error) {
          send(response, error.statusCode || 400, error.message, "text/plain;charset=utf-8");
        }
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/cmo-catalog/search") {
        try {
          const items = cmoDatabase.searchPlatforms({
            q: url.searchParams.get("q") || "",
            domain: url.searchParams.get("domain") || "",
            country: url.searchParams.get("country") || "",
            countryId: url.searchParams.get("countryId") || 0,
            limit: url.searchParams.get("limit") || 20
          });
          sendJson(response, 200, { items, status: cmoDatabase.getStatus() });
        } catch (error) {
          send(response, error.statusCode || 400, error.message, "text/plain;charset=utf-8");
        }
        return;
      }
      const cmoPlatformMatch = url.pathname.match(/^\/api\/cmo-catalog\/platforms\/([^/]+)\/(\d+)$/);
      if (request.method === "GET" && cmoPlatformMatch) {
        try {
          const item = cmoDatabase.getPlatform(decodeURIComponent(cmoPlatformMatch[1]), cmoPlatformMatch[2]);
          if (!item) {
            send(response, 404, "Platform not found", "text/plain;charset=utf-8");
            return;
          }
          sendJson(response, 200, { item });
        } catch (error) {
          send(response, error.statusCode || 400, error.message, "text/plain;charset=utf-8");
        }
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/ai-config") {
        sendJson(response, 200, getAiConfigResponse());
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/theme-config") {
        sendJson(response, 200, { theme: getThemeConfig(), configurationWrite: aiConfigWriteAuthorizer.getStatus() });
        return;
      }
      if (request.method === "PUT" && url.pathname === "/api/theme-config") {
        try {
          await aiConfigWriteAuthorizer.authorize(request);
          const input = await readJson(request);
          const next = await runtime.saveThemeConfig({ configPath: themeConfigPath, value: input });
          setThemeConfig(next);
          sendJson(response, 200, { theme: next, configurationWrite: aiConfigWriteAuthorizer.getStatus() });
        } catch (error) {
          send(response, error.statusCode || 400, error.message, "text/plain;charset=utf-8");
        }
        return;
      }
      if (request.method === "PUT" && url.pathname === "/api/ai-config") {
        try {
          await aiConfigWriteAuthorizer.authorize(request);
          const input = await readJson(request);
          const next = await saveAiServiceConfig({ configPath: aiConfigPath, value: input });
          setAiServiceConfig(next);
          if (String(input.apiKey || "").trim()) setStoredAiApiKey(await aiSecretStore.save(input.apiKey).then(() => String(input.apiKey).trim()));
          sendJson(response, 200, getAiConfigResponse());
        } catch (error) {
          send(response, error.statusCode || 400, error.message, "text/plain;charset=utf-8");
        }
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        send(response, 405, "Method Not Allowed", "text/plain;charset=utf-8");
        return;
      }
      await serveStatic(url.pathname, response, request.method === "HEAD");
    } catch (error) {
      const status = Number(error?.statusCode) || 500;
      const message = String(error?.message || "Internal Server Error").slice(0, 1200);
      send(response, status, message, "text/plain;charset=utf-8");
    }
  };
}

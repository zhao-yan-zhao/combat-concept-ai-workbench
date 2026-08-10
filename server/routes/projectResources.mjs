import { readJson, sendJson } from "../httpUtils.mjs";
import { registerAuthenticatedCollaborationActor } from "../projectCollaborationPolicy.mjs";
import { requireSensitiveKnowledgeReview } from "../knowledgeSensitivityAccess.mjs";
import { registerProjectWriteActor } from "../projectWriteAuditActor.mjs";

export function createProjectResourceHandlers(runtime) {
  const {
    localIdentity,
    projectRepository,
    projectWriteAuthorizer,
    readAuthorizedProjectInput
  } = runtime;

  async function handleProjects(request, response, url) {
    try {
      await localIdentity.authenticate(request);
      if (request.method === "GET") { sendJson(response, 200, await projectRepository.listProjects({ includeArchived: url.searchParams.get("archived") === "true" })); return; }
      sendJson(response, 201, await projectRepository.createProject(await readJson(request)));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Project request is invalid" });
    }
  }
  
  async function handleProjectMeta(request, response, projectId) {
    try {
      const actor = await localIdentity.authenticate(request);
      const input = await readJson(request);
      if ((input.archived !== undefined || input.title !== undefined || input.description !== undefined) && !actor.roles.includes("lead")) { const error = new Error("Only a lead can change project metadata or archive a project"); error.statusCode = 403; throw error; }
      sendJson(response, 200, await projectRepository.updateProject(projectId, input));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Project update is invalid" });
    }
  }
  
  async function handleProjectDelete(request, response, projectId) {
    try {
      const actor = await localIdentity.authenticate(request);
      if (!actor.roles.includes("lead")) { const error = new Error("Only a lead can delete a project"); error.statusCode = 403; throw error; }
      sendJson(response, 200, await projectRepository.deleteProject(projectId));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Project deletion is invalid" });
    }
  }
  
  async function handleProjectBrief(request, response, projectId) {
    try {
      if (request.method === "GET") {
        sendJson(response, 200, await projectRepository.getBrief(projectId));
        return;
      }
      const input = await readAuthorizedProjectInput(request);
      sendJson(response, 200, await projectRepository.saveBrief(projectId, input));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "项目简报请求无效" });
    }
  }
  
  async function handleProjectAudit(request, response, projectId, limit) {
    try {
      await projectWriteAuthorizer.authorize(request);
      sendJson(response, 200, await projectRepository.listAudit(projectId, limit));
    } catch (error) {
      sendJson(response, 400, { error: error.message || "项目审计请求无效" });
    }
  }
  
  async function handleProjectCollaboration(response, projectId) {
    try {
      sendJson(response, 200, await projectRepository.getCollaboration(projectId));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Collaboration request is invalid" });
    }
  }
  
  async function handleProjectCollaborationReview(request, response, projectId) {
    try {
      const input = await readJson(request);
      registerAuthenticatedCollaborationActor(input, await localIdentity.authenticate(request));
      sendJson(response, 201, await projectRepository.createCollaborationReview(projectId, input));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Collaboration review request is invalid" });
    }
  }
  
  async function handleProjectCollaborationDecision(request, response, projectId, reviewId) {
    try {
      const input = await readJson(request);
      registerAuthenticatedCollaborationActor(input, await localIdentity.authenticate(request));
      sendJson(response, 201, await projectRepository.resolveCollaborationReview(projectId, reviewId, input));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Collaboration decision request is invalid" });
    }
  }
  
  function createOvResourceHandler(resourceKey, label) {
    const getter = {
      forceMissionPlan: "getForceMissionPlan", phaseActionConcept: "getPhaseActionConcept",
      conceptMap: "getConceptMap", conceptGraphicPlan: "getConceptGraphicPlan", ov1: "getOv1", ov2: "getOv2", ov3: "getOv3", ov4: "getOv4", ov5a: "getOv5a", ov5: "getOv5",
      ov6a: "getOv6a", ov6b: "getOv6b", ov6c: "getOv6c", architecture: "getArchitecture"
    }[resourceKey];
    const saver = {
      forceMissionPlan: "saveForceMissionPlan", phaseActionConcept: "savePhaseActionConcept",
      conceptMap: "saveConceptMap", conceptGraphicPlan: "saveConceptGraphicPlan", ov1: "saveOv1", ov2: "saveOv2", ov3: "saveOv3", ov4: "saveOv4", ov5a: "saveOv5a", ov5: "saveOv5",
      ov6a: "saveOv6a", ov6b: "saveOv6b", ov6c: "saveOv6c", architecture: "saveArchitecture"
    }[resourceKey];
    return async function handleProjectOvResource(request, response, projectId) {
      try {
        if (request.method === "GET") {
          sendJson(response, 200, await projectRepository[getter](projectId));
          return;
        }
        sendJson(response, 200, await projectRepository[saver](projectId, await readAuthorizedProjectInput(request)));
      } catch (error) {
        sendJson(response, error.statusCode || 400, { error: error.message || `${label} request is invalid` });
      }
    };
  }

  const handleProjectOv1 = createOvResourceHandler("ov1", "OV-1");
  const handleProjectForceMissionPlan = createOvResourceHandler("forceMissionPlan", "force mission plan");
  const handleProjectPhaseActionConcept = createOvResourceHandler("phaseActionConcept", "phase action concept");
  const handleProjectConceptMap = createOvResourceHandler("conceptMap", "concept map");
  const handleProjectConceptGraphicPlan = createOvResourceHandler("conceptGraphicPlan", "concept graphic plan");
  const handleProjectOv2 = createOvResourceHandler("ov2", "OV-2");
  const handleProjectOv3 = createOvResourceHandler("ov3", "OV-3");
  const handleProjectOv4 = createOvResourceHandler("ov4", "OV-4");
  const handleProjectOv5a = createOvResourceHandler("ov5a", "OV-5a");
  const handleProjectOv5 = createOvResourceHandler("ov5", "OV-5");
  const handleProjectOv6a = createOvResourceHandler("ov6a", "OV-6a");
  const handleProjectOv6b = createOvResourceHandler("ov6b", "OV-6b");
  const handleProjectOv6c = createOvResourceHandler("ov6c", "OV-6c");
  const handleProjectArchitecture = createOvResourceHandler("architecture", "Architecture");

  async function handleArchitectureExport(request, response, projectId, format) {
    try {
      await projectWriteAuthorizer.authorize(request);
      const result = await projectRepository.exportArchitecture(projectId, { format: format === "xml" ? "xml" : "json" });
      if (format === "xml") {
        response.writeHead(200, {
          "Content-Type": "application/xml; charset=utf-8",
          "X-Project-Revision": String(result.revision)
        });
        response.end(result.body);
        return;
      }
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Architecture export is invalid" });
    }
  }

  async function handleArchitectureImport(request, response, projectId) {
    try {
      const input = await readAuthorizedProjectInput(request);
      sendJson(response, 200, await projectRepository.importArchitecture(projectId, input));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Architecture import is invalid" });
    }
  }
  
  async function handleProjectOoda(request, response, projectId) {
    try {
      if (request.method === "GET") {
        sendJson(response, 200, await projectRepository.getOoda(projectId));
        return;
      }
      sendJson(response, 200, await projectRepository.saveOoda(projectId, await readAuthorizedProjectInput(request)));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "OODA request is invalid" });
    }
  }
  
  async function handleProjectScenario(request, response, projectId) {
    try {
      if (request.method === "GET") {
        sendJson(response, 200, await projectRepository.getScenario(projectId));
        return;
      }
      sendJson(response, 200, await projectRepository.saveScenario(projectId, await readAuthorizedProjectInput(request)));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Scenario request is invalid" });
    }
  }
  
  async function handleProjectValidation(request, response, projectId) {
    try {
      if (request.method === "GET") {
        sendJson(response, 200, await projectRepository.getValidation(projectId));
        return;
      }
      sendJson(response, 200, await projectRepository.saveValidation(projectId, await readAuthorizedProjectInput(request)));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Validation request is invalid" });
    }
  }
  
  async function handleProjectKnowledge(request, response, projectId) {
    try {
      if (request.method === "GET") {
        sendJson(response, 200, await projectRepository.getKnowledge(projectId));
        return;
      }
      sendJson(response, 200, await projectRepository.saveKnowledge(projectId, await readAuthorizedProjectInput(request)));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Knowledge request is invalid" });
    }
  }
  
  async function handleProjectKnowledgeSearch(request, response, projectId, query, limit, mode, includeSensitive) {
    try {
      if (includeSensitive) requireSensitiveKnowledgeReview(await localIdentity.authenticate(request));
      sendJson(response, 200, await projectRepository.searchKnowledge(projectId, query, limit, mode, includeSensitive));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Knowledge search request is invalid" });
    }
  }
  
  async function handleKnowledgeCitationApprovals(request, response, projectId) {
    try {
      const actor = await localIdentity.authenticate(request);
      requireSensitiveKnowledgeReview(actor);
      if (request.method === "GET") {
        sendJson(response, 200, await projectRepository.getKnowledgeCitationApprovals(projectId));
        return;
      }
      const input = await readJson(request);
      registerProjectWriteActor(input, actor);
      sendJson(response, 201, await projectRepository.createKnowledgeCitationApproval(projectId, input));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Sensitive citation approval request is invalid" });
    }
  }
  
  async function handleKnowledgeCitationApprovalDelete(request, response, projectId, approvalId) {
    try {
      const actor = await localIdentity.authenticate(request);
      requireSensitiveKnowledgeReview(actor);
      const input = await readJson(request);
      registerProjectWriteActor(input, actor);
      sendJson(response, 200, await projectRepository.revokeKnowledgeCitationApproval(projectId, approvalId, input));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Sensitive citation revocation request is invalid" });
    }
  }
  
  async function handleProjectReports(request, response, projectId) {
    try {
      if (request.method === "GET") {
        sendJson(response, 200, await projectRepository.getReportArchives(projectId));
        return;
      }
      sendJson(response, 201, await projectRepository.createReportArchive(projectId, await readAuthorizedProjectInput(request)));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Report archive request is invalid" });
    }
  }
  
  async function handleProjectReportDelete(request, response, projectId, reportId) {
    try {
      sendJson(response, 200, await projectRepository.deleteReportArchive(projectId, reportId, await readAuthorizedProjectInput(request)));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Report archive deletion is invalid" });
    }
  }
  
  async function handleProjectSnapshots(request, response, projectId) {
    try {
      if (request.method === "GET") {
        sendJson(response, 200, await projectRepository.getModelSnapshots(projectId));
        return;
      }
      sendJson(response, 201, await projectRepository.createModelSnapshot(projectId, await readAuthorizedProjectInput(request)));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Model snapshot request is invalid" });
    }
  }
  
  async function handleProjectSnapshotDelete(request, response, projectId, snapshotId) {
    try {
      sendJson(response, 200, await projectRepository.deleteModelSnapshot(projectId, snapshotId, await readAuthorizedProjectInput(request)));
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "Model snapshot deletion is invalid" });
    }
  }

  return {
    handleProjects,
    handleProjectMeta,
    handleProjectDelete,
    handleProjectBrief,
    handleProjectAudit,
    handleProjectCollaboration,
    handleProjectCollaborationReview,
    handleProjectCollaborationDecision,
    handleProjectForceMissionPlan,
    handleProjectPhaseActionConcept,
    handleProjectConceptMap,
    handleProjectConceptGraphicPlan,
    handleProjectOv1,
    handleProjectOv2,
    handleProjectOv3,
    handleProjectOv4,
    handleProjectOv5a,
    handleProjectOv5,
    handleProjectOv6a,
    handleProjectOv6b,
    handleProjectOv6c,
    handleProjectArchitecture,
    handleArchitectureExport,
    handleArchitectureImport,
    handleProjectOoda,
    handleProjectScenario,
    handleProjectValidation,
    handleProjectKnowledge,
    handleProjectKnowledgeSearch,
    handleKnowledgeCitationApprovals,
    handleKnowledgeCitationApprovalDelete,
    handleProjectReports,
    handleProjectReportDelete,
    handleProjectSnapshots,
    handleProjectSnapshotDelete
  };
}

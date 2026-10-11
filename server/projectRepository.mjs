import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  buildArchitectureExchangePackage,
  decodeArchitecturePackage,
  encodeArchitecturePackage,
  normalizeArchitecture as normalizeProjectArchitecture,
  normalizeConceptMap as normalizeProjectConceptMap,
  normalizeForceMissionPlan as normalizeProjectForceMissionPlan,
  normalizePhaseActionConcept as normalizeProjectPhaseActionConcept,
  normalizeConceptGraphicPlan as normalizeProjectConceptGraphicPlan,
  normalizeModelSnapshotInput as normalizeProjectModelSnapshot,
  normalizeOv1 as normalizeProjectOv1,
  normalizeOv1b as normalizeProjectOv1b,
  normalizeOv1c as normalizeProjectOv1c,
  normalizeOv2 as normalizeProjectOv2,
  normalizeOv3 as normalizeProjectOv3,
  normalizeOv4 as normalizeProjectOv4,
  normalizeOv5a as normalizeProjectOv5a,
  normalizeOv6a as normalizeProjectOv6a,
  normalizeOv6b as normalizeProjectOv6b,
  normalizeOv6c as normalizeProjectOv6c,
  normalizeOv7 as normalizeProjectOv7,
  normalizeOoda as normalizeProjectOoda,
  normalizeOv5 as normalizeProjectOv5,
  normalizeReportArchiveInput as normalizeProjectReportArchive,
  normalizeScenario as normalizeProjectScenario,
  normalizeValidation as normalizeProjectValidation,
  productsFromExchangePackage
} from "./projectModelNormalizers.mjs";
import { normalizeKnowledgeVault } from "./projectKnowledgeNormalizers.mjs";
import { verifyReportIntegrity } from "./projectReportIntegrity.mjs";
import { combineKnowledgeRankings, resolveKnowledgeRetrievalMode, searchProjectKnowledge as searchKnowledgeWithAdapter } from "./projectKnowledgeRetrieval.mjs";
import { isSensitiveKnowledge } from "./projectKnowledgeSensitivity.mjs";
import { getCollaborationPolicy, requireCollaborationActor } from "./projectCollaborationPolicy.mjs";
import { getProjectWriteActor } from "./projectWriteAuditActor.mjs";
import { createSensitiveCitationApproval, normalizeSensitiveCitationApprovals, revokeSensitiveCitationApproval } from "./projectKnowledgeCitationPolicy.mjs";
import { earliestWorkflowStage, workflowStageForResource } from "../shared/workflowConfirmation.js";
import { normalizeWorkflowProgress } from "../shared/workflowProgress.js";

const BRIEF_FIELDS = ["researchIntent", "objective", "approach", "assumptions", "expectedEffects", "risk"];
const MAX_AUDIT_ENTRIES = 200;
const MAX_REPORT_ARCHIVES = 20;
const MAX_MODEL_SNAPSHOTS = 12;
const MAX_COLLABORATION_REVIEWS = 160;
const MAX_COLLABORATION_DECISIONS = 160;
const COLLABORATION_RESOURCES = new Set(["brief", "forceMissionPlan", "phaseActionConcept", "conceptMap", "conceptGraphicPlan", "ov1", "ov1b", "ov1c", "ov2", "ov3", "ov4", "ov5a", "ov5", "ov6a", "ov6b", "ov6c", "ov7", "architecture", "ooda", "scenario", "validation", "knowledge", "report"]);
const OV_MODEL_RESOURCES = ["ov1", "ov1b", "ov1c", "ov2", "ov3", "ov4", "ov5a", "ov5", "ov6a", "ov6b", "ov6c", "ov7", "architecture"];

export function createFileProjectRepository({ filePath, databasePath = "", now = () => new Date().toISOString(), knowledgeRetrievalMode = "hybrid", externalVectorAdapter = null }) {
  if (!filePath) throw new Error("Project repository file path is required");
  const persistence = createProjectPersistence({ filePath, databasePath });
  let statePromise;
  let writeQueue = Promise.resolve();

  return {
    getStatus() { return { storage: persistence.kind }; },
    async listProjects({ includeArchived = false } = {}) {
      const state = await loadState();
      const catalog = normalizeProjectCatalog(state.projectCatalog, state.projects);
      return { projects: Object.values(catalog).map((item) => projectSummary(item, state.projects[item.id])).filter((item) => includeArchived || !item.archived).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title)) };
    },
    createProject(input = {}) {
      return enqueue(async () => {
        const state = await loadState();
        const catalog = normalizeProjectCatalog(state.projectCatalog, state.projects);
        const project = normalizeProjectMeta(input, now());
        if (catalog[project.id]) throw createConflictError("Project identifier is already in use");
        state.projectCatalog = { ...catalog, [project.id]: project };
        state.projects[project.id] = { revision: 0, updatedAt: project.createdAt, audit: [] };
        await persistState(state);
        return { project: projectSummary(project, state.projects[project.id]) };
      });
    },
    updateProject(projectId, input = {}) {
      return enqueue(async () => {
        const state = await loadState();
        const catalog = normalizeProjectCatalog(state.projectCatalog, state.projects);
        const id = normalizeProjectId(projectId);
        const current = catalog[id];
        if (!current) throw createNotFoundError("Project was not found");
        const title = input.title === undefined ? current.title : clean(input.title, 120);
        if (!title) throw new Error("Project title is required");
        const project = { ...current, title, description: input.description === undefined ? current.description : clean(input.description, 500), archived: input.archived === undefined ? current.archived : Boolean(input.archived), workflow: input.workflow === undefined ? current.workflow : normalizeWorkflow(input.workflow), updatedAt: now() };
        state.projectCatalog = { ...catalog, [id]: project };
        await persistState(state);
        return { project: projectSummary(project, state.projects[id]) };
      });
    },
    deleteProject(projectId) {
      return enqueue(async () => {
        const state = await loadState();
        const catalog = normalizeProjectCatalog(state.projectCatalog, state.projects);
        const id = normalizeProjectId(projectId);
        const current = catalog[id];
        if (!current) throw createNotFoundError("Project was not found");
        if (id === "default") throw new Error("The default project cannot be deleted");
        if (!current.archived) throw new Error("Archive the project before deleting it");
        delete catalog[id];
        delete state.projects[id];
        state.projectCatalog = catalog;
        await persistState(state);
        return { removed: true, projectId: id };
      });
    },
    resetProject(projectId, input = {}) {
      return enqueue(async () => {
        const state = await loadState();
        const catalog = normalizeProjectCatalog(state.projectCatalog, state.projects);
        const id = normalizeProjectId(projectId);
        let current = catalog[id];
        if (!current && id === "default") {
          current = { id: "default", title: "作战概念研究", description: "", archived: false, workflow: normalizeWorkflow(), createdAt: now(), updatedAt: now() };
        }
        if (!current) throw createNotFoundError("Project was not found");
        const auditActor = getProjectWriteActor(input);
        const source = getAuditSource(input, auditActor);
        const currentRecord = normalizeProjectRecord(state.projects[id]);
        const revision = Number(currentRecord?.revision || 0) + 1;
        const updatedAt = now();
        const audit = [
          createAuditEntry({
            revision,
            action: "project.reset",
            source,
            actor: auditActor,
            occurredAt: updatedAt,
            summary: "清空当前项目全部内容",
            briefRevision: revision
          }),
          ...(currentRecord?.audit || [])
        ].slice(0, MAX_AUDIT_ENTRIES);

        catalog[id] = {
          ...current,
          workflow: normalizeWorkflow({ version: 1, mode: "gate", completedThrough: 0, updatedAt }),
          updatedAt
        };
        state.projectCatalog = catalog;

        const existingKnowledge = currentRecord?.knowledge || null;
        state.projects[id] = {
          revision,
          briefRevision: revision,
          updatedAt,
          direction: "未选择方向",
          brief: {
            researchIntent: "",
            objective: "待补充",
            approach: "待补充",
            assumptions: "待补充",
            expectedEffects: "待补充",
            risk: "待补充",
            evidenceRefs: []
          },
          inspiration: null,
          directions: [],
          ...(existingKnowledge ? { knowledge: existingKnowledge } : {}),
          reportArchives: { items: [] },
          modelSnapshots: { items: [] },
          knowledgeCitationApprovals: [],
          audit
        };

        await persistState(state);
        return { reset: true, projectId: id, revision };
      });
    },
    getBrief(projectId) {
      return readRecord(projectId);
    },

    saveBrief(projectId, input = {}) {
      return enqueue(async () => {
        const state = await loadState();
        const current = normalizeProjectRecord(state.projects[projectId]);
        const expectedRevision = normalizeExpectedRevision(input.expectedRevision);
        const currentRevision = Number(current?.revision || 0);
        if (expectedRevision !== null && expectedRevision !== currentRevision) {
          throw createRevisionConflict(expectedRevision, currentRevision);
        }
        const brief = normalizeBrief(input.brief);
        const inspiration = normalizeInspirationSnapshot(input.inspiration);
        const directions = normalizeCustomDirections(input.directions);
        const direction = clean(input.direction, 160) || "未选择方向";
        const auditActor = getProjectWriteActor(input);
        const source = getAuditSource(input, auditActor);

        if (current && sameBrief(current.brief, brief) && sameJson(current.inspiration, inspiration) && sameJson(current.directions, directions) && current.direction === direction) {
          return toBriefResponse(projectId, current);
        }

        const revision = currentRevision + 1;
        const updatedAt = now();
        const audit = [
          createAuditEntry({ revision, action: "concept_brief.updated", source, actor: auditActor, occurredAt: updatedAt, summary: brief.objective.slice(0, 120), briefRevision: revision }),
          ...(current?.audit || [])
        ].slice(0, MAX_AUDIT_ENTRIES);
        const next = { ...current, revision, briefRevision: revision, updatedAt, brief, inspiration, directions, direction, audit };
        state.projects[projectId] = next;
        invalidateProjectWorkflow(state, projectId, workflowStageForResource("brief"));
        await persistState(state);
        return toBriefResponse(projectId, next);
      });
    },

    getOv1(projectId) {
      return readModelRecord(projectId, "ov1");
    },

    saveOv1(projectId, input = {}) {
      return saveModelResource(projectId, input, "ov1");
    },

    getOv1b(projectId) {
      return readModelRecord(projectId, "ov1b");
    },

    saveOv1b(projectId, input = {}) {
      return saveModelResource(projectId, input, "ov1b");
    },

    getOv1c(projectId) {
      return readModelRecord(projectId, "ov1c");
    },

    saveOv1c(projectId, input = {}) {
      return saveModelResource(projectId, input, "ov1c");
    },

    getForceMissionPlan(projectId) {
      return readModelRecord(projectId, "forceMissionPlan");
    },

    saveForceMissionPlan(projectId, input = {}) {
      return saveModelResource(projectId, input, "forceMissionPlan");
    },

    getPhaseActionConcept(projectId) {
      return readModelRecord(projectId, "phaseActionConcept");
    },

    savePhaseActionConcept(projectId, input = {}) {
      return saveModelResource(projectId, input, "phaseActionConcept");
    },

    getResearchChats(projectId) {
      return readModelRecord(projectId, "researchChats");
    },

    /**
     * Persist step research-chat sessions (phase / force / rule).
     * Does not bump project revision or invalidate workflow confirmation,
     * so chat traffic does not fight brief/model expectedRevision writes.
     */
    saveResearchChats(projectId, input = {}) {
      return enqueue(async () => {
        const state = await loadState();
        const current = normalizeProjectRecord(state.projects[projectId]) || {
          revision: 0,
          briefRevision: 0,
          updatedAt: now(),
          audit: []
        };
        const model = normalizeResearchChatsModel(input.model);
        const existing = current.researchChats;
        if (existing?.model && sameJson(existing.model, model)) {
          return toModelResponse(projectId, current, "researchChats");
        }
        const updatedAt = now();
        const resource = {
          resourceRevision: Number(existing?.resourceRevision || 0) + 1,
          updatedAt,
          model
        };
        const next = {
          ...current,
          updatedAt,
          researchChats: resource
        };
        state.projects[projectId] = next;
        await persistState(state);
        return toModelResponse(projectId, next, "researchChats");
      });
    },

    getConceptMap(projectId) {
      return readModelRecord(projectId, "conceptMap");
    },

    saveConceptMap(projectId, input = {}) {
      return saveModelResource(projectId, input, "conceptMap");
    },

    getConceptGraphicPlan(projectId) {
      return readModelRecord(projectId, "conceptGraphicPlan");
    },

    saveConceptGraphicPlan(projectId, input = {}) {
      return saveModelResource(projectId, input, "conceptGraphicPlan");
    },

    getOv2(projectId) {
      return readModelRecord(projectId, "ov2");
    },

    saveOv2(projectId, input = {}) {
      return saveModelResource(projectId, input, "ov2");
    },

    getOv3(projectId) {
      return readModelRecord(projectId, "ov3");
    },

    saveOv3(projectId, input = {}) {
      return saveModelResource(projectId, input, "ov3");
    },

    getOv4(projectId) {
      return readModelRecord(projectId, "ov4");
    },

    saveOv4(projectId, input = {}) {
      return saveModelResource(projectId, input, "ov4");
    },

    getOv5a(projectId) {
      return readModelRecord(projectId, "ov5a");
    },

    saveOv5a(projectId, input = {}) {
      return saveModelResource(projectId, input, "ov5a");
    },

    getOv5(projectId) {
      return readModelRecord(projectId, "ov5");
    },

    saveOv5(projectId, input = {}) {
      return saveModelResource(projectId, input, "ov5");
    },

    getOv6a(projectId) {
      return readModelRecord(projectId, "ov6a");
    },

    saveOv6a(projectId, input = {}) {
      return saveModelResource(projectId, input, "ov6a");
    },

    getOv6b(projectId) {
      return readModelRecord(projectId, "ov6b");
    },

    saveOv6b(projectId, input = {}) {
      return saveModelResource(projectId, input, "ov6b");
    },

    getOv6c(projectId) {
      return readModelRecord(projectId, "ov6c");
    },

    saveOv6c(projectId, input = {}) {
      return saveModelResource(projectId, input, "ov6c");
    },

    getOv7(projectId) {
      return readModelRecord(projectId, "ov7");
    },

    saveOv7(projectId, input = {}) {
      return saveModelResource(projectId, input, "ov7");
    },

    getArchitecture(projectId) {
      return readModelRecord(projectId, "architecture");
    },

    saveArchitecture(projectId, input = {}) {
      return saveModelResource(projectId, input, "architecture");
    },

    async exportArchitecture(projectId, { format = "json" } = {}) {
      const state = await loadState();
      const current = normalizeProjectRecord(state.projects[projectId]);
      const catalog = normalizeProjectCatalog(state.projectCatalog, state.projects);
      const meta = catalog[projectId] || { id: projectId, title: projectId };
      const products = {};
      for (const key of ["ov1", "ov1b", "ov1c", "ov2", "ov3", "ov4", "ov5a", "ov5", "ov6a", "ov6b", "ov6c", "ov7"]) {
        if (current?.[key]?.model) products[key] = current[key].model;
      }
      const packageModel = buildArchitectureExchangePackage({
        projectId,
        title: meta.title,
        architecture: current?.architecture?.model || null,
        products,
        lineage: getCurrentLineage(current),
        exportedAt: now()
      });
      const body = encodeArchitecturePackage(packageModel, format === "xml" ? "xml" : "json");
      return {
        projectId,
        format: format === "xml" ? "xml" : "json",
        revision: Number(current?.revision || 0),
        contentType: format === "xml" ? "application/xml" : "application/json",
        package: packageModel,
        body
      };
    },

    importArchitecture(projectId, input = {}) {
      return enqueue(async () => {
        const state = await loadState();
        const current = normalizeProjectRecord(state.projects[projectId]);
        const expectedRevision = normalizeExpectedRevision(input.expectedRevision);
        const currentRevision = Number(current?.revision || 0);
        if (expectedRevision !== null && expectedRevision !== currentRevision) {
          throw createRevisionConflict(expectedRevision, currentRevision);
        }
        const format = clean(input.format, 20) === "xml" ? "xml" : "json";
        const packageModel = input.package
          ? decodeArchitecturePackage(input.package, format)
          : decodeArchitecturePackage(input.body || input.content || input.xml || input.json, format);
        const mergeStrategy = clean(input.mergeStrategy, 40) === "merge-entities" ? "merge-entities" : "replace-products";
        const { resources } = productsFromExchangePackage(packageModel, { mergeStrategy });
        const auditActor = getProjectWriteActor(input);
        const source = getAuditSource(input, auditActor);
        let revision = currentRevision;
        let next = { ...current };
        const imported = [];
        for (const resourceKey of OV_MODEL_RESOURCES) {
          const model = resources[resourceKey];
          if (!model) continue;
          if (mergeStrategy === "merge-entities" && resourceKey === "architecture" && next.architecture?.model) {
            const merged = normalizeProjectArchitecture({
              ...next.architecture.model,
              entities: [...(next.architecture.model.entities || []), ...(model.entities || [])],
              relations: [...(next.architecture.model.relations || []), ...(model.relations || [])],
              products: { ...(next.architecture.model.products || {}), ...(model.products || {}) }
            });
            revision += 1;
            const resource = {
              resourceRevision: Number(next.architecture?.resourceRevision || 0) + 1,
              updatedAt: now(),
              model: merged,
              ...getResourceDefinition("architecture").getLineage(next)
            };
            next = { ...next, revision, updatedAt: resource.updatedAt, architecture: resource };
            imported.push(resourceKey);
            continue;
          }
          const definition = getResourceDefinition(resourceKey);
          const normalized = definition.normalize(model);
          revision += 1;
          const existing = next[resourceKey];
          const lineage = definition.getLineage(next);
          const resource = {
            resourceRevision: Number(existing?.resourceRevision || 0) + 1,
            updatedAt: now(),
            model: normalized,
            ...lineage
          };
          next = { ...next, revision, updatedAt: resource.updatedAt, [resourceKey]: resource };
          imported.push(resourceKey);
        }
        if (!imported.length) throw new Error("Architecture import produced no OV products");
        const updatedAt = now();
        const audit = [
          createAuditEntry({
            revision,
            action: "architecture.imported",
            source,
            actor: auditActor,
            occurredAt: updatedAt,
            summary: `${mergeStrategy}: ${imported.join(",")}`,
            ...getCurrentLineage(next)
          }),
          ...(current?.audit || [])
        ].slice(0, MAX_AUDIT_ENTRIES);
        next = { ...next, revision, updatedAt, audit };
        state.projects[projectId] = next;
        invalidateProjectWorkflow(state, projectId, earliestWorkflowStage(imported));
        await persistState(state);
        return {
          projectId,
          revision,
          mergeStrategy,
          imported,
          package: packageModel,
          resources: Object.fromEntries(imported.map((key) => [key, toModelResponse(projectId, next, key)]))
        };
      });
    },

    getOoda(projectId) {
      return readModelRecord(projectId, "ooda");
    },

    saveOoda(projectId, input = {}) {
      return saveModelResource(projectId, input, "ooda");
    },

    getScenario(projectId) {
      return readModelRecord(projectId, "scenario");
    },

    saveScenario(projectId, input = {}) {
      return saveModelResource(projectId, input, "scenario");
    },

    getValidation(projectId) {
      return readModelRecord(projectId, "validation");
    },

    saveValidation(projectId, input = {}) {
      return saveModelResource(projectId, input, "validation");
    },

    getKnowledge(projectId) {
      return readModelRecord(projectId, "knowledge");
    },

    saveKnowledge(projectId, input = {}) {
      return saveModelResource(projectId, input, "knowledge");
    },

    getKnowledgeCitationApprovals(projectId) {
      return readKnowledgeCitationApprovals(projectId);
    },

    createKnowledgeCitationApproval(projectId, input = {}) {
      return createKnowledgeCitationApproval(projectId, input);
    },

    revokeKnowledgeCitationApproval(projectId, approvalId, input = {}) {
      return revokeKnowledgeCitationApproval(projectId, approvalId, input);
    },

    async searchKnowledge(projectId, query, limit = 5, mode, includeSensitive = false) {
      const state = await loadState();
      const current = normalizeProjectRecord(state.projects[projectId]);
      const resource = current?.knowledge;
      const model = resource?.model;
      const search = searchKnowledgeWithAdapter({
        query,
        docs: model?.docs || [],
        limit: clampSearchLimit(limit),
        mode,
        fallbackMode: knowledgeRetrievalMode,
        includeSensitive
      });
      const selectedMode = resolveKnowledgeRetrievalMode(mode, resolveKnowledgeRetrievalMode(knowledgeRetrievalMode));
      const external = await searchWithExternalVector({
        adapter: externalVectorAdapter,
        selectedMode,
        projectId,
        query,
        docs: model?.docs || [],
        limit: clampSearchLimit(limit),
        includeSensitive,
        localSearch: search
      });
      return {
        ...toModelResponse(projectId, current, "knowledge"),
        query: clean(query, 400),
        limit: clampSearchLimit(limit),
        index: { ...(model?.index || {}), ...search.index, ...external.index },
        results: external.results
      };
    },

    getReportArchives(projectId) {
      return readHistoryRecord(projectId, "reportArchives");
    },

    createReportArchive(projectId, input = {}) {
      return createHistoryItem(projectId, input, "reportArchives");
    },

    deleteReportArchive(projectId, reportId, input = {}) {
      return deleteHistoryItem(projectId, reportId, input, "reportArchives");
    },

    getModelSnapshots(projectId) {
      return readHistoryRecord(projectId, "modelSnapshots");
    },

    createModelSnapshot(projectId, input = {}) {
      return createHistoryItem(projectId, input, "modelSnapshots");
    },

    deleteModelSnapshot(projectId, snapshotId, input = {}) {
      return deleteHistoryItem(projectId, snapshotId, input, "modelSnapshots");
    },

    getCollaboration(projectId) {
      return readCollaboration(projectId);
    },

    createCollaborationReview(projectId, input = {}) {
      return createCollaborationReview(projectId, input);
    },

    resolveCollaborationReview(projectId, reviewId, input = {}) {
      return resolveCollaborationReview(projectId, reviewId, input);
    },

    async listAudit(projectId, limit = 20) {
      const state = await loadState();
      const current = state.projects[projectId];
      return {
        projectId,
        exists: Boolean(current),
        entries: (current?.audit || []).slice(0, clampLimit(limit))
      };
    },

    close() { persistence.close?.(); }
  };

  async function readRecord(projectId) {
    const state = await loadState();
    const current = normalizeProjectRecord(state.projects[projectId]);
    return current?.brief ? toBriefResponse(projectId, current) : { projectId, exists: false, storage: "file", revision: Number(current?.revision || 0) };
  }

  async function readModelRecord(projectId, resourceKey) {
    const state = await loadState();
    const current = normalizeProjectRecord(state.projects[projectId]);
    return current?.[resourceKey]
      ? toModelResponse(projectId, current, resourceKey)
      : toMissingModelResponse(projectId, current, resourceKey);
  }

  function saveModelResource(projectId, input, resourceKey) {
    const definition = getResourceDefinition(resourceKey);
    return enqueue(async () => {
      const state = await loadState();
      const current = normalizeProjectRecord(state.projects[projectId]);
      const model = definition.normalize(input.model);
      const auditActor = getProjectWriteActor(input);
      const source = getAuditSource(input, auditActor);
      const expectedRevision = normalizeExpectedRevision(input.expectedRevision);
      const currentRevision = Number(current?.revision || 0);

      if (expectedRevision !== null && expectedRevision !== currentRevision) {
        throw createRevisionConflict(expectedRevision, currentRevision);
      }

      const lineage = definition.getLineage(current);
      const existing = current?.[resourceKey];
      if (existing?.model && sameJson(existing.model, model) && sameJson(getStoredLineage(existing), lineage)) {
        return toModelResponse(projectId, current, resourceKey);
      }

      const revision = currentRevision + 1;
      const updatedAt = now();
      const resource = {
        resourceRevision: Number(existing?.resourceRevision || 0) + 1,
        updatedAt,
        model,
        ...lineage
      };
      const audit = [
        createAuditEntry({
          revision,
          action: `${resourceKey}.updated`,
          source,
          actor: auditActor,
          occurredAt: updatedAt,
          summary: definition.summarize(model),
          ...lineage
        }),
        ...(current?.audit || [])
      ].slice(0, MAX_AUDIT_ENTRIES);
      const next = { ...current, revision, updatedAt, [resourceKey]: resource, audit };
      state.projects[projectId] = next;
      invalidateProjectWorkflow(state, projectId, workflowStageForResource(resourceKey, input.source));
      await persistState(state);
      return toModelResponse(projectId, next, resourceKey);
    });
  }

  async function readHistoryRecord(projectId, resourceKey) {
    const state = await loadState();
    const current = normalizeProjectRecord(state.projects[projectId]);
    return current?.[resourceKey]
      ? toHistoryResponse(projectId, current, resourceKey)
      : toMissingHistoryResponse(projectId, current);
  }

  async function readCollaboration(projectId) {
    const state = await loadState();
    const current = normalizeProjectRecord(state.projects[projectId]);
    return toCollaborationResponse(projectId, current);
  }

  async function readKnowledgeCitationApprovals(projectId) {
    const state = await loadState();
    const current = normalizeProjectRecord(state.projects[projectId]);
    return { projectId, revision: Number(current?.revision || 0), approvals: normalizeSensitiveCitationApprovals(current?.knowledgeCitationApprovals) };
  }

  function createKnowledgeCitationApproval(projectId, input) {
    return enqueue(async () => {
      const state = await loadState();
      const current = normalizeProjectRecord(state.projects[projectId]);
      const currentRevision = Number(current?.revision || 0);
      requireExpectedRevision(input.expectedRevision, currentRevision);
      const actor = getProjectWriteActor(input);
      if (!actor?.id || !actor.roles?.includes("lead")) throw createForbiddenError("Sensitive citation approval requires a verified lead actor");
      const approval = createSensitiveCitationApproval({ input, docs: current?.knowledge?.model?.docs || [], actor, now, revision: currentRevision + 1 });
      const approvals = normalizeSensitiveCitationApprovals(current?.knowledgeCitationApprovals);
      const duplicate = approvals.find((item) => item.documentId === approval.documentId && !item.revokedAt && item.scope === approval.scope);
      if (duplicate) return { projectId, revision: currentRevision, approval: duplicate, approvals, duplicate: true };
      const revision = currentRevision + 1;
      const updatedAt = now();
      const nextApprovals = [approval, ...approvals];
      const audit = [createAuditEntry({ revision, action: "knowledge.sensitive_citation.approved", source: actor.id, actor, occurredAt: updatedAt, summary: `${approval.documentId}:${approval.scope}`, ...getCurrentLineage(current) }), ...(current?.audit || [])].slice(0, MAX_AUDIT_ENTRIES);
      const next = { ...current, revision, updatedAt, knowledgeCitationApprovals: nextApprovals, audit };
      state.projects[projectId] = next;
      await persistState(state);
      return { projectId, revision, approval, approvals: nextApprovals };
    });
  }

  function revokeKnowledgeCitationApproval(projectId, approvalId, input) {
    return enqueue(async () => {
      const state = await loadState();
      const current = normalizeProjectRecord(state.projects[projectId]);
      const currentRevision = Number(current?.revision || 0);
      requireExpectedRevision(input.expectedRevision, currentRevision);
      const actor = getProjectWriteActor(input);
      if (!actor?.id || !actor.roles?.includes("lead")) throw createForbiddenError("Sensitive citation revocation requires a verified lead actor");
      const id = clean(approvalId, 180);
      const approvals = normalizeSensitiveCitationApprovals(current?.knowledgeCitationApprovals);
      const existing = approvals.find((item) => item.id === id);
      if (!existing) throw createNotFoundError("Sensitive citation approval was not found");
      if (existing.revokedAt) return { projectId, revision: currentRevision, approval: existing, approvals, duplicate: true };
      const revoked = revokeSensitiveCitationApproval(existing, { input, actor, now });
      const revision = currentRevision + 1;
      const updatedAt = now();
      const nextApprovals = approvals.map((item) => item.id === id ? revoked : item);
      const audit = [createAuditEntry({ revision, action: "knowledge.sensitive_citation.revoked", source: actor.id, actor, occurredAt: updatedAt, summary: `${existing.documentId}:${existing.scope}`, ...getCurrentLineage(current) }), ...(current?.audit || [])].slice(0, MAX_AUDIT_ENTRIES);
      const next = { ...current, revision, updatedAt, knowledgeCitationApprovals: nextApprovals, audit };
      state.projects[projectId] = next;
      await persistState(state);
      return { projectId, revision, approval: revoked, approvals: nextApprovals };
    });
  }

  function createCollaborationReview(projectId, input) {
    return enqueue(async () => {
      const state = await loadState();
      const current = normalizeProjectRecord(state.projects[projectId]);
      const currentRevision = Number(current?.revision || 0);
      requireExpectedRevision(input.expectedRevision, currentRevision);
      const actor = requireCollaborationActor(input, "review.create");
      const review = normalizeCollaborationReviewInput(input, current, actor);
      const collaboration = normalizeCollaboration(current?.collaboration);
      if (collaboration.reviews.some((item) => item.id === review.id)) {
        return { ...toCollaborationResponse(projectId, current), review: collaboration.reviews.find((item) => item.id === review.id), duplicate: true };
      }
      const revision = currentRevision + 1;
      const occurredAt = now();
      const storedReview = { ...review, revision, createdAt: occurredAt, lineage: getCurrentLineage(current), reviewContext: createReviewContext(current, review.resource, review.resourceRevision) };
      const nextCollaboration = {
        resourceRevision: Number(collaboration.resourceRevision || 0) + 1,
        updatedAt: occurredAt,
        reviews: [storedReview, ...collaboration.reviews].slice(0, MAX_COLLABORATION_REVIEWS),
        decisions: collaboration.decisions
      };
      const audit = [
        createAuditEntry({ revision, action: "collaboration.review.created", source: actor.id, actor, occurredAt, summary: `${storedReview.resource}:${storedReview.disposition} ${storedReview.summary}`, ...getCurrentLineage(current) }),
        ...(current?.audit || [])
      ].slice(0, MAX_AUDIT_ENTRIES);
      const next = { ...current, revision, updatedAt: occurredAt, collaboration: nextCollaboration, audit };
      state.projects[projectId] = next;
      invalidateProjectWorkflow(state, projectId, workflowStageForResource("collaboration"));
      await persistState(state);
      return { ...toCollaborationResponse(projectId, next), review: storedReview };
    });
  }

  function resolveCollaborationReview(projectId, reviewId, input) {
    return enqueue(async () => {
      const state = await loadState();
      const current = normalizeProjectRecord(state.projects[projectId]);
      const currentRevision = Number(current?.revision || 0);
      requireExpectedRevision(input.expectedRevision, currentRevision);
      const actor = requireCollaborationActor(input, "review.resolve");
      const id = normalizeCollaborationId(reviewId);
      const collaboration = normalizeCollaboration(current?.collaboration);
      const review = collaboration.reviews.find((item) => item.id === id);
      if (!review) throw createNotFoundError("Collaboration review was not found");
      if (collaboration.decisions.some((item) => item.reviewId === id)) throw createConflictError("Collaboration review is already resolved");
      const decision = normalizeCollaborationDecisionInput(input, review, actor);
      const currentResourceRevision = getCollaborationResourceRevision(current, review.resource);
      if (decision.outcome === "accepted" && review.resourceRevision !== currentResourceRevision) {
        throw createConflictError(`Collaboration review target is stale: reviewed ${review.resource} r${review.resourceRevision}, current r${currentResourceRevision}`);
      }
      const revision = currentRevision + 1;
      const occurredAt = now();
      const storedDecision = { ...decision, id: `decision-${revision}-${stableId(`${id}:${occurredAt}`)}`, reviewId: id, revision, decidedAt: occurredAt };
      const nextCollaboration = {
        resourceRevision: Number(collaboration.resourceRevision || 0) + 1,
        updatedAt: occurredAt,
        reviews: collaboration.reviews,
        decisions: [storedDecision, ...collaboration.decisions].slice(0, MAX_COLLABORATION_DECISIONS)
      };
      const audit = [
        createAuditEntry({ revision, action: "collaboration.review.resolved", source: actor.id, actor, occurredAt, summary: `${review.resource}:${storedDecision.outcome} ${storedDecision.summary}`, ...getCurrentLineage(current) }),
        ...(current?.audit || [])
      ].slice(0, MAX_AUDIT_ENTRIES);
      const next = { ...current, revision, updatedAt: occurredAt, collaboration: nextCollaboration, audit };
      state.projects[projectId] = next;
      invalidateProjectWorkflow(state, projectId, workflowStageForResource("collaboration"));
      await persistState(state);
      return { ...toCollaborationResponse(projectId, next), decision: storedDecision };
    });
  }

  function createHistoryItem(projectId, input, resourceKey) {
    const definition = getHistoryDefinition(resourceKey);
    return enqueue(async () => {
      const state = await loadState();
      const current = normalizeProjectRecord(state.projects[projectId]);
      const expectedRevision = normalizeExpectedRevision(input.expectedRevision);
      const currentRevision = Number(current?.revision || 0);
      if (expectedRevision !== null && expectedRevision !== currentRevision) {
        throw createRevisionConflict(expectedRevision, currentRevision);
      }

      const incoming = definition.normalize(input.item);
      if (resourceKey === "reportArchives") {
        const integrity = await verifyReportIntegrity(incoming.payload);
        if (integrity.status === "mismatch") throw new Error("Report archive integrity manifest does not match its payload");
      }
      const existing = current?.[resourceKey];
      const currentItems = Array.isArray(existing?.items) ? existing.items : [];
      const duplicate = incoming.clientId && currentItems.find((item) => item.id === incoming.clientId);
      if (duplicate) return { ...toHistoryResponse(projectId, current, resourceKey), item: duplicate, duplicate: true };

      const revision = currentRevision + 1;
      const savedAt = now();
      const lineage = getCurrentLineage(current);
      const number = currentItems.reduce((highest, item) => Math.max(highest, Number(item.number) || 0), 0) + 1;
      const item = definition.createItem(incoming, { number, revision, savedAt, lineage });
      const auditActor = getProjectWriteActor(input);
      const history = {
        resourceRevision: Number(existing?.resourceRevision || 0) + 1,
        updatedAt: savedAt,
        items: [item, ...currentItems].slice(0, definition.maximum),
        ...lineage
      };
      const audit = [
        createAuditEntry({
          revision,
          action: `${definition.auditPrefix}.created`,
          source: getAuditSource(input, auditActor),
          actor: auditActor,
          occurredAt: savedAt,
          summary: definition.summarize(item),
          ...lineage
        }),
        ...(current?.audit || [])
      ].slice(0, MAX_AUDIT_ENTRIES);
      const next = { ...current, revision, updatedAt: savedAt, [resourceKey]: history, audit };
      state.projects[projectId] = next;
      invalidateProjectWorkflow(state, projectId, workflowStageForResource(resourceKey));
      await persistState(state);
      return { ...toHistoryResponse(projectId, next, resourceKey), item };
    });
  }

  function deleteHistoryItem(projectId, itemId, input, resourceKey) {
    const definition = getHistoryDefinition(resourceKey);
    return enqueue(async () => {
      const state = await loadState();
      const current = normalizeProjectRecord(state.projects[projectId]);
      const expectedRevision = normalizeExpectedRevision(input.expectedRevision);
      const currentRevision = Number(current?.revision || 0);
      if (expectedRevision !== null && expectedRevision !== currentRevision) {
        throw createRevisionConflict(expectedRevision, currentRevision);
      }
      const id = normalizeHistoryItemId(itemId, definition.idPrefix);
      const existing = current?.[resourceKey];
      const currentItems = Array.isArray(existing?.items) ? existing.items : [];
      const removed = currentItems.find((item) => item.id === id);
      if (!removed) return { ...toHistoryResponse(projectId, current, resourceKey), removed: false };

      const revision = currentRevision + 1;
      const updatedAt = now();
      const lineage = getCurrentLineage(current);
      const history = {
        resourceRevision: Number(existing?.resourceRevision || 0) + 1,
        updatedAt,
        items: currentItems.filter((item) => item.id !== id),
        ...lineage
      };
      const auditActor = getProjectWriteActor(input);
      const audit = [
        createAuditEntry({
          revision,
          action: `${definition.auditPrefix}.deleted`,
          source: getAuditSource(input, auditActor),
          actor: auditActor,
          occurredAt: updatedAt,
          summary: definition.summarize(removed),
          ...lineage
        }),
        ...(current?.audit || [])
      ].slice(0, MAX_AUDIT_ENTRIES);
      const next = { ...current, revision, updatedAt, [resourceKey]: history, audit };
      state.projects[projectId] = next;
      invalidateProjectWorkflow(state, projectId, workflowStageForResource(resourceKey));
      await persistState(state);
      return { ...toHistoryResponse(projectId, next, resourceKey), removed: true, removedId: id };
    });
  }

  async function loadState() {
    if (!statePromise) {
      statePromise = persistence.read()
        .then((state) => normalizeState(state))
        .catch((error) => {
          if (error?.code === "ENOENT") return { version: 1, projects: {} };
          throw error;
        });
    }
    return statePromise;
  }

  async function persistState(state) {
    await persistence.write(state);
  }

  function enqueue(operation) {
    const pending = writeQueue.then(operation, operation);
    writeQueue = pending.catch(() => undefined);
    return pending;
  }
}

function createProjectPersistence({ filePath, databasePath }) {
  if (!databasePath) {
    return {
      kind: "file",
      async read() { return JSON.parse(await readFile(filePath, "utf8")); },
      async write(state) {
        const targetDirectory = dirname(filePath);
        await mkdir(targetDirectory, { recursive: true });
        const temporaryPath = `${filePath}.tmp`;
        await writeFile(temporaryPath, JSON.stringify(state, null, 2), "utf8");
        await rename(temporaryPath, filePath);
      }
    };
  }
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  let closed = false;
  database.exec(`
    CREATE TABLE IF NOT EXISTS project_repository_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS project_catalog (project_id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, archived INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, workflow_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS project_records (project_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, brief_revision INTEGER NOT NULL, updated_at TEXT NOT NULL, direction TEXT NOT NULL, brief_json TEXT, inspiration_json TEXT, directions_json TEXT, citation_approvals_json TEXT);
    CREATE TABLE IF NOT EXISTS project_briefs (project_id TEXT PRIMARY KEY, research_intent TEXT NOT NULL DEFAULT '', objective TEXT NOT NULL, approach TEXT NOT NULL, assumptions TEXT NOT NULL, expected_effects TEXT NOT NULL, risk TEXT NOT NULL, evidence_refs_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS project_conversation_messages (project_id TEXT NOT NULL, message_id TEXT NOT NULL, position INTEGER NOT NULL, role TEXT NOT NULL, topic TEXT NOT NULL, source TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (project_id, message_id));
    CREATE TABLE IF NOT EXISTS project_resources (project_id TEXT NOT NULL, resource_key TEXT NOT NULL, resource_json TEXT NOT NULL, PRIMARY KEY (project_id, resource_key));
    CREATE TABLE IF NOT EXISTS project_history_collections (project_id TEXT NOT NULL, collection_key TEXT NOT NULL, collection_json TEXT NOT NULL, PRIMARY KEY (project_id, collection_key));
    CREATE TABLE IF NOT EXISTS project_history_items (project_id TEXT NOT NULL, collection_key TEXT NOT NULL, item_id TEXT NOT NULL, position INTEGER NOT NULL, item_json TEXT NOT NULL, PRIMARY KEY (project_id, collection_key, item_id));
    CREATE TABLE IF NOT EXISTS project_collaboration (project_id TEXT PRIMARY KEY, collaboration_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS project_collaboration_reviews (project_id TEXT NOT NULL, review_id TEXT NOT NULL, position INTEGER NOT NULL, review_json TEXT NOT NULL, PRIMARY KEY (project_id, review_id));
    CREATE TABLE IF NOT EXISTS project_collaboration_decisions (project_id TEXT NOT NULL, review_id TEXT NOT NULL, position INTEGER NOT NULL, decision_json TEXT NOT NULL, PRIMARY KEY (project_id, review_id));
    CREATE TABLE IF NOT EXISTS project_audit_events (project_id TEXT NOT NULL, event_id TEXT NOT NULL, position INTEGER NOT NULL, revision INTEGER NOT NULL, action TEXT NOT NULL, occurred_at TEXT NOT NULL, event_json TEXT NOT NULL, PRIMARY KEY (project_id, event_id));
    CREATE INDEX IF NOT EXISTS idx_project_resources_key ON project_resources(project_id, resource_key);
    CREATE INDEX IF NOT EXISTS idx_project_audit_revision ON project_audit_events(project_id, revision DESC);
  `);
  const briefColumns = database.prepare("PRAGMA table_info(project_briefs)").all();
  if (!briefColumns.some((column) => column.name === "research_intent")) database.exec("ALTER TABLE project_briefs ADD COLUMN research_intent TEXT NOT NULL DEFAULT ''");
  const legacyRead = database.prepare("SELECT payload FROM project_repository_state WHERE id = 1");
  const legacyWrite = database.prepare("INSERT INTO project_repository_state (id, payload, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at");
  const countRecords = database.prepare("SELECT COUNT(*) AS count FROM project_records");
  const countMessages = database.prepare("SELECT COUNT(*) AS count FROM project_conversation_messages");
  const clearStatements = ["project_catalog", "project_records", "project_briefs", "project_conversation_messages", "project_resources", "project_history_collections", "project_history_items", "project_collaboration", "project_collaboration_reviews", "project_collaboration_decisions", "project_audit_events"].map((table) => database.prepare(`DELETE FROM ${table}`));
  const insertCatalog = database.prepare("INSERT INTO project_catalog (project_id, title, description, archived, created_at, updated_at, workflow_json) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const insertRecord = database.prepare("INSERT INTO project_records (project_id, revision, brief_revision, updated_at, direction, brief_json, inspiration_json, directions_json, citation_approvals_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertBrief = database.prepare("INSERT INTO project_briefs (project_id, research_intent, objective, approach, assumptions, expected_effects, risk, evidence_refs_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const insertMessage = database.prepare("INSERT INTO project_conversation_messages (project_id, message_id, position, role, topic, source, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const insertResource = database.prepare("INSERT INTO project_resources (project_id, resource_key, resource_json) VALUES (?, ?, ?)");
  const insertHistory = database.prepare("INSERT INTO project_history_collections (project_id, collection_key, collection_json) VALUES (?, ?, ?)");
  const insertHistoryItem = database.prepare("INSERT INTO project_history_items (project_id, collection_key, item_id, position, item_json) VALUES (?, ?, ?, ?, ?)");
  const insertCollaboration = database.prepare("INSERT INTO project_collaboration (project_id, collaboration_json) VALUES (?, ?)");
  const insertReview = database.prepare("INSERT INTO project_collaboration_reviews (project_id, review_id, position, review_json) VALUES (?, ?, ?, ?)");
  const insertDecision = database.prepare("INSERT INTO project_collaboration_decisions (project_id, review_id, position, decision_json) VALUES (?, ?, ?, ?)");
  const insertAudit = database.prepare("INSERT INTO project_audit_events (project_id, event_id, position, revision, action, occurred_at, event_json) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const resourceKeys = [
    "forceMissionPlan",
    "phaseActionConcept",
    "conceptMap",
    "conceptGraphicPlan",
    "researchChats",
    "ov1",
    "ov1b",
    "ov1c",
    "ov2",
    "ov3",
    "ov4",
    "ov5a",
    "ov5",
    "ov6a",
    "ov6b",
    "ov6c",
    "ov7",
    "architecture",
    "ooda",
    "scenario",
    "validation",
    "knowledge"
  ];
  const historyKeys = ["reportArchives", "modelSnapshots"];
  // One-time bootstrap after schema exists: empty SQLite inherits projects.json, then all writes stay in DB.
  bootstrapSqliteFromFileIfEmpty({
    filePath,
    countRecords,
    legacyRead,
    legacyWrite,
    writeNormalizedState: (state) => writeNormalizedState(state)
  });
  return {
    kind: "sqlite",
    databasePath,
    fileBootstrapPath: filePath,
    async read() {
      if (Number(countRecords.get()?.count || 0) > 0) {
        const state = readNormalizedState();
        if (Number(countMessages.get()?.count || 0) === 0 && Object.values(state.projects).some((record) => record?.inspiration?.messages?.length)) writeNormalizedState(state);
        return state;
      }
      const row = legacyRead.get();
      if (!row?.payload) { const error = new Error("Project repository is empty"); error.code = "ENOENT"; throw error; }
      const legacy = JSON.parse(row.payload);
      writeNormalizedState(legacy);
      return legacy;
    },
    async write(state) { writeNormalizedState(state); },
    close() { if (!closed) { database.close(); closed = true; } }
  };

  function writeNormalizedState(state) {
    const catalog = state?.projectCatalog && typeof state.projectCatalog === "object" ? state.projectCatalog : {};
    const projects = state?.projects && typeof state.projects === "object" ? state.projects : {};
    database.exec("BEGIN IMMEDIATE");
    try {
      clearStatements.forEach((statement) => statement.run());
      Object.entries(catalog).forEach(([projectId, project]) => insertCatalog.run(projectId, project.title || projectId, project.description || "", project.archived ? 1 : 0, project.createdAt || "", project.updatedAt || "", JSON.stringify(project.workflow || {})));
      Object.entries(projects).forEach(([projectId, raw]) => {
        const record = raw && typeof raw === "object" ? raw : {};
        const inspiration = record.inspiration && typeof record.inspiration === "object" ? record.inspiration : null;
        const messages = Array.isArray(inspiration?.messages) ? inspiration.messages : [];
        const { messages: ignoredMessages, ...inspirationMeta } = inspiration || {};
        insertRecord.run(projectId, Number(record.revision || 0), Number(record.briefRevision || record.revision || 0), record.updatedAt || "", record.direction || "", null, json(inspiration ? inspirationMeta : null), json(record.directions), json(record.knowledgeCitationApprovals));
        if (record.brief && typeof record.brief === "object") insertBrief.run(projectId, record.brief.researchIntent || "", record.brief.objective || "待补充", record.brief.approach || "待补充", record.brief.assumptions || "待补充", record.brief.expectedEffects || "待补充", record.brief.risk || "待补充", json(record.brief.evidenceRefs || []));
        messages.forEach((message, position) => insertMessage.run(projectId, String(message?.id || `message-${position}`), position, String(message?.role || ""), String(message?.topic || ""), String(message?.source || ""), String(message?.text || ""), String(message?.createdAt || "")));
        resourceKeys.forEach((key) => { if (record[key] !== undefined) insertResource.run(projectId, key, json(record[key])); });
        historyKeys.forEach((key) => {
          const collection = record[key];
          if (!collection || typeof collection !== "object") return;
          const { items = [], ...meta } = collection;
          insertHistory.run(projectId, key, json(meta));
          (Array.isArray(items) ? items : []).forEach((item, position) => insertHistoryItem.run(projectId, key, String(item?.id || `${key}-${position}`), position, json(item)));
        });
        const collaboration = record.collaboration;
        if (collaboration && typeof collaboration === "object") {
          const { reviews = [], decisions = [], ...meta } = collaboration;
          insertCollaboration.run(projectId, json(meta));
          (Array.isArray(reviews) ? reviews : []).forEach((review, position) => insertReview.run(projectId, String(review?.id || `review-${position}`), position, json(review)));
          (Array.isArray(decisions) ? decisions : []).forEach((decision, position) => insertDecision.run(projectId, String(decision?.reviewId || `decision-${position}`), position, json(decision)));
        }
        (Array.isArray(record.audit) ? record.audit : []).forEach((event, position) => insertAudit.run(projectId, String(event?.id || `audit-${position}`), position, Number(event?.revision || 0), String(event?.action || ""), String(event?.occurredAt || ""), json(event)));
      });
      legacyWrite.run(JSON.stringify(state), new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  function readNormalizedState() {
    const state = { version: 1, projectCatalog: {}, projects: {} };
    database.prepare("SELECT * FROM project_catalog").all().forEach((row) => { state.projectCatalog[row.project_id] = { id: row.project_id, title: row.title, description: row.description, archived: Boolean(row.archived), createdAt: row.created_at, updatedAt: row.updated_at, workflow: parse(row.workflow_json, {}) }; });
    database.prepare("SELECT * FROM project_records").all().forEach((row) => { state.projects[row.project_id] = { revision: Number(row.revision || 0), briefRevision: Number(row.brief_revision || 0), updatedAt: row.updated_at, direction: row.direction, brief: parse(row.brief_json, null), inspiration: parse(row.inspiration_json, null), directions: parse(row.directions_json, []), knowledgeCitationApprovals: parse(row.citation_approvals_json, []), audit: [] }; });
    database.prepare("SELECT * FROM project_briefs").all().forEach((row) => { if (state.projects[row.project_id]) state.projects[row.project_id].brief = { researchIntent: row.research_intent || "", objective: row.objective, approach: row.approach, assumptions: row.assumptions, expectedEffects: row.expected_effects, risk: row.risk, evidenceRefs: parse(row.evidence_refs_json, []) }; });
    database.prepare("SELECT * FROM project_conversation_messages ORDER BY project_id, position").all().forEach((row) => { const record = state.projects[row.project_id]; if (!record) return; record.inspiration = { ...(record.inspiration || {}), messages: [...(record.inspiration?.messages || []), { id: row.message_id, role: row.role, topic: row.topic, source: row.source, text: row.text, createdAt: row.created_at }] }; });
    database.prepare("SELECT * FROM project_resources").all().forEach((row) => { if (state.projects[row.project_id]) state.projects[row.project_id][row.resource_key] = parse(row.resource_json, null); });
    database.prepare("SELECT * FROM project_history_collections").all().forEach((row) => { if (state.projects[row.project_id]) state.projects[row.project_id][row.collection_key] = { ...parse(row.collection_json, {}), items: [] }; });
    database.prepare("SELECT * FROM project_history_items ORDER BY project_id, collection_key, position").all().forEach((row) => { const collection = state.projects[row.project_id]?.[row.collection_key]; if (collection) collection.items.push(parse(row.item_json, {})); });
    database.prepare("SELECT * FROM project_collaboration").all().forEach((row) => { if (state.projects[row.project_id]) state.projects[row.project_id].collaboration = { ...parse(row.collaboration_json, {}), reviews: [], decisions: [] }; });
    database.prepare("SELECT * FROM project_collaboration_reviews ORDER BY project_id, position").all().forEach((row) => { const collaboration = state.projects[row.project_id]?.collaboration; if (collaboration) collaboration.reviews.push(parse(row.review_json, {})); });
    database.prepare("SELECT * FROM project_collaboration_decisions ORDER BY project_id, position").all().forEach((row) => { const collaboration = state.projects[row.project_id]?.collaboration; if (collaboration) collaboration.decisions.push(parse(row.decision_json, {})); });
    database.prepare("SELECT * FROM project_audit_events ORDER BY project_id, position").all().forEach((row) => { if (state.projects[row.project_id]) state.projects[row.project_id].audit.push(parse(row.event_json, {})); });
    return state;
  }

  function json(value) { return value === undefined ? null : JSON.stringify(value); }
  function parse(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
}

/**
 * If SQLite has no project records and no legacy payload, copy projects.json once.
 * Subsequent reads/writes stay entirely in the database (normalized tables + legacy snapshot).
 */
function bootstrapSqliteFromFileIfEmpty({ filePath, countRecords, legacyRead, legacyWrite, writeNormalizedState }) {
  try {
    if (Number(countRecords.get()?.count || 0) > 0) return;
    if (legacyRead.get()?.payload) return;
    if (!filePath || !existsSync(filePath)) return;
    const raw = readFileSync(filePath, "utf8");
    const source = JSON.parse(raw);
    if (!source || typeof source !== "object" || !source.projects || typeof source.projects !== "object") return;
    writeNormalizedState(source);
    legacyWrite.run(JSON.stringify(source), new Date().toISOString());
  } catch {
    // Leave SQLite empty; repository will report ENOENT until first write.
  }
}

async function searchWithExternalVector({ adapter, selectedMode, projectId, query, docs, limit, includeSensitive, localSearch }) {
  if (!adapter || !["vector", "hybrid"].includes(selectedMode)) {
    return { results: localSearch.results, index: { externalVector: { adapter: "external-vector-id-only", status: "not-applicable" } } };
  }
  const external = await adapter.search({ projectId, query, docs, limit });
  const provenance = external?.provenance || { adapter: "external-vector-id-only", status: "fallback", reason: "invalid-adapter-response" };
  if (provenance.status !== "used") return { results: localSearch.results, index: { externalVector: provenance } };

  if (selectedMode === "vector") {
    return {
      results: includeSensitive
        ? combineKnowledgeRankings(external.results, localSearch.results.filter(isSensitiveKnowledge), limit)
        : external.results,
      index: { backend: includeSensitive ? "external-vector-local-sensitive-review" : "external-vector", externalVector: provenance }
    };
  }
  const keyword = searchKnowledgeWithAdapter({ query, docs, limit, mode: "keyword", includeSensitive });
  return {
    results: combineKnowledgeRankings(keyword.results, external.results, limit),
    index: { backend: "hybrid-rrf-external-vector", externalVector: provenance }
  };
}

function normalizeState(value) {
  if (!value || typeof value !== "object" || !value.projects || typeof value.projects !== "object") return { version: 1, projects: {}, projectCatalog: {} };
  return { version: 1, projects: value.projects, projectCatalog: normalizeProjectCatalog(value.projectCatalog, value.projects) };
}

function normalizeProjectCatalog(value, projects = {}) {
  const catalog = Object.entries(value && typeof value === "object" ? value : {}).reduce((result, [id, item]) => {
    try { const project = normalizeProjectMeta({ ...item, id }, item?.createdAt || ""); result[project.id] = project; } catch { /* Ignore malformed catalog entries. */ }
    return result;
  }, {});
  for (const id of Object.keys(projects || {})) {
    const projectId = normalizeProjectId(id);
    if (!catalog[projectId]) catalog[projectId] = { id: projectId, title: projectId === "default" ? "\u4f5c\u6218\u6982\u5ff5\u7814\u7a76" : projectId, description: "", archived: false, workflow: normalizeWorkflow(), createdAt: "", updatedAt: "" };
  }
  return catalog;
}

function normalizeProjectMeta(value, timestamp) {
  const id = normalizeProjectId(value?.id);
  const title = clean(value?.title, 120);
  if (!title) throw new Error("Project title is required");
  const createdAt = clean(value?.createdAt || timestamp, 80);
  return { id, title, description: clean(value?.description, 500), archived: Boolean(value?.archived), workflow: normalizeWorkflow(value?.workflow), createdAt, updatedAt: clean(value?.updatedAt || timestamp, 80) };
}

function normalizeWorkflow(value) {
  const workflow = normalizeWorkflowProgress(value);
  return { version: workflow.version, mode: workflow.mode, completedThrough: workflow.completedThrough, updatedAt: clean(value?.updatedAt, 80) };
}

function invalidateProjectWorkflow(state, projectId, changedStage) {
  if (!Number.isInteger(changedStage)) return;
  const catalog = normalizeProjectCatalog(state.projectCatalog, state.projects);
  const current = catalog[projectId];
  if (!current || current.workflow.completedThrough < changedStage) return;
  catalog[projectId] = { ...current, workflow: { ...current.workflow, completedThrough: changedStage - 1, updatedAt: new Date().toISOString() } };
  state.projectCatalog = catalog;
}

function projectSummary(project, record) { return { ...project, revision: Number(record?.revision || 0), updatedAt: clean(record?.updatedAt || project.updatedAt, 80) }; }

function normalizeProjectId(value) {
  const id = clean(value, 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(id)) throw new Error("Project identifier is invalid");
  return id;
}


function normalizeProjectRecord(value) {
  if (!value || typeof value !== "object") return null;
  const record = {
    ...value,
    revision: Number(value.revision || 0),
    briefRevision: Number(value.briefRevision || value.revision || 0),
    inspiration: normalizeInspirationSnapshot(value.inspiration),
    audit: Array.isArray(value.audit) ? value.audit : [],
    knowledgeCitationApprovals: normalizeSensitiveCitationApprovals(value.knowledgeCitationApprovals)
  };
  if (record.ov5 && typeof record.ov5 === "object" && record.ov5.briefRevision === undefined) {
    record.ov5 = { ...record.ov5, briefRevision: record.briefRevision };
  }
  return record;
}

function normalizeBrief(value) {
  const brief = BRIEF_FIELDS.reduce((brief, field) => {
    brief[field] = clean(value?.[field], 4000) || "待补充";
    return brief;
  }, {});
  const refs = Array.isArray(value?.evidenceRefs) ? value.evidenceRefs : String(value?.evidenceRefs || "").split(/[，,、;；\n]/);
  brief.evidenceRefs = [...new Set(refs.map((item) => clean(item, 240)).filter(Boolean))].slice(0, 16);
  return brief;
}

function toBriefResponse(projectId, record) {
  return {
    projectId,
    exists: true,
    storage: "file",
    revision: record.revision,
    resourceRevision: Number(record.briefRevision || 0),
    briefRevision: Number(record.briefRevision || 0),
    updatedAt: record.updatedAt,
    direction: record.direction,
    brief: record.brief,
    inspiration: record.inspiration,
    directions: normalizeCustomDirections(record.directions),
    auditCount: record.audit?.length || 0
  };
}

function normalizeCustomDirections(value) {
  const titles = new Set();
  return (Array.isArray(value) ? value : []).reduce((items, item) => {
    if (items.length >= 8) return items;
    const title = clean(item?.title, 80);
    const text = clean(item?.text, 500);
    const basis = clean(item?.basis, 500);
    if (!title || !text || !basis || titles.has(title)) return items;
    titles.add(title);
    items.push({ id: `custom-${items.length + 1}`, title, text, basis, custom: true });
    return items;
  }, []);
}

function normalizeInspirationSnapshot(value) {
  if (!value || typeof value !== "object") return null;
  const messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeInspirationMessage).filter(Boolean).slice(-16)
    : [];
  if (!messages.length) return null;
  return {
    stage: Math.max(0, Math.min(6, Number(value.stage) || 0)),
    totalStages: Math.max(1, Math.min(6, Number(value.totalStages) || 6)),
    completed: Boolean(value.completed),
    summary: clean(value.summary, 4000),
    messages
  };
}

function normalizeInspirationMessage(value) {
  // Drop in-flight typing bubbles — only durable turns belong in the project store.
  if (value?.pending) return null;
  const role = value?.role === "user" ? "user" : value?.role === "assistant" ? "assistant" : "";
  const text = clean(value?.text, 800);
  if (!role || !text) return null;
  const sourceRaw = clean(value?.source, 16);
  const source = ["ai", "local", "error", "cancelled"].includes(sourceRaw) ? sourceRaw : "";
  const id = clean(value?.id, 80);
  return {
    ...(id ? { id } : {}),
    role,
    topic: clean(value?.topic, 64),
    source,
    text,
    truncated: Boolean(value?.truncated),
    createdAt: clean(value?.createdAt, 80)
  };
}

/** Step research chats (phase / force / rule / sequence / state-machine) persisted as one project resource. */
function normalizeResearchChatsModel(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    version: 1,
    phaseAction: normalizeResearchChatSessionSnapshot(source.phaseAction),
    forceMission: normalizeResearchChatSessionSnapshot(source.forceMission),
    ruleLibrary: normalizeResearchChatSessionSnapshot(source.ruleLibrary),
    sequence: normalizeResearchChatSessionSnapshot(source.sequence),
    stateMachine: normalizeResearchChatSessionSnapshot(source.stateMachine)
  };
}

function normalizeResearchChatSessionSnapshot(value, { maxMessages = 48 } = {}) {
  if (!value || typeof value !== "object") return null;
  const messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeResearchChatMessageSnapshot).filter(Boolean).slice(-maxMessages)
    : [];
  if (!messages.length) return null;
  return {
    version: 1,
    messages
  };
}

function normalizeResearchChatMessageSnapshot(value) {
  if (value?.pending) return null;
  const role = value?.role === "user" ? "user" : value?.role === "assistant" ? "assistant" : "";
  const text = clean(value?.text, 800);
  if (!role || !text) return null;
  const sourceRaw = clean(value?.source, 16);
  const source = ["ai", "local", "error", "cancelled"].includes(sourceRaw) ? sourceRaw : "";
  const id = clean(value?.id, 80);
  return {
    ...(id ? { id } : {}),
    role,
    topic: clean(value?.topic, 64),
    source,
    text,
    truncated: Boolean(value?.truncated),
    createdAt: clean(value?.createdAt, 80)
  };
}

function toMissingModelResponse(projectId, record) {
  return {
    projectId,
    exists: false,
    storage: "file",
    revision: Number(record?.revision || 0),
    resourceRevision: 0,
    stale: false,
    model: null,
    auditCount: record?.audit?.length || 0
  };
}

function toModelResponse(projectId, record, resourceKey) {
  const definition = getResourceDefinition(resourceKey);
  const resource = record?.[resourceKey] || {};
  const lineage = getStoredLineage(resource);
  return {
    projectId,
    exists: Boolean(record?.[resourceKey]),
    storage: "file",
    revision: Number(record?.revision || 0),
    resourceRevision: Number(resource.resourceRevision || 0),
    updatedAt: resource.updatedAt || record?.updatedAt,
    model: resource.model || null,
    auditCount: record?.audit?.length || 0,
    stale: definition.isStale(resource, record),
    ...lineage
  };
}

function toMissingHistoryResponse(projectId, record) {
  return {
    projectId,
    exists: false,
    storage: "file",
    revision: Number(record?.revision || 0),
    resourceRevision: 0,
    updatedAt: record?.updatedAt,
    auditCount: record?.audit?.length || 0,
    items: [],
    stale: false,
    historical: true
  };
}

function toHistoryResponse(projectId, record, resourceKey) {
  const resource = record?.[resourceKey] || {};
  return {
    projectId,
    exists: Boolean(record?.[resourceKey]),
    storage: "file",
    revision: Number(record?.revision || 0),
    resourceRevision: Number(resource.resourceRevision || 0),
    updatedAt: resource.updatedAt || record?.updatedAt,
    auditCount: record?.audit?.length || 0,
    items: Array.isArray(resource.items) ? resource.items : [],
    stale: false,
    historical: true,
    ...getStoredLineage(resource)
  };
}

function toCollaborationResponse(projectId, record) {
  const collaboration = normalizeCollaboration(record?.collaboration);
  const decisionsByReview = new Map(collaboration.decisions.map((decision) => [decision.reviewId, decision]));
  const reviews = collaboration.reviews.map((review) => {
    const decision = decisionsByReview.get(review.id) || null;
    const currentResourceRevision = getCollaborationResourceRevision(record, review.resource);
    return {
      ...review,
      state: decision ? decision.outcome : "open",
      freshness: review.resourceRevision === currentResourceRevision ? "current" : "stale",
      currentResourceRevision,
      decision
    };
  });
  return {
    projectId,
    exists: Boolean(record),
    revision: Number(record?.revision || 0),
    resourceRevision: Number(collaboration.resourceRevision || 0),
    updatedAt: collaboration.updatedAt || record?.updatedAt || "",
    policy: getCollaborationPolicy(),
    reviews,
    decisionCount: collaboration.decisions.length,
    openCount: reviews.filter((review) => review.state === "open").length
  };
}

function normalizeCollaboration(value) {
  const reviews = Array.isArray(value?.reviews) ? value.reviews.map(normalizeStoredReview).filter(Boolean).slice(0, MAX_COLLABORATION_REVIEWS) : [];
  const reviewIds = new Set(reviews.map((review) => review.id));
  const decisions = Array.isArray(value?.decisions) ? value.decisions.map(normalizeStoredDecision).filter((decision) => decision && reviewIds.has(decision.reviewId)).slice(0, MAX_COLLABORATION_DECISIONS) : [];
  return {
    resourceRevision: Number(value?.resourceRevision || 0),
    updatedAt: clean(value?.updatedAt, 80),
    reviews,
    decisions
  };
}

function normalizeStoredReview(value) {
  if (!value || typeof value !== "object") return null;
  const id = clean(value.id, 180);
  if (!/^review-[A-Za-z0-9_-]{1,170}$/.test(id)) return null;
  const resource = clean(value.resource, 40);
  if (!COLLABORATION_RESOURCES.has(resource)) return null;
  return {
    id,
    resource,
    resourceRevision: Number(value.resourceRevision || 0),
    disposition: ["comment", "request_changes", "approve"].includes(value.disposition) ? value.disposition : "comment",
    summary: clean(value.summary, 1200),
    evidenceRefs: normalizeStoredReviewEvidenceRefs(value.evidenceRefs),
    actor: normalizeStoredActor(value.actor),
    revision: Number(value.revision || 0),
    createdAt: clean(value.createdAt, 80),
    lineage: getStoredLineage(value.lineage),
    reviewContext: normalizeReviewContext(value.reviewContext, resource, Number(value.resourceRevision || 0))
  };
}

function normalizeStoredReviewEvidenceRefs(value) {
  const items = Array.isArray(value) ? value : [];
  return [...new Set(items.map((item) => clean(item, 180)).filter(Boolean))].slice(0, 12);
}

function createReviewContext(record, resource, resourceRevision) {
  const model = resource === "brief"
    ? record?.brief || {}
    : resource === "report"
      ? record?.reportArchives || {}
      : record?.[resource]?.model || {};
  const counts = reviewContextCounts(resource, model);
  const lineage = resource === "brief" ? { briefRevision: Number(record?.briefRevision || 0) } : getStoredLineage(record?.[resource]);
  return { modelKind: resource, resourceRevision: Number(resourceRevision || 0), primaryCount: counts.primaryCount, secondaryCount: counts.secondaryCount, lineage };
}

function normalizeReviewContext(value, resource, resourceRevision) {
  const context = value && typeof value === "object" ? value : {};
  return {
    modelKind: clean(context.modelKind, 40) || resource,
    resourceRevision: Math.max(0, Number(context.resourceRevision || resourceRevision || 0)),
    primaryCount: Math.max(0, Math.min(10000, Number(context.primaryCount || 0))),
    secondaryCount: Math.max(0, Math.min(10000, Number(context.secondaryCount || 0))),
    lineage: getStoredLineage(context.lineage)
  };
}

function reviewContextCounts(resource, model) {
  if (resource === "brief") return { primaryCount: [model.objective, model.approach, model.assumptions, model.expectedEffects, model.risk].filter(Boolean).length, secondaryCount: Array.isArray(model.evidenceRefs) ? model.evidenceRefs.length : 0 };
  if (resource === "forceMissionPlan") {
    return {
      primaryCount: (Array.isArray(model.forces) ? model.forces.length : 0) + (Array.isArray(model.combatForces) ? model.combatForces.length : 0),
      secondaryCount: Array.isArray(model.relations) ? model.relations.length : 0
    };
  }
  if (resource === "phaseActionConcept") return { primaryCount: Array.isArray(model.phases) ? model.phases.length : 0, secondaryCount: Array.isArray(model.transitions) ? model.transitions.length : 0 };
  if (resource === "conceptMap") return { primaryCount: Number(model.summary?.itemCount || 0), secondaryCount: String(model.context || "").length ? 1 : 0 };
  if (resource === "conceptGraphicPlan") return { primaryCount: Array.isArray(model.nodes) ? model.nodes.length : 0, secondaryCount: Array.isArray(model.edges) ? model.edges.length : 0 };
  if (resource === "ov1") return { primaryCount: Array.isArray(model.nodes) ? model.nodes.length : 0, secondaryCount: Array.isArray(model.edges) ? model.edges.length : 0 };
  if (resource === "ov1b") return { primaryCount: Array.isArray(model.taskGroups) ? model.taskGroups.length : 0, secondaryCount: 0 };
  if (resource === "ov1c" || resource === "ov7") return {
    primaryCount: Array.isArray(model.mappings) ? model.mappings.length : 0,
    secondaryCount: Array.isArray(model.mappings) ? model.mappings.filter((item) => item.status === "conflict").length : 0
  };
  if (resource === "ov5") return { primaryCount: Array.isArray(model.activities) ? model.activities.length : 0, secondaryCount: Array.isArray(model.edges) ? model.edges.length : 0 };
  if (resource === "ooda") return { primaryCount: (Array.isArray(model.lanes) ? model.lanes : []).reduce((count, lane) => count + (lane.nodes?.length || 0), 0), secondaryCount: Array.isArray(model.lanes) ? model.lanes.length : 0 };
  if (resource === "scenario") return { primaryCount: Array.isArray(model.entities) ? model.entities.length : 0, secondaryCount: Array.isArray(model.timeline) ? model.timeline.length : 0 };
  if (resource === "validation") return { primaryCount: Array.isArray(model.scores) ? model.scores.length : 0, secondaryCount: Array.isArray(model.issues) ? model.issues.length : 0 };
  if (resource === "knowledge") return { primaryCount: Array.isArray(model.docs) ? model.docs.length : 0, secondaryCount: Number(model.summary?.chunkCount || 0) };
  if (resource === "report") return { primaryCount: Array.isArray(model.items) ? model.items.length : 0, secondaryCount: 0 };
  return { primaryCount: 0, secondaryCount: 0 };
}

function normalizeStoredDecision(value) {
  if (!value || typeof value !== "object") return null;
  const reviewId = clean(value.reviewId, 180);
  const id = clean(value.id, 180);
  if (!/^review-[A-Za-z0-9_-]{1,170}$/.test(reviewId) || !/^decision-[A-Za-z0-9_-]{1,170}$/.test(id)) return null;
  return {
    id,
    reviewId,
    outcome: ["accepted", "rejected"].includes(value.outcome) ? value.outcome : "rejected",
    summary: clean(value.summary, 1200),
    actor: normalizeStoredActor(value.actor),
    revision: Number(value.revision || 0),
    decidedAt: clean(value.decidedAt, 80)
  };
}

function normalizeStoredActor(value) {
  return {
    id: clean(value?.id, 80),
    label: clean(value?.label, 160),
    roles: Array.isArray(value?.roles) ? value.roles.map((item) => clean(item, 80)).filter(Boolean).slice(0, 8) : []
  };
}

function normalizeCollaborationReviewInput(input, record, actor) {
  const resource = clean(input.resource, 40);
  if (!COLLABORATION_RESOURCES.has(resource)) throw new Error("Collaboration review resource is invalid");
  const resourceRevision = Number(input.resourceRevision);
  if (!Number.isInteger(resourceRevision) || resourceRevision < 0) throw new Error("Collaboration review resource revision is invalid");
  const currentResourceRevision = getCollaborationResourceRevision(record, resource);
  if (resourceRevision !== currentResourceRevision) throw createConflictError(`Collaboration review resource revision conflict: expected ${resourceRevision}, current ${currentResourceRevision}`);
  const summary = clean(input.summary, 1200);
  if (!summary) throw new Error("Collaboration review summary is required");
  const clientId = clean(input.clientId, 180) || `review-${stableId(`${actor.id}:${resource}:${resourceRevision}:${summary}`)}`;
  if (!/^review-[A-Za-z0-9_-]{1,170}$/.test(clientId)) throw new Error("Collaboration review identifier is invalid");
  return {
    id: clientId,
    resource,
    resourceRevision,
    disposition: ["comment", "request_changes", "approve"].includes(input.disposition) ? input.disposition : "comment",
    summary,
    evidenceRefs: normalizeReviewEvidenceRefs(input.evidenceRefs, record?.knowledge?.model?.docs),
    actor
  };
}

function normalizeReviewEvidenceRefs(value, docs) {
  const permitted = new Set((Array.isArray(docs) ? docs : [])
    .filter((document) => document?.id && !isSensitiveKnowledge(document))
    .map((document) => clean(document.id, 180)));
  return normalizeStoredReviewEvidenceRefs(value).filter((id) => permitted.has(id));
}

function normalizeCollaborationDecisionInput(input, review, actor) {
  const outcome = clean(input.outcome, 40);
  if (!["accepted", "rejected"].includes(outcome)) throw new Error("Collaboration decision outcome is invalid");
  const summary = clean(input.summary, 1200);
  if (!summary) throw new Error("Collaboration decision summary is required");
  return { outcome, summary, actor, reviewResource: review.resource, reviewResourceRevision: review.resourceRevision };
}

function getCollaborationResourceRevision(record, resource) {
  if (resource === "brief") return Number(record?.briefRevision || 0);
  if (resource === "report") return Number(record?.reportArchives?.resourceRevision || 0);
  return Number(record?.[resource]?.resourceRevision || 0);
}

function getResourceDefinition(resourceKey) {
  const definitions = {
    researchChats: {
      normalize: normalizeResearchChatsModel,
      getLineage: () => ({}),
      isStale: () => false,
      summarize: (model) => {
        const count = (session) => (Array.isArray(session?.messages) ? session.messages.length : 0);
        return `phase ${count(model?.phaseAction)} / force ${count(model?.forceMission)} / rules ${count(model?.ruleLibrary)} / seq ${count(model?.sequence)} / sm ${count(model?.stateMachine)}`;
      }
    },
    phaseActionConcept: {
      normalize: normalizeProjectPhaseActionConcept,
      getLineage: (record) => ({ briefRevision: Number(record?.briefRevision || 0) }),
      isStale: (resource, record) => Number(resource?.briefRevision || 0) !== Number(record?.briefRevision || 0),
      summarize: (model) => `${model.phases?.length || 0} phases / ${model.transitions?.length || 0} transitions / ${model.status || "empty"}`
    },
    forceMissionPlan: {
      normalize: normalizeProjectForceMissionPlan,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        phaseActionConceptRevision: Number(record?.phaseActionConcept?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.briefRevision || 0) !== Number(record?.briefRevision || 0)
        || Number(resource?.phaseActionConceptRevision || 0) !== Number(record?.phaseActionConcept?.resourceRevision || 0),
      summarize: (model) => `${model.forces?.length || 0} concept / ${model.combatForces?.length || 0} combat / ${model.relations?.length || 0} relations / ${model.status || "empty"}`
    },
    conceptMap: {
      normalize: normalizeProjectConceptMap,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        forceMissionPlanRevision: Number(record?.forceMissionPlan?.resourceRevision || 0),
        phaseActionConceptRevision: Number(record?.phaseActionConcept?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.briefRevision || 0) !== Number(record?.briefRevision || 0)
        || Number(resource?.forceMissionPlanRevision || 0) !== Number(record?.forceMissionPlan?.resourceRevision || 0)
        || Number(resource?.phaseActionConceptRevision || 0) !== Number(record?.phaseActionConcept?.resourceRevision || 0),
      summarize: (model) => `${model.summary?.itemCount || 0} map items / ${model.summary?.layers?.length || 0} layers`
    },
    conceptGraphicPlan: {
      normalize: normalizeProjectConceptGraphicPlan,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        forceMissionPlanRevision: Number(record?.forceMissionPlan?.resourceRevision || 0),
        phaseActionConceptRevision: Number(record?.phaseActionConcept?.resourceRevision || 0),
        conceptMapRevision: Number(record?.conceptMap?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.briefRevision || 0) !== Number(record?.briefRevision || 0)
        || Number(resource?.forceMissionPlanRevision || 0) !== Number(record?.forceMissionPlan?.resourceRevision || 0)
        || Number(resource?.phaseActionConceptRevision || 0) !== Number(record?.phaseActionConcept?.resourceRevision || 0)
        || Number(resource?.conceptMapRevision || 0) !== Number(record?.conceptMap?.resourceRevision || 0),
      summarize: (model) => `${model.nodes?.length || 0} nodes / ${model.edges?.length || 0} edges / ${model.status || "empty"}`
    },
    ov1: {
      normalize: normalizeProjectOv1,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        conceptMapRevision: Number(record?.conceptMap?.resourceRevision || 0),
        conceptGraphicPlanRevision: Number(record?.conceptGraphicPlan?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.briefRevision || 0) !== Number(record?.briefRevision || 0)
        || Number(resource?.conceptMapRevision || 0) !== Number(record?.conceptMap?.resourceRevision || 0)
        || Number(resource?.conceptGraphicPlanRevision || 0) !== Number(record?.conceptGraphicPlan?.resourceRevision || 0),
      summarize: (model) => `${model.nodes?.length || model.entities?.length || 0} nodes / ${model.edges?.length || model.relations?.length || 0} edges`
    },
    ov1b: {
      normalize: normalizeProjectOv1b,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        forceMissionPlanRevision: Number(record?.forceMissionPlan?.resourceRevision || 0),
        phaseActionConceptRevision: Number(record?.phaseActionConcept?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.forceMissionPlanRevision || 0) !== Number(record?.forceMissionPlan?.resourceRevision || 0)
        || Number(resource?.phaseActionConceptRevision || 0) !== Number(record?.phaseActionConcept?.resourceRevision || 0),
      summarize: (model) => `${model.taskGroups?.length || 0} task organization groups`
    },
    ov1c: {
      normalize: normalizeProjectOv1c,
      getLineage: (record) => ({
        forceMissionPlanRevision: Number(record?.forceMissionPlan?.resourceRevision || 0),
        ov1bRevision: Number(record?.ov1b?.resourceRevision || 0),
        ov5Revision: Number(record?.ov5?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.forceMissionPlanRevision || 0) !== Number(record?.forceMissionPlan?.resourceRevision || 0)
        || Number(resource?.ov1bRevision || 0) !== Number(record?.ov1b?.resourceRevision || 0)
        || Number(resource?.ov5Revision || 0) !== Number(record?.ov5?.resourceRevision || 0),
      summarize: (model) => `${model.mappings?.length || 0} task/activity mappings`
    },
    ov2: {
      normalize: normalizeProjectOv2,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        forceMissionPlanRevision: Number(record?.forceMissionPlan?.resourceRevision || 0),
        ov1Revision: Number(record?.ov1?.resourceRevision || 0),
        ov5Revision: Number(record?.ov5?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.forceMissionPlanRevision || 0) !== Number(record?.forceMissionPlan?.resourceRevision || 0)
        || Number(resource?.ov1Revision || 0) !== Number(record?.ov1?.resourceRevision || 0)
        || Number(resource?.ov5Revision || 0) !== Number(record?.ov5?.resourceRevision || 0),
      summarize: (model) => `${model.nodes?.length || 0} nodes / ${model.exchanges?.length || 0} exchanges`
    },
    ov3: {
      normalize: normalizeProjectOv3,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        ov2Revision: Number(record?.ov2?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.ov2Revision || 0) !== Number(record?.ov2?.resourceRevision || 0)
        || getResourceDefinition("ov2").isStale(record?.ov2 || {}, record),
      summarize: (model) => `${model.exchanges?.length || 0} exchanges`
    },
    ov4: {
      normalize: normalizeProjectOv4,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        forceMissionPlanRevision: Number(record?.forceMissionPlan?.resourceRevision || 0),
        ov1Revision: Number(record?.ov1?.resourceRevision || 0),
        ov5Revision: Number(record?.ov5?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.forceMissionPlanRevision || 0) !== Number(record?.forceMissionPlan?.resourceRevision || 0)
        || Number(resource?.ov1Revision || 0) !== Number(record?.ov1?.resourceRevision || 0)
        || Number(resource?.ov5Revision || 0) !== Number(record?.ov5?.resourceRevision || 0),
      summarize: (model) => `${model.roles?.length || 0} roles / ${model.relations?.length || 0} relations`
    },
    ov5a: {
      normalize: normalizeProjectOv5a,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        ov5Revision: Number(record?.ov5?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.ov5Revision || 0) !== Number(record?.ov5?.resourceRevision || 0),
      summarize: (model) => `${model.entities?.length || 0} activities`
    },
    ov5: {
      normalize: normalizeProjectOv5,
      getLineage: (record) => ({ briefRevision: Number(record?.briefRevision || 0), conceptMapRevision: Number(record?.conceptMap?.resourceRevision || 0) }),
      isStale: (resource, record) => Number(resource?.briefRevision || 0) !== Number(record?.briefRevision || 0)
        || Number(resource?.conceptMapRevision || 0) !== Number(record?.conceptMap?.resourceRevision || 0),
      summarize: (model) => `${model.activities?.length || model.entities?.length || 0} activities / ${model.edges?.length || 0} edges`
    },
    ov6a: {
      normalize: normalizeProjectOv6a,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        ov5Revision: Number(record?.ov5?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.ov5Revision || 0) !== Number(record?.ov5?.resourceRevision || 0),
      summarize: (model) => `${model.rules?.length || 0} rules`
    },
    ov6b: {
      normalize: normalizeProjectOv6b,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        oodaRevision: Number(record?.ooda?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.oodaRevision || 0) !== Number(record?.ooda?.resourceRevision || 0),
      summarize: (model) => `${model.states?.length || 0} states / ${model.transitions?.length || 0} transitions`
    },
    ov6c: {
      normalize: normalizeProjectOv6c,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        oodaRevision: Number(record?.ooda?.resourceRevision || 0),
        scenarioRevision: Number(record?.scenario?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.oodaRevision || 0) !== Number(record?.ooda?.resourceRevision || 0)
        || Number(resource?.scenarioRevision || 0) !== Number(record?.scenario?.resourceRevision || 0),
      summarize: (model) => `${model.events?.length || 0} events`
    },
    ov7: {
      normalize: normalizeProjectOv7,
      getLineage: (record) => ({
        ov5Revision: Number(record?.ov5?.resourceRevision || 0),
        ov6bRevision: Number(record?.ov6b?.resourceRevision || 0),
        ov6cRevision: Number(record?.ov6c?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.ov5Revision || 0) !== Number(record?.ov5?.resourceRevision || 0)
        || Number(resource?.ov6bRevision || 0) !== Number(record?.ov6b?.resourceRevision || 0)
        || Number(resource?.ov6cRevision || 0) !== Number(record?.ov6c?.resourceRevision || 0),
      summarize: (model) => `${model.mappings?.length || 0} state/activity mappings`
    },
    architecture: {
      normalize: normalizeProjectArchitecture,
      getLineage: (record) => getCurrentLineage(record),
      isStale: () => false,
      summarize: (model) => `${model.entities?.length || 0} entities / ${Object.keys(model.products || {}).length} products`
    },
    ooda: {
      normalize: normalizeProjectOoda,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        ov5Revision: Number(record?.ov5?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.ov5Revision || 0) !== Number(record?.ov5?.resourceRevision || 0),
      summarize: (model) => `${model.lanes.length} lanes / ${model.lanes.reduce((count, lane) => count + lane.nodes.length, 0)} nodes`
    },
    scenario: {
      normalize: normalizeProjectScenario,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        ov5Revision: Number(record?.ov5?.resourceRevision || 0),
        oodaRevision: Number(record?.ooda?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.ov5Revision || 0) !== Number(record?.ov5?.resourceRevision || 0)
        || Number(resource?.oodaRevision || 0) !== Number(record?.ooda?.resourceRevision || 0),
      summarize: (model) => `${model.entities.length} entities / ${model.timeline.length} timeline events`
    },
    validation: {
      normalize: normalizeProjectValidation,
      getLineage: (record) => ({
        briefRevision: Number(record?.briefRevision || 0),
        ov1Revision: Number(record?.ov1?.resourceRevision || 0),
        ov5Revision: Number(record?.ov5?.resourceRevision || 0),
        oodaRevision: Number(record?.ooda?.resourceRevision || 0),
        scenarioRevision: Number(record?.scenario?.resourceRevision || 0)
      }),
      isStale: (resource, record) => Number(resource?.ov5Revision || 0) !== Number(record?.ov5?.resourceRevision || 0)
        || Number(resource?.ov1Revision || 0) !== Number(record?.ov1?.resourceRevision || 0)
        || Number(resource?.oodaRevision || 0) !== Number(record?.ooda?.resourceRevision || 0)
        || Number(resource?.scenarioRevision || 0) !== Number(record?.scenario?.resourceRevision || 0),
      summarize: (model) => `${model.scores.length} scores / ${model.issues.length} issues`
    },
    knowledge: {
      normalize: normalizeKnowledgeVault,
      getLineage: () => ({}),
      isStale: () => false,
      summarize: (model) => `${model.summary?.fileCount || 0} notes / ${model.docs.length} chunks / keyword index`
    }
  };
  const definition = definitions[resourceKey];
  if (!definition) throw new Error(`Unknown project resource: ${resourceKey}`);
  return definition;
}

function getHistoryDefinition(resourceKey) {
  const definitions = {
    reportArchives: {
      idPrefix: "report-version",
      auditPrefix: "report_archive",
      maximum: MAX_REPORT_ARCHIVES,
      normalize: normalizeProjectReportArchive,
      createItem: (input, { number, revision, savedAt, lineage }) => {
        const id = input.clientId || `report-version-r${revision}`;
        const label = `R${String(number).padStart(3, "0")}`;
        const payload = {
          ...input.payload,
          reportVersion: { id, label, savedAt, projectRevision: revision, ...lineage }
        };
        return {
          id,
          number,
          label,
          savedAt,
          title: input.title,
          scenarioId: input.scenarioId,
          maturity: input.maturity,
          lineage,
          payload
        };
      },
      summarize: (item) => `${item.label} ${item.title}`
    },
    modelSnapshots: {
      idPrefix: "model-snapshot",
      auditPrefix: "model_snapshot",
      maximum: MAX_MODEL_SNAPSHOTS,
      normalize: normalizeProjectModelSnapshot,
      createItem: (input, { number, revision, savedAt, lineage }) => ({
        id: input.clientId || `model-snapshot-r${revision}`,
        number,
        label: `M${String(number).padStart(3, "0")}`,
        savedAt,
        title: input.title,
        direction: input.direction,
        lineage,
        model: input.model
      }),
      summarize: (item) => `${item.label} ${item.direction}`
    }
  };
  const definition = definitions[resourceKey];
  if (!definition) throw new Error(`Unknown project history resource: ${resourceKey}`);
  return definition;
}

function getCurrentLineage(record) {
  return {
    briefRevision: Number(record?.briefRevision || 0),
    forceMissionPlanRevision: Number(record?.forceMissionPlan?.resourceRevision || 0),
    phaseActionConceptRevision: Number(record?.phaseActionConcept?.resourceRevision || 0),
    conceptMapRevision: Number(record?.conceptMap?.resourceRevision || 0),
    conceptGraphicPlanRevision: Number(record?.conceptGraphicPlan?.resourceRevision || 0),
    ov1Revision: Number(record?.ov1?.resourceRevision || 0),
    ov1bRevision: Number(record?.ov1b?.resourceRevision || 0),
    ov1cRevision: Number(record?.ov1c?.resourceRevision || 0),
    ov2Revision: Number(record?.ov2?.resourceRevision || 0),
    ov3Revision: Number(record?.ov3?.resourceRevision || 0),
    ov4Revision: Number(record?.ov4?.resourceRevision || 0),
    ov5aRevision: Number(record?.ov5a?.resourceRevision || 0),
    ov5Revision: Number(record?.ov5?.resourceRevision || 0),
    ov6aRevision: Number(record?.ov6a?.resourceRevision || 0),
    ov6bRevision: Number(record?.ov6b?.resourceRevision || 0),
    ov6cRevision: Number(record?.ov6c?.resourceRevision || 0),
    ov7Revision: Number(record?.ov7?.resourceRevision || 0),
    architectureRevision: Number(record?.architecture?.resourceRevision || 0),
    oodaRevision: Number(record?.ooda?.resourceRevision || 0),
    scenarioRevision: Number(record?.scenario?.resourceRevision || 0),
    validationRevision: Number(record?.validation?.resourceRevision || 0)
  };
}

function getStoredLineage(resource) {
  return [
    "briefRevision",
    "forceMissionPlanRevision",
    "phaseActionConceptRevision",
    "conceptMapRevision",
    "conceptGraphicPlanRevision",
    "ov1Revision",
    "ov1bRevision",
    "ov1cRevision",
    "ov2Revision",
    "ov3Revision",
    "ov4Revision",
    "ov5aRevision",
    "ov5Revision",
    "ov6aRevision",
    "ov6bRevision",
    "ov6cRevision",
    "ov7Revision",
    "architectureRevision",
    "oodaRevision",
    "scenarioRevision",
    "validationRevision"
  ].reduce((result, key) => {
    if (resource?.[key] !== undefined) result[key] = Number(resource[key] || 0);
    return result;
  }, {});
}

function normalizeHistoryItemId(value, prefix) {
  const id = clean(value, 180);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,179}$/.test(id) || !id.startsWith(prefix)) {
    throw new Error("History item identifier is invalid");
  }
  return id;
}

function normalizeCollaborationId(value) {
  const id = clean(value, 180);
  if (!/^review-[A-Za-z0-9_-]{1,170}$/.test(id)) throw new Error("Collaboration review identifier is invalid");
  return id;
}

function getAuditSource(input, actor) {
  return actor?.id || clean(input.source, 80) || "manual";
}

function createAuditEntry({ revision, action, source, actor, occurredAt, summary, ...lineage }) {
  const auditActor = actor?.id
    ? { id: actor.id, label: actor.label || actor.id, roles: Array.isArray(actor.roles) ? actor.roles : [] }
    : undefined;
  return { id: `audit-${revision}-${occurredAt}`, revision, action, source, ...(auditActor ? { actor: auditActor } : {}), occurredAt, summary, ...lineage };
}

function createRevisionConflict(expectedRevision, currentRevision) {
  const error = new Error(`Project revision conflict: expected ${expectedRevision}, current ${currentRevision}`);
  error.statusCode = 409;
  return error;
}

function createConflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createForbiddenError(message) {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

function sameBrief(left, right) {
  return BRIEF_FIELDS.every((field) => left?.[field] === right?.[field])
    && JSON.stringify(left?.evidenceRefs || []) === JSON.stringify(right?.evidenceRefs || []);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clean(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function clampSearchLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(20, Math.floor(parsed)));
}

function normalizeExpectedRevision(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("Expected project revision is invalid");
  return parsed;
}

function requireExpectedRevision(value, currentRevision) {
  const expectedRevision = normalizeExpectedRevision(value);
  if (expectedRevision === null) throw new Error("Collaboration requests require an expected project revision");
  if (expectedRevision !== currentRevision) throw createRevisionConflict(expectedRevision, currentRevision);
}

function stableId(value) {
  let hash = 5381;
  for (const character of String(value)) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  return (hash >>> 0).toString(36);
}

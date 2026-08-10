# project-context.md

## Latest completed batch (2026-07-28, concept-map position persistence)

- Goal: 独立工具拖动兵力后，坐标写入 conceptMap 持久化（document + draft.placements + 服务端）。
- Fix: `applyMapDocumentToConceptMap`；assignment 同步 lon/lat；并发队列不丢最后一次移动；服务端 draft.placements；重种子可复用历史坐标。
- Verification: `check-concept-map-integration` ok。

## Latest completed batch (2026-07-28, concept-map silent live sync)

- Goal: 独立窗口改概念图时，工作台不整页刷新，只更新变更。
- Root cause: `syncConceptMap` 默认 `render()` + `onSaved→hydrateProjectDirectory→render()`。
- Fix: live soft-sync 使用 `silent: true`；仅软更新工具栏/修订号；冲突/失败仍全量 render。
- Verification: `check-concept-map-integration` ok。

## Latest completed batch (2026-07-28, concept-map incremental auto-sync)

- Goal: 独立窗口修改自动同步；只增量改对象，不整图刷新；无需点「同步工具内容」。
- combat-map-web: `BroadcastChannel` 同源窗口互相同步；`applyMapDocumentPatch` 只增删改变化对象、不飞镜头；保存仍通知工作台。
- workbench: 收到变更只静默落库 + 软更新工具栏；不再 `load-map-document` 整页灌入预览。
- Verification: map bridge check + `check-concept-map-integration` ok。

## Latest completed batch (2026-07-28, concept-map live sync)

- Goal: 独立窗口编辑概念图后自动同步回工作台与嵌入预览。
- combat-map-web: `postMessage` 同时发给 parent + opener；绑定项目保存/自动保存时发 `map-document-changed`；`parentOrigin` URL 参数。
- workbench: 接收 `map-document-changed`；独立窗口去掉 `noopener` 并传 `parentOrigin`。
- Verification: map bridge check + `check-concept-map-integration` ok。

## Latest completed batch (2026-07-28, concept-map step redesign)

- Goal: 重做作战概念图步骤——预览绘制工具、独立编辑、1:1 绑定、阶段落图、无 AI。
- Workbench: 简化 UI（预览 iframe 全工具栏）；`seedFromPlanning` 确定性编译；`boundMapProjectId`；打开独立窗口；同步工具内容；确认本步。
- combat-map-web（不影响独立使用）：`ensureWorkbenchBoundProject` / export；URL `mapProjectId=workbench-…` 才绑定。
- Verification: map bridge check + `check-concept-map-integration` + planning/workflow-test-mode ok.

## Latest completed batch (2026-07-28, concept forces on concept map)

- Goal: 作战概念图必须部署上一步「概念兵力」，不能被作战兵力顶替。
- Completed: `buildConceptMapPlanFromPlanning` 始终以 `forceMission.forces` 落图（最多 36）；AI 仅可丰富标题/区域/阶段目标；图层 `概念兵力/*`。
- Verification: `check-concept-map-integration` + planning/workflow-test-mode ok.

## Latest completed batch (2026-07-28, force-mission UX closed loop)

- Goal: 优化「兵力与任务」界面设计与交互，使概念 → 作战 → 确认各步可闭环。
- Completed:
  - 步骤条 + 下一步横幅（按进度提示主操作）
  - 概念兵力可点选查看任务并挂 1 个装备类型（收起/再点切换）
  - 作战编成：平台数量、批量挂接、补挂平台、缺平台高亮
  - 阶段条显示每阶段概念/作战数量；空态带生成 CTA
  - 主按钮按当前步强调；确认文案明确进入作战概念图
  - `close-force-platform-picker`；生成后清理 picker
- Files: `forceMissionView.js`, `conceptPlanningController.js`, `styles.css`
- Verification: `check-cmo-force-mission` + `check-concept-planning-workflow` + `check-design-studio-workflow` ok

## Latest completed batch (2026-07-28, step4 rename + map tool auto-start)

- Goal: 步骤4「模糊作战图」改名为「作战概念图」；启动工作台时独立拉起外部概念图绘制工具。
- Completed:
  - 导航/文案：`concept-map` → **作战概念图**；`concept-graphic` → **总体作战概念图**（避免重名）。
  - `server/conceptMapToolProcess.mjs`：detached 启动 `D:\项目\combat-map-web`（默认 8765）；已在跑则跳过；工作台退出不杀绘制工具。
  - env：`CONCEPT_MAP_TOOL_ENABLED` / `CONCEPT_MAP_TOOL_ROOT` / `CONCEPT_MAP_TOOL_PORT` / `CONCEPT_MAP_TOOL_PYTHON`。
  - 验收夹具补 `combatForces`（门禁已要求作战兵力层）。
- Verification: concept-map / planning / workflow-test-mode / design-studio-workflow ok；ensureConceptMapToolStarted → started then already-running；8765 HTTP 可达。

## Latest completed batch (2026-07-27, force downstream + diagnostics)

- Goal: 作战兵力贯通下游模糊图；软诊断；重启 8792 使 CMO API 生效。
- Completed: `compactForceMissionForAnalysis` / `mapForcesForLayout` / `forceMissionDiagnostics`；concept-map 优先作战兵力；结构校核提示缺作战层/缺平台；兵力页一致性检查。
- Verification: cmo/planning/structure checks ok；8792 已用新代码重启，`/api/cmo-catalog/status` open=true。

## Latest completed batch (2026-07-27, granular recommend apply)

- Goal: 推荐预览支持逐条勾选、单条应用、移除单个平台；应用后保留未应用条目。
- Completed: assignment.selected；apply selected / apply one；remove platform from preview；UI 勾选栏。
- Verification: `check-cmo-force-mission` + `check-concept-planning-workflow` ok.

## Latest completed batch (2026-07-27, recommend preview + auto preview)

- Goal: 推荐改为预览后应用；生成兵力后自动出预览；支持跳过已有平台与国家过滤。
- Completed: recommend status `preview|applied|empty`；应用/放弃；生成后 auto-preview；UI 选项与按钮。
- Verification: `check-cmo-force-mission` + `check-concept-planning-workflow` ok.

## Latest completed batch (2026-07-27, batch attach + phase platform recommend)

- Goal: 批量挂接检索结果；从阶段行动一键推荐 CMO 平台到作战兵力。
- Completed: `shared/forcePlatformRecommend.js` 关键词/域偏好；`attachForcePlatforms` / `applyPlatformRecommendations`；UI 多选批量挂接 +「从阶段行动推荐平台」。
- Verification: `check-cmo-force-mission` + `check-concept-planning-workflow` ok.

## Latest completed batch (2026-07-27, concept + combat forces)

- Goal: 兵力与任务同时维护「概念兵力」与「作战兵力」两层。
- Completed: `combatForces[]`（`conceptForceId` 挂接概念单元、CMO 任务类型、平台引用）；确认门禁要求两层都有；UI 双区块；AI schema/mock/prompt 同步。
- Verification: `check-cmo-force-mission` + `check-concept-planning-workflow` ok.

## Latest completed batch (2026-07-27, force-mission platform picker)

- Goal: 兵力卡片上手工改 CMO 任务类型，并检索/挂接/移除 DB3 平台（含数量与国别筛选）。
- Completed: `forceMissionStore` 编辑 helpers（改类型/挂接/移除/数量，确认态回退草案）；force 卡片检索 UI；controller bind + 同步。
- Verification: `check-cmo-force-mission` + `check-concept-planning-workflow` ok。

## Latest completed batch (2026-07-27, force-mission + CMO DB3)

- Goal: step 3 兵力与任务核对前两步输入；接入 `data/DB3K_510.db3`；系统管理配置数据库路径；任务分类对齐 CMO。
- Completed: force-mission UI 展示上游简报+阶段（含蓝/红行动）；生成要求至少 2 个阶段并完整传递 `phaseAction`。
- Completed: `server/cmoDatabase.mjs` 只读解析 DB3；admin「CMO 装备数据库」配置；catalog search/mission-types APIs。
- Completed: force 模型增加 `missionType` + `platforms[]`；AI schema/prompt/mock 同步。
- Verification: `scripts/check-cmo-force-mission.mjs` ok；`check-concept-planning-workflow` / `check-design-studio-workflow` ok。

## Latest completed batch (2026-07-26, combat focus before phases)

- Goal: before generating combat phases, AI drafts 3 combat-focus options from the brief; user selects or adds custom; phases obey the selected focus.
- Completed: `CombatFocusOptions` AI schema + mock; `combatFocusStore`; phase-action UI section; gate phase generation on selected focus; brief confirm auto-generates focuses (not phases).
- Verification: combat-focus smoke + `check-concept-planning-workflow`.

## Latest completed batch (2026-07-25, remove knowledge rail + phase-first planning)

- Goal: (1) remove docked right-sidebar knowledge base from the tool; (2) put phase-action as step 2 after brief with a timeline-first UI.
- Completed: non-brief views hide the right inspector; workspace is full-width by default; brief keeps research-baseline editor only. Inspector no longer renders knowledge evidence.
- Completed: workflow order is now `brief → phase-action → force-mission → concept-map → concept-graphic`.
- Completed: phase drafts from brief only; force drafts optionally consume confirmed phase; confirm chain auto-generates next step.
- Completed: phase UI redesigned — brief strip, horizontal timeline focus, phase detail + transitions/review side panel.
- Completed: repository lineage swapped so `phaseActionConcept` depends on brief; `forceMissionPlan` depends on brief + phase.
- Verification: `check-concept-planning-workflow`, `check-workflow-test-mode`, `check-concept-map-integration`, plus repo/invalidation checks.
- Docs: `plans/CONCEPT_PLANNING_WORKFLOW.md`, `INTERFACE_GUIDE.md`, `TRIAL_GUIDE.md` updated for phase-first order.

## Latest completed batch (2026-07-25, docs + full acceptance + 8792 restart)

- Goal: close planning Phase 5 — docs, full checks, live health.
- Completed: `INTERFACE_GUIDE.md` lists force-mission / phase-action / concept-map / concept-graphic-plan routes and AI schemas; `TRIAL_GUIDE.md` documents AI-primary continuous planning path and minimum completion criteria.
- Completed: fixed `check-ov1-strengthening` to set `ov1ToolsOpen: true` (matches scheme A rail visibility).
- Verification: full `scripts/check-*.mjs` suite **71/71 passed**; restarted `8792`; `/api/health` reports `forceMissionPlan/phaseActionConcept/conceptMap/conceptGraphicPlan=true` and resources include all four planning keys; `projectRepository.mode=sqlite`.
- Backup (pre-planning): `D:\项目\_backups\combat-concept-ai-workbench-pre-concept-planning-20260725-214519`
- Plan status: `plans/CONCEPT_PLANNING_WORKFLOW.md` Phase 0–5 marked landed for current scope.
- Optional later: field-level regenerate locks; richer OV reference auto-compile from fuzzy map; interactive browser walkthrough with collaboration login.

## Latest completed batch (2026-07-25, planning downstream + migration diagnostics)

- Goal: make OV-5/OODA/OV-1 AI consume confirmed planning package; surface legacy concept-map-only projects.
- Completed: `design-studio/src/planningContext.js` with `planningAnalysisForDownstream`, `planningCoverageStatus`, `detectLegacyConceptMapOnly`, migration banner helper.
- Completed: OV-1/OV-5/OODA AI controllers inject planning contexts (force/phase/map/graphic + activity candidates + OODA hints).
- Completed: structure-review issues for incomplete planning coverage and legacy concept-map-only data; summary flags `planningMissingCount` / `planningLegacy`.
- Completed: planning pages show migration banner when old map exists without force/phase.
- Verification: `check-concept-planning-workflow` (migration + analysis), `check-structure-review-workbench`, `check-concept-map-integration`, `check-workflow-test-mode`.

## Latest completed batch (2026-07-25, concept graphic plan → OV-1 seed)

- Goal: complete planning step 4 (总体作战概念图) and auto-seed OV-1 after human confirm.
- Completed: resource `conceptGraphicPlan` (normalize, SQLite/file, lineage to brief/force/phase/map, GET/PUT `/concept-graphic-plan`, health flag).
- Completed: UI `concept-graphic` view; AI contract `ConceptGraphicPlan`; compile helper `conceptGraphicToOv1Draft`.
- Completed continuous path: fuzzy-map OV reference confirm → auto generate concept graphic; concept graphic confirm → seed OV-1 via `createAiOv1Draft` + sync, open OV-1.
- Stage 1 gate now also requires confirmed concept graphic.
- OV-1 AI analysis now includes force/phase/map/graphic downstream contexts.
- Verification: `check-concept-planning-workflow` (includes graphic→OV-1), `check-concept-map-integration`, `check-workflow-test-mode`, `check-workflow-confirmation-invalidation`, `check-project-repository`.

## Latest completed batch (2026-07-25, concept planning steps after brief)

- Goal: insert AI-primary / human-review planning between brief and formal OV modeling: force-mission → phase-action → fuzzy concept map; confirm each step then auto-generate the next.
- Plan: `plans/CONCEPT_PLANNING_WORKFLOW.md` (decision frozen: auto continuous generation).
- Backup: `D:\项目\_backups\combat-concept-ai-workbench-pre-concept-planning-20260725-214519`
- Completed: shared models in `shared/conceptPlanning.js`; resources `forceMissionPlan` / `phaseActionConcept` with SQLite/file persistence, lineage, stale invalidation, health flags, GET/PUT routes.
- Completed: UI pages, controllers, AI contracts `ForceMissionPlan` / `PhaseActionConcept`, mock generator; stage 1 gate requires confirmed force + phase + fuzzy map OV reference + concept graphic.
- Completed: brief stage confirm → auto force draft; force confirm → auto phase draft; phase confirm → auto fuzzy map from planning semantics.
- Concept-map page renamed to 模糊作战图; generation prefers confirmed force/phase context.
- Verification: `check-concept-planning-workflow`, `check-concept-map-integration`, `check-workflow-test-mode`, `check-workflow-confirmation-invalidation`, `check-project-repository`, `check-sqlite-default-all-resources`, syntax checks.

## Latest completed batch (2026-07-24, brief-generated v4 initial concept map)

- Goal: replace the title-only / map-center initial draft with a complete research-level initial concept map generated from the confirmed brief.
- Completed: added the `ConceptMapInitialPlan` AI contract with four existing editor phases (`recon`, `deployment`, `assault`, `support`), conceptual forces, conceptual areas, high-level relations, and review questions. The concept-map request deliberately sends `evidence: []`; the map page has no knowledge-base panel.
- Completed: added a deterministic compiler that produces a schema-compatible independent-editor JSON v4 document with `items`, `view`, and `operation` (including `activePhaseId`, phase color/time/visibility, CMO `symbol` fields, and native area geometry fields). It maps force roles to a controlled set of CMO symbol filenames, assigns generated operational items to phases, and declares `abstract-relative-layout`; it never claims real-world coordinates or generates CMO filenames through AI.
- Completed: replaced title generation, center fields, center picker, and related state with a single `根据简报创建初始概念图` action. Generated JSON is downloaded for manual editing in the independent tool and later imported as an explicit snapshot.
- Completed: removed the temporary workbench-side initial-map preview and its collapse control after it competed with the embedded editor. The concept-map tool is again full width; the fixed generation strip is compact and does not render phase prose.
- Completed: downstream OV context remains human-confirmed and semantic only. It excludes map coordinates, raw map item payloads, and CMO symbol filenames.
- Changed files: `design-studio/src/{conceptMapStore,conceptMapController,conceptMapView}.js`, `design-studio/src/app/createInitialState.js`, `shared/generator.js`, `server/openaiClient.mjs`, `scripts/check-concept-map-integration.mjs`.
- Backup: `D:\项目\_backups\combat-concept-initial-map-v2-20260724-before-implementation` contains the pre-change copies of every changed implementation and acceptance file.
- Verification: syntax checks; `check-concept-map-integration`; full `scripts/check-*.mjs` suite (70 scripts) passed; live `8794` AI request returned `ConceptMapInitialPlan` with four required phases, 3 forces, 2 areas, 3 relations, and zero evidence references.
- Boundary: do not modify, start, stop, inject into, or synchronize with `D:\项目\combat-map-web`; it remains an independent dirty worktree and receives the initial map only via user-managed JSON import/export.
- Superseded boundary (2026-07-24): the user explicitly authorized a narrow integration change in `combat-map-web`. Its documented, origin-checked `load-map-document` bridge now accepts the generated v4 document and loads it through the editor's existing `loadData` path. This is limited to direct initial-map display; no process management or unapproved data synchronization was added.
- Browser verification: a real `8794` parent page embedded `8765`, sent a v4 CMO-symbol test document, received the editor's replacement confirmation, and after acceptance the tool rendered the symbol and reported `已载入工作台初图 ...（1 个对象）`. Screenshot: `.playwright-cli/page-2026-07-24T10-22-38-973Z.png`.

## Latest completed batch (2026-07-24, brief-generated initial concept map and OV reference)

- Goal: turn the concept-map stage into a controlled handoff from the confirmed brief to an editable initial operational sketch, then to an approved OV reference.
- Completed: the workbench generates an initial standard map JSON using only text nodes and high-level relation arrows. The user supplies the map-frame center; the generator does not invent real-world positions, targets, routes, or performance data.
- Completed: the generated JSON is downloaded for manual import into the independent map tool. A later user-selected JSON import returns an edited snapshot to the workbench without messaging, service management, state injection, or any map-project code change.
- Completed: the map resource now stores a separate OV reference with editable entities/roles, high-level relationships, activity candidates, research constraints, and open questions. Only an explicitly confirmed reference is exposed to OV-1 and OV-5; raw coordinates and editor payloads remain excluded.
- Completed: workflow stage 1 now requires both map content and a confirmed OV reference. A new map draft/import or an edited reference returns the stage to review and invalidates later dependent products.
- Changed files: `design-studio/src/{conceptMapStore,conceptMapController,conceptMapView}.js`, `design-studio/src/app/{createInitialState,wireControllers,workflowGate}.js`, `design-studio/styles.css`, `server/projectModelNormalizers.mjs`, `scripts/{check-concept-map-integration,check-workflow-test-mode}.mjs`.
- Verification: syntax checks; concept-map integration; workflow test-mode and confirmation invalidation; file/SQLite repository checks; full `check-*.mjs` suite (70 checks) passed. Restarted only the workbench listener on `8794` and confirmed `/api/health`.
- UI note: an isolated browser session reached the expected authentication gate but had no existing collaboration account, so the concept-map controls were verified by deterministic render assertions rather than creating test account data.
- Constraint: do not modify `D:\项目\combat-map-web`. Its only role is a separately started editor reached through the user-controlled JSON handoff.

## Latest completed batch (2026-07-24, independent concept-map boundary)

- Goal: keep the concept-map stage available after the brief while preserving `D:\项目\combat-map-web` as an entirely independent tool.
- Completed: retired all workbench-to-map communication, realtime synchronization, embedded-preview mode, and automatic editor-service startup. The map page has no knowledge-base panel and uses the ordinary independent editor URL.
- Completed: restored the map application's `app.js`, `index.html`, and `src/concept-deployment-bridge.js` from the pre-integration backup, and removed the workbench-specific preview CSS from its `styles.css`. The restored files hash-match the backup.
- Completed: the workbench now accepts an explicitly selected map JSON export and persists that snapshot as the project concept-map resource. Later stages consume only its object/layer summary and do not access the editor process or raw map data.
- Changed files: workbench `design-studio/src/{conceptMapBridgeStore,conceptMapView,conceptMapController}.js`, `server/app.mjs`, and `scripts/check-concept-map-integration.mjs`; retired `server/conceptMapService.mjs`, `design-studio/src/conceptMapProtocol.js`, and `scripts/check-concept-map-service.mjs`. The map project contains no remaining workbench-specific code.
- Backup: `D:\项目\_backups\combat-concept-integration-20260724-115526-pre-change` is the verified map restoration source; `D:\项目\_backups\combat-concept-integration-20260724-124500-before-map-independence` preserves the retired bridge implementation.
- Verification: workbench syntax checks, independent concept-map integration acceptance, workflow test-mode, workflow-confirmation invalidation, and project repository acceptance passed. Map `node --check`, Python compilation, and pure unit checks passed. The map project's restored files hash-match the pre-integration backup.
- Boundary control: the concept-map acceptance script verifies only workbench code and no longer reads files from the independent map project.
- Runtime note: start the independent map tool separately at its own URL. The workbench never starts, stops, injects state into, or receives messages from it.

## Latest completed batch (2026-07-24, independent concept-map stage after brief)

- Goal: add a dedicated concept-map stage after the brief while keeping the separate `D:\项目\combat-map-web` editor entirely independent.
- Completed: added `conceptMap` project resource, GET/PUT endpoint, SQLite/file persistence, audit summary, brief lineage/staleness, and workflow confirmation mapping. The six-stage workflow now places `concept-map` between `brief` and OV-1/OV-5/OODA; a stale map returns confirmation to the concept-map stage.
- Completed: added the workbench concept-map store, editor URL settings, iframe view, controller, conflict recovery, and a map JSON import action. The map editor has no workbench-specific protocol, state, or synchronization code; users export JSON from the independent editor and explicitly import it into the project.
- Completed: the concept-map right inspector now shows only map status, object count, and layers; it does not render the shared knowledge-base evidence panel.
- Completed: the concept-map page now hides the right inspector and gives the embedded editor the full work area; all other views retain the normal inspector layout.
- Completed: OV-1 and OV-5 AI inputs receive only approved map context plus object/layer summary. They never receive raw coordinates or full editor payloads.
- Changed files: `shared/workflowConfirmation.js`, `server/{projectRepository,projectModelNormalizers,createRequestHandler}.mjs`, `server/routes/projectResources.mjs`, `design-studio/src/{conceptMapStore,conceptMapBridgeStore,conceptMapView,conceptMapController}.js`, workflow/navigation/controller files, `scripts/{check-concept-map-integration,check-workflow-test-mode,check-workflow-confirmation-invalidation}.mjs`. `conceptMapProtocol.js` was removed when the cross-project bridge was retired.
- Backup: `D:\项目\_backups\combat-concept-integration-20260724-115526-pre-change` contains the workbench source/state backup and pre-integration map files. `D:\项目\_backups\combat-concept-integration-20260724-124500-before-map-independence` preserves the retired integration files.
- Verification: changed-module syntax checks; `check-concept-map-integration`; `check-workflow-test-mode`; `check-workflow-confirmation-invalidation`; project repository, design-studio workflow, DoDAF exchange, SQLite default/all-resource, and SQLite repository checks. The restored `combat-map-web` `app.js`, `index.html`, and `src/concept-deployment-bridge.js` hash-match their pre-integration backups.
- Constraint: `combat-map-web` remains a separate dirty worktree. Do not add any workbench-specific map protocol, route, style, state, or synchronization code to it. Preserve unrelated changes; do not reset, clean, commit, or push without explicit direction.

## Latest completed batch (2026-07-24, workflow reconfirmation after content changes)

- Completed: every persisted workflow resource is mapped to its owning confirmation stage. A real content change revokes confirmation for that stage and all later stages while preserving earlier completed stages and the selected workflow mode.
- Completed: the invalidation applies equally to manual, AI, generated, imported, report-archive, and collaboration-review/decision writes. Idempotent saves preserve the existing confirmation.
- Completed: all persistence controllers refresh the project directory after a successful write so the confirmation gate immediately reflects the server state; incomplete stage buttons remain clickable and display the missing-content prompt.
- Changed files: `shared/workflowConfirmation.js`, `server/projectRepository.mjs`, `design-studio/src/{projectModelSyncController,projectBriefSyncController,projectOv5SyncController,projectHistorySyncController,dodafProductController,collaborationController}.js`, `design-studio/src/app/wireControllers.js`, `scripts/check-workflow-confirmation-invalidation.mjs`, `scripts/check-workflow-test-mode.mjs`.
- Verification: syntax checks; `check-workflow-confirmation-invalidation`; `check-workflow-test-mode`; `check-project-repository`; `check-dodaf-dm2-exchange`; `check-design-studio-workflow`; restarted `8792` and confirmed `/api/health` 200. Browser reached the unauthenticated login gate; authenticated click-through remains unavailable without a user session.

## Latest completed batch (2026-07-24, industrial drafting legend library OV-1～OV-6c)

- Completed: shared drafting tokens in `shared/dodaf/drafting.js` (DM2 entity → color/icon/shape; edge type → stroke/dash/marker) with product legend sets for OV-1～OV-6c.
- Completed: UI helpers in `dodafDraftingView.js`; wired legends/badges/chips into OV-1 canvas, OV-2～OV-4, OV-5a/6a/6b/6c; CSS component styles in `styles.css`.
- Verification: `check-dodaf-drafting-legend`, `check-ov1-strengthening`, operational views / structure-review.

## Latest completed batch (2026-07-24, OV-5a/5b sync + architecture writeback + live 8792)

- Completed: bidirectional Activity sync between OV-5a tree and OV-5b parentId/title/type (`shared/dodaf/ov5ActivitySync.js`); UI parent editor + sync buttons; OV-5b activity save triggers OV-5a sync.
- Completed: saving/seeding/exporting OV products merges entities into shared `architecture` (`architectureWriteback.js` + controller writeback).
- Completed: live walkthrough against 8792 health + `data/projects.sqlite`: seed/save → export/import → snapshot restore (`scripts/check-live-8792-dodaf-flow.mjs`).
- Verification: `check-ov5a-ov5b-architecture-sync`, `check-live-8792-dodaf-flow`, `check-dodaf-operational-views`.

## Latest completed batch (2026-07-24, Phase 4 wrap-up AI DM2 + copy/checks)

- Completed: AI/local OV-1 and OV-5 drafts now emit DoDAF 2.02/DM2 envelopes (`schema`/`product`/`entities`/`relations`) via draft stores and `normalizeOv1Model` / `persistOv5Model`.
- Completed: server `OperationalConceptGraphic` normalization attaches DM2 OV-1 envelope; mock generator marks OV-1 product metadata.
- Completed: UI/report/structure-review/validation copy no longer describes OV-2～6 as read-only-only; provenance and report badge say editable/persistent DM2.
- Verification: `check-ov1-strengthening`, `check-brief-expected-effects-downstream`, `check-dodaf-operational-views`, workflow, exchange, structure-review.

## Latest completed batch (2026-07-24, workflow confirmation progression)

- Completed: fixed stage progression after the first confirmation. Client-side `0` is now preserved as a valid `completedThrough` value rather than being treated as an uninitialized stage.
- Completed: the shared confirmation gate prevents duplicate submits, describes its destination, preserves the full workflow payload, and opens the first view of the newly unlocked phase after a successful save. Incomplete stages remain clickable and name their missing requirements instead of silently disabling the confirmation action.
- Changed files: `design-studio/src/app/workflowGate.js`, `design-studio/src/main.js`, `design-studio/src/app/createInitialState.js`, `scripts/check-workflow-test-mode.mjs`.
- Verification: `node --check` for all changed client modules; `check-workflow-test-mode`; `check-design-studio-workflow`.

## Latest completed batch (2026-07-24, consistency + architecture file import + full OV snapshots)

- Completed: DM2 cross-product entity consistency (`shared/dodaf/consistency.js`) wired into structure-review with score strip and contract/mapping issues.
- Completed: architecture package UI import via hidden file picker (JSON/XML) on OV-2 and structure-review; paste JSON retained as fallback.
- Completed: model snapshots capture and restore OV-2～OV-6c + architecture; server normalizer accepts optional products; restore syncs all DoDAF resources.
- Verification: `check-dodaf-consistency-snapshot-import`, structure-review, model-snapshot-inspiration, design-studio-workflow.

## Latest completed batch (2026-07-24, all durable data in SQLite by default)

- Completed: runtime defaults project repository to `data/projects.sqlite` and collaboration identity to `data/collaboration-identities.sqlite`.
- Completed: empty SQLite bootstraps once from `projects.json` / identity JSON, then all reads/writes stay in database tables (including OV-1～OV-6c + architecture).
- Completed: health reports `projectRepository.durable=true` and full resource list when mode is sqlite.
- Opt-out for tests only: `PROJECT_STORAGE_MODE=file` / `COLLABORATION_IDENTITY_STORAGE_MODE=file`.
- Verification: `check-sqlite-default-all-resources`, `check-sqlite-project-repository`, `check-dodaf-dm2-exchange`.

## Latest completed batch (2026-07-24, DoDAF 2.02/DM2 OV full persistence + exchange)

- Completed: upgraded OV products to DoDAF 2.02/DM2 operational subset schema (`dodaf-2.02-dm2-ov`) with shared `entities`/`relations` and product projections.
- Completed: all OV-1～OV-6c plus `architecture` are first-class project resources with GET/PUT, lineage/stale, and audit.
- Completed: architecture exchange package JSON + XML import/export (`/architecture/export`, `/architecture/import`).
- Completed: client stores/views for formerly derived OV-2/3/4/5a/6a/6b/6c support seed-from-upstream, edit, and save.
- Files: `shared/dodaf/**`, `server/projectModelNormalizers.mjs`, `server/projectRepository.mjs`, `server/routes/projectResources.mjs`, `server/createRequestHandler.mjs`, `design-studio/src/dodafProduct*.js`, OV views, `INTERFACE_GUIDE.md`, `scripts/check-dodaf-dm2-exchange.mjs`.
- Verification: `check-dodaf-dm2-exchange`, existing OV/repository checks.

## Latest completed batch (2026-07-23, OV-1 canvas-first hierarchy)

- Completed: OV-1 now keeps the concept map in the first viewport. The title bar retains provenance, compact model health, add-node and AI actions; relation management, auto-layout, sidebar control and task editing are under a compact more-actions menu.
- Completed: task context is a collapsed summary strip; the full four-field summary opens only on demand. Removed the duplicate review-summary band. The OV-5 next-step block follows the canvas and renders only while OV-5 has no activities.
- Changed files: `design-studio/src/ov1View.js`, `design-studio/styles.css`, stylesheet references, `project-context.md`.
- Verification: `node --check design-studio/src/ov1View.js`, `check-ov1-strengthening`, `check-design-studio-workflow`; live `8793` served the updated OV-1 module with `200`.

## Latest completed batch (2026-07-23, centralized stylesheet + admin theme palette)

- Completed: consolidated all active project CSS into `design-studio/styles.css`; the workbench, admin page, deployment Demo, printable report, and Drawflow now use the shared stylesheet. Removed the separate deployment and Drawflow CSS files and the printable-report inline `<style>` block.
- Completed: added persisted theme configuration at `/api/theme-config`. Reads are public for shell startup; writes reuse the existing authenticated lead-only configuration policy and validate six-digit hex colors before atomic persistence to `data/theme-config.json`.
- Completed: added the `主题配色` panel to `design-studio/admin.html` with background, panel, primary/muted text, primary-action, and accent color controls; the workbench loads the saved palette on startup.
- Changed files: `design-studio/styles.css`, `index.html`, `admin.html`, `src/{main,admin,themeConfigClient}.js`, `src/app/domUtils.js`, `server/{themeConfig,createRuntime,createRequestHandler}.mjs`, `scripts/check-theme-config.mjs`; removed `deployment-tool-demo.css` and `vendor/drawflow-0.0.60.min.css`.
- Verification: syntax checks; stylesheet inventory (`1` active `.css` file, no template `<style>`); `check-theme-config`; full `scripts/check-*.mjs` suite `62/62` passed. New source service at `http://127.0.0.1:8793/` returned `200` for health, stylesheet, and theme endpoint; existing `8792` process was left unchanged.

## Latest completed batch (2026-07-23, top-menubar dropdown mutual exclusion)

- Completed: top-bar project switcher and 研究/工具/知识 menus are now mutually exclusive. Opening one functional menu closes the other menus and the project switcher; opening the project switcher closes functional menus.
- Completed: menu triggers use non-wrapping labels so 研究/工具/知识 remain horizontally readable at the 1040px desktop check.
- Changed files: `design-studio/src/main.js`, `design-studio/styles.css`.
- Verification: changed-module syntax, `check-project-manager-layout`, workflow checks, full `scripts/check-*.mjs` suite `61/61`; browser interaction and screenshot `output/playwright/menubar-dropdown-final-20260723.png`.

## Latest completed batch (2026-07-23, anonymous login entry hygiene)

- Completed: added the Concept Studio favicon and made both the explicit SVG path and Chromium's root `/favicon.ico` probe return the same SVG with the correct MIME type.
- Completed: added browser autofill semantics for collaboration display-name fields; local identity acceptance now guards the login/registration autocomplete contract.
- Completed: project-directory loading now waits for an authenticated collaboration session. Anonymous login pages do not request the protected project directory; login, registration and restored sessions still refresh it through the shell-owned callback.
- Changed files: `design-studio/index.html`, `design-studio/favicon.svg`, `server/createRuntime.mjs`, `server/staticFiles.mjs`, `design-studio/src/collaborationView.js`, `design-studio/src/app/wireControllers.js`, `design-studio/src/main.js`, `scripts/check-local-collaboration-identity.mjs`.
- Verification: changed-module syntax; local-identity and workflow acceptance; full `scripts/check-*.mjs` suite `61/61`; browser login-gate check with no console errors. Screenshot: `output/playwright/login-gate-20260723-final.png`.

## Latest completed batch (2026-07-23, step rail smooth expand)

- Collapsed path: smaller quiet circles + thin spine; current step solid blue focus (no heavy pulse/scan).
- Expand: labels only (transform/opacity + light stagger), no rail width/layout reflow; dwell 320ms.
- Styles `v0.25`.

## Latest completed batch (2026-07-23, mainstream tech palette + step dwell)

- Palette aligned to mainstream product tech dark: slate navy `#020617` / `#0f172a`, primary blue `#3b82f6`, cyan accent `#22d3ee` (Linear/Vercel/Stripe/Ant Design Pro style).
- Left step rail: long hover (~550ms) expands detail panel listing every step (track + short + full label); leave collapses.
- Styles `v0.24`.

## Latest completed batch (2026-07-23, global tech theme)

- Completed: whole workbench restyled to dark tech aesthetic (cyan/teal glow, grid workspace, glass menubar/panels).
- Step path keeps first-version numbered circles + screen-centered fixed spine.
- Styles `v0.23`.

## Latest completed batch (2026-07-23, top menubar + circle step rail)

- Completed: full-width top menubar (brand, project manager dropdown, 研究/工具/知识 menus, project meta/sync, collaboration + save + primary CTA).
- Completed: left rail rebuilt as compact vertical step path — circles + lit connectors + glow/pulse on current step; tracks remain as section labels.
- Project management moved from left rail into top bar dropdown; styles `v0.17`.
- Verification: workflow-test-mode, project-manager-layout, structure-review navigation assertions.

## Latest completed batch (2026-07-23, deployment lock + collaboration draft polish)

- Completed: deployment open/push disabled when scenario is stale (UI + controller + sendDeployment guard); stale note with regenerate CTA.
- Completed: collaboration draft banner before login, form draft panel with discard action, clearer submit label; `clear-collaboration-review-draft` action.
- Styles `v0.16`. Verification: structure-review workbench + deployment/collaboration related checks.

## Latest completed batch (2026-07-23, scenario stale + checklist→collaboration)

- Completed: scenario stamps `sourceOv5Signature` / `sourceOodaSignature`; upstream edits mark scenario stale (no longer wipe); scenario page banner + structure-review `scenario-stale` with regenerate action.
- Completed: structure-review “挂到协同审阅” builds compact collaboration draft (≤1200) + downloads full Markdown attachment; prefills form or auto-submits when authenticated.
- Changed files: `scenarioStore.js`, `scenarioView.js`, `structureReviewBuilder/View/Export.js`, `collaborationView/Controller.js`, `main.js`, `projectModelNormalizers.mjs`, styles `v0.15`, acceptance scripts.
- Verification: `check-structure-review-workbench`, `check-scenario-knowledge-provenance`, workflow-related checks.

## Latest completed batch (2026-07-23, P1 mapping quality)

- Completed: `ov5MappingQuality.js` fills blank/placeholder activity I/O from linked OV-1 nodes and adjacent edges; suggests shallow parent tree when all activities are flat; never overwrites authored text or existing parentId.
- Completed: structure review surfaces blank-I/O / flat-hierarchy issues with `apply-mapping-quality`; OV-5 toolbar + inspector expose the same action; OV-3 contract match uses token soft-overlap.
- Changed files: `ov5MappingQuality.js`, `structureReviewBuilder.js`, `structureReviewView.js`, `ov3Builder.js`, `ui.js`, `main.js`, `scripts/check-structure-review-workbench.mjs`, `scripts/check-ov3-resource-exchange.mjs`, `project-context.md`.
- Verification: `check-structure-review-workbench`, `check-ov3-resource-exchange`, related OV checks.

## Latest completed batch (2026-07-23, derived OV provenance strips)

- Completed: P0 DoDAF/workbench provenance on derived OV pages and structure review — shared catalog in `derivedViewProvenance.js` explains standard meaning, workbench projection, source fields, and jump-back actions (`data-view`).
- Wired into OV-2/3/4/5a/6a/6b/6c and structure-review; styles `v0.14`.
- Verification: `check-dodaf-operational-views`, `check-ov2-operational-exchange`, `check-structure-review-workbench`.

## Latest completed batch (2026-07-23, main controller wire + archive + ops fixes)

- Completed: extracted controller/sync assembly to `design-studio/src/app/wireControllers.js`; `main.js` keeps render/bind/actions.
- Completed: archived Playwright screenshots to `archive/output-playwright-20260723/`; moved open-source references to `D:\项目\_references\combat-concept-ai-workbench-open-source` with stub `references/README.md`.
- Completed: retired unused inspiration follow-up/suggestion stores to archive; workflow acceptance now checks research-chat reply retention.
- Completed: default server port is `8792` when `PORT` is unset (`server/createRuntime.mjs`), matching docs and trial entry.
- Verification: full `scripts/check-*.mjs` suite.

## Latest completed batch (2026-07-23, server route modularization)

- Completed: split monolithic server handlers into `createRuntime`, `createRequestHandler`, `openaiClient`, and `routes/{collaborationAuth,projectResources,aiRoutes,officeReports}`.
- Completed: root `server.mjs` still boots the process; `server/app.mjs` is a thin listen wrapper.
- Verification: full `scripts/check-*.mjs` suite 61/61 passed.

## Latest completed batch (2026-07-23, phase-3 split + hygiene finish)

- Completed: fixed AI OV-1 incomplete-draft path so `draft.expectedEffects` still wins (`ov1DraftStore.js`); `check-brief-expected-effects-downstream` now passes.
- Completed: removed root `src/` compatibility re-exports; shared code is only under `shared/`.
- Completed: server process body moved to `server/app.mjs`; extracted `server/httpUtils.mjs` and `server/staticFiles.mjs`. Root `server.mjs` remains a one-line entry.
- Completed: frontend shell helpers extracted to `design-studio/src/app/` (`createInitialState`, `domUtils`, `workflowGate`); `main.js` still wires controllers.
- Changed files: `design-studio/src/ov1DraftStore.js`, `design-studio/src/main.js`, `design-studio/src/app/**`, `server.mjs`, `server/app.mjs`, `server/httpUtils.mjs`, `server/staticFiles.mjs`, `src/**` (removed), docs.
- Verification: full `scripts/check-*.mjs` suite expected green after this batch.

## Latest completed batch (2026-07-23, phase-2 directory layout)

- Completed: moved Node domain modules from repo root into `server/` (`project*.mjs`, `aiServiceConfig.mjs`, `knowledgeSensitivityAccess.mjs`).
- Completed: moved shared runtime libs into `shared/` (`aiClient.js`, `knowledge.js`, `generator.js`, `data.js`). Root `src/` now holds compatibility re-exports only.
- Completed: updated `server.mjs`, design-studio AI/knowledge imports, and acceptance scripts to the new paths. Kept root `server.mjs` as the stable process entry so `node server.mjs` is unchanged.
- Changed files: `server/**`, `shared/**`, `src/**`, `server.mjs`, `design-studio/src/*AiController.js`, `briefController.js`, `knowledgeStore.js`, `inspirationAdviceController.js`, many `scripts/check-*.mjs`, `project-context.md`.
- Verification: full `scripts/check-*.mjs` suite — 60 passed. Pre-existing failure remains in `check-brief-expected-effects-downstream.mjs` (AI OV-1 draft prefers brief effects wording; unrelated to path moves).

## Latest completed batch (2026-07-23, pre-cleanup backup and phase-1 hygiene)

- Completed: full source backup before cleanup at `D:\项目\_backups\combat-concept-ai-workbench-8792-20260723-142709-pre-cleanup.zip`.
- Completed: removed unused AntV X6 vendor (`design-studio/vendor/x6-2.18.1.js`); Drawflow remains for OV-5b.
- Completed: archived root legacy static Demo UI (`src/main|render|state|dom|scenario*`) to `archive/legacy-static-demo-src-20260723/`. Kept shared runtime `src/aiClient.js`, `knowledge.js`, `generator.js`, `data.js`.
- Completed: archived unbound inspiration controllers to `archive/legacy-inspiration-controllers-20260723/`. Follow-up/suggestion stores stay for acceptance scripts; live path remains research chat + `inspirationAdviceController`.
- Completed: moved one-off data/recovery artifacts into `archive/data-backups/` and `archive/output-recovery-20260723/`.
- Completed: aligned `AGENTS.md` run instructions with `PORT=8792 node server.mjs`; refreshed `archive/README.md` and `src/README.md`.
- Changed files: `AGENTS.md`, `archive/**`, `src/**` (moves), `design-studio/vendor/x6-2.18.1.js` (deleted), `design-studio/src/ui.js`, `design-studio/src/inspiration*Controller.js` (archived), `project-context.md`.
- Verification: syntax checks on `ui.js`; workflow and inspiration-related acceptance scripts.

## Latest completed batch (2026-07-23, OODA freshness and structure-review checklist export)

- Completed: OODA now stamps an OV-5 source signature on derive/AI generation. When OV-5 activities/edges change, OODA is treated as stale; the OODA page shows a re-derive banner, and structure review surfaces an `ooda-stale` issue with a derive action.
- Completed: structure review can export the currently filtered issue set as a Markdown review checklist or JSON payload (`导出清单` / `导出 JSON`), including severity, target view, and sign-off blanks.
- Changed files: `oodaStore.js`, `oodaView.js`, `structureReviewBuilder.js`, `structureReviewView.js`, `structureReviewExport.js`, `main.js`, `styles.css`, `index.html`, `scripts/check-structure-review-workbench.mjs`, `project-context.md`.
- Verification: `check-structure-review-workbench`; `check-workflow-test-mode`; `check-design-studio-workflow`.

## Latest completed batch (2026-07-23, validation stale markers and structure-review filters)

- Completed: design validation is no longer discarded on model change. Results are kept and marked `stale` with reason; load path also reconstructs stale state when the input signature no longer matches. Stage-3 unlock requires a non-stale validation.
- Completed: structure review and validation views show expired banners and re-run CTAs; stale validation issues are labeled and slightly demoted so live structure findings stay first.
- Completed: structure review supports severity filters (全部/高优/需复核/未完成) and group filters (including clickable summary cards). Empty filter states are explicit.
- Changed files: `validationStore.js`, `validationView.js`, `structureReviewBuilder.js`, `structureReviewView.js`, `main.js`, `styles.css`, `index.html`, `scripts/check-structure-review-workbench.mjs`, `project-context.md`.
- Verification: `check-structure-review-workbench`; `check-workflow-test-mode`; `check-design-studio-workflow`.

## Latest completed batch (2026-07-23, validation merge and OV-1 multi-select editor)

- Completed: structure review workbench now merges the latest design-validation issues into a dedicated “设计验证” group (high/medium/low → alert/review/pending), with run-validation and jump-to-source actions. Validation page links back to the workbench.
- Completed: OV-5 activity inspector source picker upgraded to an explicit multi-select list with kind labels, live selected count, “按类型建议”, and “清空选择”; save still writes `sourceOv1NodeIds` through the existing form path.
- Changed files: `structureReviewBuilder.js`, `structureReviewView.js`, `ov5Ov1Linker.js`, `ui.js`, `main.js`, `validationView.js`, `styles.css`, `index.html`, `scripts/check-structure-review-workbench.mjs`, `project-context.md`.
- Verification: `check-structure-review-workbench`; `check-workflow-test-mode`; `check-design-studio-workflow`.

## Latest completed batch (2026-07-23, structure review workbench and OV-1 source linking)

- Completed: added a structure-review workbench that aggregates OV-1 diagnostics plus derived OV-2/3/4/5a/6* issues into prioritised, actionable items with jump-back to editable source views.
- Completed: OV-5 local/AI drafts now auto-link `sourceOv1NodeIds` from the current OV-1 model; researchers can also run “补挂 OV-1 来源” from the workbench or OV-5 toolbar.
- Navigation: `结构核对台` leads the 结构核对 track; deep-read derived pages remain available beneath it.
- Changed files: `design-studio/src/structureReviewBuilder.js`, `structureReviewView.js`, `ov5Ov1Linker.js`, `ov5DraftStore.js`, `ov5AiController.js`, `data.js`, `ui.js`, `main.js`, `styles.css`, `index.html`, `scripts/check-structure-review-workbench.mjs`, `scripts/check-workflow-test-mode.mjs`, `project-context.md`.
- Verification: syntax checks; `check-structure-review-workbench`; `check-workflow-test-mode`; `check-ov1-strengthening`; `check-design-studio-workflow`.

## Latest completed batch (2026-07-23, OV navigation tracks and OV-1→OV-5 CTA)

- Completed: regrouped the concept tree into three collapsible tracks — 研究建模 (write), 结构核对 (review derived views), 推演交付 (scenario/validate/review/report). Stage gating still uses the existing five workflow phases.
- Completed: reordered the primary path to `brief → OV-1 → OV-5b → OODA`, then derived views. OV-5a now follows OV-5b and lives under 结构核对.
- Completed: OV-1 shows a next-step strip when nodes exist: enter OV-5, or generate an OV-5 candidate from the current concept. OV-5 AI analysis now includes a compact OV-1 node/edge summary.
- Changed files: `design-studio/src/data.js`, `design-studio/src/ui.js`, `design-studio/src/ov1View.js`, `design-studio/src/main.js`, `design-studio/src/ov5AiController.js`, `design-studio/styles.css`, `design-studio/index.html`, `scripts/check-workflow-test-mode.mjs`, `scripts/check-ov1-strengthening.mjs`, `project-context.md`.
- Verification: syntax checks; `check-workflow-test-mode`; `check-ov1-strengthening`.

## Latest completed batch (2026-07-23, OV-1 interface hierarchy refresh)

- Completed: restructured the OV-1 surface into a compact command header, scenario-context band, review-metric strip, and a formal concept-map work area. Storage status no longer competes with primary commands; AI candidate generation is the sole primary action.
- Completed: refreshed the map visual language with restrained semantic node accents, a light working grid, clearer map caption, and a compact in-canvas legend. Existing modal node and relationship workflows, persisted coordinates, model data, and responsive edge anchoring are unchanged.
- Responsive: at narrow widths the heading and tool commands retain readable button labels, context items become a two-column band, and the fixed-size concept map is horizontally scrollable instead of clipping its nodes.
- Verification: `node --check design-studio/src/ov1View.js` and `node scripts/check-ov1-strengthening.mjs` passed. Live project `mj` was visually checked at 1200px, 768px, and 390px. Screenshots: `output/playwright/ov1-ui-redesign-desktop.png`, `output/playwright/ov1-ui-redesign-768.png`, and `output/playwright/ov1-ui-redesign-390-final.png`.

## Latest completed batch (2026-07-23, OV-1 AI contract and recovery protection)

- Completed: replaced the generic `ConceptPlan` route with `OperationalConceptGraphic`. The server now requires a structured concept summary, exactly five typed OV-1 entities (`sense`, `decide`, `control`, `opponent`, `assess`), and high-level relationships; the client no longer maps phases or risks into entity labels.
- Completed: applying an OV-1 AI candidate now requires confirmation and first saves a server-synchronized model recovery point. If that recovery point cannot be saved, the candidate is not applied.
- Data recovery: rebuilt project `mj` OV-1 at server revision `r9` from its preserved concept brief, retaining stable node IDs and relations. The pre-rebuild file backup is `data/projects.before-ov1-rebuild-20260723.json`. The overwritten pre-fix OV-1 cannot be reconstructed verbatim because its audit retained only a node/edge count and no historical snapshot.
- Verification: syntax checks for changed modules, `check-ov1-strengthening`, and `check-design-studio-workflow` passed. A real AI request returned `OperationalConceptGraphic` with five typed entity nodes and no stage/risk/step label. Browser visual verification is saved at `output/playwright/ov1-luzon-recovery.png`.

## Latest completed batch (2026-07-23, OV-1 responsive edge anchors)

- Completed: OV-1 edges and labels now derive their endpoints from the rendered card rectangles, not estimated percentage dimensions. A `ResizeObserver` redraws relations on canvas resize, while dragging a card redraws immediately.
- Verification: `node --check design-studio/src/ov1ConceptMapController.js`, `node --check design-studio/src/ov1View.js`, and `node scripts/check-ov1-strengthening.mjs` passed. Browser screenshots at 768px and 1200px, including a live no-reload resize, confirm arrows stay attached to target cards.

## Latest completed batch (2026-07-22, OV-1 arrow visibility)

- Completed: the OV-1 map now uses solid, high-contrast relationship lines with enlarged triangular direction markers. Connection and node layers use the same coordinate space, so arrow endpoints terminate at their target card boundary.
- Verification: inspected a real-browser element screenshot at `output/playwright/ov1-arrow-preview.png`; changed-module syntax and OV-1 strengthening acceptance passed.

## Latest completed batch (2026-07-22, OV-1 relationship labels)

- Completed: relationship arrows now render labels in an offset DOM layer instead of placing SVG text directly on the curve. Labels use normal browser text layout with a white background and subtle border, avoiding non-uniform SVG scaling.
- Completed: relationship lines now use the actual OV-1 card proportions for source/target edge anchors, so visible arrowheads terminate on node borders without the former gap. Line weight and marker size were increased for review readability.
- Changed files: `design-studio/src/ov1View.js`, `design-studio/styles.css`, `scripts/check-ov1-strengthening.mjs`, `project-context.md`.
- Verification: changed-module syntax and OV-1 strengthening acceptance passed.

## Latest completed batch (2026-07-17, OV-1 equipment and action semantics)

- Completed: OV-1 concept-map element kinds now prioritize equipment/platforms, command nodes, and key actions, with external objects, environmental factors, and effects as supporting elements. Existing `participant` records remain compatible.
- Completed: default and draft OV-1 nodes use equipment, C2, action, external influence, and effect/end-state roles. Node dialogs expose the complete selectable type set, which is preserved through server normalization.
- Verification: syntax, OV-1 strengthening, and workflow acceptance passed.

## Latest completed batch (2026-07-17, OV-1 scenario defaults and report carry-through)

- Completed: updated new OV-1 defaults, automatic layout, and AI/local candidate labels from abstract loop stages to scenario-level operational entities: sensing/monitoring, joint C2, task action, external influence, and task effects/end state.
- Completed: OV-1 concept summary now carries into the report payload; existing project node names are deliberately retained and not rewritten automatically.
- Verification: syntax; OV-1 strengthening; expected-effects downstream; workflow; and DoDAF operational-view acceptance passed.

## Latest completed batch (2026-07-17, OV-1 capability-aligned surface)

- Completed: moved OV-1 objective, scope/environment, expected effects, and constraints out of the diagram into a compact scenario-summary band. The diagram now contains only operational participants, external objects, environment factors, effects, and labeled high-level relationships.
- Completed: added `participant`, `external`, `environment`, and `effect` OV-1 node kinds. They are editable in the node dialog, normalized through the server model boundary, and visibly differentiated on the concept map.
- Verification: changed-module syntax, OV-1 strengthening, and design-studio workflow acceptance passed.

## Latest completed batch (2026-07-17, OV-1 scenario semantics)

- Completed: added OV-1 scenario-summary data for mission, objective, scope/environment, phase, expected effects, and constraints. Existing models fall back to the concept brief until researchers save an OV-1-specific summary.
- Completed: the formal OV-1 map now shows objective and scope/environment in the top context band, plus expected effects and constraints on the diagram. A task-summary dialog persists these fields through local and server model normalization.
- Changed files: `design-studio/src/ov1Store.js`, `design-studio/src/ov1View.js`, `design-studio/src/ov1Controller.js`, `design-studio/src/main.js`, `design-studio/styles.css`, `projectModelNormalizers.mjs`, `project-context.md`.
- Verification: changed-module syntax, OV-1 strengthening, and design-studio workflow acceptance passed.

## Latest completed batch (2026-07-17, formal OV-1 operational-concept map)

- Completed: removed Drawflow from OV-1 and introduced a dedicated operational-concept map renderer. The diagram now uses a title boundary, blue operational-entity blocks, labeled dashed relationship arrows, compact legend, modal entity detail, and persistent drag positions.
- Decision: Drawflow remains limited to OV-5b, where its activity-flow interaction matches the view purpose. OV-1 follows the DoDAF high-level operational-concept guidance: scenario/mission context and actor interactions at summary level, rather than a workflow editor.
- Changed files: `design-studio/src/ov1ConceptMapController.js`, `design-studio/src/ov1View.js`, `design-studio/src/main.js`, `design-studio/styles.css`, `project-context.md`.
- Verification: changed-module syntax, OV-1 strengthening, and design-studio workflow acceptance passed.

## Latest completed batch (2026-07-17, Drawflow official visual treatment)

- Completed: restored the recognizable Drawflow visual language for OV-1 and OV-5b: white fine-grid canvas, white shadowed cards, visible circular input/output ports, blue Bezier connections, and blue selected-node focus.
- Decision: ports communicate connection direction but do not directly create model relations. Relation creation remains in the existing reviewed management path so type, provenance, and downstream constraints are retained.
- Changed files: `design-studio/styles.css`, `project-context.md`.
- Verification: Drawflow controller/main syntax, OV-1 strengthening, and design-studio workflow acceptance passed.

## Latest completed batch (2026-07-17, Drawflow graph-editor migration)

- Completed: replaced the OV-1 and OV-5b graph surfaces with locally bundled Drawflow 0.0.60. OV-1 drag positions persist through the existing model sync; OV-5b keeps its derived automatic layout while using Drawflow nodes and connections for rendering and activity selection.
- Decision: kept OODA as a four-lane cycle and OV-2/3/4/5a/6 as their existing derived review views. They are not generic freeform relation editors and would lose meaningful structure under Drawflow.
- Dependency: added Drawflow's unmodified MIT browser JS/CSS and complete license attribution under `design-studio/vendor/`. The former X6 entry is no longer loaded; its downloaded file remains unused because the environment disallowed deleting that binary resource.
- Changed files: `design-studio/index.html`, `design-studio/src/drawflowCanvasController.js`, `design-studio/src/main.js`, `design-studio/src/ov1View.js`, `design-studio/src/ov5GraphView.js`, `design-studio/styles.css`, `design-studio/vendor/drawflow-0.0.60.min.js`, `design-studio/vendor/drawflow-0.0.60.min.css`, `design-studio/vendor/NOTICE.md`, `scripts/check-design-studio-workflow.mjs`, `project-context.md`.
- Verification: changed-module syntax, OV-1 strengthening, design-studio workflow acceptance, and local HTTP checks for both Drawflow artifacts passed.

## Latest completed batch (2026-07-17, X6 OV-1 graph canvas)

- Completed: replaced the hand-rendered OV-1 SVG connectors and DOM drag surface with a local AntV X6 2.18.1 graph adapter. OV-1 now uses edge anchors, rounded connectors, SVG markers, and native graph-node drag events while retaining the existing model, dialogs, synchronization, and derived-view contracts.
- Dependency: bundled the unmodified MIT-licensed X6 browser distribution in `design-studio/vendor/x6-2.18.1.js`; attribution and license text are in `design-studio/vendor/NOTICE.md`.
- Changed files: `design-studio/index.html`, `design-studio/src/ov1CanvasController.js`, `design-studio/src/ov1View.js`, `design-studio/styles.css`, `design-studio/vendor/x6-2.18.1.js`, `design-studio/vendor/NOTICE.md`, `project-context.md`.
- Verification: changed-module syntax, OV-1 strengthening, design-studio workflow acceptance, and static HTTP checks for the X6 asset and controller returned successfully. Visual verification requires an authenticated local workbench session.

## Latest completed batch (2026-07-17, account registration and login refresh)

- Completed: refreshed the login gate into a compact centered sign-in card and added a registration form with an in-place login/register switch.
- Completed: added the public `/api/collaboration/auth/register` flow. Registration creates a non-lead local research account, records an audit event, and signs the user in. Lead, reviewer-management, account enablement, and password reset remain lead-controlled.
- Changed files: `projectLocalIdentity.mjs`, `server.mjs`, `design-studio/src/projectBriefClient.js`, `design-studio/src/collaborationController.js`, `design-studio/src/collaborationView.js`, `design-studio/src/main.js`, `design-studio/styles.css`, `scripts/check-local-collaboration-identity.mjs`.
- Verification: syntax; local identity; collaboration foundation; AI configuration write access; project-write access; workflow acceptance checks passed. The server must be restarted before the new registration API route is available in the live process.

## Latest completed batch (2026-07-17, OV-1 bookmark sidebar control)

- Completed: replaced the OV-1 collapsed-sidebar rail control with a compact green bookmark tab. The tab sits at the right edge near the top, protrudes toward the canvas, and uses a bookmark notch rather than a large centered button.
- Changed files: `design-studio/styles.css`, `project-context.md`.
- Verification: main syntax, OV-1 strengthening, and design-studio workflow acceptance passed.

## Latest completed batch (2026-07-17, OV-1 sidebar expansion rail)

- Completed: revised the OV-1 collapsed context sidebar to retain a 34px right-edge rail with a small expand button. Clicking it restores the full inspector; the toolbar provides the collapse action only while expanded.
- Changed files: `design-studio/index.html`, `design-studio/src/ov1View.js`, `design-studio/styles.css`, `project-context.md`.
- Verification: main/OV-1 view syntax, OV-1 strengthening, and design-studio workflow acceptance passed.

## Latest completed batch (2026-07-17, OV-1 collapsible context sidebar)

- Completed: replaced the OV-1-only hidden context sidebar with a reversible collapsed state. The OV-1 toolbar now switches between `展开侧栏` and `收起侧栏`; the sidebar remains in the page and its grid transition restores the original workspace layout.
- Changed files: `design-studio/src/main.js`, `design-studio/src/ov1View.js`, `design-studio/styles.css`, `project-context.md`.
- Verification: main/OV-1 view syntax, OV-1 strengthening, and design-studio workflow acceptance passed.

## Latest completed batch (2026-07-17, OV-1 focused workspace)

- Completed: OV-1 now hides the application-wide context and knowledge-evidence sidebar, allowing its concept canvas to use the full main workspace.
- Decision: the focused layout applies only to OV-1; other workbench views retain their existing right-side context panel. Node evidence remains editable in the node dialog.
- Changed files: `design-studio/src/main.js`, `design-studio/styles.css`, `project-context.md`.
- Verification: main-module syntax, OV-1 strengthening, and design-studio workflow acceptance passed.

## Latest completed batch (2026-07-17, OV-1 full-width canvas and dialogs)

- Completed: removed the inline OV-1 right-side management column so the concept canvas uses the full central workspace.
- Completed: relation creation, relation removal, legend, and structural diagnostics now open in a relationship-management dialog. Selecting or adding a node opens a node-editor dialog; dragging a node only updates its position.
- Decision: retained the application-wide context and knowledge-evidence inspector, but OV-1 node details no longer render there.
- Changed files: `design-studio/index.html`, `design-studio/src/main.js`, `design-studio/src/ov1View.js`, `design-studio/src/ov1Controller.js`, `design-studio/src/ov1CanvasController.js`, `design-studio/styles.css`, `scripts/check-ov1-strengthening.mjs`, `project-context.md`.
- Verification: syntax checks, OV-1 strengthening including dialog-layout assertions, and design-studio workflow acceptance passed. Browser visual verification remains blocked by the local login gate.

## Latest completed batch (2026-07-17, live derived-view review)

- Completed: performed authenticated, test-mode UI verification against the local workbench. Test mode unlocks all 15 views after the asynchronous project-mode save completes; OV-1 node, relationship, and diagnostics controls render correctly.
- Completed: moved the OV-3 resource-flow matrix ahead of its detailed exchange table and diagnostics, matching its primary-review role. Long OV-4 responsibility descriptions now clamp to two lines in the table.
- Completed: corrected OV-6c so unscheduled OODA nodes no longer make the scenario timeline diagnostic appear complete. The derived view now explicitly reports that the time line remains ungenerated.
- Changed files: `design-studio/src/ov3View.js`, `design-studio/src/ov6cBuilder.js`, `design-studio/styles.css`, `scripts/check-ov3-resource-exchange.mjs`, `scripts/check-ov6c-event-trace.mjs`.
- Verification: live authenticated UI checks for test-mode, OV-1, OV-3, OV-4, and OV-6c; changed-module syntax; OV-3, OV-4, OV-6c, DoDAF, and workflow acceptance checks passed.

## Latest completed batch (2026-07-17, OV-1 review readability)

- Completed: improved the OV-1 review surface. Canvas nodes now show category and a bounded responsibility/detail summary; the page adds a compact node, relation, semantic-completeness, and isolated-node overview.
- Completed: structural diagnostics now explicitly flag nodes missing review-critical semantic fields: category, responsibility, input, output, constraints, or expected effects.
- Changed files: `design-studio/src/ov1View.js`, `design-studio/src/ov1Diagnostics.js`, `design-studio/styles.css`, `scripts/check-ov1-strengthening.mjs`, `project-context.md`.
- Verification: changed-module syntax checks, OV-1 strengthening, and DoDAF operational-view acceptance passed. Browser visual verification was blocked by the local workbench login gate; no authentication or project data was changed.

## Latest completed batch (2026-07-16, OV-1 to OV-6 trial guidance)

- Completed: added a focused `OV-1 至 OV-6 实操` section to the trial guide. It covers the source-model sequence, candidate application, relationship checks, read-only derived-view handling, validation handoff, and minimum completion criteria.
- Decision: kept this procedural guidance in documentation rather than adding persistent explanatory UI, preserving the focused workbench surface while answering the previously identified first-use gap.
- Changed files: `TRIAL_GUIDE.md`, `project-context.md`.
- Verification: OV-1 strengthening, DoDAF operational-view, and workflow acceptance checks passed; relevant view modules passed syntax checks.

## Latest completed batch (2026-07-16, full acceptance and archive compatibility)

- Completed: restored Obsidian archive compatibility after the OV-1 DoDAF relabel. Markdown now uses `OV-1 总体概念（高层作战概念图）`, retaining both the established archival/reference heading and the DoDAF-oriented meaning.
- Verification: all current `scripts/check-*.mjs` acceptance scripts passed, including workflow, archive-set, report templates, project repository, identity, validation, and the OV-1 to OV-6 derived-view checks.
- Changed files: `design-studio/src/reportBuilder.js`, `project-context.md`.

## Latest completed batch (2026-07-16, OV-6c event review clarity)

- Completed: OV-6c now annotates each specific out-of-order event instead of only reporting a total in diagnostics. The event row and inspector state identify whether review is needed due to a missing OODA source, unscheduled node, or abstract-time ordering.
- Changed files: `design-studio/src/ov6cBuilder.js`, `design-studio/src/ov6cView.js`, `design-studio/styles.css`, `scripts/check-ov6c-event-trace.mjs`.
- Verification: changed-module syntax checks; OV-6c event trace, OV-3 resource exchange, OV-4 responsibility, and DoDAF operational-view acceptance checks passed.

## Latest completed batch (2026-07-16, OV-4 responsibility coverage)

- Completed: OV-4 now makes abstract responsibility review more scannable with two coverage indicators: OV-5 activity-to-role assignment and role-to-activity coverage. The page retains its explicit boundary that these are research abstractions, not real organizations, personnel, or command relations.
- Changed files: `design-studio/src/ov4Builder.js`, `design-studio/src/ov4View.js`, `design-studio/styles.css`, `scripts/check-ov4-responsibility.mjs`.
- Verification: changed-module syntax checks; OV-4 responsibility, OV-3 resource exchange, and DoDAF operational-view acceptance checks passed. Local service health at `8792` returned `200` in SQLite mode.

## Latest completed batch (2026-07-16, OV-3 resource-flow matrix)

- Completed: OV-3 now renders a compact source-activity by receiving-activity resource-flow matrix in addition to the existing exchange-contract table. Non-empty cells retain the existing detail selection action and show direct-match, mapping-review, or missing-definition state.
- Decision: OV-3 remains a read-only derivation of OV-5b activity relationships. The matrix exposes no additional editable model and keeps the detailed input/output contract table for review.
- Changed files: `design-studio/src/ov3Builder.js`, `design-studio/src/ov3View.js`, `design-studio/styles.css`, `scripts/check-ov3-resource-exchange.mjs`.
- Verification: OV-3 resource-exchange acceptance, DoDAF operational views acceptance, validation diagnostic-persistence acceptance, and changed-module syntax checks passed.

## Latest completed batch (2026-07-16, derived operational-view review coverage)

- Completed: the report page now shows a compact, read-only DoDAF operational-view summary with OV-5a activity count, OV-6a rule count, OV-6b transition count, and OV-6c event count. It states that researchers maintain the source OV-5b/OODA models rather than editing derivatives.
- Completed: validation now reports low-priority review prompts when a populated OV-5b has no hierarchy, OV-6a has no rules, or OV-6b has no transitions. These prompts do not change workflow gating or scoring.
- Changed files: `design-studio/src/ui.js`, `design-studio/src/reportBuilder.js`, `design-studio/src/validationStore.js`, `scripts/check-dodaf-operational-views.mjs`.
- Verification: syntax checks; DoDAF operational views; report templates. No service restart required.

## Latest completed batch (2026-07-16, project-manager layout and deletion)

- Completed: redesigned the left-rail project manager as a compact single-column list. Each item now separates title, project ID/status, and actions; the panel suppresses horizontal overflow and keeps only a bounded vertical list scroll.
- Completed: added permanent project deletion. Only a lead can delete, and only after a non-default project has been archived. The UI does not expose deletion for the current project and requires an explicit browser confirmation; repository deletion removes the project catalog entry and every persisted project resource in the same write.
- Changed files: `design-studio/src/projectManagerView.js`, `design-studio/styles.css`, `design-studio/src/main.js`, `design-studio/src/projectBriefClient.js`, `server.mjs`, `projectRepository.mjs`, `scripts/check-project-manager-layout.mjs`, `scripts/check-project-deletion.mjs`.
- Verification: `node --check` passed for the changed JavaScript modules. Project-manager layout and project-deletion acceptance scripts passed. Before the deletion batch, all 57 `scripts/check-*.mjs` scripts passed.
- Blocker: the local execution policy rejected the service restart command, so the current `8792` process has not loaded the new deletion API yet. Restart `node server.mjs` from this workspace through the normal secure service launch procedure before browser testing; do not inspect or copy the AI-key environment.

## Latest completed batch (2026-07-16, normalized SQLite project storage)

- Completed: promoted `researchIntent` to a first-class concept-brief field. It is saved in browser drafts and the `project_briefs.research_intent` column, restored from the project repository, eligible for AI automatic update, and required for completion of the concept-brief workflow stage.
- Migration: added `research_intent` to the existing `project_briefs` table in place; the live SQLite schema and health were verified after service restart.
- Changed files: `design-studio/src/briefStore.js`, `design-studio/src/briefController.js`, `design-studio/src/main.js`, `design-studio/src/researchChatBriefUpdate.js`, `projectRepository.mjs`, `scripts/check-research-chat-brief-update.mjs`.
- Verification: syntax, research-chat brief update, brief completeness, normalized SQLite repository, project repository, brief isolation, and inspiration persistence checks passed.

- Completed: new projects now use an explicit blank concept-brief seed instead of the default demonstration project's brief. Project-scoped browser drafts remain isolated and all brief recovery, remote hydration, snapshot restore, and AI update paths use the appropriate seed.
- Changed files: `design-studio/src/main.js`, `scripts/check-project-brief-isolation.mjs`.
- Verification: new-project brief isolation, concept-brief completeness, research-chat brief-update, main-module syntax, static module HTTP, and SQLite health checks passed.

- Completed: replaced the active SQLite single-row state persistence with normalized project tables: `project_catalog`, `project_records`, `project_briefs`, `project_conversation_messages`, `project_resources`, history collections/items, collaboration reviews/decisions, and audit events.
- Migration: the existing `data/projects.sqlite` was migrated in place without deleting project data. Validation after migration found 4 project records, 2 briefs, 21 conversation messages, 2 resources, and 59 audit events in normalized tables.
- Compatibility: `project_repository_state` remains as an automatically refreshed legacy snapshot only for the existing file/SQLite migration and backup tooling; runtime reads and writes use the normalized tables.
- Changed files: `projectRepository.mjs`, `scripts/check-sqlite-project-repository.mjs`.
- Verification: normalized SQLite repository, project repository, inspiration persistence, file-to-SQLite migration, and SQLite backup/restore checks passed. `8792` restarted with SQLite and health returned `ok`.

## Latest completed batch (2026-07-16, focused research chat)

- Completed: corrected research-chat prompt/response mismatch. Chat responses now show only the AI's direct summary, while the plan phases and risks remain structured data for automatic brief updates rather than being appended into the visible reply. The server prompt explicitly requires a 1-3 sentence, 120-220 character direct answer and prohibits report-style restatement.
- Changed files: `design-studio/src/inspirationAdviceController.js`, `server.mjs`.
- Verification: syntax, research-chat advice, research-chat brief-update checks passed; `8792` restarted with SQLite and health returned `ok`.

- Completed: removed the duplicate research-summary, structured collection, adaptive follow-up, submit-and-continue, reset-session, and fill-intent controls from the concept-brief chat surface. The page now retains only the chat, message edit/regenerate controls, and automatic brief-update behavior.
- Changed files: `design-studio/src/inspirationView.js`, `design-studio/src/main.js`, `design-studio/src/ui.js`, `design-studio/styles.css`, `scripts/check-inspiration-structured-extraction.mjs`.
- Decision: retained existing structured-history data and its normalizers for compatibility with existing projects and reports, but no longer render or bind the retired workflow controls.
- Verification: research-chat advice, retained-history/no-retired-controls, research-chat brief-update, design-studio workflow, syntax, and static root/CSS HTTP checks passed.

- Completed: rebalanced the concept-brief workspace into a wider central research-chat surface and a fixed, independently scrolling brief editor. The left rail is narrower, the chat has a readable 980px internal lane, and the brief save actions remain visible in its panel.
- Changed files: `design-studio/index.html`, `design-studio/styles.css`.
- Verification: studio UI syntax, research-chat advice, brief completeness, design-studio workflow, and static root/CSS HTTP checks passed.

- Completed: successful research-chat responses now update the matching concept-brief field automatically. Question intent selects one field among objective, approach, assumptions, expected effects, and risk; local fallback advice never updates the brief.
- Changed files: `design-studio/src/researchChatBriefUpdate.js`, `design-studio/src/inspirationAdviceController.js`, `design-studio/src/main.js`, `scripts/check-research-chat-brief-update.mjs`.
- Verification: research-chat field-selection, chat-advice, brief-completeness, project-inspiration persistence, and SQLite repository checks passed.

- Completed: replaced the concept-brief main-area consultation form with a focused research chat surface. The main interaction is now a single composer and continuous message stream; the six-dimension collection workflow is retained in a collapsed support section.
- Completed: consultation turns support edit-and-resend and regenerate. Both paths retain the current research stage, record AI or local-fallback provenance, and do not automatically alter the brief or models.
- Completed: research chat updates invoke the existing project-brief sync path, so when the service is started with `PROJECT_DB_PATH=data/projects.sqlite`, conversation snapshots persist with the project in SQLite.
- Changed files: `design-studio/src/inspirationStore.js`, `design-studio/src/inspirationAdviceController.js`, `design-studio/src/inspirationController.js`, `design-studio/src/inspirationView.js`, `design-studio/src/main.js`, `design-studio/styles.css`, `scripts/check-inspiration-advice.mjs`.
- Verification: syntax checks; research-chat advice, structured extraction, project-inspiration persistence, brief completeness, SQLite repository, project repository, design-studio workflow, expected-effects and model-snapshot acceptances passed. Service restarted at `http://127.0.0.1:8792/`; health reports `projectRepository.mode=sqlite`.

## Latest completed batch (2026-07-15, lead-managed encrypted AI key)

- Completed: added a separate lead-only system-administration page at `design-studio/admin.html` for AI endpoint, model, and API Key configuration. The research workbench no longer exposes the AI configuration control.
- Completed: administrator-provided keys are protected with Windows DPAPI using the current Windows user scope and stored only as an encrypted local record. Public APIs expose only configured state and key source, never the key value.
- Decision: the service prioritizes `OPENAI_API_KEY` when supplied by the deployment environment; otherwise it uses the local DPAPI-protected key. `AI_SERVICE_CONFIG_WRITE=false` remains an explicit deployment switch to disable configuration writes.
- Changed files: `projectAiSecretStore.mjs`, `aiServiceConfig.mjs`, `server.mjs`, `design-studio/index.html`, `design-studio/admin.html`, `design-studio/src/admin.js`, `design-studio/src/main.js`, `design-studio/styles.css`, `scripts/check-ai-secret-store.mjs`.
- Verification: DPAPI secret-store, AI configuration authorization, local identity, workflow, and concept-brief checks passed. `8792` restarted in SQLite mode with lead-only AI configuration writes enabled.

## Latest completed batch (2026-07-15, focused concept brief workspace)

- Completed: simplified the concept-brief screen into a single research-baseline editing surface. Removed the duplicated read-only summary and default citation cards from the main path.
- Completed: knowledge evidence is now a collapsed source summary and the default brief inspector no longer renders the knowledge graph. Inspiration history and direction selection remain available in a collapsed support section.
- Changed files: `design-studio/src/ui.js`, `design-studio/src/main.js`, `design-studio/styles.css`.
- Verification: syntax checks plus concept-brief completeness, expected-effects downstream, workflow, and knowledge-retrieval checks passed.

## Latest completed batch (2026-07-15, persistent workflow gates)

- Completed: the research workflow now uses strict persistent stage gates. Later phases are locked until the current phase passes basic completeness checks and a user confirms completion.
- Completed: workflow progress is stored in SQLite project metadata. Saving an upstream brief, knowledge resource, model, scenario, or validation resource invalidates the affected stage and all later phases.
- Decision: structural review is a confirmation gate over the derived OV-2/OV-3/OV-4/OV-6c views, whose source prerequisites are OV-1, OV-5, and OODA. It does not introduce a duplicate editable model.
- Changed files: `projectRepository.mjs`, `server.mjs`, `design-studio/index.html`, `design-studio/src/data.js`, `design-studio/src/ui.js`, `design-studio/src/main.js`, `design-studio/styles.css`.
- Verification: syntax checks plus SQLite project repository, project repository, workflow, and collaboration-foundation checks passed. `8792` restarted with `PROJECT_DB_PATH=data/projects.sqlite` and health reports `projectRepository.mode=sqlite`.

## Latest completed batch (2026-07-15, workflow-oriented navigation)

- Completed: the left navigation now groups existing views by research workflow: preparation, concept modeling, structural review, simulation/evaluation, and review/delivery. Derived OV-2/OV-3/OV-4/OV-6c views remain available but are no longer presented as the main linear workflow.
- Completed: removed the fixed top-level OV-5 generation action. The top command bar is now reserved for cross-workflow context and commands; generation remains in the relevant model view.
- Changed files: `design-studio/src/data.js`, `design-studio/src/ui.js`, `design-studio/src/main.js`, `design-studio/styles.css`.
- Verification: `node --check` passed; workflow, OV-5 activity graph, OV-4 responsibility, and OV-6c event-trace acceptance checks passed.

## Latest completed batch (2026-07-15, SQLite project directory and project management)

- Completed: project directory metadata (`id`, title, description, archive state, timestamps) now persists with all project resources in the existing SQLite repository state. New projects begin as isolated empty project records; archival hides a project by default without deleting its resources.
- Completed: authenticated users can create research projects; leads can archive or restore them. The workbench project panel lists projects, creates a project, changes the current project through a URL parameter, and loads project-specific server resources.
- Decision: the SQLite repository retains a single application-state payload table. This intentionally keeps directory metadata and versioned project resources in the same local transaction boundary; it is not a substitute for a future multi-instance relational deployment.
- Changed files: `projectRepository.mjs`, `server.mjs`, `design-studio/index.html`, `design-studio/styles.css`, `design-studio/src/main.js`, `design-studio/src/collaborationController.js`, `design-studio/src/projectBriefClient.js`, `design-studio/src/projectManagerView.js`, `scripts/check-sqlite-project-repository.mjs`.
- Verification: syntax checks passed; SQLite catalog persistence, project repository, and collaboration foundation checks passed. Updated local service is available at `http://127.0.0.1:8793/design-studio/`.

## Latest completed batch (2026-07-15, login-gated collaboration review)

- Completed: the design studio now requires a local collaboration session before rendering the workspace. Unauthenticated users see only the first-run lead setup or account login gate; logout returns to that gate.
- Completed: collaboration review now has a top-level identity entry and a filterable queue for open, current-version, stale, and closed reviews. Existing server-validated roles, optimistic revisions, audit events, and public-evidence-only filtering are unchanged.
- Changed files: `design-studio/index.html`, `design-studio/styles.css`, `design-studio/src/main.js`, `design-studio/src/collaborationController.js`, `design-studio/src/collaborationView.js`, `scripts/check-collaboration-review-evidence.mjs`.
- Verification: `node --check` passed for the three changed JavaScript modules; collaboration evidence/foundation/local-identity checks passed. Local browser verification confirmed that an unauthenticated page exposes only the login gate.

## Current Handoff (2026-07-15, bounded review context and deferred heavy simulation)

### Current goal

- Maintain the working research chain `AI inspiration -> concept brief -> OV-1 -> OV-5 -> OODA -> scenario/deployment -> validation/red team -> report export` while continuing bounded intranet collaboration controls and self-hosted persistence preparation.

### Latest completed batch (2026-07-16, DoDAF operational-view alignment)

- Completed: aligned the client navigation and reports to the DoDAF operational-view terms used by the locally downloaded architecture-modeling example. OV-1/2/3/4 labels now state their DoDAF intent; the existing editable activity model is labelled OV-5b; OODA is explicitly a research-support cycle rather than a DoDAF product.
- Completed: added read-only derived OV-5a activity decomposition, OV-6a rule model, and OV-6b state-transition views. They derive only from existing OV-5b parent/precondition/constraint/edge data and OODA nodes, so they introduce no second editable model or operational instructions.
- Changed files: `design-studio/src/dodafOperationalBuilders.js`, `design-studio/src/dodafOperationalViews.js`, `design-studio/src/data.js`, `design-studio/src/ui.js`, `design-studio/src/reportBuilder.js`, `design-studio/styles.css`, `scripts/check-dodaf-operational-views.mjs`.
- Verification: syntax checks plus DoDAF operational-view, OV-1, OV-2, OV-3, OV-4, OV-6c and report-template acceptance checks passed. The full suite has one residual unrelated failure in `check-design-studio-workflow.mjs`: its existing Obsidian archive-set assertion finds an incomplete legacy output set. Browser-session visual verification was unavailable after the authenticated Playwright session closed.

### Latest completed batch (2026-07-16, project-local inspiration and brief isolation)

- Issue: newly created projects displayed another project's historical inspiration conversation and concept-brief content because those browser drafts used global localStorage keys while project switching only changed the URL/project ID.
- Completed: inspiration sessions and concept-brief drafts now use a project-scoped local key. The legacy unscoped key remains assigned to `default` for compatibility; non-default projects load a clean seed until they have their own saved local/server state. Returning to a project restores only its scoped draft.
- Changed files: `design-studio/src/inspirationStore.js`, `design-studio/src/briefStore.js`, `design-studio/src/main.js`, `scripts/check-project-local-draft-isolation.mjs`, `TRIAL_GUIDE.md`.
- Decision: this fixes the visible conversation/brief leak without silently migrating or deleting existing browser data. Other legacy local-only artifact stores remain outside this narrow correction and should be separately scoped before relying on them for multi-project work.
- Verification: `node --check` passed for modified modules; `node scripts/check-project-local-draft-isolation.mjs` passed clean new-project state plus return-to-project restoration. All 56 `scripts/check-*.mjs` acceptance scripts passed.
- Remaining work: when business testing confirms multi-project use of local-only OV/Scenario/Knowledge drafts, scope those stores in a dedicated migration batch; service-synced project models are already addressed by project ID.

### Latest completed batch (2026-07-16, test-mode workflow access)

- Current target: allow business trial users to reach any module without artificial phase-unlock friction.
- Completed: restored the workflow mode panel in the workbench. In `测试模式`, tree navigation does not disable any stage; `解锁模式` keeps the existing phase-confirmation behavior.
- Changed files: `design-studio/src/main.js`, `scripts/check-workflow-test-mode.mjs`, `TRIAL_GUIDE.md`, `SOFTWARE_DESIGN.md`.
- Decision: test mode changes navigation only. It does not bypass collaboration authentication, project-write authorization, Vault sensitivity policy, validation, audit or export boundaries.
- Verification: `node --check design-studio/src/main.js`; `node scripts/check-workflow-test-mode.mjs`; all 55 `scripts/check-*.mjs` acceptance scripts passed.
- Remaining work: gather business trial feedback for both modes; do not introduce further workflow gates in test mode.

### Latest completed batch (2026-07-16, OV-1 strengthening)

- Completed: OV-1 nodes now retain research-level category, responsibility, abstract input/output, constraints, expected effects, and knowledge-reference fields through local state, project persistence, snapshots, and report output.
- Completed: added OV-1 structure checks for isolated nodes, duplicate names, information-flow and feedback coverage, and disconnected concept graphs. Added deterministic layout, visible relationship labels, and deletion impact confirmation for linked OV-5 activities.
- Completed: AI/local OV-1 generation now creates a candidate for human comparison and explicit apply/discard; it no longer overwrites the current model immediately.
- Decision: these controls remain conceptual and review-oriented. Node references are identifiers for research evidence, not authority for sensitive evidence disclosure or executable tasking.
- Changed files: `design-studio/src/ov1Diagnostics.js`, `design-studio/src/ov1Store.js`, `design-studio/src/ov1Controller.js`, `design-studio/src/ov1AiController.js`, `design-studio/src/ov1View.js`, `design-studio/src/main.js`, `design-studio/styles.css`, `projectModelNormalizers.mjs`, `design-studio/src/reportBuilder.js`, `scripts/check-ov1-strengthening.mjs`.
- Verification: syntax checks, `check-ov1-strengthening`, relevant project/report/snapshot checks, and all current `scripts/check-*.mjs` acceptance scripts passed. `8792` was restarted with `PROJECT_DB_PATH=data/projects.sqlite`; health reports SQLite mode.

### Latest completed batch (2026-07-16, OV-1 canvas readability)

- Completed: replaced the generic grid auto-layout with a fixed conceptual loop placement for the core sensing, decision, control, assessment, and opponent nodes. Relationship lines now use curved paths and relationship names remain in the side list instead of obscuring the canvas.
- Completed: increased node dimensions and line-height to avoid compressed multi-line labels.
- Verification: OV-1 strengthening acceptance now asserts the concept-loop arrangement; syntax checks passed. Browser access reached the login gate, but could not inspect the protected OV-1 canvas without a trial account session; screenshot saved as `output/playwright/ov1-layout-rework.png` for environment verification.

### Latest completed batch (2026-07-16, project directory archival)

- Completed: created a pre-archive backup before reorganizing the current project. The backup contains a source/file-state ZIP, a canonical SQLite project-state export, and copies of file-backed runtime state.
- Completed: moved the early root static Demo into `archive/legacy-static-demo-20260709/`, historical verification outputs into `archive/verification-outputs-20260709-12/`, and obsolete planning/session material into `plans/historical/`.
- Decision: keep `data/`, `src/`, `design-studio/`, `scripts/`, and current operating documents at their existing paths. Do not modify the separately maintained `D:\项目\combat-map-web` project or prior backup archives.
- Verification: current service health and root/studio static entry checks passed after the move.

### Latest completed batch (2026-07-16, project custom concept directions)

- Completed: concept briefs retain the three default direction frames and now support project-scoped custom directions with a title, research-level summary, and research basis. Users can add, select, edit, and delete custom directions; deleting the selected direction falls back to a default frame.
- Completed: custom directions synchronize with the project concept-brief record, participate in revision-conflict recovery and remote reload, and retain an isolated browser-local fallback per project.
- Decision: custom directions are bounded to eight per project, require all three fields, and cannot duplicate a default or existing direction title. Default direction frames remain immutable comparators.
- Changed files: `design-studio/src/directionProposalStore.js`, `design-studio/src/main.js`, `design-studio/src/ui.js`, `design-studio/styles.css`, `design-studio/src/projectBriefClient.js`, `design-studio/src/projectBriefSyncController.js`, `projectRepository.mjs`, `scripts/check-custom-directions.mjs`.
- Verification: syntax checks passed for all changed JavaScript modules. `check-custom-directions`, concept-brief persistence/conflict/completeness checks, and all current `scripts/check-*.mjs` acceptance scripts passed.

### Latest completed batch (2026-07-16, inspiration consultation assistant)

- Current target: allow researchers to ask for advice within inspiration incubation while retaining a bounded, reviewable research workflow.
- Completed: added a `咨询助手` form to the inspiration panel. It records a user question and an AI or local fallback research-level suggestion as `consultation` turns, without advancing the six-stage guided flow or changing a brief/model/scenario automatically.
- Changed files: `design-studio/src/inspirationStore.js`, `design-studio/src/inspirationAdviceController.js`, `design-studio/src/inspirationView.js`, `design-studio/src/main.js`, `scripts/check-inspiration-advice.mjs`, `TRIAL_GUIDE.md`, `INTERFACE_GUIDE.md`, `SOFTWARE_DESIGN.md`.
- Decision: question/answer turns remain subject to the existing 16-message browser-session bound and project snapshot normalization. The AI prompt excludes operational instructions, targets, routes, weapons and evasion guidance; assistant output is a suggestion for human review, not a conclusion.
- Verification: `node --check` passed for modified modules; `node scripts/check-inspiration-advice.mjs` passed stage preservation, provenance and rendering. All 51 `scripts/check-*.mjs` acceptance scripts passed.
- Remaining work: collect trial feedback on advice relevance and question flow before changing message bounds, adding streaming, or connecting any external conversation framework.

### Latest completed batch (2026-07-16, structured multi-turn inspiration extraction)

- Current target: strengthen the existing bounded inspiration workflow using dialogue patterns without becoming a general chat system.
- Completed: existing stage prompts, AI follow-up refinement and post-completion direction proposals are now complemented by a structured extraction editor. It exposes only already answered initial-idea/environment/opponent/resources/constraints/success fields; saving replaces the corresponding user replies without adding messages or automatically modifying the concept brief.
- Changed files: `design-studio/src/inspirationStore.js`, `design-studio/src/inspirationController.js`, `design-studio/src/inspirationView.js`, `scripts/check-inspiration-structured-extraction.mjs`, `TRIAL_GUIDE.md`, `SOFTWARE_DESIGN.md`.
- Decision: inspiration remains bounded to 16 messages and the existing six-topic research schema. It retains default-sensitive-excluding evidence boundaries, is not a free-form chat transcript, and requires an explicit user action before its summary enters the brief.
- Verification: `node --check` passed for all modified modules; `node scripts/check-inspiration-structured-extraction.mjs` passed replacement-only editing and rendering. All 50 `scripts/check-*.mjs` acceptance scripts passed.
- Remaining work: collect business trial feedback on question order, extraction field labels, direction proposals and brief handoff before expanding the schema or adding any external conversation dependency.

### Latest completed batch (2026-07-16, root workbench entry)

- Current target: expose the current workbench at the requested root URL while preserving existing deep links.
- Completed: `GET /` now serves `design-studio/index.html` at `http://127.0.0.1:8792/`. The studio page has an absolute `/design-studio/` base path, so its stylesheet, JavaScript modules and admin link still resolve correctly. `/design-studio/` remains a compatible direct path.
- Changed files: `server.mjs`, `design-studio/index.html`, `README.md`, `TRIAL_GUIDE.md`, `AGENTS.md`, `project-context.md`.
- Verification: `node --check server.mjs` passed. Root HTML contains the studio base path; root, compatibility path, stylesheet, main module and `/api/health` each returned `200` from `8792`. The accidental default-port `8788` listener created during validation was identified as this `server.mjs` process and closed; target `8792` remains running.
- Remaining work: business trial remains paused; do not change feature scope without trial feedback.

### Pause Handoff (2026-07-16, business trial requested)

- Status: feature development is paused at the user's request while business users trial the current prototype one capability at a time. Do not begin the remaining productionization, real-time collaboration, OIDC browser flow, or external platform work without a new trial finding or explicit direction.
- Trial entry point: `http://127.0.0.1:8792/`. `/design-studio/` remains a compatible direct path; the root page sets its base path to retain all studio assets.
- Trial guide: read `TRIAL_GUIDE.md` for the recommended business workflow, limits, observation record, and known local trial constraints.
- Interface guide: read `INTERFACE_GUIDE.md` for HTTP paths, revision/conflict behavior, role boundaries, archive integrity scope, and prohibited secret handling.
- Documentation index: read `DOCUMENTATION_INDEX.md` to distinguish current operating documents from historical planning references.
- Documentation refresh: on 2026-07-16, `README.md` was replaced with the current server-backed prototype entry point; `DOCUMENTATION_INDEX.md` and `plans/README.md` were added; `TRIAL_GUIDE.md`, `INTERFACE_GUIDE.md`, and `SOFTWARE_DESIGN.md` now state the business-trial pause. Historical plans remain traceability material only.
- Runtime note: during the documentation refresh, no listener was present on local port `8792`; no service was started because development is paused. Before the next trial, start the approved local service and check `GET /api/health`.
- Current acceptance baseline: all 48 `scripts/check-*.mjs` scripts passed after the OV-4 validation bridge. Browser visual automation remains unavailable because its runtime script is missing; do not retry that connection until it is repaired.
- Feedback required to resume: tested feature, sanitized input/sample, project revision, expected versus actual result, reproduction steps, and exported artifact or screenshot name. Never include passwords, session cookies, API keys, or sensitive Vault body text.
- First continuation action: read this file, `TRIAL_GUIDE.md`, `INTERFACE_GUIDE.md`, and the cited feature modules; reproduce the reported trial observation before changing scope.

### Latest completed batch (2026-07-15, OV-4 validation bridge)

- Completed: OV-4 unmapped activities, unassigned abstract roles and unresolvable cross-role relations now create transparent low-priority validation review issues.
- Changed files: `design-studio/src/validationStore.js`, `scripts/check-ov4-responsibility.mjs`.
- Decision: these derived-view findings do not alter the eight automatic scores, quantitative comparison, ranking, recommendation, or simulation claims.
- Verification: `node --check design-studio/src/validationStore.js` and `node scripts/check-ov4-responsibility.mjs` passed after adding a browser-local-storage test stub. All 48 `scripts/check-*.mjs` acceptance scripts passed after this validation bridge.
- Remaining work: run the full acceptance suite at the next substantive batch boundary, then continue production storage, identity and collaboration work as separately governed tracks.

### Latest completed batch (2026-07-15, derived OV-4 abstract responsibility view)

- Current target: extend DoDAF-derived review coverage without introducing real organization data, personnel information, operational tasking, or a new editable model.
- Completed: added read-only OV-4 abstract responsibility view. It derives conceptual responsibility roles from OV-1 nodes, activity ownership and OODA/scenario coverage from OV-5/OODA/scenario inputs, plus cross-role relations from OV-5 edges. It shows unmapped activities, unassigned roles and broken relationships as review diagnostics; navigation, inspector selections, Markdown and XML report output are integrated.
- Changed files: `design-studio/src/ov4Builder.js`, `design-studio/src/ov4View.js`, `design-studio/src/data.js`, `design-studio/src/ui.js`, `design-studio/src/main.js`, `design-studio/src/reportBuilder.js`, `scripts/check-ov4-responsibility.mjs`, `SOFTWARE_DESIGN.md`.
- Decision: OV-4 is a derived abstract research view only. It is not an organizational chart, authority assignment, real command relationship, or executable workflow.
- Verification: `node --check` passed for all modified modules; `node scripts/check-ov4-responsibility.mjs` passed role/relation derivation, coverage, unresolved diagnostics, inspector traceability and Markdown/XML output. All 48 `scripts/check-*.mjs` acceptance scripts passed. Browser automation remains unavailable because its runtime script is missing.
- Remaining work: further DoDAF views should remain derived and bounded; real-time collaboration remains deferred until persistent event-stream and merge policy decisions exist; heavy simulation platforms remain deferred.

### Latest completed batch (2026-07-15, review evidence references)

- Current target: prepare bounded collaborative editing through more auditable server-side review events, without claiming real-time editing or weakening Vault sensitivity controls.
- Completed: collaboration review events now retain up to 12 evidence fragment IDs. The server accepts only IDs that exist in the current project Vault and are not marked sensitive; duplicates, unknown IDs, and sensitive IDs are dropped. The review form exposes only public evidence choices, the review list displays retained IDs, and Markdown/XML reports preserve only currently public IDs.
- Changed files: `projectRepository.mjs`, `design-studio/src/collaborationController.js`, `design-studio/src/collaborationView.js`, `design-studio/src/reportBuilder.js`, `scripts/check-collaboration-review-evidence.mjs`, `SOFTWARE_DESIGN.md`.
- Decision: review evidence is reference-only and does not copy Vault content into the collaboration record, audit stream, model snapshot, prompt, or export. It is not a real-time editing protocol, automatic merge, or sensitive-citation approval path.
- Verification: `node --check` passed for all four modified modules and the new acceptance script; `node scripts/check-collaboration-review-evidence.mjs` passed public retention plus sensitive/unknown filtering, form rendering, and Markdown/XML output. Collaboration foundation/audit/watch, knowledge-sensitivity, and workflow regressions passed. All 47 `scripts/check-*.mjs` acceptance scripts passed. Static collaboration modules at `8792` returned `200`; browser automation remains unavailable because its runtime script is missing.
- Remaining work: add no real-time transport until persistent event-stream and conflict/merge policy decisions exist. Continue incremental DoDAF-derived views and collaboration preparation while keeping heavy simulation platforms deferred.

### Latest completed batch (2026-07-15, explicit manual simulation-return fingerprint)

- Current target: improve the review trust boundary of the existing manual abstract JSON result-return contract, without a vendor or heavy simulation-platform connection.
- Completed: the manual result form no longer silently reuses the expected fingerprint. The returner must explicitly paste the fingerprint from the exported abstract input JSON. A result without it remains compatible but diagnostics classify it as `review`; a mismatch remains `inconclusive`; deterministic local abstract runs now persist their own matching fingerprint and remain `completed` when current.
- Changed files: `design-studio/src/simulationAdapter.js`, `design-studio/src/simulationAdapterView.js`, `scripts/check-simulation-adapter.mjs`, `scripts/check-simulation-adapter-view.mjs`, `SOFTWARE_DESIGN.md`.
- Decision: return provenance verifies only that the reported result names the same abstract input package. It does not verify external execution, establish operational validity, retain a raw external payload, or select/connect a simulation vendor.
- Verification: `node --check` passed for both modules and both acceptance scripts; `node scripts/check-simulation-adapter.mjs` and `node scripts/check-simulation-adapter-view.mjs` passed; all 46 `scripts/check-*.mjs` acceptance scripts passed. Static adapter/view modules at `8792` returned `200`. Browser visual automation remains unavailable because its runtime script is missing.
- Remaining work: keep refining bounded collaboration editing preparation and derived DoDAF views; maintain the current abstract-only simulation contract until a separately governed platform decision exists.

### Latest completed batch (2026-07-15, auditable quantitative-review rationale)

- Current target: deepen the frozen-snapshot quantitative comparison without treating an automatic score as an operational decision or adding a heavy simulation dependency.
- Completed: each of the eight criteria now carries an optional, bounded manual-review rationale whenever a reviewer supplies a manual score. The rationale is visible in the model-comparison form, retained in the comparison result, and emitted in comparison Markdown/JSON plus the main Markdown/XML report.
- Changed files: `design-studio/src/schemeScoring.js`, `design-studio/src/modelComparisonSettingsStore.js`, `design-studio/src/modelSnapshotController.js`, `design-studio/src/modelSnapshotView.js`, `design-studio/src/modelComparisonBuilder.js`, `design-studio/src/reportBuilder.js`, `scripts/check-quantitative-comparison.mjs`, `SOFTWARE_DESIGN.md`.
- Decision: rationales are browser-local comparison-review metadata, normalized to a maximum of 600 plain-text characters per criterion. A rationale without an active manual score does not affect the score or output. The eight transparent criteria, normalized weights, sensitivity analysis, and expert-review boundary remain unchanged.
- Verification: `node --check` passed for all seven modified JavaScript modules and the acceptance script; `node scripts/check-quantitative-comparison.mjs` passed; all 46 `scripts/check-*.mjs` acceptance scripts passed. Static `modelSnapshotView.js` and `schemeScoring.js` at `8792` returned `200`. Browser visual automation remains unavailable because its runtime script is missing.
- Remaining work: use the existing abstract simulation contract to improve review usability only; then prepare bounded collaboration editing and additional DoDAF derived views. Heavy simulation platforms remain explicitly deferred.

### Latest completed batch (2026-07-15, simulation return provenance in reports)

- Current target: retain the abstract local simulation and manual JSON handoff/result-return path; do not connect or select a heavy simulation platform.
- Completed: simulation report summaries now preserve the normalized manual-return `inputMatch` enum. Markdown renders the bounded return fingerprint state, and XML emits it as the `result@inputMatch` attribute.
- Changed files: `design-studio/src/reportBuilder.js`, `scripts/check-simulation-adapter.mjs`, `SOFTWARE_DESIGN.md`.
- Decision: `matched`, `mismatch`, and `not-supplied` are audit/review provenance only. They do not make a result operationally valid, expose raw input packages, or add a vendor dependency.
- Verification: `node --check design-studio/src/reportBuilder.js`; `node --check scripts/check-simulation-adapter.mjs`; `node scripts/check-simulation-adapter.mjs`; all 46 `scripts/check-*.mjs` acceptance scripts passed. `GET /api/health` returned `200`.
- Remaining work: continue the documented later capabilities in small batches, beginning with bounded multi-option quantitative comparison refinements, simulation-adapter usability under the existing abstract contract, collaboration editing preparation, and later OV-2/OV-3 extensions. Browser visual automation remains unavailable because its runtime script is missing; do not retry the same connection until repaired.

### Completed work

- The prototype supports versioned project persistence, lineage, stale-state detection, audit, local fallback, AI/local concept drafting, editable OV-1 and OV-5, OODA, abstract-grid scenario/deployment, deterministic validation/red-team review, and structured exports/archives.
- Vault sensitivity defaults to exclusion across retrieval, AI evidence, red-team prompts, reports, archives, and external-vector requests. Explicit sensitive retrieval requires a server-verified lead session.
- Knowledge retrieval supports keyword, transparent local sparse vector, and hybrid RRF modes; the optional external vector adapter transmits only permitted IDs and is disabled by default.
- Quantitative frozen-snapshot comparison, weight-sensitivity analysis, OV-2/OV-3 derived views, and a manual-only generic simulation handoff/result contract are present.
- Local managed collaboration accounts use salted `scrypt` password hashes and HttpOnly signed sessions. Lead users manage accounts and bounded security events; collaboration review/decision roles are server-verified.
- `COLLABORATION_PROJECT_WRITE_AUTH=true` optionally requires an authenticated researcher, reviewer, or lead session for every project mutation. The default remains disabled for the local single-machine prototype.
- Authenticated project mutations now carry server-derived, bounded actor attribution into the project audit record. The request `source` is overridden by the verified account ID; audit entries retain public `actor.id`, `actor.label`, and permitted roles only. Default unauthenticated local writes preserve their prior `source`-only audit behavior.
- Concept-brief saves now use the same optional expected-project-revision check as other models. Stale writes return `409`; the client preserves its local draft, surfaces a version conflict, and offers explicit refresh/load-server recovery rather than reporting an offline failure.
- Added a per-fragment sensitive-citation policy. Only a server-verified lead may create or revoke a bounded `report-citation` approval for an existing marked Vault fragment, with mandatory reason, optional expiry, public lead attribution, project revision, and append-only project audit event. Revocation restores default exclusion.
- Reports now include a sensitive fragment only when its active explicit report-citation approval is passed into the report context. The policy is visible in Markdown/XML metadata. Retrieval, AI evidence selection, red-team prompts, and external-vector requests remain sensitivity-excluding regardless of citation approvals.
- Added lead-only controls in the knowledge inspector to create and revoke report-citation approvals. The control list is refreshed after collaboration session changes. The collaboration page now also displays project mutation audit entries and prioritizes server-verified actor attribution over a client-provided source label.
- Collaboration review creation and lead decisions now also retain the same bounded verified `actor` object in their project-audit entries, matching authenticated project-write and sensitive-citation events.
- Added a local project-audit JSON export from the collaboration page. It exports at most the existing bounded audit entries and only public audit fields: event, revision/lineage, public actor, source, timestamp, and summary. It intentionally omits arbitrary input fields, sessions, passwords, hashes, and secrets.
- Reconciled `SOFTWARE_DESIGN.md` with the actual prototype. The current-state sections now record the completed OV-1/OV-5/OODA editors, OV-2/OV-3, deployment bridge, validation, exports, sensitivity governance, and bounded collaboration; production storage, governed external platforms, durable identity and real-time editing remain explicit gaps.
- Added bounded in-memory login throttling to the local account adapter: five failed attempts in a 15-minute window trigger a 10-minute lock for that username. Failed attempts are intentionally not written to the identity store or bounded security-event log, so no failed password details or attacker-controlled data are persisted.
- Main report Markdown and XML now include up to 20 already-read public project-audit events, linking exported conclusions to model revision, action, verified actor/source, timestamp, and summary. The report contains no session or credential fields and remains separate from the full audit JSON evidence package.
- Added an explicit deployment-only `COLLABORATION_LOCAL_SECURE_COOKIE=true` option. It appends `Secure` to local-account session and logout cookies for HTTPS deployments; it remains false by default so the localhost trial URL continues to work.
- When optional authenticated project writes are enabled, a `403` project sync response now becomes an explicit local `auth-required` state rather than an offline error. Brief, model, and archive/snapshot history sync preserve local work and tell the user that a researcher, reviewer, or lead collaboration login is needed.
- Updated the collaboration-page policy text so it accurately distinguishes default local review-only accounts from deployments that opt into authenticated project writes.
- Project audit reads now use the same optional project-write authorization gate. When authenticated project writes are enabled, unauthenticated callers cannot read audit summaries that may contain project objectives or sensitive-citation decisions; default local trial reads remain unchanged.
- Added a self-hosted local deterministic abstract simulation option. It runs only against current abstract-percent-grid entities, areas, deployment diagnostics, and timeline, producing bounded grid, coverage, timeline, and diagnostic metrics in the existing simulation-run record. It makes no external request and contains no real coordinates, routes, targets, or weapon behavior.
- Design validation now translates a completed local abstract run's low boundary, coverage, timeline, or deployment-diagnostic metrics into explicit review issues. It does not alter the existing eight transparent scores or treat the local result as operational validation.
- The scenario simulation panel now displays bounded latest-run metrics directly, rather than only a result summary and metric count.
- Lead-visible local-account security events now have a bounded JSON export. It contains only event/action/time and public actor/subject identity fields, omitting arbitrary input, passwords, hashes, cookies, session data, and failed-login details.
- Added a reversible PostgreSQL/PostGIS migration preparation plan. It maps the current project file resources, history, collaboration/sensitive-citation events, audit, and separate identity data to logical target tables; defines import order, checksum/revision gates, rollback, and deployment decisions without installing or connecting to a database.
- Report knowledge provenance now lists the minimum public record for each active sensitive report-citation approval: approval ID, fragment ID, approval/time window, and lead identity. It does not emit the source content or approval reason, and revoked/expired approvals remain excluded.
- Added optional self-hosted SQLite persistence for local collaboration identities using Node 24's built-in `node:sqlite`. Set `COLLABORATION_LOCAL_IDENTITY_DB_PATH` to opt in; the default JSON file remains unchanged. Account records, salted hashes, sessions, lifecycle controls, and bounded security events use the same adapter behavior after reopen.
- Added optional self-hosted SQLite persistence for the complete versioned project repository. Set `PROJECT_DB_PATH` to opt in; current brief/models/history/collaboration/sensitive-citation approvals/audit records retain the same JSON normalization, revisions, lineage, conflict and audit semantics. The health endpoint reports only `file` or `sqlite`, never a storage path.
- Added an explicit file-to-SQLite project migration helper. It creates the parent directory, imports exactly one file repository payload into an empty SQLite state table, verifies a canonical SHA-256 checksum, and refuses to overwrite an existing SQLite repository. It never runs automatically.
- Added the equivalent explicit file-to-SQLite migration helper for local collaboration identity data. It imports only an explicitly selected identity JSON file into an empty SQLite identity state, verifies a canonical SHA-256 checksum, and never logs source accounts, hashes, or passwords. The migration is never automatic.
- Added explicit SQLite application-state backup and isolated restore helpers for the project repository and collaboration identity store. Backup packages are non-overwriting and checksum-verified; restore only targets a new database path and verifies the state again before completion. Identity backup packages retain salted hashes by necessity, use mode `0600`, and are documented as protected local artifacts rather than report/archive data.
- Heavy simulation platform integration is deliberately deferred. The existing manual abstract JSON handoff/result-return contract and deterministic local abstract-grid evaluation remain the current intranet trial path; no vendor platform or external simulation dependency is required.
- Concept-brief project synchronization now persists a bounded inspiration-incubation snapshot with the explicit brief save/generation baseline. The server accepts at most 16 normalized messages, only `user`/`assistant` roles and `ai`/`local` sources, and strips unsupported fields. This keeps the trace available after repository reopen and remote brief load without making every intermediate follow-up a separate downstream-invalidating project revision.
- The manual deployment bridge now uses protocol v2. Every `load` creates an `exchangeId` bound to the current scenario and project revision; a `change` must echo that ID plus a unique `changeId`. The workbench rejects stale, unidentified, duplicate, wrong-origin, or wrong-frame changes, and records accepted bridge origin/batch/change/time metadata on the abstract scenario for repository, GeoJSON, and report traceability.
- Markdown and XML reports now render the accepted deployment-return provenance already normalized on the scenario: bridge origin, `exchangeId`, `changeId`, and received time. They do not include raw postMessage payloads or any unaccepted return data.
- AI endpoint/model HTTP configuration writes are now disabled by default. `AI_SERVICE_CONFIG_WRITE=true` explicitly enables them, and only a server-authenticated lead may write; otherwise `/api/ai-config` returns `403` before its body is read or any file is changed. This preserves support for self-hosted OpenAI-compatible endpoints without permitting an arbitrary page to redirect a process-only API key.
- Model snapshots now include the bounded inspiration-incubation session as well as the scenario's accepted abstract deployment-return provenance. Restoring a snapshot replaces the current inspiration session before the restored brief is synchronized; project snapshot normalization independently bounds the session to 16 safe presentation/provenance messages so server-stored snapshots cannot grow unbounded or carry arbitrary fields.
- Snapshot comparison now exposes inspiration-message count/trace changes and whether an accepted abstract deployment return is present or changed. These are context-only review differences and never enter the eight automatic quantitative criteria, ranking, recommendation, or operational decision path.
- Added a read-only derived OV-6c event-trace view. It joins OODA nodes, abstract scenario timeline items, linked activity/entity counts, and the accepted deployment-return flag; it diagnoses unscheduled OODA nodes, timeline items with missing source nodes, and non-monotonic abstract time offsets. It offers selection traceability and Markdown/XML export, but makes no operational recommendation or simulation claim.
- Simulation runs now store a deterministic abstract-input fingerprint covering only scenario ID, abstract entities/areas/timeline, deployment diagnostics, and accepted deployment-return IDs. A completed result is `current` only when that fingerprint matches the present scenario. Modified or legacy-unfingerprinted runs are marked stale/unverified, report their state in the panel and exports, and local metrics are withheld from validation in favor of an explicit rerun/review issue.
- OV-6c diagnostics now enter design validation as low-priority transparent review issues: unmapped OODA nodes, timeline events with missing sources, and non-monotonic abstract `T+` offsets. They do not affect the eight scores, quantitative comparison, ranking, or recommendation.
- Server validation normalization now retains bounded `traceabilityDiagnostics` and `flowDiagnostics` (counts, scores and checks) alongside OODA and simulation diagnostics. The `stale` simulation-diagnostic state is also preserved. These fields survive file and SQLite project repository reopen instead of being silently dropped after sync.
- Persisted traceability diagnostics now render alongside OODA, OV-5 exchange/resource, and simulation diagnostics on the validation page. Markdown and XML reports carry the same bounded diagnostic counts, scores, and checks, so a reopened validation snapshot has consistent screen and export evidence.
- Core editable-model conflict handling now preserves a bounded browser-local recovery draft on a `409` revision conflict and before an explicit server-model load. Brief, OV-1, OV-5, OODA, scenario, and validation drafts can be restored only by an explicit local action; restoration never writes the server. OV-5 refresh now preserves local work and exposes a separate explicit server-load action, matching the other model controllers. Vault knowledge is intentionally excluded from this secondary recovery cache.
- OODA nodes now carry bounded abstract `equipmentRefs`. They derive from the linked OV-5 resource description, can be edited as a normalized reference list, persist through file/SQLite repository normalization, appear in the inspector and Markdown/XML reports, and create a low-priority validation review issue only when a source activity has a resource description but no linked OODA reference. They never carry equipment performance, coordinates, targets, or task instructions.
- OODA nodes now also carry bounded `knowledgeRefs`. They derive from the linked OV-5 activity references, can be edited independently, persist through file/SQLite normalization, appear in Markdown/XML reports, and drive the existing selected-node Vault evidence panel with its default sensitive-fragment exclusion. A missing OODA reference for a source activity that already has knowledge evidence becomes a low-priority review issue only; no Vault content is copied into the OODA model.
- Generated abstract scenario entities now carry bounded `sourceKnowledgeRefs` collected from their source OV-5 activity and linked OODA nodes. The references flow into selected-entity evidence lookup, abstract deployment data, GeoJSON, manual simulation packages, simulation freshness fingerprints, repository normalization and reports. They remain reference IDs only, default-sensitive-filtered in the evidence panel, and do not alter local abstract simulation metrics. A missing entity reference where its source activity has knowledge evidence creates only a low-priority validation review issue.
- Concept briefs now retain bounded `expectedEffects` and `evidenceRefs` alongside objective, approach, assumptions and risk. The editor supports both fields; local/AI draft generation uses only already-selected default-sensitive-filtered evidence IDs. File/SQLite project normalization, conflict/idempotence checks and snapshots preserve the fields without copying Vault content. Report and Obsidian archive construction independently filters the references again, emitting only standard Vault fragments or active lead-approved sensitive citations; unmatched free text and unapproved sensitive references are excluded.
- Brief `expectedEffects` now flow into the OV-1 assessment-node and OV-5 assessment-activity descriptions, plus both downstream AI generation queries/structured context. Brief `evidenceRefs` intentionally do not flow into OV-5; it remains limited to the current default-sensitive-filtered evidence selection before OODA and scenario propagation.
- The collaboration controller now performs a bounded 30-second revision check after initial collaboration hydrate. When a higher remote project revision appears, it shows a manual-review prompt with the remote revision/time but does not change local project revision, models, reviews, audits, or drafts. Only an explicit existing refresh/load path clears the prompt. This is a polling aid, not event streaming, real-time editing, automatic merge, or conflict resolution.
- Collaboration reviews now retain a server-derived, bounded review context: resource kind/revision, two structural counts, and existing revision lineage. It never retains model text, Vault fragment content, prompts, sessions, or keys; the same minimal context is shown in the review UI and Markdown/XML reports.
- Report exports now use one of three built-in, locally selected templates (research standard, review evidence, or exchange baseline). The whitelisted template metadata is carried by Markdown/RTF/XML/JSON payloads and frozen in each report archive; Word/PDF/PPTX generators display the frozen title/label without accepting custom template code or content.
- The report-page preview now passes the same sensitive-citation approvals and collaboration summary as the export action. An approved marked fragment is still shown only when an already-linked model reference selects it; the preview never bypasses the default evidence-minimization or citation policy.
- Archived-report rows now show their frozen template label; legacy archives display the compatible `研究通用` label. This is display-only and does not modify archived payloads or export behavior.
- Markdown reports now use the selected template's document title in the primary heading, which also carries through the existing RTF and printable-PDF fallbacks.
- Textual report exports now include the normalized built-in template ID in their filenames, preventing a same-version export under different templates from being confused.
- Report archives now carry a local SHA-256 integrity manifest based on stable JSON of the filtered payload. It excludes archive metadata while detecting report-content changes; it is a local integrity aid, not a signature, authority proof, or tamper-proof storage control.
- Report archive rows now label a stored SHA-256 manifest as `SHA-256 清单`; legacy rows explicitly remain `未校验`. This is availability metadata only and does not claim a current online verification result.
- A report archive with a stored manifest now offers an explicit local `校验` action. It recomputes the filtered snapshot digest and reports match or mismatch without writing the project, adding audit data, or inspecting Vault source text.
- Report archiving now exposes a busy state and disables both report-page and header save controls while the SHA-256 snapshot is being created, preventing duplicate-click ambiguity without changing version semantics.
- Report archive integrity now uses a shared browser/server module. The project repository recomputes and rejects a newly submitted archive when its supplied SHA-256 manifest does not match the filtered payload; legacy archives without a manifest remain readable.
- The existing OIDC JWKS verifier was audited but intentionally remains disconnected from the local-account runtime. A safe OIDC deployment still needs browser token acquisition/refresh and a reverse-proxy/session boundary; an environment-only switch would not provide that flow and could break the local trial.
- The dormant OIDC verifier now refreshes its JWKS once when an otherwise-valid token has an unknown `kid`, supporting controlled signing-key rotation while retaining its existing RS256, issuer, audience, expiry and role checks.
- Simulation fingerprint review confirmed that server-side rejection cannot be applied to every scenario save: historical runs must remain after normal scenario edits and become `stale`. A future server proof must bind to run creation/receipt rather than treating a later current-scenario mismatch as corruption.
- Manual simulation result returns now echo the selected run's input fingerprint. Matched fingerprints retain the declared result; a supplied mismatch is forced to `inconclusive` with explicit provenance, while omitted legacy/manual fingerprints remain `not-supplied` and subject to existing review. These fields persist through scenario normalization and remain abstract-grid-only.

### Changed files

- `projectWriteAuditActor.mjs` (new): request-object scoped trusted actor context, never serialized from browser input.
- `server.mjs`: registers the verified project-write actor after optional authorization.
- `projectRepository.mjs`: persists bounded actor attribution for brief/model/history mutation audit entries.
- Sensitive citation policy: `projectKnowledgeCitationPolicy.mjs` (new), `projectRepository.mjs`, `server.mjs`, `design-studio/src/reportBuilder.js`, `projectKnowledgeClient.js`, `knowledgeController.js`, `knowledgeView.js`, `ui.js`, `main.js`, and `design-studio/styles.css`.
- Project audit visibility: `design-studio/src/collaborationController.js`, `collaborationView.js`, `main.js`, and `design-studio/styles.css`.
- Collaboration audit attribution: `projectRepository.mjs`, `scripts/check-collaboration-foundation.mjs`.
- Bounded review context: `projectRepository.mjs`, `design-studio/src/collaborationView.js`, `design-studio/src/reportBuilder.js`, `scripts/check-collaboration-foundation.mjs`.
- Bounded report templates: `design-studio/src/reportTemplateStore.js` (new), `reportBuilder.js`, `reportVersionStore.js`, `ui.js`, `main.js`, `scripts/generate-report-docx.ps1`, `scripts/generate-report-pptx.ps1`, `scripts/fixtures/report-template-acceptance.json` (new), `scripts/check-report-templates.mjs` (new).
- Report-preview context parity: `design-studio/src/ui.js`, `scripts/check-report-templates.mjs`.
- Archived template-label presentation: `design-studio/src/ui.js`, `scripts/check-report-templates.mjs`.
- Template document-title rendering: `design-studio/src/reportBuilder.js`, `scripts/check-report-templates.mjs`.
- Template-aware export filenames: `design-studio/src/reportBuilder.js`, `scripts/check-report-templates.mjs`.
- Report archive integrity: `design-studio/src/reportIntegrity.js` (new), `reportVersionStore.js`, `main.js`, `scripts/check-report-templates.mjs`.
- Report integrity presentation: `design-studio/src/ui.js`, `scripts/check-report-templates.mjs`.
- Report integrity verification action: `design-studio/src/main.js`, `ui.js`, `scripts/check-report-templates.mjs`.
- Report archive busy state: `design-studio/src/main.js`, `ui.js`, `scripts/check-report-templates.mjs`.
- Server-verified report integrity: `projectReportIntegrity.mjs` (new), `projectRepository.mjs`, `design-studio/src/reportIntegrity.js`, `scripts/check-report-archive-integrity.mjs` (new).
- Design-record reconciliation: `SOFTWARE_DESIGN.md`.
- OIDC deployment-path audit: `projectOidcIdentity.mjs`, `server.mjs` (no retained runtime change).
- OIDC deployment boundary: `plans/OIDC_DEPLOYMENT.md` (new), `SOFTWARE_DESIGN.md`.
- OIDC key rotation: `projectOidcIdentity.mjs`, `scripts/check-oidc-identity.mjs` (new).
- Simulation return fingerprint provenance: `design-studio/src/simulationAdapter.js`, `simulationAdapterController.js`, `simulationAdapterView.js`, `projectModelNormalizers.mjs`, `scripts/check-simulation-adapter.mjs`.
- Audit evidence export: `design-studio/src/projectAuditArtifact.js` (new), `collaborationController.js`, `collaborationView.js`, `main.js`, `styles.css`, `scripts/check-project-audit-artifact.mjs`.
- Design record: `SOFTWARE_DESIGN.md`.
- Login-throttling: `projectLocalIdentity.mjs`, `design-studio/src/collaborationController.js`, `scripts/check-local-collaboration-identity.mjs`.
- Report audit provenance: `design-studio/src/reportBuilder.js`, `scripts/check-collaboration-audit-view.mjs`.
- Secure deployment cookies: `projectLocalIdentity.mjs`, `server.mjs`, `scripts/check-local-collaboration-identity.mjs`.
- Authenticated-project-write feedback: `design-studio/src/projectWriteFailureState.js` (new), `projectModelSyncController.js`, `projectBriefSyncController.js`, `projectHistorySyncController.js`, `scripts/check-project-write-auth-feedback.mjs`.
- Deployment authentication guidance: `design-studio/src/collaborationView.js`, `scripts/check-collaboration-audit-view.mjs`.
- Audit-read authorization: `server.mjs`, `scripts/check-project-write-access.mjs`.
- Local abstract simulation: `design-studio/src/simulationAdapter.js`, `simulationAdapterController.js`, `simulationAdapterView.js`, `scripts/check-simulation-adapter.mjs`.
- Local simulation validation bridge: `design-studio/src/validationStore.js`, `scripts/check-simulation-adapter.mjs`.
- Local simulation metric display: `design-studio/src/simulationAdapter.js`, `simulationAdapterView.js`, `design-studio/styles.css`, `scripts/check-simulation-adapter-view.mjs`.
- Collaboration security-event export: `design-studio/src/collaborationSecurityArtifact.js` (new), `collaborationController.js`, `collaborationView.js`, `main.js`, `styles.css`, `scripts/check-collaboration-security-artifact.mjs`.
- Storage migration preparation: `plans/PROJECT_STORAGE_MIGRATION.md` (new).
- Sensitive-citation report provenance: `projectKnowledgeCitationPolicy.mjs`, `design-studio/src/reportBuilder.js`, `scripts/check-sensitive-citation-policy.mjs`.
- SQLite identity persistence: `projectLocalIdentity.mjs`, `server.mjs`, `scripts/check-local-collaboration-identity.mjs`, `SOFTWARE_DESIGN.md`.
- SQLite project persistence: `projectRepository.mjs`, `server.mjs`, `scripts/check-sqlite-project-repository.mjs`, `SOFTWARE_DESIGN.md`.
- SQLite project migration: `scripts/migrate-file-project-to-sqlite.mjs` (new), `scripts/check-file-project-sqlite-migration.mjs` (new), `plans/PROJECT_STORAGE_MIGRATION.md`.
- SQLite identity migration: `scripts/migrate-file-identity-to-sqlite.mjs` (new), `scripts/check-file-identity-sqlite-migration.mjs` (new), `plans/PROJECT_STORAGE_MIGRATION.md`.
- SQLite backup/recovery: `scripts/sqlite-state-transfer.mjs` (new), `scripts/sqlite-state-backup.mjs` (new), `scripts/sqlite-state-restore.mjs` (new), `scripts/check-sqlite-state-backup-restore.mjs` (new), `plans/PROJECT_STORAGE_MIGRATION.md`, `SOFTWARE_DESIGN.md`.
- Deferred simulation decision: `SOFTWARE_DESIGN.md`, `project-context.md`.
- Brief-linked inspiration persistence: `projectRepository.mjs`, `design-studio/src/projectBriefClient.js`, `projectBriefSyncController.js`, `briefController.js`, `main.js`, `SOFTWARE_DESIGN.md`, `scripts/check-project-inspiration-persistence.mjs` (new).
- Deployment bridge v2: `design-studio/src/deploymentProtocol.js`, `deploymentController.js`, `scenarioStore.js`, `scenarioGeoJsonBuilder.js`, `deployment-tool-demo.js`, `projectModelNormalizers.mjs`, `main.js`, `SOFTWARE_DESIGN.md`, `scripts/check-deployment-bridge-protocol.mjs` (new).
- Deployment-return reporting: `design-studio/src/reportBuilder.js`, `SOFTWARE_DESIGN.md`, `project-context.md`, `scripts/check-deployment-bridge-protocol.mjs`.
- AI configuration write policy: `projectAiConfigWriteAccess.mjs` (new), `server.mjs`, `design-studio/src/aiConfigView.js`, `SOFTWARE_DESIGN.md`, `scripts/check-ai-config-write-access.mjs` (new).
- Context-complete snapshots: `design-studio/src/modelSnapshotStore.js`, `modelSnapshotRestore.js`, `modelSnapshotController.js`, `main.js`, `projectModelNormalizers.mjs`, `SOFTWARE_DESIGN.md`, `scripts/check-model-snapshot-inspiration.mjs` (new).
- Contextual comparison: `design-studio/src/modelCompare.js`, `scripts/check-deployment-bridge-protocol.mjs`, `SOFTWARE_DESIGN.md`, `project-context.md`.
- Derived OV-6c: `design-studio/src/ov6cBuilder.js` (new), `ov6cView.js` (new), `data.js`, `ui.js`, `main.js`, `reportBuilder.js`, `SOFTWARE_DESIGN.md`, `scripts/check-ov6c-event-trace.mjs` (new).
- Simulation freshness: `design-studio/src/simulationAdapter.js`, `simulationAdapterView.js`, `validationStore.js`, `reportBuilder.js`, `projectModelNormalizers.mjs`, `scripts/check-simulation-adapter.mjs`.
- OV-6c validation bridge: `design-studio/src/validationStore.js`, `SOFTWARE_DESIGN.md`, `scripts/check-ov6c-event-trace.mjs`, `project-context.md`.
- Durable validation diagnostics: `projectModelNormalizers.mjs`, `scripts/check-validation-diagnostic-persistence.mjs` (new), `SOFTWARE_DESIGN.md`, `project-context.md`.
- `design-studio/src/projectBriefClient.js`, `projectBriefSyncController.js`, `projectStorageView.js`: send expected revision and expose recoverable brief conflicts.
- `scripts/check-project-write-audit-attribution.mjs` (new): verifies source spoofing cannot replace a verified actor and disabled-mode behavior is unchanged.
- Validation diagnostic presentation: `design-studio/src/validationView.js`, `design-studio/src/reportBuilder.js`, `scripts/check-validation-diagnostic-persistence.mjs`, `SOFTWARE_DESIGN.md`.
- Conflict-draft recovery: `design-studio/src/projectConflictDraftStore.js` (new), `projectStorageView.js`, `projectBriefSyncController.js`, `projectModelSyncController.js`, `projectOv5SyncController.js`, `main.js`, `scripts/check-project-conflict-draft-recovery.mjs` (new), `SOFTWARE_DESIGN.md`.
- OODA equipment references: `design-studio/src/oodaStore.js`, `oodaController.js`, `oodaView.js`, `validationStore.js`, `reportBuilder.js`, `projectModelNormalizers.mjs`, `scripts/check-ooda-equipment-references.mjs` (new), `scripts/check-design-studio-workflow.mjs`, `SOFTWARE_DESIGN.md`.
- OODA knowledge references: `design-studio/src/oodaStore.js`, `oodaController.js`, `oodaView.js`, `validationStore.js`, `reportBuilder.js`, `projectModelNormalizers.mjs`, `scripts/check-ooda-knowledge-references.mjs` (new), `scripts/check-design-studio-workflow.mjs`, `SOFTWARE_DESIGN.md`.
- Scenario knowledge provenance: `design-studio/src/scenarioStore.js`, `scenarioGeoJsonBuilder.js`, `scenarioView.js`, `simulationAdapter.js`, `validationStore.js`, `reportBuilder.js`, `projectModelNormalizers.mjs`, `scripts/check-scenario-knowledge-provenance.mjs` (new), `SOFTWARE_DESIGN.md`.
- Complete concept brief: `design-studio/src/briefStore.js`, `briefController.js`, `ui.js`, `data.js`, `projectRepository.mjs`, `projectModelNormalizers.mjs`, `reportBuilder.js`, `obsidianArchiveBuilder.js`, `scripts/check-concept-brief-completeness.mjs` (new), `SOFTWARE_DESIGN.md`.
- Brief citation filtering: `design-studio/src/reportBuilder.js`, `ui.js`, `scripts/check-concept-brief-completeness.mjs`, `SOFTWARE_DESIGN.md`.
- Brief expected-effects downstream: `design-studio/src/ov1DraftStore.js`, `ov5DraftStore.js`, `ov1AiController.js`, `ov5AiController.js`, `scripts/check-brief-expected-effects-downstream.mjs` (new), `SOFTWARE_DESIGN.md`.
- Collaboration revision watch: `design-studio/src/collaborationController.js`, `collaborationView.js`, `main.js`, `scripts/check-collaboration-revision-watch.mjs` (new), `SOFTWARE_DESIGN.md`.
- `project-context.md`: refreshed to this single current handoff.

### Key decisions

- Actor attribution is enabled only after the opt-in server write gate validates a session. It is not a browser-supplied identity field and does not expose session data, passwords, hashes, or secrets.
- The repository stores attribution only in bounded audit entries; it does not alter models, Vault data, reports, snapshots, or archive payloads.
- This remains a localhost intranet-trial adapter, not a production IAM, durable audit, or real-time collaboration solution.
- Brief conflict handling is a bounded optimistic-concurrency safeguard. It does not merge concurrent text changes automatically or replace the future event-stream/merge policy.
- Citation approval applies only to report construction and only after an explicit lead decision. It neither lowers the lead-only local review requirement nor propagates marked content to an AI provider, red-team prompt, retrieval result by default, or external vector adapter.
- The audit JSON is an intranet-trial evidence package, not a replacement for durable retention, protected transport, signed export, or production audit governance.
- Login throttling is process-memory only and resets on service restart. It is a trial safeguard, not a substitute for durable rate limiting, IP-aware abuse controls, account recovery, or protected transport.
- The secure-cookie switch must be enabled only after HTTPS is enforced by the deployment. It is intentionally disabled for `http://127.0.0.1:8792`.
- Authentication-required feedback is a client-side recovery state only; the authorization boundary remains enforced independently by the server switch.
- The collaboration policy text deliberately describes both modes because the server switch is deployment-time configuration and remains disabled in the local prototype.
- Audit reads follow the same deployment switch as project writes to avoid exposing audit summaries in an authenticated collaboration deployment.
- Local abstract simulation is a deterministic design-review aid, not a substitute for a validated operational or heavy simulation platform; every result remains subject to design validation and human review.
- Low local metrics create review questions only. They are intentionally not folded into automatic readiness scores, rankings, targeting, routing, or deployment decisions.
- Simulation diagnostics expose at most six bounded public metrics from the latest run; the UI never executes an external adapter or displays configuration secrets.
- Security-event export is available only in the lead-only security-event panel. It is a local trial evidence package, not a durable retention, signed-export, or central audit system.
- The migration plan is intentionally non-executable until the deployment owner selects storage services, transport, backup/retention, and administrator responsibilities.
- Approved citation provenance uses only public identity and approval metadata; sensitive document content remains governed by the existing explicit citation filter.
- SQLite is a self-hosted intranet identity persistence option, not a replacement for PostgreSQL/PostGIS project storage, backup/retention, recovery procedure, or multi-instance session governance.
- SQLite project persistence is a self-hosted durable local step, not a replacement for PostgreSQL/PostGIS, object/vector/graph stores, backup/retention policy, or multi-instance coordination.
- File-to-SQLite migration is deliberately opt-in and non-overwriting. Operators must back up the source, review the checksum, and set the deployment path themselves; no project data is migrated on service start.
- Identity file-to-SQLite migration follows the same opt-in, non-overwriting rule. It retains existing salted hashes and session-version records without displaying their contents; operators must separately back up the identity source and set the deployment path after verification.
- SQLite backup is an application-state export instead of copying a live database file. It is non-overwriting and checksum-bound; restores must go to a new isolated database, after which the normal repository adapter verifies project reads or identity login. Identity backup artifacts remain protected local data because they include existing salted hashes.
- Heavy simulation remains an optional future adapter only. It must not be selected or connected until intranet deployment conditions, governed evaluation metrics, protected transport, retention, and administrator responsibility are defined.
- The inspiration trace is coupled to the user-confirmed brief baseline, not each dialog turn. It carries no Vault retrieval content automatically, and server normalization keeps only bounded presentation/provenance fields needed for research traceability.
- Deployment bridge v2 remains a manual abstract-grid integration, not a simulation or command interface. `exchangeId` and `changeId` are freshness/audit correlators only; the bridge never accepts real coordinates, routes, target data, or operational instructions.
- Report provenance is derived solely from the accepted and normalized scenario review record. It intentionally omits raw transport payloads, rejected return attempts, and any data outside the abstract-grid contract.
- The AI key remains process-environment-only. The public config response exposes only endpoint/model state and whether endpoint writes are disabled or lead-controlled; it never exposes a key. Self-hosted endpoint choice remains a deployment-owner decision.
- Snapshot restoration carries the accepted research context, but does not create a separate dialog-event stream or merge concurrent session edits. Existing explicit restore confirmation and optimistic project revision checks remain the conflict boundary.
- Inspiration and deployment-return comparison entries are descriptive review evidence only. They do not imply quality, readiness, priority, or suitability, and the existing manual review requirement for scheme comparison is unchanged.
- OV-6c is a derived research chronology, not a tasking, routing, targeting, or operational execution plan. Its times are existing abstract `T+` offsets only; unmapped or out-of-order content stays visible as a review issue.
- Simulation fingerprints are research-data freshness checks, not cryptographic attestation or operational validation. They intentionally exclude real-world geospatial or operational fields, and a stale result must be rerun/reviewed rather than merged into current scores.
- OV-6c validation findings are descriptive time/source consistency prompts only. They deliberately use `low` severity so source-model chronology review cannot silently change automatic readiness or scheme score outcomes.
- Validation diagnostic persistence preserves only bounded derived counts, scores and checks; it does not add raw Vault content, prompts, identities, sessions or secrets to the validation model.
- Report audit provenance is bounded to the audit entries loaded into the collaboration state; the independent audit JSON remains the fuller local evidence package.
- Review context is a server-derived metadata summary, not a model snapshot or an event stream. It deliberately excludes Vault text, sensitive references, prompts, sessions, and keys; remote revision polling remains manual-refresh-only.
- Report templates are fixed built-ins, not uploaded document files, HTML, macros, or executable styles. A selection changes only public template metadata and labels; all existing report evidence filtering and sensitive-citation approval rules remain authoritative.

### Remaining tasks

- Move project, identity, and audit persistence to governed durable storage (PostgreSQL/PostGIS plus object/vector/graph stores), including retention/export controls and protected transport.
- Add a durable, exportable retention policy for sensitive-citation and project audit records before expanding beyond the intranet trial.
- Select governed external vector/graph and simulation/deployment platforms only when deployment governance requires them; do not select a heavy simulation vendor for the current intranet trial.
- Keep the heavy simulation interface stable while deferring platform selection; continue only with local abstract assessment and manual review.
- Define event-stream, conflict/merge, RBAC, and retention semantics before real-time co-editing.

### Next step

- Run an intranet collaboration rehearsal with a researcher review and lead decision, and verify the displayed/exported review context has only resource kind/revision, counts, and lineage. Separately exercise the brief-linked inspiration trace and SQLite backup/restore path; use the local abstract simulation path and manual handoff only, without selecting a heavy platform.

### Verification

- `node --check projectWriteAuditActor.mjs`, `projectRepository.mjs`, `server.mjs`, and `scripts/check-project-write-audit-attribution.mjs` passed.
- `node scripts/check-project-write-audit-attribution.mjs` passed: verified actor attribution, request-source override, bounded roles, and unchanged default local behavior.
- `node scripts/check-project-write-access.mjs` and `node scripts/check-project-repository.mjs` passed.
- `node scripts/check-project-repository.mjs` covers stale brief writes with `409`; `node scripts/check-design-studio-workflow.mjs` passed after the change. Live `8792` serves the brief sync and project-storage modules with `200`.
- `node scripts/check-sensitive-citation-policy.mjs` passed: lead-only approval, bounded actor roles, approved report inclusion, revocation, and audit attribution. `node scripts/check-sensitive-citation-view.mjs` passed: controls render only for a lead. Existing knowledge-sensitivity, collaboration, project-write, repository, and workflow regressions passed.
- `node scripts/check-collaboration-foundation.mjs` now directly asserts verified `local-researcher` and `local-lead` actor attribution in project audit records. Repository and workflow regressions passed; live `8792` was restarted and health returned `200`.
- `node scripts/check-project-audit-artifact.mjs` passed bounded public-field export; the collaboration audit-view acceptance verifies the export control. Collaboration foundation and workflow regressions passed. Live static checks for `projectAuditArtifact.js`, `collaborationView.js`, and `main.js` returned `200`.
- `node scripts/check-design-studio-workflow.mjs`, `node scripts/check-project-repository.mjs`, and `node scripts/check-knowledge-sensitivity.mjs` passed after the design-record reconciliation.
- `node scripts/check-local-collaboration-identity.mjs` passed the five-failure throttle, `429` rejection, lock expiry, successful re-login, and the absence of failed-password/event persistence. Project-write and collaboration regressions passed. Live `8792` was restarted; health and `collaborationController.js` returned `200`.
- `node scripts/check-collaboration-audit-view.mjs` now verifies public audit inclusion in Markdown/XML. Collaboration, workflow, knowledge-sensitivity, quantitative-comparison, project-audit artifact, and repository regressions passed; static `reportBuilder.js` and collaboration-view checks returned `200`.
- `node scripts/check-local-collaboration-identity.mjs` verifies the HTTPS secure-cookie option while retaining default cookie behavior. Project-write and collaboration regressions passed. Live `8792` was restarted; health returned `200` and reports `collaborationIdentity.secureCookies: false` for localhost.
- `node scripts/check-project-write-auth-feedback.mjs` passed explicit `403` login-required recovery. Brief/model conflict and project-write access regressions plus full workflow acceptance passed. Static checks for the failure-state and affected sync modules returned `200`.
- Collaboration audit-view acceptance now verifies deployment authentication guidance. Collaboration foundation and workflow regressions passed; the live collaboration view returned `200`.
- Project-write access, repository, collaboration-audit view, and workflow regressions passed after audit-read gating. Live `8792` was restarted; health and the default-mode project audit endpoint return `200`.
- `node scripts/check-simulation-adapter.mjs` passed local deterministic run provenance, four bounded metrics, and forbidden-field exclusion. Workflow, repository, sensitivity, and quantitative comparison regressions passed. Live static checks for all three simulation modules returned `200`.
- Simulation acceptance now verifies that low local coverage and deployment-diagnostic metrics produce transparent review issues. Workflow, repository, sensitivity, and quantitative regressions passed; live `validationStore.js` and simulation adapter checks returned `200`.
- `node scripts/check-simulation-adapter-view.mjs` passed direct rendering of local metrics. Simulation adapter, workflow, repository, and knowledge-sensitivity regressions passed; simulation adapter/view static checks returned `200`.
- `node scripts/check-collaboration-security-artifact.mjs` passed bounded public event export and unsafe-field exclusion. Local identity, collaboration audit-view/foundation, and workflow regressions passed; security artifact, collaboration view, and main static checks returned `200`.
- Migration-plan consistency check confirmed target data mapping, migration order, acceptance gates, rollback, and pending decisions. Repository, project-write, and knowledge-sensitivity regressions passed without modifying runtime data.
- Sensitive-citation acceptance now verifies Markdown/XML approval provenance as well as approval/revocation behavior. Knowledge sensitivity, workflow, repository, quantitative-comparison, and collaboration regressions passed; report builder and citation policy static modules returned `200`.
- `node scripts/check-local-collaboration-identity.mjs` now verifies SQLite identity persistence across adapter recreation and explicit connection cleanup. Project-write, collaboration, and repository regressions passed. Live `8792` was restarted; health reports default identity storage `file`.
- `node scripts/check-sqlite-project-repository.mjs` verifies a brief revision persists across SQLite repository recreation. File repository, write authorization, collaboration, and workflow regressions passed. Live `8792` was restarted; health reports default project repository mode `file`.
- `node scripts/check-file-project-sqlite-migration.mjs` verifies SQLite import, checksum path, parent-directory creation, and refusal to overwrite existing state. SQLite/file repository, identity, project-write, and workflow regressions passed.
- `node --check scripts/migrate-file-identity-to-sqlite.mjs` and `scripts/check-file-identity-sqlite-migration.mjs` passed. `node scripts/check-file-identity-sqlite-migration.mjs` passed import, parent-directory creation, source-account login after import, and refusal to overwrite existing identity state. `node scripts/check-local-collaboration-identity.mjs`, `node scripts/check-sqlite-project-repository.mjs`, and `node scripts/check-file-project-sqlite-migration.mjs` also passed.
- `node --check scripts/sqlite-state-transfer.mjs`, `sqlite-state-backup.mjs`, `sqlite-state-restore.mjs`, and `check-sqlite-state-backup-restore.mjs` passed. `node scripts/check-sqlite-state-backup-restore.mjs` passed project and identity backup/restore round trips, restored repository reads and identity login, plus backup/output and restore/target non-overwrite refusal. Existing SQLite project/identity migration and persistence regressions also passed.
- `node --check projectRepository.mjs`, `server.mjs`, affected brief-sync modules, `main.js`, and `scripts/check-project-inspiration-persistence.mjs` passed. `node scripts/check-project-inspiration-persistence.mjs` passed bounded normalization, idempotent brief save, revision-controlled update, and repository reload. Repository, brief-conflict, and full design-studio workflow regressions passed. Live `8792` was restarted to load the repository change.
- `node --check` passed for the deployment protocol, controller, scenario/GeoJSON modules, bundled demo, scenario normalizer, and `scripts/check-deployment-bridge-protocol.mjs`. The deployment-bridge acceptance passed v2 exchange identity, stale/unidentified rejection, bounded positions, and persisted review provenance; deployment planner, simulation adapter, and project repository regressions passed.
- `node --check design-studio/src/reportBuilder.js` and the deployment-bridge acceptance passed after report provenance addition. The check now verifies accepted `exchangeId` appears in Markdown and XML; simulation adapter, full workflow, and repository regressions passed.
- `node --check projectAiConfigWriteAccess.mjs`, `server.mjs`, AI config view, and its acceptance script passed. The acceptance verifies default deny and lead-only opt-in. Identity, project-write and workflow regressions passed. Live `8792` was restarted; health reports `aiConfigurationWrite.enabled: false`, and an empty unauthenticated `PUT /api/ai-config` returned `403` without a configuration write.
- `node --check` passed for the snapshot store/restore/controller, main client, project model normalizer, and `scripts/check-model-snapshot-inspiration.mjs`. The new acceptance passed local snapshot save/restore and server-side 16-message field-bounded normalization. Full workflow plus file and SQLite project repository regressions passed.
- `node --check design-studio/src/modelCompare.js` and deployment-bridge acceptance passed after context comparison addition. The acceptance verifies both accepted deployment-return and inspiration trace additions appear as snapshot differences. Quantitative comparison, snapshot inspiration, and workflow regressions passed with unchanged scoring behavior.
- `node --check` passed for OV-6c builder/view, navigation/UI/main/report modules, and its acceptance. `node scripts/check-ov6c-event-trace.mjs` passed event derivation, unscheduled/orphan/order diagnostics, selection traceability, and Markdown/XML output. OV-2, OV-3, workflow, and simulation adapter regressions passed.
- `node --check` passed for simulation adapter/view, validation, report builder, project normalizer, and simulation acceptance. The acceptance now verifies current local runs retain their status, modified abstract inputs become stale, and validation emits an explicit stale-result issue instead of reusing old metrics. Simulation-view, workflow, repository, and OV-6c regressions passed.
- `node --check design-studio/src/validationStore.js` and OV-6c acceptance passed after the validation bridge. The acceptance verifies all three OV-6c diagnostic types are low-priority validation issues; workflow, simulation and quantitative-comparison regressions passed with the same automatic totals.
- `node --check projectModelNormalizers.mjs` and `node scripts/check-validation-diagnostic-persistence.mjs` passed. The new acceptance verifies traceability/flow diagnostics survive service normalization and repository reopen. File/SQLite repository, simulation, and workflow regressions passed.
- `node --check design-studio/src/validationView.js`, `design-studio/src/reportBuilder.js`, and `scripts/check-validation-diagnostic-persistence.mjs` passed. The diagnostic acceptance now verifies normalized traceability diagnostics survive reload and appear in the validation view plus Markdown/XML report outputs.
- All 36 `scripts/check-*.mjs` acceptance scripts passed after the validation diagnostic presentation batch. Live `8792` health and static `validationView.js`/`reportBuilder.js` checks returned `200`; browser visual automation remains unavailable because its runtime script is missing.
- `node --check` passed for the conflict-draft store, storage view, brief/model/OV-5 sync controllers, main client, and the new acceptance. `node scripts/check-project-conflict-draft-recovery.mjs` passed 409 preservation, explicit local restoration, no-write recovery, and OV-5 non-overwriting refresh; existing brief/model conflict and authenticated-write feedback acceptances also passed.
- All 37 `scripts/check-*.mjs` acceptance scripts passed after the conflict-draft recovery batch. Live `8792` health returned `true`, and static checks for `projectConflictDraftStore.js` and `projectOv5SyncController.js` returned `200`; no service restart was required.
- `node --check` passed for OODA store/controller/view, validation, report builder, server model normalizer, and `scripts/check-ooda-equipment-references.mjs`. The new acceptance passed derivation, edit normalization, repository reopen, validation, Markdown, and XML output; project repository, validation persistence, and full workflow regressions passed.
- Live `8792` was restarted after the OODA server-normalizer change and health returned `true`. All 38 `scripts/check-*.mjs` acceptance scripts passed; static `oodaView.js` and `reportBuilder.js` checks returned `200`.
- `node --check` passed for the OODA store/controller/view, validation, report builder, server normalizer, and `scripts/check-ooda-knowledge-references.mjs`. The new acceptance passed derivation, edit normalization, selected-node evidence references, validation, Markdown, and XML output; equipment-reference, repository, validation-persistence, and full-workflow regressions passed.
- Live `8792` was restarted after the OODA knowledge-reference normalizer change and health returned `true`. All 39 `scripts/check-*.mjs` acceptance scripts passed; static `oodaView.js`, `knowledgeView.js`, and `reportBuilder.js` checks returned `200`.
- `node --check` passed for scenario generation/GeoJSON/view, simulation adapter, validation, reports, the server normalizer, and `scripts/check-scenario-knowledge-provenance.mjs`. The new acceptance passed generation, selected-entity evidence, deployment handoff, GeoJSON, simulation freshness, repository reload, validation, and report output; workflow, simulation, deployment bridge, and repository regressions passed.
- Live `8792` was restarted after the scenario knowledge-provenance normalizer change and health returned `true`. All 40 `scripts/check-*.mjs` acceptance scripts passed; static `scenarioStore.js`, `scenarioView.js`, and `simulationAdapter.js` checks returned `200`.
- `node --check` passed for brief store/controller, UI, reports, Obsidian archive, project repository/normalizer, and `scripts/check-concept-brief-completeness.mjs`. The new acceptance passed local/AI drafts, idempotence and changed revisions, repository reload, snapshot normalization, Markdown/XML reports and archive output; repository, inspiration, snapshot, workflow, conflict-resolution and recovery regressions passed.
- Brief completeness acceptance now also verifies that report payloads exclude unmatched/free-text and unapproved sensitive references, while retaining an active lead-approved sensitive citation. Sensitive-citation, knowledge-sensitivity, workflow, collaboration-audit and repository regressions passed.
- All 41 `scripts/check-*.mjs` acceptance scripts passed after the brief citation-filtering batch. Live static `reportBuilder.js` and `ui.js` checks returned `200`; no server restart was required.
- `node --check` passed for OV-1/OV-5 draft stores, AI controllers and `scripts/check-brief-expected-effects-downstream.mjs`. The new acceptance verifies expected-effects propagation and that brief evidence references do not enter OV-5 activity refs; workflow, sensitivity/citation, repository, OV-2 and OV-3 regressions passed.
- All 42 `scripts/check-*.mjs` acceptance scripts passed after the brief expected-effects downstream batch. Live static `ov1DraftStore.js`, `ov5DraftStore.js`, and `ov1AiController.js` checks returned `200`; no server restart was required.
- `node --check` passed for the collaboration controller/view, main client, and `scripts/check-collaboration-revision-watch.mjs`. The new acceptance verifies remote-revision detection, deduplication, manual-review prompt, no automatic local overwrite, and explicit-refresh clearing; collaboration foundation/audit, project-write, conflict recovery, workflow and repository regressions passed.
- All 43 `scripts/check-*.mjs` acceptance scripts passed after the collaboration revision-watch batch. Live static `collaborationController.js`, `collaborationView.js`, and `main.js` checks returned `200`; no server restart was required.
- `node --check` passed for `projectRepository.mjs`, `collaborationView.js`, `reportBuilder.js`, and the collaboration-foundation acceptance. `node scripts/check-collaboration-foundation.mjs` passed server-derived review-context persistence and Markdown/XML output; collaboration audit, repository, write-attribution, SQLite repository, and workflow regressions passed. All 43 `scripts/check-*.mjs` acceptance scripts passed before the service restart.
- `node --check` passed for report template/UI/version modules and both Office generator scripts. `node scripts/check-report-templates.mjs` passed whitelist fallback, local selection, Markdown/XML/JSON metadata and archive freezing; workflow, repository and knowledge-sensitivity regressions passed. All 44 `scripts/check-*.mjs` acceptance scripts passed. Direct interactive-session Word/PPTX generation produced non-empty files with the selected template title/label in their Office XML; the current background `8792` document endpoints return `503` because their Office process lacks an interactive desktop session.
- Report-template acceptance now also renders the report page and verifies an approved, model-linked sensitive citation appears only through the shared report context. Sensitive-citation policy and collaboration-audit regressions passed.
- Report-template acceptance now also verifies that an archived frozen template and a different current template render distinctly in the report page. Workflow and repository regressions passed.
- Report-template acceptance verifies the selected template document title in Markdown; workflow and knowledge-sensitivity regressions passed.
- Report-template acceptance verifies the template suffix in the Markdown export filename; workflow regression passed.
- Report-template acceptance now verifies SHA-256 archive-manifest preservation, archive-metadata independence, and changed-payload detection. Project repository and knowledge-sensitivity regressions passed; static `reportIntegrity.js` returned `200`.
- Report-template acceptance verifies the archive-list SHA-256 manifest label; workflow and project-repository regressions passed.
- Report-template acceptance verifies that an archive with a manifest exposes the explicit local verification action; workflow and project-repository regressions passed.
- Report-template acceptance verifies disabled `正在归档` rendering during an archive operation; workflow regression passed.
- `node scripts/check-report-archive-integrity.mjs` passed valid-manifest persistence and mismatched-payload rejection; file/SQLite repository regressions passed. Live `8792` was restarted after the repository change and health returned `true`.
- `node --check server.mjs`, local-collaboration identity and project-write access acceptances passed after the OIDC-path audit; default local identity behavior remains unchanged.
- `node scripts/check-oidc-identity.mjs` passed RS256 validation, role extraction, unknown-key JWKS refresh and expiry rejection; local collaboration and project-write regressions passed.
- `node scripts/check-simulation-adapter.mjs` now passes matched return provenance, mismatch downgrade and normalization persistence; simulation-view and validation-diagnostic regressions passed. Live `8792` was restarted after the normalizer change and health returned `true`.
- Live `8792` was restarted after the complete-brief repository/normalizer change and health returned `true`. All 41 `scripts/check-*.mjs` acceptance scripts passed; static `briefStore.js`, `briefController.js`, and `ui.js` checks returned `200`.
- Live `8792` was restarted after the sensitive-citation API change. An unauthenticated citation-approval read returns `403`; `knowledgeView.js`, `knowledgeController.js`, `projectKnowledgeClient.js`, and `collaborationView.js` all return `200`.
- Live `8792` was restarted after the server change. `GET /api/health` returned `200`; the replacement remains in `mock-fallback` because no process-only AI key was accessed or persisted.
- Live `GET /api/health` at `8792` returned `200` after this batch. It remains `mock-fallback`, project and identity storage remain the default `file` mode, and no AI key was read or written.

### Blockers

- Real AI generation requires launching `8792` through the existing secure environment that supplies its process-only key. Do not write or inspect that key.
- Browser visual automation is unavailable because the bundled browser-control runtime script is missing. Do not retry that connection until repaired; static HTTP checks are the available verification path.

### 2026-07-24 Concept-map title and center picker

#### Goal

- Make the initial concept-map title derive from the current concept brief through AI generation, and allow the map-frame center to be selected by clicking as well as entered precisely.

#### Completed work

- `design-studio/src/conceptMapController.js`, `server/openaiClient.mjs`: initial-draft generation now requests one bounded research-level Chinese title from the AI using only `researchIntent`, objective, approach, expected effects, assumptions, and risk. The request has `evidence: []`; it does not query or expose knowledge-base content. The service enforces a title-only `summary` of 2 to 40 characters with empty auxiliary arrays. A bounded brief-derived title is used only when no valid AI title is available. The controller also owns an in-workbench longitude/latitude picker that converts clicks on an abstract graticule to form values.
- `design-studio/src/conceptMapView.js`, `design-studio/styles.css`, `design-studio/src/app/createInitialState.js`: removed the manually editable title field; rendered the generated-title state, a responsive point-selection canvas, numeric coordinate inputs for precision adjustment, and a generating state.
- `design-studio/src/conceptMapStore.js`: records the title source/time for generated drafts and uses an imported JSON document's `view.camera` as the workbench center when valid.
- `scripts/check-concept-map-integration.mjs`: verifies the AI-title/no-evidence path, picker rendering and coordinate mapping, no manual title field, and imported camera-center recovery.

#### Decisions

- The picker is only a local abstract longitude/latitude selector. It neither sends messages to, injects state into, nor otherwise controls `combat-map-web`.
- `combat-map-web` was not modified. Its existing JSON import/export remains the only integration point; the independent editor still receives no knowledge-base interface or retrieval data.
- Coordinates remain excluded from the confirmed OV downstream context. Imported camera information is retained only as draft presentation metadata.

#### Remaining task

- Perform an authenticated manual browser pass when the local browser-control runtime is repaired; select a point, generate a title with the configured AI, download/import JSON through the independent editor, and confirm the returned camera center.

#### Verification

- `node --check design-studio/src/conceptMapController.js`, `conceptMapStore.js`, `conceptMapView.js`, `app/createInitialState.js`, and `server/openaiClient.mjs` passed.
- `node scripts/check-concept-map-integration.mjs`, `node scripts/check-workflow-test-mode.mjs`, and `node scripts/check-design-studio-workflow.mjs` passed.
- All `scripts/check-*.mjs` acceptance scripts passed after the title-only API constraint was added.
- The `8794` server was restarted with its original `PORT=8794` environment. Its health endpoint returned `200` afterward.
- A real no-write title request returned `联合防护概念初图` through `result.coreIdea` with `ConceptPlan` and zero evidence references. The controller accepts that bounded title and uses a brief-derived fallback only when the returned value is invalid.

### 2026-07-24 Automatic title and center-picker entry

#### Goal

- Generate a missing initial concept-map title immediately on entering the concept-map stage, without requiring the user to submit the initial-draft form.
- Make the existing workbench-local center-selection canvas easy to reach from the concept-map page.

#### Completed work

- `design-studio/src/conceptMapController.js`: page binding now queues title generation whenever the active project's concept-map title is absent. It persists the bounded AI or brief fallback title immediately and the initial-draft submit consumes that title rather than requesting it again.
- `design-studio/src/conceptMapView.js`: added the `选择图幅中心` toolbar command. It opens the initial-draft panel containing the local graticule canvas; clicks continue to populate the longitude/latitude fields for precision adjustment.
- `design-studio/src/app/createInitialState.js`: added title-request and title-generating state to avoid duplicate requests during rerenders.
- `scripts/check-concept-map-integration.mjs`: now asserts the automatic-title controller path and visible center-picker command.

#### Decision

- The center cannot be selected from inside the independent editor iframe without violating the independent-tool boundary. The toolbar opens the existing local canvas in the concept-map workspace; it has no iframe messaging, editor state access, or `combat-map-web` change.

#### Verification

- `node --check` passed for the changed client modules.
- `node scripts/check-concept-map-integration.mjs` and `node scripts/check-workflow-test-mode.mjs` passed.
- All 70 `scripts/check-*.mjs` acceptance scripts passed after the automatic-title and center-picker-entry change.
- The live `8794` static `conceptMapController.js` route returned `200`; no restart was needed because the change is client-side only.

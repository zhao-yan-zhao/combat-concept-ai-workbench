# Project Storage Migration Plan

## Purpose

Prepare a reversible migration from the current versioned file repository to a governed PostgreSQL/PostGIS deployment. This plan does not select, install, connect to, or modify any external service.

## Current Source Of Truth

`projectRepository.mjs` persists one project record with:

- Project revision and update time.
- Concept brief and per-resource revisions for OV-1, OV-5, OODA, scenario, validation, and knowledge.
- Resource lineage and stale-state inputs.
- Bounded immutable report archives and model snapshots.
- Append-only collaboration reviews, decisions, sensitive-citation approvals, and project audit events.

The current file is retained as the rollback source until migration verification completes.

## Target Logical Model

| Current data | Target table | Notes |
|---|---|---|
| Project revision/root metadata | `projects` | One row per project; optimistic revision is authoritative. |
| Current model resource | `project_resources` | `(project_id, resource_key)` unique; JSONB model, resource revision, lineage and stale inputs. |
| Report archive/model snapshot | `project_history_items` | Immutable payload JSONB; resource key and item ID are unique within a project. |
| Collaboration review/decision | `collaboration_events` | Append-only event rows with reviewed revision and public actor identity. |
| Sensitive citation approval/revocation | `sensitive_citation_events` | Append-only approval/revocation records; no Vault content. |
| Project audit event | `project_audit_events` | Append-only public event, revision, lineage, source and public actor. |
| Identity account/session/security event | Separate identity schema | Kept outside research project data; password hash/salt never copied into project tables. |
| Abstract deployment geometry | `project_resources.model` first | Promote only governed abstract geometry to PostGIS after coordinate and retention policy approval. |

No raw Vault content, API key, session token, password, password hash, or external adapter secret belongs in audit, report, history, or export tables.

## Migration Order

1. Provision an empty governed database and a separate object store only after deployment approval.
2. Create schema migrations with unique keys, foreign keys, JSONB validation constraints, and append-only audit permissions.
3. Export each current project file into a read-only migration package with a checksum and source revision.
4. Import projects and current resources first, then immutable history, collaboration/sensitivity events, and audit events.
5. Recompute resource lineage/stale state from imported revisions; do not trust a copied stale flag alone.
6. Compare source and target counts, revision values, resource revisions, history IDs, event IDs, and payload checksums.
7. Run repository acceptance scenarios against the new adapter while file writes remain disabled or shadowed.
8. Enable dual-read comparison, then an explicitly scheduled cutover. Keep the file repository read-only until retention and backup checks pass.

For the current self-hosted SQLite bridge, use the explicit one-shot helper only after a file backup:

```powershell
node scripts/migrate-file-project-to-sqlite.mjs --source <projects.json> --database <projects.sqlite>
```

The helper refuses to overwrite an SQLite repository that already contains state and verifies a canonical SHA-256 checksum after import. Start the service with `PROJECT_DB_PATH=<projects.sqlite>` only after this verification.

Local collaboration identity data has a separate, explicit migration path. It retains the existing salted password hashes and session-version records without printing source content:

```powershell
node scripts/migrate-file-identity-to-sqlite.mjs --source <identities.json> --database <identities.sqlite>
```

It also refuses a nonempty SQLite identity state and verifies a canonical SHA-256 checksum. Start with `COLLABORATION_LOCAL_IDENTITY_DB_PATH=<identities.sqlite>` only after verification. Do not run either helper automatically at service start.

## SQLite Backup And Isolated Restore

For the local SQLite bridge, create an application-state backup package before any migration rehearsal or service change. The export reads the selected database, verifies its state shape, creates a new mode-`0600` JSON package, and reports only a checksum. It never overwrites an existing backup file:

```powershell
node scripts/sqlite-state-backup.mjs --kind project --database <projects.sqlite> --output <project-backup.json>
node scripts/sqlite-state-backup.mjs --kind identity --database <identities.sqlite> --output <identity-backup.json>
```

Restore only to a new, isolated path. The restore helper checks package kind and checksum, refuses an existing target database, and verifies the stored state checksum after writing:

```powershell
node scripts/sqlite-state-restore.mjs --kind project --source <project-backup.json> --database <isolated-projects.sqlite>
node scripts/sqlite-state-restore.mjs --kind identity --source <identity-backup.json> --database <isolated-identities.sqlite>
```

Identity backup packages contain existing salted password hashes as required to retain authentication. They are local sensitive artifacts: keep them under the same protected backup and retention controls as the identity database, do not add them to report/archive exports, and do not print their contents or hashes to logs.

## Acceptance Gates

- Every project revision and resource revision matches the source package.
- Every audit, collaboration, and sensitive-citation event has the same ID, time, public actor, and lineage.
- A stale write still returns `409`; an authenticated write denial still returns `403` when deployment policy enables it.
- Sensitive content remains excluded from default retrieval, AI evidence, red-team input, external-vector requests, reports, archives, and exports.
- Snapshot/archive payload checksums match after canonical JSON serialization.
- Backup restore into an isolated database reproduces the target checksums.
- An isolated SQLite identity migration can authenticate an existing account without exposing source credentials or hashes in logs.
- SQLite backup/restore refuses existing output paths, and a restored project or identity store is accepted by its normal repository adapter in an isolated process.

## Rollback

Before cutover, the file repository stays the write source. After cutover, retain a timestamped read-only migration package and database backup. Roll back only by pausing target writes, recording the cutover boundary, and restoring the file adapter from the last verified source package. Do not merge divergent post-cutover writes automatically.

## Decisions Required

- Database and PostGIS operating model, backup target, retention duration, and responsible administrator.
- Object/vector/graph service selection and whether they may receive any project identifiers or only permitted knowledge IDs.
- Protected transport, identity-session secret lifecycle, account-recovery procedure, and audit export retention policy.
- Event-stream ordering, conflict/merge semantics, and data retention before real-time collaborative editing.

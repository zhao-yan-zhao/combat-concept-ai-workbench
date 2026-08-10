# Shared runtime libraries

Used by both the browser workbench and Node server.

| File | Consumers |
|---|---|
| `aiClient.js` | `design-studio` AI controllers |
| `knowledge.js` | browser vault import + server knowledge retrieval |
| `generator.js` | server mock / degraded AI output |
| `data.js` | mock generator templates |
| `dodaf/` | DoDAF 2.02/DM2 OV product normalizers + JSON/XML exchange |

Import from `shared/` directly. The old root `src/` compatibility layer has been removed.

DoDAF operational products use schema `dodaf-2.02-dm2-ov` with DM2 `entities`/`relations` plus product projections. See `shared/dodaf/README.md`.

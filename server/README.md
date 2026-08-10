# Server package

Root entry remains `../server.mjs` → `./app.mjs`.

## Layout

| Path | Role |
|---|---|
| `app.mjs` | Listen + wire runtime to HTTP handler |
| `createRuntime.mjs` | Config, identity, repository, AI secret, static server |
| `createRequestHandler.mjs` | Path/method router |
| `httpUtils.mjs` | `send` / `readJson` / id decoders / process runner |
| `staticFiles.mjs` | Static file serving |
| `openaiClient.mjs` | OpenAI-compatible generate + red-team helpers |
| `routes/collaborationAuth.mjs` | Local account session/login/register/admin |
| `routes/projectResources.mjs` | Project CRUD and resource models |
| `routes/aiRoutes.mjs` | `/api/generate`, `/api/red-team` |
| `routes/officeReports.mjs` | Word/PDF/PPTX export |
| `project*.mjs` / `aiServiceConfig.mjs` / … | Domain modules |

Runtime data stays in `../data/`.

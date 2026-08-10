# App shell modules

Thin shell helpers extracted from `main.js` so orchestration stays readable.

| Module | Responsibility |
|---|---|
| `createInitialState.js` | Project-scoped initial workbench state |
| `domUtils.js` | Toast, escape, download, printable report helpers |
| `workflowGate.js` | Stage unlock gate rendering and completion rules |
| `wireControllers.js` | Controller + project-sync adapter assembly |

Feature modules stay beside this folder. `main.js` owns render/bind/actions and passes shell callbacks into `wireControllers`.

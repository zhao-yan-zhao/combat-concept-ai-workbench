import { createCollaborationController } from "../design-studio/src/collaborationController.js";
import { renderCollaboration } from "../design-studio/src/collaborationView.js";

let revision = 3;
const state = { activeView: "brief", projectRevision: 3, collaboration: { status: "checking" } };
const notifications = [];
let renders = 0;
const controller = createCollaborationController({
  getState: () => state,
  render: () => { renders += 1; },
  notify: (message) => notifications.push(message),
  load: async () => ({ revision, resourceRevision: revision, updatedAt: `2026-07-15T00:0${revision}:00.000Z`, policy: {}, reviews: [], openCount: 0 }),
  loadAudit: async () => ({ entries: [] }),
  loadSession: async () => ({ authenticated: false, setupRequired: false }),
  loadAccounts: async () => ({ accounts: [] }),
  loadSecurityEvents: async () => ({ events: [] }),
  setup: async () => {}, login: async () => {}, logout: async () => {}, createAccount: async () => {}, updateAccount: async () => {}, createReview: async () => ({}), resolveReview: async () => ({})
});

await controller.hydrate();
assert(state.collaboration.revision === 3 && !state.collaboration.remoteChangeAvailable, "Initial collaboration hydrate did not establish the loaded revision");
revision = 5;
assert(await controller.checkForUpdates(), "Revision watch did not detect a newer remote revision");
assert(state.collaboration.remoteChangeAvailable && state.collaboration.remoteRevision === 5, "Revision watch did not retain remote update metadata");
assert(state.collaboration.revision === 3 && state.projectRevision === 3, "Revision watch overwrote local collaboration or project revision");
assert(notifications.length === 0 && renderCollaboration(state).includes("r5"), "Revision watch interrupted a non-collaboration workspace or did not render a manual-review prompt");
assert(!await controller.checkForUpdates() && notifications.length === 0, "Unchanged remote revision created repeated update notifications");
await controller.hydrate();
assert(state.collaboration.revision === 5 && !state.collaboration.remoteChangeAvailable, "Explicit collaboration refresh did not clear the remote-update prompt");
state.activeView = "collaboration";
revision = 6;
assert(await controller.checkForUpdates() && notifications.length === 1 && notifications[0].includes("检测到项目 r6"), "Collaboration workspace did not receive a localized remote-update prompt");
assert(controller.startWatch({ intervalMs: 4000 }) === false, "Revision watch accepted an unsafe poll interval");
assert(renders >= 3, "Revision watch did not render state transitions");
console.log("Collaboration revision-watch acceptance passed: remote updates are detected without automatic local overwrite.");

function assert(condition, message) { if (!condition) throw new Error(message); }

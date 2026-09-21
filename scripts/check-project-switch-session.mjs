import assert from 'node:assert/strict';
import { createCollaborationController } from '../design-studio/src/collaborationController.js';
import { renderCollaborationLoginGate } from '../design-studio/src/collaborationView.js';

const state = { collaboration: { status: 'checking' } };
assert(!renderCollaborationLoginGate(state.collaboration).includes('<form'));
let releaseProject;
const pendingProject = new Promise((resolve) => { releaseProject = resolve; });
const frames = [];
const controller = createCollaborationController({
  getState: () => state,
  render: () => frames.push(renderCollaborationLoginGate(state.collaboration)),
  loadSession: async () => ({ authenticated: true, actor: { roles: [] } }),
  load: () => pendingProject,
  loadAudit: async () => ({ entries: [] })
});
const hydration = controller.hydrate();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(state.collaboration.session.authenticated, true, 'Identity must resolve while project data is still pending');
assert.deepEqual(frames, [''], 'Authenticated users must not see the login form during project loading');
releaseProject(Promise.reject(new Error('Project temporarily unavailable')));
await hydration;
assert.equal(state.collaboration.session.authenticated, true, 'Project errors must preserve the verified identity');
assert(frames.every((html) => html === ''));

const signedOut = { collaboration: { status: 'checking' } };
await createCollaborationController({
  getState: () => signedOut, render: () => {},
  loadSession: async () => ({ authenticated: false }),
  load: async () => { throw new Error('Forbidden'); },
  loadAudit: async () => ({ entries: [] })
}).hydrate();
assert(renderCollaborationLoginGate(signedOut.collaboration).includes('collaborationLoginForm'), 'Confirmed signed-out sessions must still show login');
console.log('Project-switch session checks passed');

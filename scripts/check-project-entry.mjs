import assert from 'node:assert/strict';
import { renderProjectEntry } from '../design-studio/src/projectManagerView.js';
const html = renderProjectEntry({ directory: { status: 'ready', projects: [
  { id: 'default', title: '默认研究' },
  { id: 'research-a', title: '现有项目 <A>' },
  { id: 'archived', title: '已归档', archived: true }
] } });
assert(html.includes('data-project-switch="default"'), 'Default project must be explicitly selectable');
assert(html.includes('data-project-switch="research-a"'));
assert(!html.includes('data-project-switch="archived"'));
assert(html.includes('现有项目 &lt;A&gt;'));
assert(!html.includes('data-project-delete'));
assert(renderProjectEntry({ directory: { status: 'ready', projects: [] }, createOpen: true }).includes('id="projectCreateForm"'));
assert(renderProjectEntry({ directory: { status: 'unavailable' } }).includes('retry-project-entry'));
assert(renderProjectEntry().includes('正在读取项目列表'));
console.log('Project entry checks passed');

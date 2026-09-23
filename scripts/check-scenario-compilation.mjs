import assert from 'node:assert/strict';
import { generateScenario } from '../design-studio/src/scenarioStore.js';
import { createOpenAiClient } from '../server/openaiClient.mjs';

console.log('--- Checking Scenario Prompt Registration ---');
const client = createOpenAiClient({
  getAiServiceConfig: () => ({ baseUrl: "http://example.test/v1", model: "test" }),
  getAiApiKey: () => "test-key"
});
const prompts = client.listPromptDefinitions();
const scenarioPrompt = prompts.find((p) => p.id === 'ai.generate.scenario');
assert.ok(scenarioPrompt, 'ai.generate.scenario prompt must be registered in listPromptDefinitions');
assert.equal(scenarioPrompt.name, '仿真想定');
assert.ok(scenarioPrompt.defaultContent.includes('仿真想定要求'), 'Prompt content must include scenario requirements');
assert.ok(scenarioPrompt.defaultContent.includes('entities') && scenarioPrompt.defaultContent.includes('timeline'), 'Prompt content must include entities and timeline requirements');
console.log('Scenario Prompt Registration: OK');

console.log('--- Checking Scenario Full-Element Compilation Engine ---');
const mockBrief = {
  objective: '夺取制信息权与区域防空压制',
  approach: '多源协同侦察与隐身突防打击',
  expectedEffects: '瘫痪敌指控中枢，确保空天走廊安全'
};

const mockPhaseAction = {
  phases: [
    {
      id: 'phase-prep',
      name: '态势感知与电子压制',
      timeframe: 'T+00:00 ~ T+00:30',
      actions: [
        { id: 'act-1', name: '高空长航时无人机前沿侦察', side: 'friendly' },
        { id: 'act-2', name: '全频段防空预警雷达搜索', side: 'enemy' }
      ]
    },
    {
      id: 'phase-strike',
      name: '防空压制与联合突击',
      timeframe: 'T+00:30 ~ T+01:30',
      actions: [
        { id: 'act-3', name: '隐身战机发射反辐射导弹打击敌防空阵地', side: 'friendly' },
        { id: 'act-4', name: '敌机动地空导弹转移阵地并组织抗击', side: 'enemy' }
      ]
    }
  ]
};

const mockForceMission = {
  tasks: [
    {
      id: 'task-1',
      name: '前沿广域侦察监视',
      side: 'friendly',
      missionType: '侦察监视',
      objective: '获取敌一类雷达目标坐标',
      expectedEffect: '实时态势更新',
      area: {
        name: '东部海空监视区',
        type: '海空走廊',
        geometryType: 'polygon',
        points: [
          { latitude: 24.5, longitude: 121.2 },
          { latitude: 24.8, longitude: 121.6 },
          { latitude: 24.2, longitude: 121.8 }
        ]
      }
    },
    {
      id: 'task-2',
      name: '中高空区域防空抗击',
      side: 'enemy',
      missionType: '区域防空',
      objective: '拦截来袭打击兵力',
      expectedEffect: '保卫核心节点',
      area: {
        name: '某要地防空区',
        type: '要地防空',
        geometryType: 'point',
        points: [{ latitude: 24.4, longitude: 121.5 }]
      }
    }
  ],
  forces: [
    {
      id: 'f-1',
      name: '无人侦察机编队',
      side: 'friendly',
      domain: '空中',
      role: '侦察预警',
      task: '前沿广域侦察监视',
      platform: 'EA-18G / 无人侦察机'
    },
    {
      id: 'f-2',
      name: '防空导弹营',
      side: 'enemy',
      domain: '地面',
      role: '防空反导',
      task: '中高空区域防空抗击',
      platform: '爱国者-3 / S-400'
    }
  ],
  combatForces: [
    {
      id: 'cf-1',
      name: '红方-隐身突击机群',
      side: 'friendly',
      domain: '空中',
      role: '突防打击',
      cmoPlatform: {
        platformName: 'J-20A',
        category: '战斗机',
        sensors: ['AESA有源相控阵雷达', 'EOTS光电瞄准系统'],
        weapons: ['PL-15中远程空空导弹', '反辐射导弹']
      }
    },
    {
      id: 'cf-2',
      name: '蓝方-防空雷达站',
      side: 'enemy',
      domain: '地面',
      role: '预警侦测',
      cmoPlatform: {
        platformName: 'AN/FPS-117雷达站',
        category: '地面雷达',
        sensors: ['三坐标远程对空情报雷达']
      }
    }
  ]
};

const compiledScenario = generateScenario({
  brief: mockBrief,
  phaseAction: mockPhaseAction,
  forceMission: mockForceMission
});

console.log('Compiled Scenario summary:');
console.log(`- Entities count: ${compiledScenario.entities?.length}`);
console.log(`- Areas count: ${compiledScenario.areas?.length}`);
console.log(`- Phases count: ${compiledScenario.phases?.length}`);

assert.ok(compiledScenario.entities && compiledScenario.entities.length >= 4, 'Should compile both concept forces and combatForces (at least 4 entities)');
const redEntities = compiledScenario.entities.filter((e) => e.side === 'friendly');
const blueEntities = compiledScenario.entities.filter((e) => e.side === 'enemy');
assert.ok(redEntities.length >= 2, 'Should contain friendly entities');
assert.ok(blueEntities.length >= 2, 'Should contain enemy entities');

// Verify CMO platform payload mapping
const j20 = compiledScenario.entities.find((e) => e.name.includes('隐身突击机群') || e.platform === 'J-20A');
assert.ok(j20, 'Should include J-20A combat force');
assert.equal(j20.side, 'friendly');
assert.ok(j20.sensors && j20.sensors.includes('AESA有源相控阵雷达'), 'Should inherit CMO sensors');
assert.ok(j20.weapons && j20.weapons.length > 0, 'Should inherit CMO weapons');

// Verify areas compiled from tasks
assert.ok(compiledScenario.areas && compiledScenario.areas.length >= 2, 'Should compile at least 2 task areas');
const polyArea = compiledScenario.areas.find((a) => a.geometryType === 'polygon');
assert.ok(polyArea, 'Should compile polygon task area');
assert.equal(polyArea.points.length, 3, 'Polygon area must preserve all 3 coordinate points');

// Verify phases and action sequence
assert.equal(compiledScenario.phases.length, 2, 'Should compile 2 scenario phases from phaseAction');
assert.equal(compiledScenario.phases[0].name, '态势感知与电子压制');
assert.ok(compiledScenario.phases[0].events.length >= 2, 'First phase must contain compiled action events');
assert.ok(compiledScenario.phases[1].events.some((e) => e.action.includes('反辐射导弹')), 'Second phase must contain anti-radiation strike action');

console.log('--- Checking Scenario Entities Coordinates & Sides ---');
assert.ok(compiledScenario.entities.every((e) => (Array.isArray(e.position) && e.position.length >= 2 && e.position.every((p) => Number.isFinite(Number(p)))) || (Number.isFinite(e.position?.latitude) && Number.isFinite(e.position?.longitude))), 'All entities must have valid numeric coordinates');
assert.ok(compiledScenario.entities.every((e) => ['friendly', 'enemy', 'hostile', 'neutral'].includes(e.side)), 'All entities must have valid side values');

console.log('Scenario Full-Element Compilation Checks: ALL PASSED!');

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTacticsLibraryStore, PRESET_TACTICS_SEED } from "../server/tacticsLibraryStore.mjs";
import { buildForkedProjectData } from "../design-studio/src/tacticsLibraryClient.js";
import { renderTacticsLibraryModal } from "../design-studio/src/tacticsLibraryView.js";

console.log("--- 运行 M7-T7.4 战法库：跨项目复用与复制起点专项测试 ---");

const tempFilePath = path.join(process.cwd(), "data", `test-tactics-library-${Date.now()}.json`);

try {
  // 1. 战法库仓储初始化与预置种子
  const store = createTacticsLibraryStore({ filePath: tempFilePath });
  const initialList = await store.listTactics();
  assert.equal(initialList.length >= 2, true, "预置战法库应至少包含2个种子战法");
  const strikeTactic = initialList.find((t) => t.id === "tactic-distributed-strike");
  assert.ok(strikeTactic, "必须包含分布式集群多轴饱和突防战法");
  assert.equal(strikeTactic.category, "反舰突防 / 电子欺骗");
  assert.ok(strikeTactic.applicableConditions.includes("雷达"));
  console.log("✔ 检查项 1: 战法库仓储初始化与预置战法种子正确");

  // 2. 战法库搜索与分类过滤
  const strikeSearch = await store.listTactics({ search: "饱和" });
  assert.equal(strikeSearch.length, 1);
  assert.equal(strikeSearch[0].id, "tactic-distributed-strike");

  const categorySearch = await store.listTactics({ category: "电子欺骗" });
  assert.equal(categorySearch.length, 1);
  assert.equal(categorySearch[0].id, "tactic-distributed-strike");

  const allCategorySearch1 = await store.listTactics({ category: "all" });
  assert.equal(allCategorySearch1.length, initialList.length, "category='all' 应返回全部战法");
  const allCategorySearch2 = await store.listTactics({ category: "全部" });
  assert.equal(allCategorySearch2.length, initialList.length, "category='全部' 应返回全部战法");

  const emptySearch = await store.listTactics({ search: "不存在的关键词xyz" });
  assert.equal(emptySearch.length, 0);
  console.log("✔ 检查项 2: 战法库关键词多维搜索与分类过滤正确");

  // 3. 保存新战法到战法库
  const createdTactic = await store.saveTactic({
    name: "新型跨域诱骗协同突防战法",
    category: "诱骗破门",
    summary: "利用诱饵无人机模拟多路主攻航线，诱导防空火控雷达开机并实施硬反辐射打击。",
    applicableConditions: "强电磁对抗与高密集地空导弹防御纵深",
    recordTemplate: {
      brief: { objective: "夺取要地防空走廊" },
      ov5: { activities: [{ id: "act-1", name: "发射雷达诱饵" }] }
    },
    author: "战术推演组"
  });
  assert.ok(createdTactic.id);
  assert.equal(createdTactic.name, "新型跨域诱骗协同突防战法");
  const fetched = await store.getTactic(createdTactic.id);
  assert.equal(fetched.name, createdTactic.name);
  const currentList = await store.listTactics();
  assert.equal(currentList.length, initialList.length + 1);
  console.log("✔ 检查项 3: 新增战法条目与数据落盘持久化契约正确");

  // 4. 跨项目复用作为复制起点（绝对解耦测试）
  const newProjectId = "proj-derived-test-001";
  const newTitle = "某岛礁防空压制实兵想定";
  const forkedProjectPayload = buildForkedProjectData(createdTactic, newProjectId, newTitle);

  assert.equal(forkedProjectPayload.id, newProjectId);
  assert.equal(forkedProjectPayload.title, newTitle);
  assert.equal(forkedProjectPayload.kind, "tactic");
  assert.ok(forkedProjectPayload.record);
  assert.equal(forkedProjectPayload.record.brief.objective, "夺取要地防空走廊");

  // 验证修改复制后的新项目，战法库模板不受任何污染（纯深拷贝解耦）
  forkedProjectPayload.record.brief.objective = "修改后的目标：已与战法库完全脱钩";
  forkedProjectPayload.record.ov5.activities.push({ id: "act-2", name: "新增行动" });
  const refetchTactic = await store.getTactic(createdTactic.id);
  assert.equal(
    refetchTactic.recordTemplate.brief.objective,
    "夺取要地防空走廊",
    "修改派生新项目必须绝对严禁污染战法库原始模板"
  );
  assert.equal(
    refetchTactic.recordTemplate.ov5.activities.length,
    1,
    "战法库原始行动列表必须保持纯洁，严禁产生跨项目双向联动污染"
  );
  console.log("✔ 检查项 4: 跨项目复用复制起点与深拷贝绝对解耦验证通过");

  // 5. 删除战法条目
  const deleteResult = await store.deleteTactic(createdTactic.id);
  assert.equal(deleteResult, true);
  assert.equal(await store.getTactic(createdTactic.id), null);
  console.log("✔ 检查项 5: 战法库条目删除契约正确");

  // 6. 前端战法库模态弹窗组件渲染契约
  const modalHtml = renderTacticsLibraryModal({
    open: true,
    tactics: [strikeTactic],
    searchQuery: "饱和",
    activeCategory: "all"
  });
  assert.ok(modalHtml.includes("跨项目战法复用库"), "应包含模态弹窗标题");
  assert.ok(modalHtml.includes("tacticsLibSearchInput"), "应包含搜索框");
  assert.ok(modalHtml.includes("tactics-search-input"), "搜索框应包含类名 tactics-search-input");
  assert.ok(modalHtml.includes("分布式集群多轴饱和突防战法"), "应渲染战法卡片");
  assert.ok(modalHtml.includes('data-action="fork-tactic-as-project"'), "卡片应包含以该战法创建新项目按钮");
  assert.ok(modalHtml.includes('data-action="close-tactics-library"'), "应包含关闭按钮");

  const emptyModalHtml = renderTacticsLibraryModal({
    open: true,
    tactics: [],
    searchQuery: "xyz",
    activeCategory: ""
  });
  assert.ok(emptyModalHtml.includes('data-action="reset-tactics-filter"'), "空结果时应提供重置筛选与检索按钮");
  console.log("✔ 检查项 6: 前端战法库模态弹窗 HTML 契约正确");

  // 7. 检查关键入口静态集成与事件委托闭环
  const projectManagerSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/projectManagerView.js"), "utf8");
  assert.ok(projectManagerSource.includes('data-action="open-tactics-library"'), "项目管理器中必须提供战法库入口");

  const ov5ViewSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/ov5MechanismView.js"), "utf8");
  assert.ok(ov5ViewSource.includes('data-action="save-to-tactics-library"'), "OV-5中必须提供存入战法库动作按钮");
  assert.ok(ov5ViewSource.includes('data-action="open-tactics-library"'), "OV-5中必须提供打开战法库动作按钮");

  const indexHtml = fs.readFileSync(path.join(process.cwd(), "design-studio/index.html"), "utf8");
  assert.ok(indexHtml.includes('id="tacticsLibraryRoot"'), "index.html 中必须包含 tacticsLibraryRoot 挂载节点");

  const mainSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/main.js"), "utf8");
  assert.ok(mainSource.includes('action === "open-tactics-library"'), "main.js 必须处理 open-tactics-library");
  assert.ok(mainSource.includes('action === "fork-tactic-as-project"'), "main.js 必须处理 fork-tactic-as-project");
  assert.ok(mainSource.includes('action === "close-tactics-library"'), "main.js 必须处理 close-tactics-library");
  assert.ok(mainSource.includes('action === "reset-tactics-filter"'), "main.js 必须处理 reset-tactics-filter");
  assert.ok(mainSource.includes('tacticsLibraryRoot'), "main.js 必须对 tacticsLibraryRoot 保持委托隔离");

  const chromeBindingsSource = fs.readFileSync(path.join(process.cwd(), "design-studio/src/app/bindings/chromeBindings.js"), "utf8");
  assert.ok(chromeBindingsSource.includes('tacticsLibraryRoot'), "chromeBindings 必须为 tacticsLibraryRoot 绑定根级事件委托");
  assert.ok(chromeBindingsSource.includes('state.tacticsLibraryOpen'), "chromeBindings 必须支持 Esc 键关闭战法库");

  const serverHandlerSource = fs.readFileSync(path.join(process.cwd(), "server/createRequestHandler.mjs"), "utf8");
  assert.ok(serverHandlerSource.includes('items: tactics'), "后端 GET /api/tactics-library 必须兼顾 items 与 tactics 兼容契约");
  console.log("✔ 检查项 7: 前端关键入口、事件委托闭环与主调度生命周期集成完整");

} finally {
  if (fs.existsSync(tempFilePath)) {
    try {
      fs.unlinkSync(tempFilePath);
    } catch {}
  }
}

console.log("--- M7-T7.4 战法库专项测试全部 PASS ---");

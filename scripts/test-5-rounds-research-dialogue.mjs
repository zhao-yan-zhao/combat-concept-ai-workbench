// scripts/test-5-rounds-research-dialogue.mjs
// Test 5 continuous rounds of research dialogue on port 8792

const PORT = process.env.PORT || "8792";
const BASE_URL = `http://127.0.0.1:${PORT}`;

const PROJECT_TITLE = "分布式无人机群在巴士海峡反介入封控中的突防与协同打击战法研究";

const questions = [
  // Round 1: Core operational question
  "我们在巴士海峡实施封控时，面对美菲在吕宋岛北部部署的‘堤丰’中导系统与‘爱国者-3’阵地，分布式无人机群如何规划低空突防与防区外压制路径？",

  // Round 2: Challenging communication & emission dilemma
  "如果按照你说的多轴向低空突防，在强电磁干扰和无线电静默条件下，无人机群去中心化协同自组网的射频辐射必然会暴露群队方位，引来标准-6的被动雷达制导截击，这个自相矛盾如何解决？",

  // Round 3: Adversarial reaction & tactical counter-measure
  "美军如果不做固定阵位死守，而是采用公路机动‘打了就跑’结合诱饵雷达阵地，同时用有人机（E-2D预警机与P-8A）在后方远海提供协同交战（CEC）照射，我们怎么识别真假阵位并压缩其打击响应窗口？",

  // Round 4: Logistics & operational constraints
  "有人提出全部用高超声速高价值弹药先手洗地，但我方弹药基数有限、成本极高，无法对巴士海峡实施全时段消耗性覆盖。在弹药库存受限的现实约束下，如何用‘廉价饱和消耗+精确点穴’的兵力配比实现可持续封控？",

  // Round 5: Decision threshold & brief finalization
  "根据前面讨论，我们要把这套打法正式写入作战概念简报。请提炼出行动转入‘全面突防点穴阶段’的核心判决门槛（Exit Criteria），并最终审定我们整套概念的各关键要素。"
];

async function runDialogue() {
  console.log(`=== 启动 5 轮作战概念深度研讨测试 (服务地址: ${BASE_URL}) ===\n`);

  let brief = {
    researchIntent: "",
    objective: "",
    approach: "",
    assumptions: "",
    expectedEffects: "",
    risk: ""
  };

  const historyMessages = [];

  for (let round = 0; round < questions.length; round++) {
    const question = questions[round];
    console.log(`\n========================================`);
    console.log(`【第 ${round + 1} 轮提问】`);
    console.log(`研究员: ${question}`);
    console.log(`----------------------------------------`);

    // Format conversationContext
    const contextLines = [];
    if (historyMessages.length > 0) {
      contextLines.push("【最近对话原文】");
      for (const msg of historyMessages.slice(-6)) {
        contextLines.push(`${msg.role === "user" ? "研究人员" : "研究助手"}：${msg.text}`);
      }
    }
    const conversationContext = contextLines.join("\n") || "这是首轮研究咨询，暂无历史对话。";

    const targetFieldsPerRound = ["approach", "assumptions", "risk", "expectedEffects", "all"];
    const briefField = targetFieldsPerRound[round] || "all";

    const requestBody = {
      workflowId: "concept",
      workflow: { id: "concept", title: "研究对话直接答复", outputSchema: "ConceptPlan" },
      analysis: {
        "项目标题": PROJECT_TITLE,
        "已记录灵感": "围绕巴士海峡反介入封控，探索无人机群与远程火力协同压制吕宋岛敌防空反导节点。",
        "当前研究简报": { ...brief },
        "近期对话上下文": conversationContext,
        "研究人员问题": question,
        "本轮允许更新的简报字段": briefField,
        "对话回答要求": [
          "你是作战概念研究工作台的【资深军事概念研讨参谋】：以“项目标题”与用户提出的实际课题为核心，展开有实质深度、平等互动的专业战法机制研讨，并顺带完善右侧研究简报。",
          "回答采用参谋式三段论：① 结合军事常识回应关键矛盾、攻防痛点与装备对抗机理；② 提炼一句规范表述代拟写入右侧对应简报栏（并填入 briefUpdate 对应字段）且友好提示已代拟；③ 抛出 1 至 2 个推演分支或关键对抗变量供研究员权衡利弊。",
          "当用户表达研究主题或询问如何填写某字段时，在 briefUpdate 允许字段写入贴合本课题的研究表述；用户若提出新课题，优先以用户最新课题为准。",
          "多轮对话紧密承接：当用户承接询问或提出质疑/推敲时，锁定当前核心课题，分析不同推演分支利弊，协助研究员推敲决策。",
          "用户询问某字段现状时直接复述已有内容，briefUpdate 置空。严禁输出机械套话（如“研究框架已就绪”、“请提供变量”等说辞）。"
        ].join("")
      },
      evidence: []
    };

    const startTime = Date.now();
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`第 ${round + 1} 轮请求失败 (${res.status}): ${errText}`);
      break;
    }

    const data = await res.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const result = data.result || {};
    const answer = result.answer || result.summary || JSON.stringify(result);
    const briefUpdate = result.briefUpdate || {};

    console.log(`【AI 参谋回答】(耗时 ${duration}s):`);
    console.log(answer);

    console.log(`\n【同步更新简报字段 (briefUpdate)】:`);
    console.log(JSON.stringify(briefUpdate, null, 2));

    // Update brief state
    for (const [k, v] of Object.entries(briefUpdate)) {
      if (v && typeof v === "string" && v.trim()) {
        brief[k] = v.trim();
      }
    }

    // Append to history
    historyMessages.push({ role: "user", text: question });
    historyMessages.push({ role: "assistant", text: answer });
  }

  console.log(`\n========================================`);
  console.log(`=== 5 轮研讨结束后的最终研究简报 ===`);
  console.log(JSON.stringify(brief, null, 2));
}

runDialogue().catch(console.error);

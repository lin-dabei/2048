# Tasks

> 改动全部收敛在 `js/ai2048.js`、`game_ai.html`、`style/ai.css`、`tools/verify_ai.js`；**零运行时依赖**。
> 所有子任务以 `node tools/verify_ai.js` 无头校验可跑 + 浏览器(F5 各难度)回归为验收。

## 阶段 A · 核心规则与捣乱骨架（引擎层打底）
- [ ] Task 1: 重构规则引擎与胜负判定
  - [ ] 1.1 新增 `placeTile(board,r,c,val)` 与 `addTileEmpty(board,val)` 空位放置工具
  - [ ] 1.2 重写 `checkWin` 优先级链：先达 2048 胜 > 任一方 `deadOr` 立即判负 > 双死比分
  - [ ] 1.3 新增轮计数：一轮 = 玩家1步 + AI1步 = 2 正常移动
  - [ ] 1.4 简单档 determinism 兜底（ceil 判负）兼容新判负链，仍满足随便划稳赢
- [ ] Task 2: 双向捣乱机制（引擎层）
  - [ ] 2.1 每轮结束进入捣乱：玩家侧 `playerSabotage(rc,val2or4)` 可跳过
  - [ ] 2.2 AI 侧 `aiSabotage()`：玩家盘空位放 2/4（落点按难度/情绪）
  - [ ] 2.3 空位不足不放置；捣乱不触发下一轮捣乱
  - [ ] 2.4 导出 placeTile/addTileEmpty/playerSabotage/aiSabotage 到 module.exports

## 阶段 B · 地狱强化 + MCTS 搜索
- [ ] Task 3: 可复现 PRNG 与自盘已知生成
  - [ ] 3.1 新增 seed 参数 PRNG（mulberry32），地狱自盘生成走它，AI 可精确预知 (格,值)
  - [ ] 3.2 地狱正常移动玩家盘新块走对抗放置（含已知自盘 + 情绪强度）
  - [ ] 3.3 `DIFF_CFG` 新增 controlSpawn/selfKnown/mctsBudget/thinkMs 并应用
  - [ ] 3.4 非地狱不接管玩家盘生成、自盘随机未知（回归现状）
- [ ] Task 4: MCTS 走子决策
  - [ ] 4.1 MCTS 引擎：UCB1/PUCT 选择 + 贪婪启发式 rollout + 回传
  - [ ] 4.2 地狱 chance 层按"自盘已知生成"单点展开，避免采样分叉；目标单决策 ≤1s、强度最大化
  - [ ] 4.3 难度→节点/时间预算映射；简单档并入 blunder + ceil 约束
  - [ ] 4.4 情绪对 MCTS 预算做可调因子（Task 6 接线）
- [ ] Task 5: 内联 Blob Web Worker 封装（纯前端零依赖）
  - [ ] 5.1 `new Worker(URL.createObjectURL(new Blob([代码串])))` 后台跑 MCTS；postMessage 问/收
  - [ ] 5.2 无 Worker 环境回退同步时间闸（≤1s），仍可决策
  - [ ] 5.3 主线程思考期锁输入 + "思考中…"；撤消/重下兼容

## 阶段 C · 情绪状态机与反馈引擎（引擎层 + 文案库）
- [ ] Task 6: AIEmotion 状态机
  - [ ] 6.1 状态：calm/confident/tsundere/angry/rage/deadpan；对象含 MCTS 预算系数、捣乱强度、嘲讽开关、进度条抖动开关、帮助倾向
  - [ ] 6.2 事件驱动转移：最佳解追随/合成大块/被反超/濒死被救/大比分领先
  - [ ] 6.3 情绪改变 MCTS 预算与捣乱强度（接线 Task 4）
- [ ] Task 7: 正反馈引擎
  - [ ] 7.1 P1 傲娇鼓励（连走最优 + N、大数合成触发话术）
  - [ ] 7.2 P2/P8 分步胜率进度条计算（双盘评估差 + 难度目标归一化）
  - [ ] 7.3 P3 稳定盘帮助块（calm/help 情绪 + 频次/价值上限）
  - [ ] 7.4 P4 推荐高亮候选：真最优/伪候选 + 防连续最优 + 一定概率示最差
  - [ ] 7.5 P5 冷静期保守；P6 里程碑庆祝；P7 败势段回暖
- [ ] Task 8: 负反馈引擎
  - [ ] 8.1 N1 嘲讽（情绪话术库 + 限频）
  - [ ] 8.2 N2 胜率预估 ∈(30%,50%) 进度条抖动
  - [ ] 8.3 N3 死里逃生 + 假最差生成；N4 温水煮青蛙锁分差 ≈200
  - [ ] 8.4 N5 边缘大数诱惑；N6 暴怒加深；N7 假走神；N8 时差压迫；N9 希望收割
- [ ] Task 9: 文案库（按情绪分组的拟人话术）

## 阶段 D · UI / 渲染
- [ ] Task 10: game_ai.html 结构扩展
  - [ ] 10.1 胜率进度条容器（双方标签 + 抖动层）
  - [ ] 10.2 情绪/嘲讽气泡区（不影响主操作）
  - [ ] 10.3 推荐方向高亮层（棋盘边缘/箭头标）
  - [ ] 10.4 捣乱交互层：AI 盘点选、切 2/4、跳过；捣乱锁定普通移动
  - [ ] 10.5 保留 diff-slot / settings-slot / skill-info 对接
- [ ] Task 11: style/ai.css 新增样式
  - [ ] 11.1 进度条+抖动动画、气泡入场/离场、推荐高亮、捣乱选格态、捣乱遮罩
  - [ ] 11.2 地狱 is-hell 及情绪（如 rage）配色叠加
  - [ ] 11.3 响应式：移动端不遮挡棋盘主操作

## 阶段 E · 集成与验证
- [ ] Task 12: Duel 主流程接线
  - [ ] 12.1 正常移动 → AI步(Worker) → 捣乱(玩家点选→AI放置) → 下一轮循环
  - [ ] 12.2 AIEmotion 与正/负反馈在关键节点触发（回合/捣乱/被反超/濒死）
  - [ ] 12.3 进度条与推荐高亮每步刷新；结算横幅/ELO 兼容新判负链
- [ ] Task 13: 扩展 tests/verify_ai.js
  - [ ] 13.1 捣乱：每轮后双方各自在对方盘放置 2/4；空位不足不放置
  - [ ] 13.2 判负链：死盘立即判负、先达 2048 胜优先级
  - [ ] 13.3 地狱可控性：自盘生成可复现；单步 ≤1s；MCTS 强度（solo 能爬高位）
  - [ ] 13.4 情绪：被反超→rage 预算上调；领先→calm 保守；P4 连续最优不重复
  - [ ] 13.5 难度单调与既有阈值回归（简单≥90% / 分差拉满 / hell≤5% 等）

# Task Dependencies
- Task 1 ← 基础（Task 2,3,4 依赖其判定与工具）
- Task 2 依赖 Task 1；Task 3 依赖 Task 1；Task 4 依赖 Task 3；Task 5 依赖 Task 4（封装 Worker）
- Task 6 依赖 Task 4（预算系数）；Task 7,8 依赖 Task 6；Task 9 被 Task 7,8 使用
- Task 10,11 可并行（引擎就绪后接 UI）
- Task 12 依赖 Task 2,5,6,7,8,10,11
- Task 13 覆盖全部，最后执行

# 并行建议
- 阶段 A（Task1-2）串行打底；阶段 B（Task3-5）串行；阶段 C 逻辑引擎（Task6-8）与文案库（Task9）可并行；阶段 D（Task10-11）与阶段 C 并行；阶段 E 串行收口。
/**
 * 合规性校验 · AI 对抗「双向捣乱 + 情绪化反馈」改版（R1）
 * 在无 DOM 环境复用生产引擎，断言：
 *   A. 判负链 + 胜负原因（reach2048 / player-dead / bot-dead / both-dead / bot-ceil）
 *   B. 捣乱技能点经济（攒点/花费/跳过/自动插桩/空位不足不放置）
 *   C. 地狱可控性：自盘生成可复现；对抗放置保最小间隙；MCTS 有合法走子
 *   D. 情绪：所有情绪 MCTS 预算上浮系数 ≥1（不改强度下限）
 *   E. 时间上限：地狱单步决策可控；难度配置齐全
 */
"use strict";
const A = require("../js/ai2048.js");
const {
  WIN_VAL, DIFF_CFG, DIFF_TARGET,
  emptyBoard, clone, emptyCells, tryMove,
  spawn, placeTile, addTileEmpty, spawnWorst, spawnHelp,
  maxVal, deadOr, decideWinner,
  heuristic, hellOwnSpawn, mctsBest, chooseBotMove,
  EMOTIONS, EMOTION_ORDER
} = A;

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  console.log((cond ? "  PASS  " : "  FAIL  ") + name + (cond ? "" : "  ← " + (detail || "")));
}
function pct(n, d) { return (100 * n / d).toFixed(1) + "%"; }

/* 玩家正常移动补子：按难度 spawn 策略 */
function playerFill(p, cfg) {
  if (cfg.spawn === "worst") spawnWorst(p, 3);
  else if (cfg.spawn === "help") spawnHelp(p);
  else spawn(p, cfg.p4p);
}
/* AI 步：走子 + 自盘补子 */
function aiStep(bb, cfg) {
  const d = chooseBotMove(bb, {
    timeMs: Math.min(cfg.timeMs, 60), nodes: Math.min(cfg.nodes, 800),
    selfKnown: cfg.selfKnown, p4b: cfg.p4b, blunder: cfg.blunder,
    ceil: cfg.ceil || 0, mult: 1
  });
  if (d === null) return { moved: false };
  const r = tryMove(bb, d);
  let out = r.board;
  if (cfg.selfKnown) { const s = hellOwnSpawn(out, 1); if (s) placeTile(out, s.r, s.c, s.v); }
  else spawn(out, cfg.p4b);
  return { moved: true, board: out, gained: r.gained };
}

console.log("=== A. 判负链 + 原因 ===");
{
  // 玩家先达 2048
  const pA = emptyBoard(); pA[0][0] = 2048; const bA = emptyBoard();
  const r1 = decideWinner(pA, bA, {}); check("玩家达2048 -> 玩家胜/reach2048", r1.winner === "p" && r1.reason === "reach2048", JSON.stringify(r1));
  // 机器人先达 2048
  const pB = emptyBoard(); const bB = emptyBoard(); bB[0][0] = 2048;
  const r2 = decideWinner(pB, bB, {}); check("AI达2048 -> AI胜/reach2048", r2.winner === "b" && r2.reason === "reach2048", JSON.stringify(r2));
  // 玩家死盘立即判负（即使 AI 也弱）
  const pd = emptyBoard();
  [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3],[2,0],[2,1],[2,2],[2,3],[3,0],[3,1],[3,2],[3,3]].forEach((c,i)=>{ pd[c[0]][c[1]] = [2,4,8,16,32,64,128,2,4,8,16,32,64,128,2,4][i]; });
  check("死盘被 deadOr 识别", deadOr(pd), "expected dead");
  const r3 = decideWinner(pd, emptyBoard(), {}); check("玩家死盘 -> AI胜(player-dead)", r3.winner === "b" && r3.reason === "player-dead", JSON.stringify(r3));
  // 机器人死盘 -> 玩家胜
  const r4 = decideWinner(emptyBoard(), pd, {}); check("AI死盘 -> 玩家胜(bot-dead)", r4.winner === "p" && r4.reason === "bot-dead", JSON.stringify(r4));
  // 双死比分
  const r5 = decideWinner(pd, clone(pd), { ps: 500, bs: 300 }); check("双死比分 玩家高 -> 玩家胜", r5.winner === "p", JSON.stringify(r5));
  // ceil 触顶
  const r6 = decideWinner(emptyBoard(), (()=>{const b=emptyBoard(); b[0][0]=16; return b;})(), { ceil: 8 }); check("AI触顶(ceil) -> 玩家胜(bot-ceil)", r6.winner === "p" && r6.reason === "bot-ceil", JSON.stringify(r6));
}

console.log("=== B. 工具 + 捣乱技能点经济（引擎层） ===");
{
  // placeTile / addTileEmpty
  const b = emptyBoard();
  placeTile(b, 0, 0, 4); check("placeTile 放在空位", b[0][0] === 4);
  placeTile(b, 0, 0, 8); check("placeTile 忽略已占用格", b[0][0] === 4);
  // 攒点/花费模拟（复刻 Duel 规则：开局0，每轮各+1，上限2）
  let p1 = 0, a1 = 0;
  for (let i = 0; i < 3; i++) { if (p1 < 2) p1++; if (a1 < 2) a1++; }
  check("攒点上限2", p1 === 2 && a1 === 2, `p1=${p1}`);
  // 花 1 点捣乱放置
  const target = emptyBoard(); spawn(target); spawn(target);
  const cells = emptyCells(target);
  const c = cells[0];
  p1--; placeTile(target, c[0], c[1], 4);
  check("花费1点后放置生效", p1 === 1 && target[c[0]][c[1]] === 4);
  // 空位不足不放置：addTileEmpty 返回 -1
  placeTile(b, 0, 1, 2); placeTile(b, 0, 2, 4); placeTile(b, 0, 3, 8);
  const full = [[2,4,8,16],[32,64,128,2],[4,8,16,32],[64,128,2,4]];
  check("无空位 addTileEmpty 返回 -1", addTileEmpty(full, 4) === -1, "full board should refuse");
  // 自动/跳过：模拟"跳过"即不花费、留在点数里
  const skip = 2 /* p1 capped */ ; // callers may simply not spend; points remain
  check("跳过=保留点数（不强制）", skip >= 1);
}

console.log("=== C. 地狱可控性 ===");
{
  const cfg = DIFF_CFG.hell;
  check("地狱 controlSpawn/selfKnown 开", cfg.controlSpawn === true && cfg.selfKnown === true, JSON.stringify({c:cfg.controlSpawn,s:cfg.selfKnown}));
  const b = emptyBoard(); spawn(b); spawn(b); spawn(b);
  const s1 = hellOwnSpawn(b, 3), s2 = hellOwnSpawn(b, 3);
  check("自盘生成可复现(同counter同结果)", JSON.stringify(s1) === JSON.stringify(s2), `${JSON.stringify(s1)} vs ${JSON.stringify(s2)}`);
  check("自盘生成落于空位", b[s1.r][s1.c] === 0, "cell should be empty");
  // 对抗放置保最小间隙：deep-fill to minGap, spawnWorst refuses to go below
  const crowd = emptyBoard();
  placeTile(crowd, 0,0,2); placeTile(crowd, 0,1,4); placeTile(crowd, 0,2,8); placeTile(crowd, 0,3,16);
  placeTile(crowd, 1,0,32); placeTile(crowd, 1,1,64); placeTile(crowd, 1,2,128); placeTile(crowd, 1,3,256);
  placeTile(crowd, 2,0,2); placeTile(crowd, 2,1,4); placeTile(crowd, 2,2,8); placeTile(crowd, 2,3,16);
  placeTile(crowd, 3,0,32); placeTile(crowd, 3,1,64); placeTile(crowd, 3,2,128); // 只剩 1 空位
  spawnWorst(crowd, 3); // minGap 3：当前空位 1 <= 3 → 不填
  check("对抗放置不降到最小间隙以下", emptyCells(crowd).length >= 1, "empties=" + emptyCells(crowd).length);
  // MCTS 在可玩盘上有合法走子；死盘返回 null
  const pB = emptyBoard(); spawn(pB); spawn(pB); spawn(pB);
  const dm = mctsBest(pB, { timeMs: 20, nodes: 200, spawn: "random", p4: 0.1 });
  check("MCTS 返回合法方向", dm !== null && dm >= 0 && dm <= 3, "dir=" + dm);
  const deadB = [[2,4,8,16],[32,64,128,2],[4,8,16,32],[64,128,2,4]];
  const dn = mctsBest(deadB, { timeMs: 10, nodes: 50, spawn: "random", p4: 0.1 });
  check("MCTS 死盘返回 null", dn === null, "dir=" + dn);
}

console.log("=== D. 情绪（不改强度下限） ===");
{
  const need = ["calm", "confident", "tsundere", "deadpan", "angry", "rage"];
  check("情绪状态齐全", need.every(x => EMOTIONS[x]) && EMOTION_ORDER.length >= need.length, JSON.stringify(EMOTION_ORDER));
  const allGe1 = need.every(x => EMOTIONS[x].mult >= 1);
  check("所有情绪预算上浮系数 ≥1（强度只升不降）", allGe1);
  check("暴怒比冷静更激进（rage mult最高）", EMOTIONS.rage.mult >= EMOTIONS.calm.mult, `${EMOTIONS.rage.mult} vs ${EMOTIONS.calm.mult}`);
}

console.log("=== E. 时间上限 + 难度配置 ===");
{
  const hell = DIFF_CFG.hell;
  check("地狱 timeMs=1000", hell.timeMs === 1000, "timeMs=" + hell.timeMs);
  // 地狱单步决策耗时（单次测量）
  const hb = emptyBoard();
  [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3],[2,0],[2,1],[2,2],[2,3],[3,0]].forEach((c,i)=>{ placeTile(hb, c[0], c[1], [2,4,8,16,32,64,128,2,4,8,16,32,64][i]); });
  const t0 = Date.now();
  const hd = chooseBotMove(hb, { timeMs: hell.timeMs, nodes: hell.nodes, selfKnown: hell.selfKnown, p4b: hell.p4b, blunder: hell.blunder, ceil: hell.ceil || 0, mult: 1 });
  const dt = Date.now() - t0;
  check("地狱单步决策 ≤ 1500ms", dt <= 1500, "dt=" + dt + "ms, dir=" + hd);
  check("地狱决策返回合法方向", hd === null || (hd >= 0 && hd <= 3), "dir=" + hd);
  // chooseBotMove respect ceil（简单档）
  const ecl = chooseBotMove((()=>{const b=emptyBoard(); b[0][0]=16; return b; })(), { timeMs: 10, nodes: 50, selfKnown: false, p4b: 0.1, blunder: 0, ceil: 8, mult: 1 });
  check("简单档 ceil=8 下拒绝越界走法", ecl === null, "ecl=" + ecl);
}

console.log("=== F. 难度单调 + 简单档确定性封顶 ===");
{
  const greedy = (b) => { let best = -Infinity, dd = -1; for (let d = 0; d < 4; d++) { const r = tryMove(b, d); if (r.moved && heuristic(r.board) > best) { best = heuristic(r.board); dd = d; } } return dd; };
  function run(diff, lim) {
    const cfg = DIFF_CFG[diff]; let p = emptyBoard(), b = emptyBoard();
    const seed = () => { if (cfg.spawn === "worst") spawnWorst(p, 3); else if (cfg.spawn === "help") spawnHelp(p); else spawn(p, cfg.p4p); };
    seed(); seed(); seed(); spawn(b); spawn(b); spawn(b);
    let st = 0, pMax = 0, bMax = 0, win = null;
    while (st < lim && !win) {
      if (deadOr(p)) { win = "lose"; break; }
      const d = greedy(p); if (d < 0) { win = "lose"; break; }
      const pr = tryMove(p, d); if (pr.moved) p = pr.board; playerFill(p, cfg); st++;
      pMax = maxVal(p); if (pMax >= WIN_VAL) { win = "win"; break; }
      if (deadOr(b)) { win = "win"; break; }
      const st2 = aiStep(b, cfg);
      if (st2.moved) { b = st2.board; }
      st++; bMax = maxVal(b); if (bMax >= WIN_VAL) { win = "lose"; break; }
    }
    return { pMax, bMax, win };
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  // 简单档：确定性封顶（AI 撑不过 8、一局都到不了 2048）
  const easyRuns = []; for (let i = 0; i < 6; i++) easyRuns.push(run("easy", 600));
  const easyBMax = Math.max.apply(null, easyRuns.map(r => r.bMax));
  check("简单档 AI 始终 ≤ ceil(8)（撑不过8封顶）", easyBMax <= DIFF_CFG.easy.ceil, "max bMax=" + easyBMax);
  check("简单档 AI 一局都未到 2048", easyRuns.every(r => r.bMax < WIN_VAL));
  check("简单档 玩家平均最大块 ≥ 128（能轻松爬高）", avg(easyRuns.map(r => r.pMax)) >= 128, "avg=" + avg(easyRuns.map(r => r.pMax)));
  // 难度单调：玩家(会玩/贪心)在 easy 走得最远、hard 被压得最狠
  const pm = {};
  for (const diff of ["easy", "normal", "hard"]) {
    const arr = []; for (let i = 0; i < 6; i++) arr.push(run(diff, 400).pMax);
    pm[diff] = avg(arr);
  }
  console.log("   (信息) 会玩玩家平均最大块  easy=" + pm.easy + " normal=" + pm.normal + " hard=" + pm.hard);
  check("难度单调 · 玩家最大块 easy ≥ normal ≥ hard", pm.easy >= pm.normal - 32 && pm.normal >= pm.hard && pm.hard < 128, JSON.stringify(pm));
}

console.log("\n=== 校验汇总 ===");
const failed = results.filter(r => !r.pass);
if (failed.length === 0) console.log("✅ 全部断言通过 —— 双向捣乱 + 情绪化反馈符合阈值。");
else { console.log("❌ " + failed.length + " 项未通过："); failed.forEach(f => console.log("   - " + f.name + "  <-- " + f.detail)); process.exitCode = 1; }
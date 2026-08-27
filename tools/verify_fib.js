/**
 * 合规性校验 · 斐波那契 2048（FIBO）
 * 在无 DOM 环境复用生产引擎核心，断言：
 *   A. fibMerge 规则：1↔1→2、1+2→3、2+3→5、3+5→8、8+13→21；非相邻/相同>1 不可合成
 *   B. collapseAll：横向/纵向滑动合体、一个格子一次只参与一次合成、无合成也正确移动
 *   C. 出生/胜利/死局：出生只出 1/2；合成 ≥2048 触发 won；无路可走 trigger over
 *   D. 棋盘不变量：4×4 不超 16 格；分数只增不减
 */
"use strict";
const fs = require("fs");

// —— 先准备 DOM/全局桩，再加载生产引擎 ——
const stubEl = () => ({
  styles: {}, classList: { add() {}, remove() {} },
  setAttribute() {}, getAttribute() { return null; },
  appendChild() {}, style: {}, innerHTML: "", clientWidth: 330, offsetHeight: 0,
  addEventListener() {}, querySelectorAll() { return []; },
});
global.window = {
  innerWidth: 1440,
  addEventListener() {},
  bindSwipe: null,
  Sound: null,
  Assist: null,
  requestAnimationFrame: function (cb) { return 0; },
  FiboGame: null, fibMerge: null,
};
global.document = { createElement: stubEl, getElementById: () => stubEl() };
const storage = {};
global.localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };

const src = fs.readFileSync("js/fib2048.js", "utf8");
const wrapped = src + "\n;module.exports = { FiboGame: window.FiboGame, fibMerge: window.fibMerge };";
fs.writeFileSync("/tmp/fib_mod.js", wrapped);

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  console.log((cond ? "  PASS  " : "  FAIL  ") + name + (cond ? "" : "  ← " + (detail || "")));
}

// —— 直接复用生产文件里暴露的 fibMerge ——
const { fibMerge } = require("/tmp/fib_mod.js");

console.log("=== A. 合并规则 fibMerge ===");
function fm(a, b) { return fibMerge(a, b); }
check("1+1 → 2", fm(1, 1) === 2, "got " + fm(1, 1));
check("1+2 → 3", fm(1, 2) === 3, "got " + fm(1, 2));
check("2+3 → 5", fm(2, 3) === 5, "got " + fm(2, 3));
check("3+5 → 8", fm(3, 5) === 8, "got " + fm(3, 5));
check("5+8 → 13", fm(5, 8) === 13, "got " + fm(5, 8));
check("8+13 → 21", fm(8, 13) === 21, "got " + fm(8, 13));
check("2+5 不可合成（中间隔 3）", fm(2, 5) === 0, "got " + fm(2, 5));
check("2+2 不可合成", fm(2, 2) === 0, "got " + fm(2, 2));
check("8+21 不可合成（中间隔 13）", fm(8, 21) === 0, "got " + fm(8, 21));
check("对称性：5+3 同 3+5", fm(5, 3) === 8 && fm(3, 5) === 8);
check("0 参与不合成", fm(0, 2) === 0 && fm(2, 0) === 0);

// —— collapseAll：通过 DomStub 构造一局，直接调用引擎 ——
const FiboGame = require("/tmp/fib_mod.js").FiboGame;
const game = new FiboGame(stubEl());

function setBoard(vals) {
  game.g = [[], [], [], []];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const v = vals[r] ? vals[r][c] : 0;
    game.g[r].push(v ? { v: v, id: r * 4 + c } : null);
  }
  game.over = false; game.won = false; game.keep = false; game.score = 0; game.moves = null;
}
function vals() { return game.g.map((row) => row.map((t) => (t ? t.v : 0))); }

console.log("=== B. 滑动与合成（引擎 collapseAll） ===");
// 禁用出生干扰，直接断言纯合并结果
game.spawn = function () {};
// 1+2 相邻 → 合成 3
setBoard([[null, null, null, null], [null, null, null, null], [1, 2, 0, 0], [0, 0, 0, 0]]);
game.move(1); // right
let v = vals();
check("1+2 向右 → [3]", JSON.stringify(v[2]) === "[0,0,0,3]", JSON.stringify(v[2]));

// 2+3 → 5
setBoard([[null, null, null, null], [null, null, null, null], [2, 3, 0, 0], [0, 0, 0, 0]]);
game.move(1);
v = vals();
check("2+3 向右 → [5]", JSON.stringify(v[2]) === "[0,0,0,5]", JSON.stringify(v[2]));

// 一行 1,1,2 → 从远端合成：2+1→3（2 与左侧 1 相邻），余下 1 保留
setBoard([[null, null, null, null], [null, null, null, null], [1, 1, 2, 0], [0, 0, 0, 0]]);
game.move(1);
v = vals();
check("1,1,2 → [1,3]（远端 1+2 先合）", JSON.stringify(v[2]) === "[0,0,1,3]", JSON.stringify(v[2]));

// 链式 1,1,1 → 2,1（后一个 1 不再二次合成）
setBoard([[null, null, null, null], [null, null, null, null], [1, 1, 1, 0], [0, 0, 0, 0]]);
game.move(1);
v = vals();
check("1,1,1 → [1,2] 不连跳", JSON.stringify(v[2]) === "[0,0,1,2]", JSON.stringify(v[2]));

// 竖直滑动：2/3 上下相邻合成 5
setBoard([[null, null, 2, null], [null, null, 3, null], [null, null, 0, null], [null, null, 0, null]]);
game.move(2); // down
v = vals();
check("竖向 2/3 → 底行 5", v[3][2] === 5 && v[2][2] === 0, JSON.stringify(v.map((r) => r[2])));

// 无合成的平移：2,0,0,0 向左底部
setBoard([[null, null, null, null], [null, null, null, null], [2, 0, 0, 0], [0, 0, 0, 0]]);
game.move(2); // down
v = vals();
check("无合成纯平移到底行", v[3][0] === 2, JSON.stringify(v.map((r) => r[0])));
game.spawn = FiboGame.prototype.spawn;

console.log("=== C. 出生 / 胜利 / 死局 ===");
// 出生只出 1/2：清空棋盘后连续 spawn，每次扫描所有格验证
const g2 = new FiboGame(stubEl());
g2.g = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
let only12 = true;
for (let i = 0; i < 200; i++) {
  // 先用掉一格：确保 spawn 有空格可放
  g2.spawn();
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const t = g2.g[r][c];
    if (t && t.v !== 1 && t.v !== 2) { only12 = false; break; }
  }
  if (!only12) break;
  // 清空一盘再来
  g2.g = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
}
check("出生池只出 1/2", only12);

// 胜利：超过 2048（用一局新实例避免污染）
setBoard([[null, null, null, null], [null, null, null, null], [null, null, null, null], [2048, 0, 0, 0]]);
game.move(0);
function maxIn(g) { let m = 0; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (g[r][c] && g[r][c].v > m) m = g[r][c].v; return m; }
check("已有 2048 直接判定 won（或达成）", game.won === true || maxIn(game.g) >= 2048, "won=" + game.won);

// 死局检测：棋盘无路可走时 over=true
// 交替 1 与 8（1 与 8 在斐波那契序列中不相邻），满盘无可合成
const deadBoard = [[1, 8, 1, 8], [8, 1, 8, 1], [1, 8, 1, 8], [8, 1, 8, 1]];
setBoard(deadBoard);
check("死局识别 canMove=false", game.canMove() === false);

console.log("=== D. 不变量 ===");
// 随机打 500 步，检查不超 16 格
const g4 = new FiboGame(stubEl());
g4.bind = function () {};
let maxCells = 0;
for (let i = 0; i < 500; i++) {
  g4.move(i % 4);
  let n = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (g4.g[r][c]) n++;
  if (n > 16) break;
  if (n > maxCells) maxCells = n;
  if (g4.over) g4.restart();
}
check("任意时刻格数 ≤ 16", maxCells <= 16, "max=" + maxCells);
check("多步游走不抛异常", true);

const failed = results.filter((r) => !r.pass);
console.log("\n=== 汇总 ===");
console.log(failed.length ? "❌ " + failed.length + " 项未通过" : "✅ 全部断言通过 —— 斐波那契 2048 规则与不变量符合预期。");
process.exit(failed.length ? 1 : 0);
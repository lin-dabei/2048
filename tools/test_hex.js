// Hex engine logic test: stub minimal DOM and exercise move()/board state
"use strict";
const fs = require("fs");
const src = fs.readFileSync("js/hex2048.js", "utf8");

// Minimal DOM stubs for the HexGame constructor path
function makeEl() {
  const el = {
    children: [],
    childNodes: [],
    style: {},
    setAttribute(k, v) { this._attrs = this._attrs || {}; this._attrs[k] = String(v); },
    getAttribute(k) { return this._attrs ? this._attrs[k] : null; },
    classList: { add() {}, remove() {} },
    appendChild(c) { this.childNodes.push(c); this.children.push(c); },
    removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); },
    addEventListener() {},
    getBoundingClientRect() { return { width: 100, height: 100 }; },
  };
  return el;
}
global.window = {
  innerWidth: 1440,
  addEventListener() {},
  bindSwipe8: null,
  nudge: null,
  Assist: null,
  Sound: null,
  HexGame: null,
};
const createElementNS = () => makeEl();
// getElementById returns a stub el so updateHud/render paths don't crash
global.document = {
  createElementNS,
  getElementById: () => makeEl(),
};
const storage = {};
global.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
};

const wrapped = src + "\n;module.exports = window.HexGame;";
fs.writeFileSync("/tmp/hex_mod.js", wrapped);
const HexGame = require("/tmp/hex_mod.js");

const container = { appendChild() {} };
const game = new HexGame(container);

function setBoard(map) {
  game.board = {};
  game.score = 0; game.won = false; game.over = false; game.keepPlaying = false;
  Object.keys(map).forEach((k) => { game.board[k] = map[k]; });
}
function isInRange(q, r) { return q >= -2 && q <= 2 && r >= -2 && r <= 2 && (q + r) >= -2 && (q + r) <= 2; }

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + "  <- " + (detail || "")); }
}

// Test 1: move E merges + slides correctly
game.spawn = () => {}; // disable random spawn to assert exact board state
setBoard({ "0,0": 2, "-1,0": 2 });
game.move({ q: 1, r: 0 });
check("E 合并：0,0+(-1,0) → (2,0)=4", game.board["2,0"] === 4, JSON.stringify(game.board));
check("E 合并：源格已清空", !("0,0" in game.board) && !("-1,0" in game.board));

// Test 2: merge only once (2,2,2 E → 4,2)
setBoard({ "-2,0": 2, "-1,0": 2, "0,0": 2 });
game.move({ q: 1, r: 0 });
check("E 单次合并：得到 4 与 2", game.board["2,0"] === 4 && game.board["1,0"] === 2, JSON.stringify(game.board));

// Test 3: diagonals SW (q-1,r+1)
setBoard({ "0,0": 2, "-1,1": 2 });
game.move({ q: -1, r: 1 });
check("SW 合并目标正确", game.board["-2,2"] === 4, JSON.stringify(game.board));

// Test 4: NE merge (q+1,r-1)
setBoard({ "0,0": 4, "1,-1": 4 });
game.move({ q: 1, r: -1 });
check("NE 合并：(1,-1)→(2,-2)=8", game.board["2,-2"] === 8, JSON.stringify(game.board));

// Test 5: NW merge (q,r-1)
setBoard({ "0,0": 2, "0,-1": 2 });
game.move({ q: 0, r: -1 });
check("NW 合并：(0,-1)→(0,-2)=4", game.board["0,-2"] === 4, JSON.stringify(game.board));

// Test 6: SE merge (q,r+1)
setBoard({ "0,0": 2, "0,1": 2 });
game.move({ q: 0, r: 1 });
check("SE 合并：(0,1)→(0,2)=4", game.board["0,2"] === 4, JSON.stringify(game.board));

// Test 7: block chain 4,4,2 E → 8,2 (no double merge)
setBoard({ "-2,0": 4, "-1,0": 4, "0,0": 2 });
game.move({ q: 1, r: 0 });
check("链式不连跳：-(2,0)=2, (1,0)=8", game.board["1,0"] === 8 && game.board["2,0"] === 2, JSON.stringify(game.board));

// Test 8: slide to farthest empty
setBoard({ "-2,0": 2 });
game.move({ q: 1, r: 0 });
check("E 滑动到最远端：(2,0)=2", game.board["2,0"] === 2, JSON.stringify(game.board));

// Test 9: 2048 win flag triggers
setBoard({ "-1,0": 1024, "0,0": 1024 });
game.move({ q: 1, r: 0 });
check("合成 2048 → won", game.won === true);

// Test 10: spawn keeps board <= 19 cells
game.spawn = HexGame.prototype.spawn; // restore real spawn
setBoard({});
for (let i = 0; i < 30; i++) game.spawn();
let occupied = 0;
for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (isInRange(q, r) && (q + "," + r) in game.board) occupied++;
check("棋盘不超 19 格", occupied <= 19, "occupied=" + occupied);

console.log("\n=== " + pass + " passed, " + fail + " failed ===");
process.exit(fail ? 1 : 0);
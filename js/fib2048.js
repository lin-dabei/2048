/* =============================================================
   FIBO · 斐波那契 2048
   4×4 棋盘，数字轮廓不是 2 的幂，而是斐波那契数。
   合并规则：相邻两枚若「首尾相接」—— 即 1↔1、或一枚恰为另一枚的
   下一个斐波那契数（1+2→3、2+3→5、3+5→8 …），则合成二者的【和】。
   出生只有 1 与 2。合成 2048（含首个越过它的斐波那契数 2584）即胜。
   引擎独立，动画沿用经典套路（绝对定位 + transform 过渡 + 合体弹跳 + 新生浮现）。
   ============================================================= */
(function () {
  "use strict";

  var SIZE = 4, WIN_VAL = 2048;
  var PAD = 8, GAP = 10;
  // 出生池：1 更常见，2 稍少
  var SPAWN_POOL = [1, 1, 1, 2, 2];
  var _id = 0;

  // 斐波那契序列（足够大即可）: F(1)=1, F(2)=1, F(3)=2 ...
  var FIBS = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946];

  function fibIndex(v) { var i = FIBS.indexOf(v); return i; }

  // 合并判定：1↔1 合成 2；否则 a<b 且 b 恰为 a 的下一个斐波那契 → a+b
  function fibMerge(a, b) {
    if (a === 0 || b === 0) return 0;
    if (a === b) return a === 1 ? 2 : 0;
    var lo = Math.min(a, b), hi = Math.max(a, b);
    var i = fibIndex(lo);
    if (i < 0) return 0;
    return FIBS[i + 1] === hi ? lo + hi : 0;
  }

  // 1 在序列中出现两次，取最后一次出现的位置 → next(1)=2
  function fibIndex(v) {
    var last = -1;
    for (var i = 0; i < FIBS.length; i++) { if (FIBS[i] === v) last = i; }
    return last;
  }

  function empty() { var g = []; for (var r = 0; r < SIZE; r++) g.push([null, null, null, null]); return g; }
  function newT(v) { return { v: v, id: ++_id }; }
  function emptyCells(g) { var o = []; for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (!g[r][c]) o.push({ r: r, c: c }); return o; }
  function maxVal(g) { var m = 0; for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (g[r][c] && g[r][c].v > m) m = g[r][c].v; return m; }
  function clone(g) { return g.map(function (row) { return row.slice(); }); }

  // 数字越大越接近暖金色（按在斐波那契序列中的位置取色）
  var PALETTE = [
    [0xee, 0xe4, 0xda], [0xed, 0xe0, 0xc8], [0xf2, 0xb1, 0x79], [0xf5, 0x95, 0x63],
    [0xf6, 0x7c, 0x5f], [0xf6, 0x5e, 0x3b], [0xed, 0xcf, 0x72], [0xed, 0xcc, 0x61],
    [0xed, 0xc8, 0x50], [0xed, 0xc5, 0x3f], [0xed, 0xc2, 0x2e], [0xf0, 0xa9, 0x3a]
  ];
  function rgb(v) { return "rgb(" + v[0] + "," + v[1] + "," + v[2] + ")"; }
  function fibPalette(v) {
    var i = fibIndex(v);
    if (i < 0) i = Math.min(PALETTE.length - 1, Math.floor(PALETTE.length * 0.7));
    var bg = PALETTE[Math.min(PALETTE.length - 1, Math.max(0, i))];
    if (v > 2584) {
      var gold = [0xf0, 0xa9, 0x3a];
      var t = Math.min(0.65, (v - 2584) / 2584);
      bg = [Math.round(bg[0] + (gold[0] - bg[0]) * t), Math.round(bg[1] + (gold[1] - bg[1]) * t), Math.round(bg[2] + (gold[2] - bg[2]) * t)];
    }
    var bright = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) > 200;
    return { bg: rgb(bg), fg: bright ? "#776e65" : "#f9f6f2" };
  }

  function FiboGame(elBoard) {
    this.elBoard = elBoard;
    this.elScore = document.getElementById("fb-score");
    this.elBest = document.getElementById("fb-best");
    this.elMsg = document.getElementById("fb-msg");
    this.g = empty();
    this.score = 0;
    this.best = parseInt(localStorage.getItem("fib-best") || "0", 10);
    this.over = false; this.won = false; this.keep = false;
    this.moves = null;   // 本步移动/合成动画数据
    this.fresh = null;
    this.cellW = 0; this.cellH = 0;

    this.spawn(); this.spawn();
    this.render(true);
    this.bind();
  }

  FiboGame.prototype.spawn = function () {
    var cells = emptyCells(this.g);
    if (!cells.length) return;
    var p = cells[Math.floor(Math.random() * cells.length)];
    var v = SPAWN_POOL[Math.floor(Math.random() * SPAWN_POOL.length)];
    this.g[p.r][p.c] = newT(v);
  };

  FiboGame.prototype.move = function (dir) {
    if (this.over || (this.won && !this.keep)) return;
    var axis = (dir === 0 || dir === 2) ? 1 : 0;      // 竖/横
    var forward = (dir === 1 || dir === 2) ? -1 : 1;  // i=0 为目标端
    var g = clone(this.g);
    var res = this.collapseAll(g, axis, forward);
    if (!res.moved) return;
    this.g = g;
    this.moves = res.moves;
    this.score += res.gain;

    this.spawn();
    if (window.Sound) { window.Sound.move(); if (res.merges > 0) window.Sound.merge(); }

    if (maxVal(this.g) >= WIN_VAL && !this.won) this.won = true;
    if (!this.canMove()) this.over = true;

    if (this.score > this.best) { this.best = this.score; localStorage.setItem("fib-best", String(this.best)); }
    this.render();
    this.announce();
  };

  FiboGame.prototype.canMove = function () {
    if (emptyCells(this.g).length) return true;
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      var t = this.g[r][c];
      if (!t) continue;
      var d = [[0, 1], [1, 0]];
      for (var k = 0; k < 2; k++) {
        var rr = r + d[k][0], cc = c + d[k][1];
        if (rr < SIZE && cc < SIZE && this.g[rr][cc]) {
          if (fibMerge(t.v, this.g[rr][cc].v) > 0) return true;
        }
      }
    }
    return false;
  };

  FiboGame.prototype.collapseAll = function (g, axis, forward) {
    var moves = [], gain = 0, merges = 0, moved = false, lane;
    function coord(i) { return axis === 1 ? [(forward === 1 ? i : SIZE - 1 - i), lane] : [lane, (forward === 1 ? i : SIZE - 1 - i)]; }
    for (lane = 0; lane < SIZE; lane++) {
      var entries = [];
      for (var i = 0; i < SIZE; i++) { var rc = coord(i); if (g[rc[0]][rc[1]]) entries.push({ t: g[rc[0]][rc[1]], r: rc[0], c: rc[1] }); }
      // 滑行合并（i=0 为目标端）
      var out = [], j = 0;
      var mergedIdx = -1; // 一格只参与一次合成
      while (j < entries.length) {
        if (j + 1 < entries.length && j + 1 !== mergedIdx + 1) {
          var mv = fibMerge(entries[j].t.v, entries[j + 1].t.v);
          if (mv > 0) {
            var a = entries[j], b = entries[j + 1];
            var vt = newT(mv);
            out.push({ v: mv, id: vt.id, fromR: a.r, fromC: a.c, merge: true });
            gain += mv; merges++; moved = true;
            mergedIdx = j + 1;
            j += 2;
            continue;
          }
        }
        var e = entries[j];
        out.push({ v: e.t.v, id: e.t.id, fromR: e.r, fromC: e.c, merge: false });
        j++;
      }
      for (var m = 0; m < SIZE; m++) { var c2 = coord(m); g[c2[0]][c2[1]] = null; }
      for (var k = 0; k < out.length; k++) {
        var c3 = coord(k);
        g[c3[0]][c3[1]] = { v: out[k].v, id: out[k].id };
        if (!out[k].merge && (out[k].fromR !== c3[0] || out[k].fromC !== c3[1])) moved = true;
        moves.push({ fromR: out[k].fromR, fromC: out[k].fromC, toR: c3[0], toC: c3[1], v: out[k].v, merge: out[k].merge });
      }
    }
    return { moved: moved, gain: gain, merges: merges, moves: moves };
  };

  FiboGame.prototype.announce = function () {
    if (this.over) this.say("斐波那契之环闭合 · 无路可走", false);
    else if (this.won && !this.keep) this.say('抵达 <b>2048</b>，黄金螺旋尽显！<button class="grv-act" data-a="keep">续攀</button><button class="grv-act" data-a="new">重开</button>', true);
    else if (this.elMsg) this.elMsg.style.display = "none";
  };
  FiboGame.prototype.say = function (html, acts) {
    this.elMsg.innerHTML = html; this.elMsg.style.display = "block";
    var self = this;
    if (acts) this.elMsg.querySelectorAll("[data-a]").forEach(function (b) {
      b.addEventListener("click", function () { if (b.getAttribute("data-a") === "keep") self.keep = true; self.restart(); });
    });
  };

  FiboGame.prototype.restart = function () {
    this.g = empty(); this.score = 0; this.won = false; this.over = false; this.keep = false;
    this.moves = null; this.fresh = null;
    if (this.elMsg) this.elMsg.style.display = "none";
    this.spawn(); this.spawn(); this.render(true);
  };

  // ---------- 渲染（绝对定位 + transform 动画，参照经典） ----------
  FiboGame.prototype.measure = function () {
    var w = this.elBoard.clientWidth || 260;
    this.cellW = (w - 2 * PAD - 3 * GAP) / 4;
    this.cellH = this.cellW;
  };
  FiboGame.prototype.render = function (initial) {
    this.elScore.textContent = this.score;
    this.elBest.textContent = this.best;
    this.measure();
    this.elBoard.innerHTML = "";
    var self = this;
    var start = {};
    if (this.moves) this.moves.forEach(function (m) { start[m.toR + "," + m.toC] = m; });
    if (this.fresh) { var f = this.fresh; if (!start[f.r + "," + f.c]) start[f.r + "," + f.c] = { fromR: 0, fromC: f.c, fresh: true }; }

    for (var i = 0; i < 16; i++) {
      var bg = document.createElement("div");
      bg.className = "fbbg";
      bg.style.left = (PAD + (i % 4) * (this.cellW + GAP)) + "px";
      bg.style.top = (PAD + Math.floor(i / 4) * (this.cellH + GAP)) + "px";
      bg.style.width = this.cellW + "px"; bg.style.height = this.cellH + "px";
      this.elBoard.appendChild(bg);
    }

    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      var t = this.g[r][c];
      if (!t) continue;
      var st = start[r + "," + c] || { fromR: r, fromC: c };
      var pal = fibPalette(t.v);
      var cell = document.createElement("div");
      cell.className = "fbtile";
      cell.textContent = t.v;
      cell.style.left = (PAD + c * (this.cellW + GAP)) + "px";
      cell.style.top = (PAD + r * (this.cellH + GAP)) + "px";
      cell.style.width = this.cellW + "px"; cell.style.height = this.cellH + "px";
      cell.style.background = pal.bg;
      cell.style.color = pal.fg;
      if (t.v > 2584) cell.style.boxShadow = "0 0 20px rgba(240,169,58,0.5)";
      // 字号随数字增大而缩小
      if (t.v < 100) cell.style.fontSize = "clamp(20px,6vw,30px)";
      else if (t.v < 1000) cell.style.fontSize = "clamp(15px,4.5vw,22px)";
      else cell.style.fontSize = "clamp(11px,3.4vw,18px)";
      var dx = (st.fromC - c) * this.cellW, dy = (st.fromR - r) * this.cellH;
      if (st.merge) {
        cell.className += " fb-pop";
      } else if (dx !== 0 || dy !== 0) {
        cell.className += " fb-slide";
        cell.style.transform = "translate(" + dx + "px," + dy + "px)";
      } else if (!initial) {
        cell.className += " fb-static";
      }
      this.elBoard.appendChild(cell);
    }
    void this.elBoard.offsetHeight;
    window.requestAnimationFrame(function () {
      var els = self.elBoard.querySelectorAll(".fb-slide");
      for (var k = 0; k < els.length; k++) els[k].style.transform = "translate(0,0)";
    });
    this.moves = null; this.fresh = null;
  };

  FiboGame.prototype.bind = function () {
    var self = this;
    var KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
    window.addEventListener("keydown", function (e) {
      var d = KEYS[e.code];
      if (d === undefined) return;
      e.preventDefault(); self.move(d);
    });
    if (window.bindSwipe) window.bindSwipe(this.elBoard, function (d) { self.move(d); });
  };

  window.FiboGame = FiboGame;
  window.fibMerge = fibMerge;   // 供无头校验
})();
/*
 * Wool Sort — pure rules engine (shared by the browser and tools/gen.js).
 *
 * A level is a set of wooden spools. Each spool holds a stack of wool bands
 * (bottom → top). You can pull the top run of same-coloured bands off one
 * spool and wind it onto another spool whose top band matches (or that is
 * empty), as many as fit.
 *
 * THE TWIST — knit-away: the moment one spool holds EVERY band of a colour,
 * Mochi knits that colour into the scarf and the spool comes back empty.
 * Finished colours leave the board instead of clogging it, so levels are
 * built tighter (fewer spare spools, mixed spool sizes, short strands).
 * A level is won when every spool is empty and the scarf is complete.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WoolEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Sesame-style saturated palette shared with Wool Flow.
  var PALETTE = [
    { name: 'Rose',   hex: '#ff5fa2' },
    { name: 'Sky',    hex: '#1f75fe' },
    { name: 'Butter', hex: '#ffd23f' },
    { name: 'Mint',   hex: '#3cb44b' },
    { name: 'Tangerine', hex: '#ff7f11' },
    { name: 'Plum',   hex: '#7b2cbf' },
    { name: 'Cherry', hex: '#e4002b' },
    { name: 'Lagoon', hex: '#12b5c6' },
    { name: 'Cocoa',  hex: '#8d5524' },
    { name: 'Lilac',  hex: '#b388ff' },
    { name: 'Lime',   hex: '#9acd32' },
    { name: 'Slate',  hex: '#5c6b7a' },
    { name: 'Navy',   hex: '#22318f' },
    { name: 'Forest', hex: '#1b6b3a' }
  ];

  function topRun(spool) {
    var n = spool.length;
    if (!n) return { color: -1, count: 0 };
    var c = spool[n - 1], k = 1;
    for (var i = n - 2; i >= 0 && spool[i] === c; i--) k++;
    return { color: c, count: k };
  }

  function isUniform(spool) {
    for (var i = 1; i < spool.length; i++) if (spool[i] !== spool[0]) return false;
    return true;
  }

  function countTotals(spools) {
    var totals = {};
    spools.forEach(function (s) { s.forEach(function (c) { totals[c] = (totals[c] || 0) + 1; }); });
    return totals;
  }

  /** Build a fresh play state from a level definition. */
  function newState(level) {
    var spools = level.spools.map(function (s) { return s.slice(); });
    var caps = level.caps ? level.caps.slice() : spools.map(function () { return level.cap || 4; });
    var st = {
      spools: spools,
      caps: caps,
      totals: countTotals(spools),
      knitted: [],
      moves: 0,
      hidden: spools.map(function (s) {
        return s.map(function (_, j) { return !!level.hidden && j < s.length - 1; });
      })
    };
    return st;
  }

  function cloneState(st) {
    return {
      spools: st.spools.map(function (s) { return s.slice(); }),
      caps: st.caps.slice(),
      totals: st.totals,
      knitted: st.knitted.slice(),
      moves: st.moves,
      hidden: st.hidden ? st.hidden.map(function (h) { return h.slice(); }) : null
    };
  }

  /** Lightweight solver state (no hidden bookkeeping). */
  function liteState(st) {
    return { spools: st.spools.map(function (s) { return s.slice(); }), caps: st.caps, totals: st.totals, knitted: [], moves: 0, hidden: null };
  }
  function encode(st) { return st.spools.map(function (s) { return s.join(','); }).join('|'); }
  function decode(str, caps, totals) {
    return {
      spools: str.split('|').map(function (p) { return p === '' ? [] : p.split(',').map(Number); }),
      caps: caps, totals: totals, knitted: [], moves: 0, hidden: null
    };
  }

  function canMove(st, a, b) {
    if (a === b) return false;
    var A = st.spools[a], B = st.spools[b];
    if (!A || !B || !A.length) return false;
    if (B.length >= st.caps[b]) return false;
    var ta = A[A.length - 1];
    if (B.length && B[B.length - 1] !== ta) return false;
    return true;
  }

  /** How many bands would move from a to b (0 if illegal). */
  function moveCount(st, a, b) {
    if (!canMove(st, a, b)) return 0;
    var run = topRun(st.spools[a]);
    return Math.min(run.count, st.caps[b] - st.spools[b].length);
  }

  /**
   * Apply a move in place. Returns { moved, color, knitted } where knitted is
   * the colour that was knitted away (or -1).
   */
  function applyMove(st, a, b) {
    var n = moveCount(st, a, b);
    if (!n) return null;
    var A = st.spools[a], B = st.spools[b];
    var HA = st.hidden ? st.hidden[a] : null, HB = st.hidden ? st.hidden[b] : null;
    var color = A[A.length - 1];
    for (var i = 0; i < n; i++) { A.pop(); B.push(color); if (HA) { HA.pop(); HB.push(false); } }
    if (HA && HA.length) HA[HA.length - 1] = false; // newly exposed band is revealed
    st.moves++;
    var knitted = -1;
    if (B.length === st.totals[color] && isUniform(B)) {
      st.knitted.push(color);
      st.spools[b] = [];
      if (st.hidden) st.hidden[b] = [];
      knitted = color;
    }
    return { moved: n, color: color, knitted: knitted };
  }

  function isWon(st) {
    for (var i = 0; i < st.spools.length; i++) if (st.spools[i].length) return false;
    return true;
  }

  /**
   * Legal moves. With prune=true, drops moves that can never help:
   *  - relocating a uniform spool onto an empty spool that is not bigger.
   */
  function legalMoves(st, prune) {
    var res = [];
    for (var a = 0; a < st.spools.length; a++) {
      var A = st.spools[a];
      if (!A.length) continue;
      var run = topRun(A);
      var uniformA = run.count === A.length;
      for (var b = 0; b < st.spools.length; b++) {
        if (a === b) continue;
        if (!canMove(st, a, b)) continue;
        var B = st.spools[b];
        if (prune !== false) {
          if (!B.length && uniformA && st.caps[b] <= st.caps[a]) continue;
          if (!B.length && uniformA && st.totals[run.color] > st.caps[b]) continue;
        }
        res.push([a, b]);
      }
    }
    return res;
  }

  function hasUsefulMove(st) { return legalMoves(st, true).length > 0; }

  /** Canonical key: spools are interchangeable, so sort them. */
  function stateKey(st) {
    var parts = new Array(st.spools.length);
    for (var i = 0; i < st.spools.length; i++) parts[i] = st.caps[i] + ':' + st.spools[i].join(',');
    parts.sort();
    return parts.join('|');
  }

  // Move ordering heuristic for the DFS: knits first, then merges, then empties.
  function scoreMove(st, m) {
    var A = st.spools[m[0]], B = st.spools[m[1]];
    var run = topRun(A);
    var n = Math.min(run.count, st.caps[m[1]] - B.length);
    var s = 0;
    if (B.length && B.length + n === st.totals[run.color] && isUniform(B)) s += 100; // knit
    if (B.length) s += 20 + B.length * 2; // consolidate onto a matching spool
    if (n === run.count) s += 10; // move the whole run
    if (run.count === A.length) s -= 15; // moving a uniform spool around
    if (!B.length) s -= 5;
    return s;
  }

  /**
   * Breadth-first search for the SHORTEST solution. Returns an array of
   * [from,to] moves, or null if none found within maxNodes. States are kept
   * as compact strings so millions of nodes fit in memory.
   */
  function solveBFS(st0, maxNodes) {
    maxNodes = maxNodes || 1500000;
    var start = liteState(st0);
    if (isWon(start)) return [];
    var caps = start.caps, totals = start.totals;
    var parent = new Map();
    parent.set(stateKey(start), null);
    var queue = [encode(start)], qi = 0, explored = 0;
    while (qi < queue.length) {
      var cur = queue[qi++];
      var st = decode(cur, caps, totals);
      var moves = legalMoves(st, true);
      for (var i = 0; i < moves.length; i++) {
        var nx = decode(cur, caps, totals);
        applyMove(nx, moves[i][0], moves[i][1]);
        var k = stateKey(nx);
        if (parent.has(k)) continue;
        parent.set(k, { prev: cur, move: moves[i] });
        explored++;
        if (isWon(nx)) return reconstruct(parent, k, caps, totals);
        if (explored > maxNodes) return null;
        queue.push(encode(nx));
      }
    }
    return null;
  }

  function reconstruct(parent, k, caps, totals) {
    var path = [];
    var node = parent.get(k);
    while (node) { path.push(node.move); node = parent.get(stateKey(decode(node.prev, caps, totals))); }
    return path.reverse();
  }

  /**
   * Depth-first search for ANY solution, quickly. Used for in-game hints.
   * Returns the move list or null.
   */
  function solveDFS(st0, maxNodes, rng) {
    maxNodes = maxNodes || 200000;
    var start = liteState(st0);
    if (isWon(start)) return [];
    var visited = new Set([stateKey(start)]);
    var stack = [{ st: start, moves: null, i: 0 }];
    var path = [];
    var explored = 0;
    while (stack.length) {
      var top = stack[stack.length - 1];
      if (!top.moves) {
        var ms = legalMoves(top.st, true);
        var scored = ms.map(function (m) { return { m: m, s: scoreMove(top.st, m) + (rng ? rng() * 12 : 0) }; });
        scored.sort(function (x, y) { return y.s - x.s; });
        top.moves = scored.map(function (x) { return x.m; });
      }
      if (top.i >= top.moves.length) { stack.pop(); path.pop(); continue; }
      var mv = top.moves[top.i++];
      var nx = cloneState(top.st);
      applyMove(nx, mv[0], mv[1]);
      var key = stateKey(nx);
      if (visited.has(key)) continue;
      visited.add(key);
      explored++;
      if (explored > maxNodes) return null;
      path.push(mv);
      if (isWon(nx)) { var out = path.slice(); out.nodes = explored; return out; }
      stack.push({ st: nx, moves: null, i: 0 });
    }
    return null;
  }

  /**
   * Admissible heuristic: every colour split into r runs needs at least r-1
   * moves to gather (a move transfers a single run of a single colour).
   */
  function heuristic(st) {
    var runs = {};
    for (var i = 0; i < st.spools.length; i++) {
      var s = st.spools[i];
      for (var j = 0; j < s.length; j++) if (j === 0 || s[j] !== s[j - 1]) runs[s[j]] = (runs[s[j]] || 0) + 1;
    }
    var h = 0;
    for (var c in runs) h += runs[c] - 1;
    return h;
  }

  // tiny binary heap on [f, g, str]
  function heapPush(h, item) {
    h.push(item); var i = h.length - 1;
    while (i > 0) { var p = (i - 1) >> 1; if (cmp(h[i], h[p]) >= 0) break; var t = h[i]; h[i] = h[p]; h[p] = t; i = p; }
  }
  function heapPop(h) {
    var top = h[0], last = h.pop();
    if (h.length) { h[0] = last; var i = 0, n = h.length;
      for (;;) { var l = 2 * i + 1, r = l + 1, m = i;
        if (l < n && cmp(h[l], h[m]) < 0) m = l; if (r < n && cmp(h[r], h[m]) < 0) m = r;
        if (m === i) break; var t = h[i]; h[i] = h[m]; h[m] = t; i = m; } }
    return top;
  }
  function cmp(a, b) { return a[0] - b[0] || b[1] - a[1]; } // lower f first, deeper first on ties

  /**
   * A* search for the SHORTEST solution (heuristic is consistent, so the first
   * goal popped is optimal). Far fewer nodes than BFS on big boards.
   */
  function solveAStar(st0, maxNodes) {
    maxNodes = maxNodes || 1500000;
    var start = liteState(st0);
    if (isWon(start)) return [];
    var caps = start.caps, totals = start.totals;
    var best = new Map(), parent = new Map();
    var k0 = stateKey(start);
    best.set(k0, 0); parent.set(k0, null);
    var heap = [[heuristic(start), 0, encode(start)]], explored = 0;
    while (heap.length) {
      var node = heapPop(heap);
      var g = node[1], cur = node[2];
      var st = decode(cur, caps, totals);
      var key = stateKey(st);
      if (best.get(key) < g) continue; // stale entry
      if (isWon(st)) { var sol = reconstruct(parent, key, caps, totals); sol.nodes = explored; return sol; }
      var moves = legalMoves(st, true);
      for (var i = 0; i < moves.length; i++) {
        var nx = decode(cur, caps, totals);
        applyMove(nx, moves[i][0], moves[i][1]);
        var k = stateKey(nx), g2 = g + 1;
        if (best.has(k) && best.get(k) <= g2) continue;
        best.set(k, g2); parent.set(k, { prev: cur, move: moves[i] });
        heapPush(heap, [g2 + heuristic(nx), g2, encode(nx)]);
        if (++explored > maxNodes) return null;
      }
    }
    return null;
  }

  /** Fraction of random playouts (pruned legal moves) that win. */
  function randomPlayRate(level, trials, rng) {
    rng = rng || Math.random;
    var wins = 0;
    for (var t = 0; t < trials; t++) {
      var st = newState(level);
      for (var step = 0; step < 400; step++) {
        if (isWon(st)) { wins++; break; }
        var ms = legalMoves(st, true);
        if (!ms.length) break;
        var m = ms[Math.floor(rng() * ms.length)];
        applyMove(st, m[0], m[1]);
      }
    }
    return wins / trials;
  }

  return {
    PALETTE: PALETTE,
    topRun: topRun,
    isUniform: isUniform,
    newState: newState,
    cloneState: cloneState,
    canMove: canMove,
    moveCount: moveCount,
    applyMove: applyMove,
    isWon: isWon,
    legalMoves: legalMoves,
    hasUsefulMove: hasUsefulMove,
    stateKey: stateKey,
    solveBFS: solveBFS,
    solveAStar: solveAStar,
    solveDFS: solveDFS,
    heuristic: heuristic,
    randomPlayRate: randomPlayRate
  };
});

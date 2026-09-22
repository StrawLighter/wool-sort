#!/usr/bin/env node
/*
 * Wool Sort level generator.
 *
 *   node tools/gen.js          # rebuild js/levels.js from the SPECS below
 *   node tools/gen.js --check  # re-verify every level in js/levels.js
 *
 * For each spec it deals the wool bands into spools at random (seeded), keeps
 * only boards the solver can finish, measures how often random play wins,
 * picks the seed whose win rate best matches the target band, and stores the
 * shortest solution (par) with the level.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../js/engine.js');

const SPECS = [
  { id: 1,  name: 'First Stitch',        colors: 3, empties: 2, target: [0.9, 1.0] },
  { id: 2,  name: 'Two by Two',          colors: 4, empties: 2, target: [0.6, 0.85] },
  { id: 3,  name: 'Loose Ends',          colors: 5, empties: 2, target: [0.45, 0.6] },
  { id: 4,  name: 'Tight Knit',          colors: 5, empties: 1, target: [0.3, 0.45] },
  { id: 5,  name: 'Short Strand',        colors: 6, empties: 1, shorts: 1, target: [0.25, 0.36] },
  { id: 6,  name: 'Little Bobbin',       colors: 6, empties: 1, smalls: [2], target: [0.18, 0.3] },
  { id: 7,  name: 'Seven Skeins',        colors: 7, empties: 1, target: [0.12, 0.22] },
  { id: 8,  name: 'Fuzzy Logic',         colors: 7, empties: 1, hidden: true, target: [0.1, 0.2] },
  { id: 9,  name: 'Bobbin & Weave',      colors: 8, empties: 1, smalls: [2], shorts: 1, target: [0.05, 0.12] },
  { id: 10, name: "Mochi's Masterpiece", colors: 9, empties: 1, hidden: true, target: [0.02, 0.08] }
];

const SEEDS_PER_LEVEL = 64;
const RATE_TRIALS = 300;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deal(spec, seed) {
  const rng = mulberry32(seed * 7919 + spec.id * 104729);
  const cap = 4;
  const bands = [];
  const shorts = spec.shorts || 0;
  for (let c = 0; c < spec.colors; c++) {
    const n = c >= spec.colors - shorts ? 3 : cap; // last colours are short strands
    for (let i = 0; i < n; i++) bands.push(c);
  }
  // Fisher-Yates
  for (let i = bands.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bands[i], bands[j]] = [bands[j], bands[i]];
  }
  const spools = [];
  for (let i = 0; i < bands.length; i += cap) spools.push(bands.slice(i, i + cap));
  const caps = spools.map(() => cap);
  for (let i = 0; i < (spec.empties || 0); i++) { spools.push([]); caps.push(cap); }
  (spec.smalls || []).forEach(s => { spools.push([]); caps.push(s); });
  const level = { id: spec.id, name: spec.name, cap, caps, spools, hidden: !!spec.hidden };
  // reject boring starts: a spool that is already uniform with 2+ bands
  const totals = {};
  bands.forEach(c => { totals[c] = (totals[c] || 0) + 1; });
  for (const s of spools) {
    if (s.length >= 2 && E.isUniform(s)) return null;
  }
  // reject if any colour already has its whole strand on one spool (would knit instantly)
  for (const s of spools) {
    const run = E.topRun(s);
    if (s.length && s.length === totals[run.color] && E.isUniform(s)) return null;
  }
  // reject if there is no legal first move that is not into an empty spool... keep it playable
  return level;
}

function build(spec) {
  const cands = [];
  for (let seed = 1; seed <= SEEDS_PER_LEVEL; seed++) {
    const level = deal(spec, seed);
    if (!level) continue;
    const st = E.newState(level);
    const dfs = E.solveDFS(st, 400000);
    if (!dfs) continue;
    const rate = E.randomPlayRate(level, RATE_TRIALS, mulberry32(seed + 13));
    cands.push({ seed, level, rate, dfsLen: dfs.length });
  }
  if (!cands.length) throw new Error('no solvable deal for level ' + spec.id);
  const [lo, hi] = spec.target;
  const inBand = cands.filter(c => c.rate >= lo && c.rate <= hi);
  let pick;
  if (inBand.length) {
    // hardest-looking board inside the band (lowest random win rate), tie → longer DFS
    inBand.sort((a, b) => a.rate - b.rate || b.dfsLen - a.dfsLen);
    pick = inBand[0];
  } else {
    const mid = (lo + hi) / 2;
    cands.sort((a, b) => Math.abs(a.rate - mid) - Math.abs(b.rate - mid));
    pick = cands[0];
    console.warn(`  level ${spec.id}: no seed in band [${lo},${hi}], closest rate ${pick.rate.toFixed(2)}`);
  }
  const st = E.newState(pick.level);
  const t0 = Date.now();
  let solution = E.solveBFS(st, 3000000);
  let exact = true;
  if (!solution) { solution = E.solveDFS(st, 2000000); exact = false; }
  const par = solution.length;
  console.log(`  L${spec.id} ${spec.name}: seed ${pick.seed}, colours ${spec.colors}, spools ${pick.level.spools.length}, ` +
    `random win ${(pick.rate * 100).toFixed(0)}%, par ${par}${exact ? '' : ' (dfs)'} in ${Date.now() - t0}ms, ` +
    `${cands.length} solvable seeds`);
  return Object.assign({}, pick.level, { seed: pick.seed, rate: +pick.rate.toFixed(3), par, parExact: exact, solution });
}

function verify(levels) {
  let ok = true;
  for (const lv of levels) {
    const st = E.newState(lv);
    for (const [a, b] of lv.solution) {
      if (!E.applyMove(st, a, b)) { console.error(`L${lv.id}: illegal stored move ${a}->${b}`); ok = false; break; }
    }
    if (!E.isWon(st)) { console.error(`L${lv.id}: stored solution does not win`); ok = false; }
    else console.log(`L${lv.id} ${lv.name}: OK (${lv.solution.length} moves)`);
  }
  return ok;
}

function main() {
  const out = path.join(__dirname, '..', 'js', 'levels.js');
  if (process.argv.includes('--check')) {
    const levels = require(out);
    process.exit(verify(levels) ? 0 : 1);
  }
  console.log('Generating levels…');
  const levels = SPECS.map(build);
  if (!verify(levels)) process.exit(1);
  const src = '/* GENERATED by tools/gen.js — do not edit by hand. */\n' +
    'var LEVELS = ' + JSON.stringify(levels.map(l => ({
      id: l.id, name: l.name, cap: l.cap, caps: l.caps, spools: l.spools, hidden: l.hidden,
      seed: l.seed, rate: l.rate, par: l.par, parExact: l.parExact, solution: l.solution
    }))) + ';\n' +
    "if (typeof module === 'object' && module.exports) module.exports = LEVELS;\n";
  fs.writeFileSync(out, src);
  console.log('wrote', out);
}

main();

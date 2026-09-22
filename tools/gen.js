#!/usr/bin/env node
/*
 * Wool Sort level generator (100 levels).
 *
 *   node tools/gen.js                 # regenerate levels 11-100, keep 1-10 from js/levels.js
 *   node tools/gen.js --range 41-60   # regenerate only that range, keep the rest
 *   node tools/gen.js --all           # regenerate everything
 *   node tools/gen.js --check         # re-verify every stored solution
 *   node tools/gen.js --table         # print the level table (markdown) from js/levels.js
 *
 * Levels 1-10 are hand-tuned specs; 11-100 follow a procedural progression
 * modelled on the original water-sort games: colours and spools grow
 * steadily, spare spools shrink, and every decade has the same rhythm —
 * a breather, plain boards, a short strand, a little bobbin, a fuzzy
 * (hidden-colour) board, and a HARD finale on every 10th level.
 *
 * For each spec the generator deals the wool at random (seeded), keeps only
 * boards the DFS solver can finish, measures how often random play wins,
 * picks the seed that best matches the target band (hardest first), and
 * stores the exact shortest solution from the A* solver as par.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const E = require('../js/engine.js');

const OUT = path.join(__dirname, '..', 'js', 'levels.js');
const TOTAL = 100;
const SEEDS_PER_LEVEL = 40;
const MAX_COLORS = 12;

// ---------------- hand-tuned opening ----------------
const HAND = [
  { id: 1,  name: 'First Stitch',        colors: 3, empties: 2, target: [0.9, 1.0] },
  { id: 2,  name: 'Two by Two',          colors: 4, empties: 2, target: [0.6, 0.85] },
  { id: 3,  name: 'Loose Ends',          colors: 5, empties: 2, target: [0.45, 0.6] },
  { id: 4,  name: 'Tight Knit',          colors: 5, empties: 1, target: [0.3, 0.45] },
  { id: 5,  name: 'Short Strand',        colors: 6, empties: 1, shorts: 1, target: [0.25, 0.36] },
  { id: 6,  name: 'Little Bobbin',       colors: 6, empties: 1, smalls: [2], target: [0.18, 0.3] },
  { id: 7,  name: 'Seven Skeins',        colors: 7, empties: 1, target: [0.12, 0.22] },
  { id: 8,  name: 'Fuzzy Logic',         colors: 7, empties: 1, hidden: true, target: [0.1, 0.2] },
  { id: 9,  name: 'Bobbin & Weave',      colors: 8, empties: 1, smalls: [2], shorts: 1, target: [0.05, 0.12] },
  { id: 10, name: "Mochi's Masterpiece", colors: 9, empties: 1, hidden: true, hard: true, target: [0.02, 0.08] }
];

// ---------------- names for 11-100 ----------------
const NAMES = [
  'Casting On', 'Purl One', 'Knit Two', 'Slip Stitch', 'Garter Row', 'Yarn Over', 'Moth in the Wool', 'Fuzzy Slippers', 'Wound Tight', 'Dropped Stitch',
  'Rib Stitch', 'Seed Stitch', 'Loose Thread', 'Wee Bobbin', 'Cosy Corner', 'Twisted Yarn', 'Mystery Skein', 'Odd Bobbin', 'Bramble Wool', 'Cable Knot',
  'Tea Break', 'Double Knit', 'Frayed Ends', 'Cotton Reel', 'Nap Time', 'Herringbone', 'Hidden Hank', 'Shuttle & Spool', 'Tangle Tuesday', 'Cable Knit',
  'Fresh Fleece', 'Basket Weave', 'Snipped Short', 'Tiny Reel', 'Lamp Light', 'Cross Stitch', 'Foggy Fleece', 'Bobbin Lace', 'Long Night', 'Fair Isle',
  'Sunday Skein', 'Lace Panel', 'Short Row', 'Thimble', "Mochi's Nap", 'Stockinette', 'Fuzzy Mittens', 'Spindle & Spool', 'Late Stitches', 'Double Points',
  'Warm Up', 'Chevron', 'Loose Loop', 'Mini Bobbin', 'Fireside', 'Zigzag Rib', 'Wool Mist', 'Reel & Remnant', 'Knotty', 'Tangled Skeins',
  'Morning Yarn', 'Diamond Rib', 'Odd Length', 'Bobbin Jar', 'Cushion Pile', 'Honeycomb', 'Lost Colour', 'Spare Reel', 'Thick Wool', 'Moth Holes',
  'Wide Awake', 'Trellis', 'Cut Strand', 'Dinky Bobbin', 'Purring Along', 'Braided Cable', 'Foggy Night', 'Bobbin Pair', 'Endless Row', 'Aran Sweater',
  'Last Light', 'Twelve Skeins', 'Short & Sweet', 'Smallest Bobbin', 'Whiskers', 'Master Rib', 'Blind Knit', 'Reel Trouble', 'Ninety-Nine Stitches', 'The Grand Scarf'
];

/** Procedural spec for levels 11..100. */
function specFor(id) {
  if (id <= 10) return HAND[id - 1];
  const decade = Math.floor((id - 1) / 10); // 1 = 11-20 … 9 = 91-100
  const pos = id % 10;                      // 1..9, 0 = decade finale
  const base = [0, 5, 6, 7, 8, 9, 9, 10, 11, 12][decade];
  let colors = Math.min(MAX_COLORS, base + (pos >= 6 || pos === 0 ? 1 : 0));
  const spec = { id, name: NAMES[id - 11], colors, empties: 1 };
  switch (pos) {
    case 1: spec.empties = 2; break;                                   // breather
    case 2: break;
    case 3: spec.shorts = 1; break;                                    // short strand
    case 4: spec.smalls = [2]; break;                                  // little bobbin
    case 5: spec.empties = 2; if (decade >= 3) spec.hidden = true; break;
    case 6: break;
    case 7: spec.hidden = true; break;                                 // fuzzy wool
    case 8: spec.smalls = [3]; spec.shorts = 1; break;                 // bobbin + short
    case 9: if (decade >= 5) spec.smalls = [2]; break;
    case 0: spec.hard = true; spec.hidden = true; if (decade >= 4) spec.smalls = [2]; break;
  }
  const bands = { 1: [0.18, 0.45], 2: [0.1, 0.3], 3: [0.05, 0.2], 4: [0.02, 0.12], 5: [0.01, 0.08], 6: [0, 0.05], 7: [0, 0.04], 8: [0, 0.03], 9: [0, 0.02] };
  const b = bands[decade].slice();
  if (spec.empties === 2) b[1] = Math.min(1, b[1] * 1.8 + 0.05); // breathers may be easier
  spec.target = b;
  return spec;
}

// ---------------- dealing ----------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deal(spec, seed, empties) {
  const rng = mulberry32(seed * 7919 + spec.id * 104729);
  const cap = 4;
  const bands = [];
  const shorts = spec.shorts || 0;
  for (let c = 0; c < spec.colors; c++) {
    const n = c >= spec.colors - shorts ? 3 : cap; // last colours are short strands
    for (let i = 0; i < n; i++) bands.push(c);
  }
  for (let i = bands.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bands[i], bands[j]] = [bands[j], bands[i]];
  }
  const spools = [];
  for (let i = 0; i < bands.length; i += cap) spools.push(bands.slice(i, i + cap));
  const caps = spools.map(() => cap);
  for (let i = 0; i < empties; i++) { spools.push([]); caps.push(cap); }
  (spec.smalls || []).forEach(s => { spools.push([]); caps.push(s); });
  const level = { id: spec.id, name: spec.name, cap, caps, spools, hidden: !!spec.hidden };
  if (spec.hard) level.hard = true;
  const totals = {};
  bands.forEach(c => { totals[c] = (totals[c] || 0) + 1; });
  for (const s of spools) if (s.length >= 2 && E.isUniform(s)) return null; // boring start
  for (const s of spools) { // would knit instantly
    const run = E.topRun(s);
    if (s.length && s.length === totals[run.color] && E.isUniform(s)) return null;
  }
  return level;
}

function build(spec, log) {
  const t0 = Date.now();
  const trials = spec.colors <= 7 ? 200 : spec.colors <= 9 ? 120 : 80;
  const dfsCap = spec.colors <= 8 ? 250000 : 400000;
  let empties = spec.empties;
  let cands = [];
  for (let attempt = 0; attempt < 2 && !cands.length; attempt++) {
    for (let seed = 1; seed <= SEEDS_PER_LEVEL; seed++) {
      const level = deal(spec, seed, empties);
      if (!level) continue;
      const st = E.newState(level);
      const dfs = E.solveDFS(st, dfsCap);
      if (!dfs) continue;
      const rate = E.randomPlayRate(level, trials, mulberry32(seed + 13));
      cands.push({ seed, level, rate, dfsLen: dfs.length, nodes: dfs.nodes });
    }
    if (!cands.length) { empties++; log(`  L${spec.id}: no solvable deal, adding a spare spool`); }
  }
  if (!cands.length) throw new Error('no solvable deal for level ' + spec.id);
  const [lo, hi] = spec.target;
  const inBand = cands.filter(c => c.rate >= lo && c.rate <= hi);
  let pick;
  if (inBand.length) {
    // hardest-looking board inside the band: lowest random win rate, then most solver effort, then longest solution
    inBand.sort((a, b) => a.rate - b.rate || b.nodes - a.nodes || b.dfsLen - a.dfsLen);
    pick = inBand[0];
  } else {
    const mid = (lo + hi) / 2;
    cands.sort((a, b) => Math.abs(a.rate - mid) - Math.abs(b.rate - mid));
    pick = cands[0];
  }
  const st = E.newState(pick.level);
  const t1 = Date.now();
  let solution = E.solveAStar(st, spec.colors <= 10 ? 3000000 : 2000000);
  let exact = true;
  if (!solution) { // fall back to the best of several randomised DFS runs
    exact = false;
    for (let k = 0; k < 24; k++) {
      const s = E.solveDFS(st, 600000, mulberry32(1000 + k));
      if (s && (!solution || s.length < solution.length)) solution = s;
    }
  }
  const par = solution.length;
  log(`  L${spec.id} ${spec.name}: seed ${pick.seed}, ${spec.colors} colours, ${pick.level.spools.length} spools, ` +
    `random win ${(pick.rate * 100).toFixed(1)}%, par ${par}${exact ? '' : ' (approx)'}, ` +
    `${cands.length}/${SEEDS_PER_LEVEL} solvable, ${Date.now() - t0} ms (solve ${Date.now() - t1} ms)`);
  return Object.assign({}, pick.level, { seed: pick.seed, rate: +pick.rate.toFixed(3), par, parExact: exact, solution });
}

// ---------------- verification / output ----------------
function verify(levels, quiet) {
  let ok = true;
  for (const lv of levels) {
    const st = E.newState(lv);
    for (const [a, b] of lv.solution) {
      if (!E.applyMove(st, a, b)) { console.error(`L${lv.id}: illegal stored move ${a}->${b}`); ok = false; break; }
    }
    if (!E.isWon(st)) { console.error(`L${lv.id}: stored solution does not win`); ok = false; }
    else if (!quiet) console.log(`L${lv.id} ${lv.name}: OK (${lv.solution.length} moves)`);
  }
  return ok;
}

function write(levels) {
  levels.sort((a, b) => a.id - b.id);
  const src = '/* GENERATED by tools/gen.js — do not edit by hand. */\n' +
    'var LEVELS = ' + JSON.stringify(levels.map(l => {
      const o = { id: l.id, name: l.name, cap: l.cap, caps: l.caps, spools: l.spools, hidden: !!l.hidden };
      if (l.hard) o.hard = true;
      Object.assign(o, { seed: l.seed, rate: l.rate, par: l.par, parExact: l.parExact, solution: l.solution });
      return o;
    })) + ';\n' +
    "if (typeof module === 'object' && module.exports) module.exports = LEVELS;\n";
  fs.writeFileSync(OUT, src);
  console.log('wrote', OUT, `(${levels.length} levels)`);
}

function table(levels) {
  const rows = ['| # | Name | Colours | Spools | Twist | Par | Random-play win |', '| - | --- | --- | --- | --- | --- | --- |'];
  for (const l of levels) {
    const colors = new Set(l.spools.flat()).size;
    const twists = [];
    if (l.hidden) twists.push('fuzzy');
    if (l.caps.some(c => c < 4)) twists.push('bobbin');
    const totals = {}; l.spools.flat().forEach(c => { totals[c] = (totals[c] || 0) + 1; });
    if (Object.values(totals).some(n => n < 4)) twists.push('short strand');
    if (l.caps.filter((c, i) => c === 4 && l.spools[i].length === 0).length >= 2) twists.push('2 spare');
    if (l.hard) twists.push('**HARD**');
    rows.push(`| ${l.id} | ${l.name} | ${colors} | ${l.spools.length} | ${twists.join(', ')} | ${l.par}${l.parExact ? '' : '*'} | ${(l.rate * 100).toFixed(l.rate < 0.1 ? 1 : 0)}% |`);
  }
  return rows.join('\n');
}

// ---------------- main / workers ----------------
if (!isMainThread) {
  for (const spec of workerData.specs) {
    const r = build(spec, msg => parentPort.postMessage({ type: 'log', msg }));
    parentPort.postMessage({ type: 'result', level: r });
  }
  parentPort.postMessage({ type: 'done' });
} else {
  main();
}

function main() {
  const args = process.argv.slice(2);
  const existing = fs.existsSync(OUT) ? require(OUT) : [];
  if (args.includes('--check')) { process.exit(verify(existing) ? 0 : 1); }
  if (args.includes('--table')) { console.log(table(existing)); return; }

  let from = 11, to = TOTAL;
  const ri = args.indexOf('--range');
  if (ri >= 0) { const m = /^(\d+)-(\d+)$/.exec(args[ri + 1] || ''); if (!m) throw new Error('--range A-B'); from = +m[1]; to = +m[2]; }
  if (args.includes('--all')) { from = 1; to = TOTAL; }

  const specs = [];
  for (let id = from; id <= to; id++) specs.push(specFor(id));
  const keep = existing.filter(l => l.id < from || l.id > to);
  console.log(`Generating levels ${from}-${to} (${specs.length}), keeping ${keep.length} existing…`);

  const W = Math.max(1, Math.min(os.cpus().length - 1, 7, specs.length));
  // spread the expensive (late) levels across workers
  const buckets = Array.from({ length: W }, () => []);
  specs.slice().reverse().forEach((s, i) => buckets[i % W].push(s));
  const results = [];
  let done = 0;
  const t0 = Date.now();
  buckets.forEach((bucket, wi) => {
    const w = new Worker(__filename, { workerData: { specs: bucket }, resourceLimits: { maxOldGenerationSizeMb: 3072 } });
    w.on('message', m => {
      if (m.type === 'log') console.log(m.msg);
      else if (m.type === 'result') { results.push(m.level); process.stdout.write(`    [${results.length}/${specs.length}] `); console.log(`L${m.level.id} done`); }
      else if (m.type === 'done') { if (++done === W) finish(); }
    });
    w.on('error', e => { console.error(`worker ${wi} failed:`, e); process.exit(1); });
  });
  function finish() {
    const all = keep.concat(results);
    if (!verify(all, true)) process.exit(1);
    write(all);
    console.log(`all ${all.length} levels verified in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}

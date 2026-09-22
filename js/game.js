/* Wool Sort — canvas renderer, animation, input, sound, daily puzzle and progress. */
(function () {
  'use strict';
  var E = window.WoolEngine;
  var $ = function (s) { return document.querySelector(s); };

  // Spool sprite geometry (fractions of the trimmed sprite) — measured by the asset script.
  var GEOM = { barrelTop: 0.0957, barrelBottom: 0.8945, barrelLeft: 0.1626, barrelRight: 0.8374, aspect: 246 / 512 };

  var ASSET_LIST = {
    spool: 'assets/spool.png', wool: 'assets/wool_tile.jpg', scarf: 'assets/scarf_tile.jpg',
    kittenKnit: 'assets/kitten_knit.png', kittenWin: 'assets/kitten_win.png', kittenThink: 'assets/kitten_think.png',
    yarn: 'assets/yarn.png'
  };
  var IMG = {};

  // Sesame chapter colours (menu pills + level stripes)
  var CHAPTERS = ['First Stitches', 'Casting On', 'Purl & Plain', 'Cable Knit', 'Fair Isle', 'Double Points',
    'Tangled Skeins', 'Moth Holes', 'Aran Sweater', 'The Grand Scarf'];
  var CHAPTER_COLORS = ['#e4002b', '#ffd23f', '#1f75fe', '#3cb44b', '#ff7f11', '#7b2cbf', '#ff5fa2', '#12b5c6', '#9acd32', '#d6249f'];
  var DARK_TEXT_ON = { '#ffd23f': true, '#9acd32': true, '#12b5c6': true };

  var canvas = $('#board'), ctx = canvas.getContext('2d');
  var dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));

  // ---------- game state ----------
  var level = null, levelIdx = -1, st = null, history = [], selected = -1, anim = null, hint = null;
  var usedHint = false, usedSpool = false, extraSpools = 0, layout = null, won = false;
  var liftAnim = {}, scarfPop = 0, kittenBounce = 0, toastTimer = 0, lastTime = 0;
  var STAGGER = 85, FLIGHT = 300, KNIT_TIME = 520;

  // ---------- progress ----------
  var PKEY = 'woolsort.v1';
  var progress = load();
  function load() {
    var p;
    try { p = JSON.parse(localStorage.getItem(PKEY)); } catch (e) { p = null; }
    p = p || {};
    p.stars = p.stars || {}; p.best = p.best || {}; p.daily = p.daily || {};
    if (p.sound === undefined) p.sound = true;
    return p;
  }
  function save() { try { localStorage.setItem(PKEY, JSON.stringify(progress)); } catch (e) { /* ignore */ } }
  function unlocked(i) { return i === 0 || (progress.stars[LEVELS[i - 1].id] || 0) > 0; }

  // ---------- dates (local) ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayKey() { return dateKey(new Date()); }
  function shiftKey(key, days) { var p = key.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + days); return dateKey(d); }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function prettyDate(key) { var p = key.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function dailyStreak() {
    var key = todayKey();
    if (!progress.daily[key]) key = shiftKey(key, -1); // yesterday still counts until today is played
    var n = 0;
    while (progress.daily[key]) { n++; key = shiftKey(key, -1); }
    return n;
  }

  // =====================================================================
  //  SOUND — a small procedural WebAudio kit (no audio files)
  // =====================================================================
  var AC = null, master = null, noiseBuf = null;
  function audio() {
    if (!progress.sound) return null;
    if (!AC) {
      try {
        AC = new (window.AudioContext || window.webkitAudioContext)();
        var comp = AC.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
        master = AC.createGain(); master.gain.value = 0.85;
        master.connect(comp); comp.connect(AC.destination);
      } catch (e) { return null; }
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function noiseBuffer() {
    if (noiseBuf) return noiseBuf;
    var len = AC.sampleRate * 1.5, b = AC.createBuffer(1, len, AC.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = b; return b;
  }
  function envGain(t0, attack, dur, peak) {
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(master);
    return g;
  }
  function osc(type, freq, t0, dur, gain, o) {
    o = o || {};
    var s = AC.createOscillator(); s.type = type;
    s.frequency.setValueAtTime(freq, t0);
    if (o.slide) s.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur * (o.slideAt || 1));
    var g = envGain(t0, o.attack || 0.006, dur, gain);
    if (o.lowpass) { var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lowpass; s.connect(lp); lp.connect(g); }
    else s.connect(g);
    s.start(t0); s.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, gain, f0, f1, q) {
    var src = AC.createBufferSource(); src.buffer = noiseBuffer();
    var bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q || 1;
    bp.frequency.setValueAtTime(f0, t0); bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    var g = envGain(t0, 0.015, dur, gain);
    src.connect(bp); bp.connect(g); src.start(t0); src.stop(t0 + dur + 0.05);
  }
  function chime(freq, t0, dur, gain) { // bell: fundamental + soft partials
    osc('sine', freq, t0, dur, gain);
    osc('sine', freq * 2.01, t0, dur * 0.6, gain * 0.35);
    osc('triangle', freq * 3.0, t0, dur * 0.35, gain * 0.12);
  }
  function pluck(freq, t0, gain) { // wool "twang"
    osc('triangle', freq, t0, 0.16, gain, { slide: freq * 0.93, lowpass: 2200 });
    osc('sine', freq * 0.5, t0, 0.12, gain * 0.5);
  }
  function thump(t0, gain) { osc('sine', 200, t0, 0.14, gain, { slide: 70 }); }
  function meow(t0, sad) { // formant-ish kitten
    var dur = sad ? 0.6 : 0.42;
    var s = AC.createOscillator(); s.type = 'sawtooth';
    var f = s.frequency;
    f.setValueAtTime(sad ? 540 : 470, t0);
    f.exponentialRampToValueAtTime(sad ? 470 : 840, t0 + dur * 0.4);
    f.exponentialRampToValueAtTime(sad ? 250 : 560, t0 + dur);
    var vib = AC.createOscillator(); vib.frequency.value = sad ? 6 : 9;
    var vg = AC.createGain(); vg.gain.value = 16; vib.connect(vg); vg.connect(f);
    var bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(1000, t0); bp.frequency.linearRampToValueAtTime(2000, t0 + dur * 0.45); bp.frequency.linearRampToValueAtTime(900, t0 + dur);
    var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400;
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.05);
    g.gain.setValueAtTime(0.2, t0 + dur * 0.65); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(master);
    s.start(t0); vib.start(t0); s.stop(t0 + dur + 0.05); vib.stop(t0 + dur + 0.05);
  }
  function purr(t0, dur) { // low modulated rumble
    var src = AC.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
    var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 1.5;
    var mod = AC.createGain(); mod.gain.value = 0.55;
    var lfo = AC.createOscillator(); lfo.frequency.value = 23; var lg = AC.createGain(); lg.gain.value = 0.45;
    lfo.connect(lg); lg.connect(mod.gain);
    var g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.3);
    g.gain.setValueAtTime(0.5, t0 + dur - 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(lp); lp.connect(mod); mod.connect(g); g.connect(master);
    src.start(t0); lfo.start(t0); src.stop(t0 + dur + 0.1); lfo.stop(t0 + dur + 0.1);
  }
  function now() { return AC.currentTime; }
  var SFX = {
    pick: function () { if (!audio()) return; var t = now(); noise(t, 0.2, 0.1, 500, 2600, 0.9); pluck(660, t, 0.08); },
    drop: function () { if (!audio()) return; thump(now(), 0.12); },
    wind: function (k) { if (!audio()) return; var t = now(); pluck(480 + k * 70, t, 0.1); noise(t, 0.09, 0.045, 1800, 800, 1.5); },
    land: function () { if (!audio()) return; thump(now(), 0.09); },
    nope: function () { if (!audio()) return; var t = now(); osc('sine', 320, t, 0.3, 0.12, { slide: 105, slideAt: 0.8 }); osc('triangle', 160, t, 0.18, 0.05, { slide: 80 }); },
    knit: function () {
      if (!audio()) return; var t = now();
      [0, 0.09, 0.18, 0.27].forEach(function (d) { osc('square', 2400 + (d * 1000), t + d, 0.03, 0.045, { slide: 1500 }); });
      [523, 659, 784, 1047].forEach(function (f, i) { chime(f, t + 0.2 + i * 0.09, 0.4, 0.1); });
      noise(t + 0.25, 0.35, 0.03, 4000, 8000, 0.7);
    },
    win: function () {
      if (!audio()) return; var t = now();
      [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { chime(f, t + i * 0.11, 0.55, 0.11); });
      noise(t + 0.3, 0.6, 0.035, 3000, 9000, 0.6);
      meow(t + 0.75, false);
      purr(t + 1.3, 2.2);
    },
    stuck: function () { if (!audio()) return; meow(now(), true); },
    hello: function () { if (!audio()) return; meow(now() + 0.05, false); },
    hint: function () { if (!audio()) return; var t = now(); chime(880, t, 0.3, 0.08); chime(1320, t + 0.12, 0.35, 0.08); },
    click: function () { if (!audio()) return; var t = now(); osc('sine', 900, t, 0.05, 0.06, { slide: 600 }); noise(t, 0.03, 0.03, 3000, 1500, 1); },
    hop: function () { if (!audio()) return; var t = now(); osc('triangle', 400, t, 0.12, 0.08, { slide: 700 }); }
  };

  // ---------- assets ----------
  function loadImage(src) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { console.warn('missing asset', src); res(null); };
      im.src = src;
    });
  }
  function loadAll() {
    var keys = Object.keys(ASSET_LIST);
    return Promise.all(keys.map(function (k) { return loadImage(ASSET_LIST[k]); })).then(function (imgs) {
      keys.forEach(function (k, i) { IMG[k] = imgs[i]; });
    });
  }

  // ---------- tinted texture cache ----------
  var bandCache = {};
  function bandImage(color, w, h, hidden) {
    var key = (hidden ? 'h' : color) + '_' + w + 'x' + h;
    if (bandCache[key]) return bandCache[key];
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    var hex = hidden ? '#b9b3b8' : E.PALETTE[color].hex;
    var r = Math.min(h * 0.42, w * 0.2);
    g.beginPath(); roundRect(g, 0, 0, w, h, r); g.closePath();
    g.fillStyle = hex; g.fill();
    g.save(); g.clip();
    if (IMG.wool) { // wool grain, kept light so the colour stays vivid
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.72;
      var tile = IMG.wool, scale = (h * 2.6) / tile.height;
      var tw = tile.width * scale, th = tile.height * scale;
      for (var y = -th * 0.3; y < h; y += th) for (var x = 0; x < w; x += tw) g.drawImage(tile, x, y, tw, th);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    var lg = g.createLinearGradient(0, 0, w, 0); // cylinder
    lg.addColorStop(0, 'rgba(0,0,0,0.3)'); lg.addColorStop(0.16, 'rgba(0,0,0,0.03)'); lg.addColorStop(0.42, 'rgba(255,255,255,0.2)');
    lg.addColorStop(0.72, 'rgba(0,0,0,0.03)'); lg.addColorStop(1, 'rgba(0,0,0,0.33)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    var vg = g.createLinearGradient(0, 0, 0, h); // gloss
    vg.addColorStop(0, 'rgba(255,255,255,0.32)'); vg.addColorStop(0.3, 'rgba(255,255,255,0.02)'); vg.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    if (hidden) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.font = 'bold ' + Math.round(h * 0.78) + 'px Fredoka, Nunito, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('?', w / 2, h / 2 + h * 0.04);
    }
    g.restore();
    bandCache[key] = c;
    return c;
  }
  var stripeCache = {};
  function stripeImage(color, w, h) {
    var key = color + '_' + w + 'x' + h;
    if (stripeCache[key]) return stripeCache[key];
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = E.PALETTE[color].hex; g.fillRect(0, 0, w, h);
    if (IMG.scarf) {
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.8;
      var tile = IMG.scarf, scale = (h * 1.15) / tile.height;
      var tw = tile.width * scale, th = tile.height * scale;
      for (var y = 0; y < h; y += th) for (var x = -tw * (color % 3) / 3; x < w; x += tw) g.drawImage(tile, x, y, tw, th);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    var vg = g.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, 'rgba(255,255,255,0.22)'); vg.addColorStop(1, 'rgba(0,0,0,0.2)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    stripeCache[key] = c;
    return c;
  }
  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  }

  // ---------- layout ----------
  function resize() {
    var r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    if (st) layout = computeLayout();
  }
  window.addEventListener('resize', resize);

  function computeLayout() {
    var W = canvas.width / dpr, H = canvas.height / dpr;
    var n = st.spools.length;
    var cols = n <= 5 ? n : n <= 10 ? Math.ceil(n / 2) : Math.ceil(n / 3);
    var rows = Math.ceil(n / cols);
    var scarfH = rows >= 3 ? Math.min(H * 0.17, 118) : Math.min(H * 0.24, 168);
    var zoneTop = scarfH + 6, zoneBottom = H - 8;
    var slotW = Math.min((W - 14) / cols, 112);
    var liftRoom = rows >= 3 ? 18 : 26, rowGap = rows >= 3 ? 12 : 22;
    var spriteW = slotW * 0.86, spriteH = spriteW / GEOM.aspect;
    var need = rows * (spriteH + liftRoom + rowGap);
    var avail = zoneBottom - zoneTop;
    if (need > avail) { var k = avail / need; spriteW *= k; spriteH *= k; slotW *= k; }
    var bandH = spriteH * (GEOM.barrelBottom - GEOM.barrelTop) / 4;
    var topH = spriteH * GEOM.barrelTop, botH = spriteH * (1 - GEOM.barrelBottom);
    var rowH = spriteH + liftRoom + rowGap;
    var gridH = rows * rowH;
    var y0 = zoneTop + (avail - gridH) * 0.58 + liftRoom;
    var spools = [];
    for (var i = 0; i < n; i++) {
      var r = Math.floor(i / cols), c = i % cols;
      var rowCount = (r === rows - 1) ? n - (rows - 1) * cols : cols;
      var rowX0 = (W - rowCount * slotW) / 2;
      var cap = st.caps[i];
      var h = topH + bandH * cap + botH;
      var x = rowX0 + c * slotW + (slotW - spriteW) / 2;
      var y = y0 + r * rowH + (spriteH - h);
      spools.push({
        x: x, y: y, w: spriteW, h: h, cap: cap, topH: topH, botH: botH, bandH: bandH,
        barrelX: x + spriteW * GEOM.barrelLeft, barrelW: spriteW * (GEOM.barrelRight - GEOM.barrelLeft),
        barrelY: y + topH, barrelBottom: y + topH + bandH * cap, cx: x + spriteW / 2
      });
    }
    return { W: W, H: H, scarfH: scarfH, spools: spools, bandH: bandH, slotW: slotW };
  }
  function bandPos(i, j, lift) {
    var L = layout.spools[i];
    return { x: L.barrelX - 2, y: L.barrelBottom - (j + 1) * L.bandH - (lift || 0), w: L.barrelW + 4, h: L.bandH + 1 };
  }

  // ---------- drawing ----------
  function drawBand(color, x, y, w, h, hidden, scale) {
    var img = bandImage(color, Math.round(w * dpr), Math.round(h * dpr), hidden);
    if (scale && scale !== 1) {
      var cx = x + w / 2, cy = y + h / 2;
      ctx.drawImage(img, cx - w * scale / 2, cy - h * scale / 2, w * scale, h * scale);
    } else ctx.drawImage(img, x, y, w, h);
  }
  function drawSpoolBody(i, lift) {
    var L = layout.spools[i], img = IMG.spool;
    var y = L.y - lift;
    ctx.save();
    ctx.fillStyle = 'rgba(40,20,30,0.28)';
    ctx.beginPath(); ctx.ellipse(L.cx, L.y + L.h + 3, L.w * 0.55, L.w * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (img) {
      var sw = img.width, sh = img.height;
      var topPx = sh * GEOM.barrelTop, barPx = sh * (GEOM.barrelBottom - GEOM.barrelTop), botPx = sh - topPx - barPx;
      var barrelH = L.bandH * L.cap;
      ctx.drawImage(img, 0, 0, sw, topPx, L.x, y, L.w, L.topH + 0.5);
      ctx.drawImage(img, 0, topPx, sw, barPx, L.x, y + L.topH, L.w, barrelH + 0.5);
      ctx.drawImage(img, 0, topPx + barPx, sw, botPx, L.x, y + L.topH + barrelH, L.w, L.botH);
    } else {
      ctx.fillStyle = '#c98a4b'; ctx.fillRect(L.barrelX, y + L.topH, L.barrelW, L.bandH * L.cap);
      ctx.fillStyle = '#a86a33'; ctx.fillRect(L.x, y, L.w, L.topH); ctx.fillRect(L.x, y + L.topH + L.bandH * L.cap, L.w, L.botH);
    }
  }
  function drawSpoolWithBands(i, lift, bands, hidden, liftedTop) {
    drawSpoolBody(i, lift);
    for (var j = 0; j < bands.length; j++) {
      var extra = (liftedTop && j >= bands.length - liftedTop) ? 10 : 0;
      var p = bandPos(i, j, lift + extra);
      drawBand(bands[j], p.x, p.y, p.w, p.h, hidden && hidden[j]);
    }
  }
  function drawHighlight(i, lift, color, alpha) {
    var L = layout.spools[i];
    ctx.save();
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.beginPath(); roundRect(ctx, L.x - 6, L.y - lift - 6, L.w + 12, L.h + 12, 16); ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
  function scarfGeom() {
    var W = layout.W, SH = layout.scarfH;
    var kH = SH * 0.98, kW = kH * (IMG.kittenKnit ? IMG.kittenKnit.width / IMG.kittenKnit.height : 0.68);
    var sx = 10 + kW + 4, sw = W - sx - 12, sh = Math.min(SH * 0.42, 60), sy = SH * 0.5 - sh / 2 + 10;
    return { kx: 10, ky: 4, kW: kW, kH: kH, sx: sx, sy: sy, sw: sw, sh: sh, stripeW: sw / Object.keys(st.totals).length };
  }
  function drawScarf() {
    var G = scarfGeom(), colorsTotal = Object.keys(st.totals).length;
    var bounce = kittenBounce > 0 ? Math.sin((1 - kittenBounce) * Math.PI) * 0.08 : 0;
    if (IMG.kittenKnit) {
      ctx.save(); ctx.translate(G.kx + G.kW / 2, G.ky + G.kH); ctx.scale(1 + bounce, 1 - bounce);
      ctx.drawImage(IMG.kittenKnit, -G.kW / 2, -G.kH, G.kW, G.kH); ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); roundRect(ctx, G.sx, G.sy, G.sw, G.sh, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    var visible = st.knitted.length - (anim && anim.type === 'knit' ? 1 : 0);
    ctx.save();
    ctx.beginPath(); roundRect(ctx, G.sx, G.sy, G.sw, G.sh, 10); ctx.closePath(); ctx.clip();
    for (var k = 0; k < visible; k++) {
      var img = stripeImage(st.knitted[k], Math.round(G.stripeW * dpr) + 2, Math.round(G.sh * dpr));
      var pop = (k === visible - 1 && scarfPop > 0) ? 1 + Math.sin((1 - scarfPop) * Math.PI) * 0.12 : 1;
      ctx.drawImage(img, G.sx + k * G.stripeW, G.sy + G.sh / 2 - G.sh * pop / 2, G.stripeW + 1, G.sh * pop);
    }
    ctx.restore();
    if (visible > 0) {
      var fx = G.sx + visible * G.stripeW;
      ctx.save(); ctx.strokeStyle = E.PALETTE[st.knitted[visible - 1]].hex; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
      for (var f = 0; f < 5; f++) { var fy = G.sy + 5 + f * (G.sh - 10) / 4; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 8, fy + 2); ctx.stroke(); }
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = '#fff'; ctx.font = '800 12px Nunito, sans-serif'; ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
    ctx.fillText('Scarf ' + visible + ' / ' + colorsTotal, G.sx + G.sw, G.sy - 6);
    ctx.restore();
  }
  function scarfTarget(k) { var G = scarfGeom(); return { x: G.sx + k * G.stripeW + G.stripeW / 2, y: G.sy + G.sh / 2 }; }

  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : (1 - Math.cos(t * Math.PI)) / 2; }
  function bez(p0, p1, p2, t) { var u = 1 - t; return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y }; }

  function render(now) {
    if (!st || !layout) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, layout.W, layout.H);
    drawScarf();
    for (var i = 0; i < st.spools.length; i++) {
      var lift = liftAnim[i] || 0;
      var bands = st.spools[i], hid = st.hidden[i], liftedTop = 0;
      if (anim && anim.type === 'pour') {
        if (i === anim.from) { bands = anim.fromBands.slice(0, anim.fromBands.length - departed(now)); hid = anim.fromHidden; }
        else if (i === anim.to) { bands = anim.toBands.concat(repeatColor(anim.color, landed(now))); hid = null; }
      } else if (anim && anim.type === 'knit' && i === anim.spool) {
        var p = (now - anim.t0) / KNIT_TIME;
        bands = repeatColor(anim.color, Math.max(0, anim.count - Math.floor(p * (anim.count + 1)))); hid = null;
      }
      if (selected === i && !anim) liftedTop = E.topRun(st.spools[i]).count;
      drawSpoolWithBands(i, lift, bands, hid, liftedTop);
      if (selected === i && !anim) drawHighlight(i, lift, '#ffd23f', 0.95);
      if (hint && (i === hint.from || i === hint.to)) {
        var pulse = 0.55 + 0.45 * Math.sin(now / 160);
        drawHighlight(i, lift, i === hint.from ? '#3cb44b' : '#1f75fe', pulse);
      }
    }
    if (anim && anim.type === 'pour') {
      var Lf = layout.spools[anim.from];
      for (var k = 0; k < anim.n; k++) {
        var t = (now - anim.t0 - k * STAGGER) / FLIGHT;
        if (t <= 0 || t >= 1) continue;
        var fromIdx = anim.fromBands.length - 1 - k, toIdx = anim.toBands.length + k;
        var p0 = bandPos(anim.from, fromIdx, liftAnim[anim.from] || 0), p2 = bandPos(anim.to, toIdx, 0);
        var peak = Math.min(p0.y, p2.y) - Math.max(60, Math.abs(p0.x - p2.x) * 0.35);
        var c0 = { x: p0.x, y: p0.y }, c2 = { x: p2.x, y: p2.y }, c1 = { x: (p0.x + p2.x) / 2, y: peak };
        var e = ease(t), pos = bez(c0, c1, c2, e);
        ctx.save(); ctx.strokeStyle = E.PALETTE[anim.color].hex; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(Lf.cx, Lf.barrelY - (liftAnim[anim.from] || 0));
        ctx.quadraticCurveTo(c1.x + p0.w / 2, c1.y + 10, pos.x + p0.w / 2, pos.y + p0.h / 2); ctx.stroke(); ctx.restore();
        drawBand(anim.color, pos.x, pos.y, p0.w, p0.h, false, 1 + 0.12 * Math.sin(e * Math.PI));
      }
      if (now - anim.t0 >= (anim.n - 1) * STAGGER + FLIGHT) finishPour();
    }
    if (anim && anim.type === 'knit') {
      var pk = (now - anim.t0) / KNIT_TIME, tgt = scarfTarget(st.knitted.length - 1);
      for (var q = 0; q < anim.count; q++) {
        var tq = pk * (anim.count + 1) - q, idx = anim.count - 1 - q;
        if (tq <= 0 || tq >= 1) continue;
        var s0 = bandPos(anim.spool, idx, 0);
        var sp0 = { x: s0.x + s0.w / 2, y: s0.y + s0.h / 2 }, sp2 = { x: tgt.x, y: tgt.y };
        var sp1 = { x: (sp0.x + sp2.x) / 2, y: Math.min(sp0.y, sp2.y) - 50 };
        var ps = bez(sp0, sp1, sp2, ease(tq)), scl = 1 - 0.45 * tq;
        drawBand(anim.color, ps.x - s0.w * scl / 2, ps.y - s0.h * scl / 2, s0.w * scl, s0.h * scl, false, 1);
      }
      if (pk >= 1) finishKnit();
    }
    if (hint) {
      var A = layout.spools[hint.from], B = layout.spools[hint.to];
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -now / 40;
      ctx.beginPath(); ctx.moveTo(A.cx, A.y - 10); ctx.quadraticCurveTo((A.cx + B.cx) / 2, Math.min(A.y, B.y) - 50, B.cx, B.y - 10); ctx.stroke();
      ctx.restore();
      if (now > hint.until) hint = null;
    }
  }
  function repeatColor(c, n) { var a = []; for (var i = 0; i < n; i++) a.push(c); return a; }
  function departed(now) { var d = 0; for (var k = 0; k < anim.n; k++) if (now - anim.t0 - k * STAGGER > 0) d++; return d; }
  function landed(now) { var d = 0; for (var k = 0; k < anim.n; k++) if (now - anim.t0 - k * STAGGER >= FLIGHT) d++; return d; }

  function frame(now) {
    var dt = Math.min(50, now - (lastTime || now)); lastTime = now;
    for (var i = 0; st && i < st.spools.length; i++) {
      var target = (selected === i && !anim) ? 16 : 0, cur = liftAnim[i] || 0;
      liftAnim[i] = cur + (target - cur) * Math.min(1, dt / 70);
      if (Math.abs(liftAnim[i] - target) < 0.2) liftAnim[i] = target;
    }
    if (scarfPop > 0) scarfPop = Math.max(0, scarfPop - dt / 420);
    if (kittenBounce > 0) kittenBounce = Math.max(0, kittenBounce - dt / 380);
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('#toast').classList.add('hidden'); }
    render(now);
    requestAnimationFrame(frame);
  }

  // ---------- moves ----------
  function tryMove(a, b) {
    if (!E.canMove(st, a, b)) return false;
    var before = E.cloneState(st);
    var fromBands = st.spools[a].slice(), fromHidden = st.hidden[a].slice(), toBands = st.spools[b].slice();
    var res = E.applyMove(st, a, b);
    history.push(before);
    anim = { type: 'pour', from: a, to: b, color: res.color, n: res.moved, t0: performance.now(),
      fromBands: fromBands, fromHidden: fromHidden, toBands: toBands, knit: res.knitted };
    selected = -1; hint = null;
    for (var k = 0; k < res.moved; k++) setTimeout(SFX.wind.bind(null, k), k * STAGGER + FLIGHT - 60);
    updateHud();
    return true;
  }
  function finishPour() {
    var a = anim;
    if (a.knit >= 0) { anim = { type: 'knit', spool: a.to, color: a.knit, count: a.toBands.length + a.n, t0: performance.now() }; SFX.knit(); }
    else { anim = null; afterMove(); }
  }
  function finishKnit() {
    anim = null; scarfPop = 1; kittenBounce = 1;
    if (!progress.seenTut && level.id === 1 && !E.isWon(st)) {
      toast('Mochi knitted ' + E.PALETTE[st.knitted[st.knitted.length - 1]].name + ' into the scarf — that spool is free again!', 3200);
    }
    afterMove();
  }
  function afterMove() {
    if (E.isWon(st)) { won = true; setTimeout(showWin, 350); return; }
    if (!E.hasUsefulMove(st)) setTimeout(function () { if (!anim && !won && !E.hasUsefulMove(st)) showStuck(); }, 500);
  }
  function onTap(x, y) {
    if (!st || anim || won) return;
    audio();
    var hit = -1;
    for (var i = 0; i < layout.spools.length; i++) {
      var L = layout.spools[i];
      if (x >= L.x - 8 && x <= L.x + L.w + 8 && y >= L.y - 30 && y <= L.y + L.h + 6) { hit = i; break; }
    }
    if (hit < 0) { if (selected >= 0) { selected = -1; SFX.drop(); } return; }
    if (selected < 0) { if (st.spools[hit].length) { selected = hit; SFX.pick(); } else SFX.nope(); return; }
    if (hit === selected) { selected = -1; SFX.drop(); return; }
    if (tryMove(selected, hit)) return;
    SFX.nope();
    selected = st.spools[hit].length ? hit : -1;
  }
  canvas.addEventListener('pointerdown', function (ev) {
    var r = canvas.getBoundingClientRect();
    onTap(ev.clientX - r.left, ev.clientY - r.top);
    ev.preventDefault();
  });

  // ---------- controls ----------
  function undo() {
    if (anim || !history.length) return;
    st = history.pop(); selected = -1; hint = null; won = false;
    layout = computeLayout(); updateHud(); SFX.click();
    hideModal('#stuck');
  }
  function restart() { if (level.daily) playLevel(level, -1); else playLevel(LEVELS[levelIdx], levelIdx); }
  function addSpool() {
    if (anim || extraSpools >= 1) return;
    st.spools.push([]); st.caps.push(level.cap || 4); st.hidden.push([]);
    extraSpools++; usedSpool = true; layout = computeLayout(); updateHud(); SFX.hop();
    hideModal('#stuck');
    toast('An extra spool! (three stars need a clean solve)', 2200);
  }
  function showHint() {
    if (anim || won) return;
    var sol = E.solveDFS(st, 150000);
    if (!sol || !sol.length) { toast("Mochi can't see a way out from here — try Undo.", 2600); SFX.nope(); return; }
    hint = { from: sol[0][0], to: sol[0][1], until: performance.now() + 2600 };
    usedHint = true; selected = -1; SFX.hint();
  }
  function updateHud() {
    $('#hud-count').textContent = st.moves;
    $('#hud-par').textContent = level.par;
    $('#btn-undo').disabled = !history.length;
    $('#btn-spool').disabled = extraSpools >= 1;
    $('#btn-spool .badge').textContent = String(1 - extraSpools);
    $('#btn-stuck-spool').disabled = extraSpools >= 1;
  }
  function toast(msg, ms) { var t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); toastTimer = ms || 2000; }

  // ---------- screens ----------
  function show(id) { ['#loading', '#menu', '#game'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); }); }
  function showModal(id) { $(id).classList.remove('hidden'); }
  function hideModal(id) { $(id).classList.add('hidden'); }

  function stars() {
    var s = st.moves <= level.par + 2 ? 3 : st.moves <= level.par + 8 ? 2 : 1;
    if (usedSpool) s = Math.min(s, 2);
    return s;
  }
  function starHtml(s) { return [1, 2, 3].map(function (i) { return '<span class="' + (i <= s ? 'on' : '') + '">★</span>'; }).join(''); }
  function showWin() {
    var s = stars(), text;
    if (level.daily) {
      var prev = progress.daily[level.daily];
      if (!prev || s > prev.stars || (s === prev.stars && st.moves < prev.moves)) progress.daily[level.daily] = { moves: st.moves, stars: s };
      save();
      text = 'Daily done in ' + st.moves + ' move' + (st.moves === 1 ? '' : 's') + ' · par ' + level.par + ' · streak 🔥 ' + dailyStreak();
      $('#btn-win-next').classList.add('hidden'); $('#btn-win-share').classList.remove('hidden');
    } else {
      progress.stars[level.id] = Math.max(progress.stars[level.id] || 0, s);
      progress.best[level.id] = Math.min(progress.best[level.id] || 1e9, st.moves);
      progress.seenTut = true; save();
      text = 'Scarf finished in ' + st.moves + ' move' + (st.moves === 1 ? '' : 's') + ' · par ' + level.par +
        (usedSpool ? ' · extra spool used' : '') + (s === 3 ? ' · Purr-fect!' : '');
      $('#btn-win-next').classList.remove('hidden'); $('#btn-win-share').classList.add('hidden');
      $('#btn-win-next').textContent = levelIdx < LEVELS.length - 1 ? 'Next' : 'Levels';
    }
    $('#win-stars').innerHTML = starHtml(s);
    $('#win-text').textContent = text;
    SFX.win(); showModal('#win');
  }
  function showStuck() { showModal('#stuck'); SFX.stuck(); }

  function shareDaily() {
    var rec = progress.daily[level.daily] || { moves: st.moves, stars: stars() };
    var text = 'Wool Sort Daily 🧶 ' + prettyDate(level.daily) + ' · ' + rec.moves + ' moves (par ' + level.par + ') ' +
      '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars) + ' · streak 🔥' + dailyStreak() + '\nhttps://strawlighter.github.io/wool-sort/';
    var done = function () { toast('Result copied — go brag!', 2200); SFX.click(); };
    if (navigator.share) navigator.share({ text: text }).then(done).catch(function () { copy(text, done); });
    else copy(text, done);
  }
  function copy(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { toast(text, 5000); });
    else toast(text, 5000);
  }

  function playLevel(lv, idx) {
    level = lv; levelIdx = idx; st = E.newState(level); history = []; selected = -1; anim = null; hint = null;
    usedHint = false; usedSpool = false; extraSpools = 0; won = false; liftAnim = {};
    hideModal('#win'); hideModal('#stuck');
    if (level.daily) { var pd = prettyDate(level.daily).split(' '); $('#hud-level').textContent = 'Daily ' + pd[1] + ' ' + pd[2]; $('#hud-name').textContent = level.twist; }
    else { $('#hud-level').textContent = 'Level ' + level.id; $('#hud-name').textContent = level.name + (level.hard ? ' · HARD' : ''); }
    show('#game'); resize(); layout = computeLayout(); updateHud();
    if (level.daily) { toast(level.twist + ' — same puzzle for everyone today.', 2600); SFX.hello(); }
    else if (level.id === 1 && !progress.seenTut) toast('Tap a spool to pick up its top wool, then tap another spool to wind it on.', 4200);
    else if (level.hidden) toast('Fuzzy wool: a band shows its colour only when it reaches the top.', 3200);
    else if (level.caps.some(function (c) { return c < 4; })) toast('A little bobbin holds less wool, but it still counts as a spool.', 3000);
    else if (Object.keys(st.totals).some(function (c) { return st.totals[c] < 4; })) toast('Short strand: one colour has only three bands. Gather all three to knit it.', 3400);
    else toast(level.name, 1400);
  }
  function startLevel(idx) { playLevel(LEVELS[idx], idx); }
  function startDaily() {
    var key = todayKey();
    toast('Mochi is winding today\'s puzzle…', 1500);
    setTimeout(function () {
      var lv = E.buildDaily(key);
      if (!lv) { toast('No daily puzzle today — try again tomorrow!', 2500); return; }
      playLevel(lv, -1);
    }, 30);
  }

  function buildMenu() {
    var grid = $('#level-grid'); grid.innerHTML = '';
    var next = LEVELS.findIndex(function (lv) { return !(progress.stars[lv.id] > 0); });
    var focusBtn = null;
    LEVELS.forEach(function (lv, i) {
      var ch = Math.floor(i / 10), col = CHAPTER_COLORS[ch % CHAPTER_COLORS.length];
      if (i % 10 === 0) {
        var h = document.createElement('div'); h.className = 'chapter';
        var done = LEVELS.slice(i, i + 10).filter(function (l) { return progress.stars[l.id] > 0; }).length;
        h.innerHTML = '<span class="pill" style="background:' + col + ';color:' + (DARK_TEXT_ON[col] ? '#1d1a2b' : '#fff') + '">Chapter ' + (ch + 1) + '</span><b>' + (CHAPTERS[ch] || '') + '</b><em>' + done + '/10</em>';
        grid.appendChild(h);
      }
      var b = document.createElement('button');
      var s = progress.stars[lv.id] || 0, un = unlocked(i);
      b.className = 'lvl' + (un ? '' : ' locked') + (lv.hard ? ' hard' : '') + (s ? ' done' : '') + (i === next ? ' current' : '');
      b.style.setProperty('--ch', col);
      b.innerHTML = (un ? lv.id : '🔒') + '<small>' + (s ? '★'.repeat(s) : (lv.hard && un ? 'HARD' : '')) + '</small>';
      b.title = lv.name + (lv.hard ? ' (hard)' : '');
      if (un) b.addEventListener('click', function () { SFX.click(); startLevel(i); });
      if (i === next) focusBtn = b;
      grid.appendChild(b);
    });
    $('#btn-play').textContent = next <= 0 ? 'Play' : next < 0 ? 'Play again' : 'Continue · Level ' + LEVELS[next].id;
    // daily card
    var key = todayKey(), rec = progress.daily[key], streak = dailyStreak(), spec = E.dailySpec(key);
    $('#daily-date').textContent = prettyDate(key) + ' · ' + spec.twist;
    $('#daily-status').innerHTML = rec ? 'Done in ' + rec.moves + ' moves ' + starHtml(rec.stars) : 'Not played yet';
    $('#daily-streak').textContent = streak ? '🔥 ' + streak : '';
    $('#daily-streak').title = streak + '-day streak';
    if (focusBtn && next > 4) setTimeout(function () { focusBtn.scrollIntoView({ block: 'center' }); }, 30);
  }
  function openMenu() { hideModal('#win'); hideModal('#stuck'); buildMenu(); show('#menu'); }

  // ---------- wiring ----------
  $('#btn-play').addEventListener('click', function () {
    audio(); SFX.click();
    var next = LEVELS.findIndex(function (lv) { return !(progress.stars[lv.id] > 0); });
    startLevel(next < 0 ? 0 : next);
  });
  $('#btn-daily').addEventListener('click', function () { audio(); SFX.click(); startDaily(); });
  $('#btn-home').addEventListener('click', function () { SFX.click(); openMenu(); });
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-hint').addEventListener('click', showHint);
  $('#btn-spool').addEventListener('click', addSpool);
  $('#btn-restart').addEventListener('click', function () { SFX.click(); restart(); });
  $('#btn-win-levels').addEventListener('click', function () { SFX.click(); openMenu(); });
  $('#btn-win-replay').addEventListener('click', function () { SFX.click(); restart(); });
  $('#btn-win-share').addEventListener('click', shareDaily);
  $('#btn-win-next').addEventListener('click', function () {
    SFX.click();
    if (!level.daily && levelIdx < LEVELS.length - 1) startLevel(levelIdx + 1); else openMenu();
  });
  $('#btn-stuck-undo').addEventListener('click', undo);
  $('#btn-stuck-spool').addEventListener('click', addSpool);
  $('#btn-stuck-restart').addEventListener('click', function () { SFX.click(); restart(); });
  $('#btn-sound').addEventListener('click', function () {
    progress.sound = !progress.sound; save();
    $('#btn-sound').textContent = progress.sound ? '🔊' : '🔇'; if (progress.sound) SFX.click();
  });
  $('#btn-sound').textContent = progress.sound ? '🔊' : '🔇';
  document.addEventListener('keydown', function (ev) {
    if ($('#game').classList.contains('hidden')) return;
    if (ev.key === 'z' || ev.key === 'u') undo();
    if (ev.key === 'h') showHint();
    if (ev.key === 'r') restart();
    if (ev.key === 'Escape') { selected = -1; hint = null; }
  });

  window.WoolSort = { state: function () { return st; }, level: function () { return level; }, layout: function () { return layout; },
    move: tryMove, start: startLevel, daily: startDaily, engine: E, sfx: SFX, progress: function () { return progress; } };

  loadAll().then(function () { resize(); openMenu(); requestAnimationFrame(frame); });
})();

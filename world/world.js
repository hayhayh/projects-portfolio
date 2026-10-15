// Hayville: a walkable top-down map. Each category is a district, each project a building.
// Reads the shared `projects` array from ../projects.js, so the plain list and the map never drift apart.
(() => {
  const categoryColors = {
    'AI tools': '#0f7a53', 'Automation': '#9c4d0a', 'Browser': '#185f9e', 'Career': '#9c2a52', 'Culture': '#6935a0',
    'Data': '#0a6a78', 'Games': '#a83a19', 'Learning': '#3f7a19', 'Personal tools': '#35409c', 'Travel': '#9c6a0a',
  };
  const colorOf = (cat) => categoryColors[cat] || '#4a4a4a';

  const SLOT_W = 150, SLOT_H = 150, SIGN = 84, BOTTOM_PAD = 20, GAP = 90, MARGIN = 120, TOP = 400, GRID_COLS = 4;
  const SPEED = 190, PLAYER_R = 7;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  const canvas = document.querySelector('#world');
  const ctx = canvas.getContext('2d');
  const mini = document.querySelector('#minimap');
  const mctx = mini.getContext('2d');
  const hint = document.querySelector('#hint');
  const card = document.querySelector('#card');

  // ---------- helpers ----------
  const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };

  // ---------- build the world ----------
  const byCategory = new Map();
  projects.forEach((p) => { if (!byCategory.has(p.category)) byCategory.set(p.category, []); byCategory.get(p.category).push(p); });
  const cats = [...byCategory.keys()].sort((a, b) => byCategory.get(b).length - byCategory.get(a).length || a.localeCompare(b));

  const districts = cats.map((name, i) => {
    const list = byCategory.get(name);
    const cols = list.length > 12 ? 4 : Math.min(list.length, 3);
    return { name, list, cols, rows: Math.ceil(list.length / cols), gx: i % GRID_COLS, gy: Math.floor(i / GRID_COLS), color: colorOf(name) };
  });
  const colW = [], rowH = [];
  districts.forEach((d) => {
    colW[d.gx] = Math.max(colW[d.gx] || 0, d.cols * SLOT_W + 80);
    rowH[d.gy] = Math.max(rowH[d.gy] || 0, SIGN + d.rows * SLOT_H + BOTTOM_PAD);
  });
  const sum = (arr, n) => arr.slice(0, n).reduce((s, v) => s + v + GAP, 0);
  const WORLD_W = MARGIN * 2 + sum(colW, colW.length) - GAP;
  const WORLD_H = TOP + sum(rowH, rowH.length) - GAP + MARGIN;

  const buildings = [], colliders = [], trees = [];
  districts.forEach((d) => {
    d.x = MARGIN + sum(colW, d.gx); d.y = TOP + sum(rowH, d.gy); d.w = colW[d.gx]; d.h = rowH[d.gy];
    const offX = (d.w - d.cols * SLOT_W) / 2;
    d.list.forEach((p, i) => {
      const h = hash(p.name), c = i % d.cols, r = Math.floor(i / d.cols);
      const b = {
        p, d, color: d.color,
        cx: d.x + offX + c * SLOT_W + SLOT_W / 2,
        base: d.y + SIGN + r * SLOT_H + SLOT_H - 34,
        w: 70 + (h % 30), bh: 44 + ((h >> 5) % 26), roofH: 22 + ((h >> 9) % 8), style: (h >> 12) % 3, win: (h >> 15) % 2,
      };
      buildings.push(b);
      colliders.push({ x1: b.cx - b.w / 2, x2: b.cx + b.w / 2, y1: b.base - 12, y2: b.base });
    });
    // decorative trees in the open space of each district
    const rand = rng(hash(d.name));
    for (let n = 0; n < Math.floor(d.w / 28); n++) {
      const x = d.x + 14 + rand() * (d.w - 28), y = d.y + SIGN + 10 + rand() * (d.h - SIGN - 24);
      if (buildings.some((b) => b.d === d && Math.abs(x - b.cx) < b.w / 2 + 24 && y > b.base - b.bh - b.roofH - 24 && y < b.base + 46)) continue;
      trees.push({ x, y, s: 0.8 + rand() * 0.6 });
    }
    d.spawn = { x: d.x + d.w / 2, y: d.y + SIGN - 8 };
  });
  trees.push(...Array.from({ length: 26 }, (_, i) => { const r = rng(hash('tree' + i)); r(); r(); return { x: MARGIN / 2 + r() * (WORLD_W - MARGIN), y: 60 + r() * (TOP - 140), s: 0.9 + r() * 0.6 }; })
    .filter((t) => Math.abs(t.x - WORLD_W / 2) > 330 || t.y > 330));

  // ---------- state ----------
  const player = { x: WORLD_W / 2, y: 320, face: 1, walk: 0, moving: false };
  const cam = { x: 0, y: 0 };
  const keys = new Set();
  let target = null, holding = false, hover = null, near = null, open = null, W = 0, H = 0, dpr = 1, scale = 1, time = 0;

  function resize() {
    dpr = devicePixelRatio || 1; W = innerWidth; H = innerHeight; scale = W < 700 ? 0.78 : 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const mw = mini.clientWidth, mh = mini.clientHeight; mini.width = mw * dpr; mini.height = mh * dpr;
  }
  addEventListener('resize', resize); resize();
  cam.x = player.x - W / scale / 2; cam.y = player.y - H / scale / 2;

  // ---------- input ----------
  const moveKeys = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') return closeCard();
    if (moveKeys[e.key]) { keys.add(moveKeys[e.key]); target = null; e.preventDefault(); }
    else if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter' || e.key === ' ') && near && document.activeElement === document.body) { e.preventDefault(); openCard(near); }
  });
  addEventListener('keyup', (e) => keys.delete(moveKeys[e.key]));
  addEventListener('blur', () => keys.clear());

  const toWorld = (e) => ({ x: cam.x + e.clientX / scale, y: cam.y + e.clientY / scale });
  const buildingAt = (pt) => buildings.find((b) => pt.x > b.cx - b.w / 2 - 6 && pt.x < b.cx + b.w / 2 + 6 && pt.y > b.base - b.bh - b.roofH && pt.y < b.base + 34);

  canvas.addEventListener('pointerdown', (e) => {
    const pt = toWorld(e), b = buildingAt(pt);
    if (b) return openCard(b);
    closeCard(); holding = true; target = pt; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const pt = toWorld(e);
    if (holding) target = pt;
    else if (e.pointerType === 'mouse') { hover = buildingAt(pt) || null; canvas.classList.toggle('pointing', !!hover); }
  });
  canvas.addEventListener('pointerup', () => { holding = false; });

  function openCard(b) {
    open = b;
    card.style.setProperty('--c', b.color);
    document.querySelector('#card-cat').textContent = b.p.category;
    document.querySelector('#card-name').textContent = b.p.name;
    document.querySelector('#card-desc').textContent = b.p.description;
    const link = document.querySelector('#card-link');
    let ok = false;
    if (b.p.github) { const u = new URL(b.p.github); ok = u.protocol === 'https:' && u.hostname === 'github.com'; if (ok) link.href = u.href; }
    link.hidden = !ok;
    card.hidden = false;
  }
  function closeCard() { open = null; card.hidden = true; }
  document.querySelector('#card-close').addEventListener('click', closeCard);

  const nav = document.querySelector('#districts');
  districts.forEach((d) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.style.setProperty('--c', d.color);
    btn.innerHTML = `<i></i>`; btn.append(`${d.name} · ${d.list.length}`);
    btn.addEventListener('click', () => { player.x = d.spawn.x; player.y = d.spawn.y; target = null; closeCard(); });
    nav.append(btn);
  });
  mini.addEventListener('pointerdown', (e) => {
    const r = mini.getBoundingClientRect(), k = Math.min(r.width / WORLD_W, r.height / WORLD_H);
    player.x = Math.max(0, Math.min(WORLD_W, (e.clientX - r.left) / k)); player.y = Math.max(0, Math.min(WORLD_H, (e.clientY - r.top) / k));
    target = null; nudgeOut();
  });
  hint.textContent = coarse ? 'Touch and hold to walk. Tap a building to open it.' : 'WASD or arrows to walk, E to open a building. Or click anywhere.';

  // ---------- movement ----------
  const hits = (x, y) => colliders.some((c) => x + PLAYER_R > c.x1 && x - PLAYER_R < c.x2 && y + 4 > c.y1 && y - 4 < c.y2);
  function nudgeOut() { let n = 0; while (hits(player.x, player.y) && n++ < 40) player.y += 4; }

  function update(dt) {
    let dx = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), dy = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
    if (!dx && !dy && target) {
      const tx = target.x - player.x, ty = target.y - player.y, dist = Math.hypot(tx, ty);
      if (dist < 6) { if (!holding) target = null; } else { dx = tx / dist; dy = ty / dist; }
    }
    const len = Math.hypot(dx, dy);
    const before = { x: player.x, y: player.y };
    if (len) {
      const step = SPEED * dt / len;
      const nx = Math.max(10, Math.min(WORLD_W - 10, player.x + dx * step));
      if (!hits(nx, player.y)) player.x = nx;
      const ny = Math.max(10, Math.min(WORLD_H - 10, player.y + dy * step));
      if (!hits(player.x, ny)) player.y = ny;
      if (dx) player.face = Math.sign(dx);
      if (target && Math.hypot(player.x - before.x, player.y - before.y) < step * 0.1) target = null; // stuck against a wall
    }
    player.moving = len > 0 && (player.x !== before.x || player.y !== before.y);
    if (player.moving) player.walk += dt * 10;

    near = null; let best = 64;
    for (const b of buildings) { const dd = Math.hypot(player.x - b.cx, player.y - (b.base + 16)); if (dd < best) { best = dd; near = b; } }

    const vw = W / scale, vh = H / scale;
    const gx = Math.max(0, Math.min(Math.max(0, WORLD_W - vw), player.x - vw / 2)), gy = Math.max(0, Math.min(Math.max(0, WORLD_H - vh), player.y - vh / 2));
    const k = reduceMotion ? 1 : 1 - Math.pow(0.0005, dt);
    cam.x += (gx - cam.x) * k; cam.y += (gy - cam.y) * k;
  }

  // ---------- drawing ----------
  const font = (w, size, fam) => `${w} ${size}px ${fam === 'serif' ? 'Newsreader, Georgia, serif' : "'IBM Plex Sans', sans-serif"}`;
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  function drawGround(vx, vy, vw, vh) {
    ctx.fillStyle = '#ede3c8'; ctx.fillRect(cam.x, cam.y, vw, vh);
    for (const d of districts) {
      if (d.x > vx + vw || d.x + d.w < vx || d.y > vy + vh || d.y + d.h < vy) continue;
      ctx.fillStyle = mix('#dcebc8', d.color, 0.12); rrect(d.x, d.y, d.w, d.h, 26); ctx.fill();
      ctx.strokeStyle = mix('#dcebc8', d.color, 0.3); ctx.lineWidth = 2; ctx.stroke();
      // sign
      const sx = d.x + d.w / 2, sy = d.y + 14;
      ctx.fillStyle = 'rgba(40,50,30,.2)'; ctx.fillRect(sx - 92, sy + 44, 8, 14); ctx.fillRect(sx + 84, sy + 44, 8, 14);
      ctx.fillStyle = d.color; rrect(sx - 110, sy, 220, 50, 6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = font(600, 22, 'serif'); ctx.fillText(d.name, sx, sy + 26);
      ctx.font = font(500, 11, 'sans'); ctx.globalAlpha = 0.85; ctx.fillText(`${d.list.length} project${d.list.length === 1 ? '' : 's'}`, sx, sy + 42); ctx.globalAlpha = 1;
    }
    // welcome text painted on the ground
    const cx = WORLD_W / 2, mw = Math.max(240, W / scale - 32);
    ctx.fillStyle = '#16233a'; ctx.textAlign = 'center';
    ctx.font = font(500, 76, 'serif'); ctx.fillText('Hayville', cx, 200);
    ctx.font = font(400, 18, 'serif'); ctx.fillStyle = '#4b4a44';
    ctx.fillText('The projects of Haywood Ho: consultant, operator, builder of small tools.', cx, 244, mw);
    ctx.font = font(500, 13, 'sans'); ctx.fillStyle = '#a83a19';
    ctx.fillText(coarse ? 'Touch and hold to walk. Tap any building to see what it is.' : 'Walk with WASD or the arrow keys. Press E at a door, or click a building.', cx, 278, mw);
    ctx.fillText('↓  districts are below  ↓', cx, 372);
  }

  function drawTree(t) {
    ctx.fillStyle = 'rgba(40,50,30,.16)'; ctx.beginPath(); ctx.ellipse(t.x + 4, t.y, 13 * t.s, 5 * t.s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(t.x - 2 * t.s, t.y - 12 * t.s, 4 * t.s, 12 * t.s);
    ctx.fillStyle = '#6fa05a'; ctx.beginPath(); ctx.arc(t.x, t.y - 22 * t.s, 13 * t.s, 0, 7); ctx.fill();
    ctx.fillStyle = '#86b46d'; ctx.beginPath(); ctx.arc(t.x - 4 * t.s, t.y - 26 * t.s, 7 * t.s, 0, 7); ctx.fill();
  }

  function drawBuilding(b) {
    const { cx, base, w, bh, roofH, color } = b, active = b === near || b === hover || b === open;
    const lift = active ? -3 : 0;
    ctx.save(); ctx.translate(0, lift);
    ctx.fillStyle = 'rgba(40,50,30,.2)'; ctx.beginPath(); ctx.ellipse(cx + 8, base - lift, w / 2 + 10, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = mix(color, '#ffffff', 0.84); ctx.fillRect(cx - w / 2, base - bh, w, bh);
    ctx.fillStyle = mix(color, '#ffffff', 0.7); ctx.fillRect(cx + w / 2 - 12, base - bh, 12, bh);
    ctx.fillStyle = mix(color, '#ffffff', 0.45);
    const wy = base - bh + 12;
    if (b.win) { ctx.fillRect(cx - w / 2 + 10, wy, 12, 12); ctx.fillRect(cx + w / 2 - 34, wy, 12, 12); } else ctx.fillRect(cx - 8, wy, 16, 12);
    ctx.fillStyle = color; rrect(cx - 7, base - 24, 14, 24, [7, 7, 0, 0]); ctx.fill();
    const top = base - bh;
    ctx.fillStyle = color;
    if (b.style === 0) { ctx.beginPath(); ctx.moveTo(cx - w / 2 - 7, top); ctx.lineTo(cx, top - roofH - 6); ctx.lineTo(cx + w / 2 + 7, top); ctx.closePath(); ctx.fill(); ctx.fillStyle = mix(color, '#000000', 0.2); ctx.fillRect(cx + w / 4, top - roofH + 2, 8, 14); }
    else if (b.style === 1) { rrect(cx - w / 2 - 5, top - 14, w + 10, 14, 3); ctx.fill(); ctx.fillStyle = mix(color, '#ffffff', 0.35); ctx.fillRect(cx - w / 2 + 4, top - 22, w - 8, 8); }
    else { ctx.beginPath(); ctx.arc(cx, top, w / 2 + 3, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = mix(color, '#ffffff', 0.5); ctx.fillRect(cx - 1.5, top - w / 2 - 12, 3, 12); }
    if (active) { ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.strokeRect(cx - w / 2 - 3, base - bh - 3, w + 6, bh + 3); }
    ctx.restore();
    // name under the door, wrapped to two lines
    ctx.font = font(500, 11.5, 'sans'); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const lines = wrap(b.p.name, SLOT_W - 14);
    lines.forEach((ln, i) => {
      const y = base + 15 + i * 13;
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(252,252,250,.9)'; ctx.strokeText(ln, cx, y);
      ctx.fillStyle = active ? color : '#2b2a27'; ctx.fillText(ln, cx, y);
    });
  }
  const wrapCache = new Map();
  function wrap(text, max) {
    if (wrapCache.has(text)) return wrapCache.get(text);
    const words = text.split(' '), out = []; let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > max && line) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
    if (out.length > 2) { out.length = 2; out[1] = out[1].replace(/.{0,2}$/, '…'); }
    wrapCache.set(text, out); return out;
  }

  function drawPlayer() {
    const { x, y } = player, bob = player.moving && !reduceMotion ? Math.abs(Math.sin(player.walk)) * 3 : 0, leg = player.moving ? Math.sin(player.walk) * 4 : 0;
    ctx.fillStyle = 'rgba(40,50,30,.25)'; ctx.beginPath(); ctx.ellipse(x, y, 10, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#16233a'; ctx.fillRect(x - 5 + leg, y - 6 - bob / 2, 3.5, 6); ctx.fillRect(x + 1.5 - leg, y - 6 - bob / 2, 3.5, 6);
    ctx.fillStyle = '#a83a19'; rrect(x - 8, y - 22 - bob, 16, 17, 5); ctx.fill();
    ctx.fillStyle = '#f2d2b3'; ctx.beginPath(); ctx.arc(x, y - 28 - bob, 7.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#2b2118'; ctx.beginPath(); ctx.arc(x, y - 30.5 - bob, 7.5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#1c1c1a'; ctx.fillRect(x + player.face * 2.5 - 1, y - 28 - bob, 2, 2.5);
  }

  function drawBubble(b) {
    const label = b.p.name, tip = coarse ? 'Tap to open' : near === b ? 'Press E to open' : 'Click to open';
    ctx.font = font(600, 13, 'sans'); const w = Math.max(ctx.measureText(label).width, 90) + 24, x = b.cx - w / 2, y = b.base - b.bh - b.roofH - 52;
    ctx.fillStyle = '#16233a'; rrect(x, y, w, 38, 5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(b.cx - 6, y + 38); ctx.lineTo(b.cx + 6, y + 38); ctx.lineTo(b.cx, y + 45); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(label, b.cx, y + 17);
    ctx.font = font(400, 10.5, 'sans'); ctx.globalAlpha = 0.7; ctx.fillText(tip, b.cx, y + 31); ctx.globalAlpha = 1;
  }

  function drawMini() {
    const w = mini.width, h = mini.height, k = Math.min(w / WORLD_W, h / WORLD_H);
    mctx.clearRect(0, 0, w, h);
    districts.forEach((d) => { mctx.fillStyle = d.color; mctx.globalAlpha = 0.55; mctx.fillRect(d.x * k, d.y * k, d.w * k, d.h * k); });
    mctx.globalAlpha = 1; mctx.strokeStyle = '#16233a'; mctx.lineWidth = dpr;
    mctx.strokeRect(cam.x * k, cam.y * k, (W / scale) * k, (H / scale) * k);
    mctx.fillStyle = '#a83a19'; mctx.beginPath(); mctx.arc(player.x * k, player.y * k, 3.5 * dpr, 0, 7); mctx.fill();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - time) / 1000 || 0); time = now;
    update(dt);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -cam.x * dpr * scale, -cam.y * dpr * scale);
    const vw = W / scale, vh = H / scale, vx = cam.x, vy = cam.y;
    drawGround(vx, vy, vw, vh);
    const items = [];
    for (const t of trees) if (t.x > vx - 40 && t.x < vx + vw + 40 && t.y > vy && t.y < vy + vh + 80) items.push({ y: t.y, draw: () => drawTree(t) });
    for (const b of buildings) if (b.cx > vx - 120 && b.cx < vx + vw + 120 && b.base > vy && b.base - b.bh - 60 < vy + vh) items.push({ y: b.base, draw: () => drawBuilding(b) });
    items.push({ y: player.y, draw: drawPlayer });
    items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
    const focus = hover || near; if (focus && !open) drawBubble(focus);
    drawMini();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

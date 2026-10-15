import * as THREE from 'three';
import { hash, rng, grassTexture, pavementTexture, waterTexture, woodTexture, signTexture, posterTexture, mixHex } from './textures.js';
import { lam, box, makeBuilding, makePerson, animateWalk, makeLamp, makeBench, makeUmbrellaTable, makeBush, makeSignPost, furnishInterior } from './props.js';

// ---------- data ----------
const categoryColors = {
  'AI tools': '#0f7a53', 'Automation': '#9c4d0a', 'Browser': '#185f9e', 'Career': '#9c2a52', 'Culture': '#6935a0',
  'Data': '#0a6a78', 'Games': '#a83a19', 'Learning': '#3f7a19', 'Personal tools': '#35409c', 'Travel': '#9c6a0a',
};
const interiorKind = { 'Games': 'arcade', 'Culture': 'gallery', 'Learning': 'study', 'Automation': 'servers', 'Travel': 'travel', 'Personal tools': 'workshop' };
const colorOf = (c) => categoryColors[c] || '#4a4a4a';
const icons = [
  [/mahjong/i, '🀄'], [/shrine/i, '⛩️'], [/racer/i, '🏎️'], [/scraper|scrape/i, '🕸️'], [/scanner/i, '🔎'], [/newsletter/i, '📰'], [/event/i, '🎟️'],
  [/summar|article/i, '📝'], [/youtube/i, '▶️'], [/record/i, '🔴'], [/bypass/i, '🔓'], [/extension|plugin/i, '🧩'], [/linkedin/i, '💼'],
  [/job|apply|career/i, '💼'], [/board ?game/i, '🎲'], [/spending|cc /i, '💳'], [/whisper|transcribe/i, '🎙️'], [/slides/i, '📊'], [/mcp/i, '🔌'],
  [/epub|pdf|reader/i, '📚'], [/german/i, '🇩🇪'], [/rehearsal/i, '🎭'], [/fuji|hotel|ubud|arrival/i, '✈️'], [/music/i, '🎵'], [/wiki/i, '🧠'],
  [/pocket/i, '📥'], [/ocr|museum/i, '🏛️'], [/holmes/i, '🕵️'], [/vc /i, '💰'], [/360/i, '🎥'], [/cron/i, '⏰'], [/ollama|research/i, '🔬'],
  [/opencode|vps/i, '🖥️'], [/claude|nanobot|orchestr|agent|computer/i, '🤖'], [/substack/i, '✉️'], [/mekong/i, '🌏'], [/seo/i, '📈'],
];
const catIcon = { 'AI tools': '🤖', Automation: '⚙️', Browser: '🧩', Career: '💼', Culture: '🎭', Data: '📊', Games: '🎮', Learning: '📖', 'Personal tools': '🛠️', Travel: '🧳' };
const iconFor = (p) => (icons.find(([re]) => re.test(p.name)) || [0, catIcon[p.category] || '📁'])[1];

// ---------- renderer / scene ----------
const canvas = document.querySelector('#view');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); }
catch (e) { document.querySelector('#nogl').hidden = false; throw e; }
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor('#16241a');
const scene = new THREE.Scene();
const PX = innerWidth > 1800 ? 3 : 2;

const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 160 });
scene.add(sun, sun.target, new THREE.HemisphereLight('#a9c4e8', '#2a3a22', 1.35));

const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -300, 400);

// ---------- world layout ----------
const world = new THREE.Group(); scene.add(world);
const colliders = [];            // {x1,x2,z1,z2}
const blockers = [];             // rects where trees must not grow
const buildings = [];
const lanes = [];                // walkable routes for pedestrians

const byCat = new Map();
projects.forEach((p) => { if (!byCat.has(p.category)) byCat.set(p.category, []); byCat.get(p.category).push(p); });
const cats = [...byCat.keys()].sort((a, b) => byCat.get(b).length - byCat.get(a).length || a.localeCompare(b));

const STREET_HALF = 5, LANE_W = 5, PITCH = 9, DIST_W = 25;
const WORLD = { x1: -88, x2: 104, z1: -96, z2: 96 };

function plane(w, d, tex, x, z, y = 0.02, receive = true) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = receive; world.add(m); return m;
}

// ground
{
  const w = WORLD.x2 - WORLD.x1, d = WORLD.z2 - WORLD.z1;
  plane(w, d, grassTexture([w / 8, d / 8]), (WORLD.x1 + WORLD.x2) / 2, 0, 0);
}
// main street + sidewalks
const STREET_X1 = -74, STREET_X2 = 100;
plane(STREET_X2 - STREET_X1, STREET_HALF * 2, pavementTexture([(STREET_X2 - STREET_X1) / 6, 10 / 6], '#8c817a'), (STREET_X1 + STREET_X2) / 2, 0);
for (const s of [-1, 1]) plane(STREET_X2 - STREET_X1, 2.2, pavementTexture([(STREET_X2 - STREET_X1) / 6, 2.2 / 6], '#a39a90'), (STREET_X1 + STREET_X2) / 2, s * (STREET_HALF + 1.1), 0.03);
blockers.push({ x1: STREET_X1, x2: STREET_X2, z1: -STREET_HALF - 3, z2: STREET_HALF + 3 });
lanes.push({ ax: STREET_X1 + 4, az: 0, bx: 78, bz: 0, spread: 3.2, horizontal: true });

// districts
const north = [], south = [];
cats.forEach((c, i) => (i % 2 ? south : north).push(c));
function placeRow(row, sign) {
  const total = row.length * DIST_W; let x = -total / 2 - 5;
  row.forEach((cat) => {
    const list = byCat.get(cat), color = colorOf(cat), cx = x + DIST_W / 2, rows = Math.ceil(list.length / 2), len = rows * PITCH + 6;
    const z0 = sign * (STREET_HALF + 2.2), zc = sign * (STREET_HALF + 2.2 + len / 2);
    // lane
    plane(LANE_W, len, pavementTexture([LANE_W / 6, len / 6], '#9a9086'), cx, zc, 0.03);
    plane(LANE_W + 2.4, len, pavementTexture([(LANE_W + 2.4) / 6, len / 6], '#6f6860'), cx, zc, 0.025);
    blockers.push({ x1: cx - 6, x2: cx + 6, z1: Math.min(z0, z0 + sign * len), z2: Math.max(z0, z0 + sign * len) });
    lanes.push({ ax: cx, az: z0, bx: cx, bz: z0 + sign * (len - 3), spread: 1.4, horizontal: false });
    // district sign at the lane mouth
    const signTex = signTexture(cat, `${list.length} project${list.length === 1 ? '' : 's'}`, color);
    const post = makeSignPost(signTex); post.position.set(cx, 0, sign * (STREET_HALF + 3.2)); post.rotation.y = sign < 0 ? 0 : Math.PI;
    world.add(post); for (const px of [-1.9, 1.9]) colliders.push({ x1: cx + px - 0.25, x2: cx + px + 0.25, z1: sign * (STREET_HALF + 3.2) - 0.25, z2: sign * (STREET_HALF + 3.2) + 0.25 });
    // buildings
    list.forEach((p, idx) => {
      const side = idx % 2 ? 1 : -1, rowI = Math.floor(idx / 2);
      const b = makeBuilding(p, color), { w, d } = b.userData;
      const bx = cx + side * (3.2 + d / 2), bz = sign * (STREET_HALF + 2.2 + 2 + w / 2 + rowI * PITCH);
      b.position.set(bx, 0, bz); b.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      world.add(b);
      const door = { x: bx - side * (d / 2 + 1.4), z: bz };
      const rec = { project: p, color, group: b, x: bx, z: bz, door, height: b.userData.height, icon: iconFor(p), hx: d / 2 + 0.3, hz: w / 2 + 0.3 };
      colliders.push({ x1: bx - rec.hx, x2: bx + rec.hx, z1: bz - rec.hz, z2: bz + rec.hz });
      blockers.push({ x1: bx - d / 2 - 1.5, x2: bx + d / 2 + 1.5, z1: bz - w / 2 - 1.5, z2: bz + w / 2 + 1.5 });
      // invisible pick volume
      const pick = new THREE.Mesh(new THREE.BoxGeometry(d, rec.height, w), new THREE.MeshBasicMaterial({ visible: false }));
      pick.position.set(bx, rec.height / 2, bz); pick.userData.rec = rec; world.add(pick); rec.pick = pick;
      buildings.push(rec);
    });
    x += DIST_W;
  });
}
placeRow(north, -1); placeRow(south, 1);

// river and bridge on the east edge
const RIVER = { x1: 82, x2: 89 };
const waterTex = waterTexture([3, 40]);
plane(RIVER.x2 - RIVER.x1, WORLD.z2 - WORLD.z1, waterTex, (RIVER.x1 + RIVER.x2) / 2, 0, 0.05, false);
for (const s of [-1, 1]) world.add(box(0.8, 0.5, WORLD.z2 - WORLD.z1, lam('#6f6a60'), s < 0 ? RIVER.x1 - 0.2 : RIVER.x2 + 0.2, -0.1, 0, false));
{
  const wood = lam('#ffffff', { map: woodTexture([4, 2]) });
  world.add(box(RIVER.x2 - RIVER.x1 + 2, 0.35, STREET_HALF * 2, wood, 85.5, 0.1, 0));
  for (const s of [-1, 1]) world.add(box(RIVER.x2 - RIVER.x1 + 2, 0.7, 0.2, '#4a3524', 85.5, 0.45, s * (STREET_HALF - 0.1)));
  colliders.push({ x1: RIVER.x1, x2: RIVER.x2, z1: WORLD.z1, z2: -STREET_HALF + 0.2 }, { x1: RIVER.x1, x2: RIVER.x2, z1: STREET_HALF - 0.2, z2: WORLD.z2 });
  blockers.push({ x1: RIVER.x1 - 2, x2: RIVER.x2 + 2, z1: WORLD.z1, z2: WORLD.z2 });
}

// street furniture
{
  const r = rng(99);
  for (let x = STREET_X1 + 6; x < 80; x += 12) for (const s of [-1, 1]) {
    const l = makeLamp(); l.position.set(x, 0, s * (STREET_HALF + 0.9)); l.rotation.y = s < 0 ? 0 : Math.PI; world.add(l);
  }
  for (let x = STREET_X1 + 14; x < 78; x += 17) for (const s of [-1, 1]) {
    if (r() > 0.55) { const b = makeBench(); b.position.set(x, 0, s * (STREET_HALF + 1.6)); b.rotation.y = s < 0 ? 0 : Math.PI; world.add(b); }
    else if (r() > 0.4) { const t = makeUmbrellaTable(['#d8603c', '#3c8fd8', '#d8b13c', '#d8d4c8'][Math.floor(r() * 4)]); t.position.set(x + 3, 0, s * (STREET_HALF + 2.2)); world.add(t); }
  }
  for (let i = 0; i < 40; i++) { // bushes along sidewalks
    const b = makeBush(i); b.position.set(STREET_X1 + r() * 150, 0, (r() > 0.5 ? 1 : -1) * (STREET_HALF + 3.6)); world.add(b);
  }
  const welcome = makeSignPost(signTexture('Hayville', 'projects by Haywood Ho', '#16233a'), 5.4, 1.9);
  welcome.position.set(-8, 0, 4.4); welcome.rotation.y = Math.PI; world.add(welcome);
}

// trees (instanced)
{
  const r = rng(2024), spots = [];
  const inRect = (x, z, b, m) => x > b.x1 - m && x < b.x2 + m && z > b.z1 - m && z < b.z2 + m;
  for (let i = 0; i < 4200 && spots.length < 900; i++) {
    const x = WORLD.x1 + 2 + r() * (WORLD.x2 - WORLD.x1 - 4), z = WORLD.z1 + 2 + r() * (WORLD.z2 - WORLD.z1 - 4);
    if (blockers.some((b) => inRect(x, z, b, 1.4))) continue;
    spots.push({ x, z, s: 0.8 + r() * 0.8 });
  }
  const parts = [
    { geo: new THREE.CylinderGeometry(0.18, 0.28, 1.8, 5), y: 0.9, mat: lam('#4a3524'), color: false },
    { geo: new THREE.ConeGeometry(1.8, 2.2, 6), y: 2.4, mat: new THREE.MeshLambertMaterial(), color: true },
    { geo: new THREE.ConeGeometry(1.4, 2, 6), y: 3.5, mat: new THREE.MeshLambertMaterial(), color: true },
    { geo: new THREE.ConeGeometry(0.95, 1.8, 6), y: 4.5, mat: new THREE.MeshLambertMaterial(), color: true },
  ];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), tint = new THREE.Color();
  const greens = ['#1c4220', '#25502a', '#2c5a2b', '#336630', '#1f4a2d'];
  parts.forEach((part) => {
    const im = new THREE.InstancedMesh(part.geo, part.mat, spots.length); im.castShadow = true; im.receiveShadow = true;
    spots.forEach((sp, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 1.7) % 6.28);
      m4.compose(new THREE.Vector3(sp.x, part.y * sp.s, sp.z), q, new THREE.Vector3(sp.s, sp.s, sp.s));
      im.setMatrixAt(i, m4);
      if (part.color) { tint.set(greens[(i * 7 + part.y * 3 | 0) % greens.length]); im.setColorAt(i, tint); }
    });
    world.add(im);
  });
}

// ---------- people ----------
const player = makePerson(4242, { shirt: '#a83a19', hair: '#1d1612' });
player.position.set(0, 0, 1); scene.add(player);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; scene.add(ring);

// a faint silhouette so you can still find yourself when a building is in the way
const ghost = player.clone(true), ghostMat = new THREE.MeshBasicMaterial({ color: '#ffb199', transparent: true, opacity: 0.55, depthFunc: THREE.GreaterDepth, depthWrite: false });
ghost.traverse((o) => { if (o.isMesh) { o.material = ghostMat; o.castShadow = false; o.renderOrder = 5; } });
scene.add(ghost);
const syncGhost = (a, b) => { b.position.copy(a.position); b.rotation.copy(a.rotation); a.children.forEach((c, i) => syncGhost(c, b.children[i])); };

const walkers = [];
{
  const r = rng(77);
  for (let i = 0; i < 46; i++) {
    const lane = lanes[Math.floor(r() * lanes.length)], p = makePerson(1000 + i);
    const off = (r() - 0.5) * 2 * lane.spread;
    const a = lane.horizontal ? { x: lane.ax + r() * (lane.bx - lane.ax), z: off } : { x: lane.ax + off, z: lane.az };
    const b = lane.horizontal ? { x: lane.ax + r() * (lane.bx - lane.ax), z: off } : { x: lane.ax + off, z: lane.bz };
    p.position.set(a.x, 0, a.z); world.add(p);
    walkers.push({ p, a, b, t: r(), dir: r() > 0.5 ? 1 : -1, speed: 0.9 + r() * 0.9, phase: r() * 9 });
  }
}

// ---------- interiors ----------
const INT = { x: 5000, z: 0, hx: 6.6, hz: 5.6 };
const interior = new THREE.Group(); interior.visible = false; scene.add(interior);
let interiorBlockers = [];
const exitPoint = { x: INT.x + 5.5, z: INT.z + 4.6 };

function buildInterior(rec) {
  interior.clear();
  const { project, color } = rec;
  const floorTex = woodTexture([7, 6], mixHex('#8a6a46', color, 0.1));
  const floor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 12), [lam('#3a3128'), lam('#3a3128'), new THREE.MeshLambertMaterial({ map: floorTex }), lam('#2a241e'), lam('#3a3128'), lam('#3a3128')]);
  floor.position.set(INT.x, -0.25, INT.z); floor.receiveShadow = true; interior.add(floor);
  const wallC = mixHex('#d8d2c4', color, 0.12);
  interior.add(box(14.4, 4.6, 0.4, wallC, INT.x, 0, INT.z - 6.2), box(0.4, 4.6, 12.4, wallC, INT.x - 7.2, 0, INT.z));
  const glass = new THREE.MeshBasicMaterial({ color: '#8fb8e0' });
  for (const wx of [-4.6, 4.6]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), glass); w.position.set(INT.x + wx + 0, 2.5, INT.z - 5.98); interior.add(w); }
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.3), new THREE.MeshBasicMaterial({ map: posterTexture(project, color) }));
  poster.position.set(INT.x, 2.35, INT.z - 5.97); interior.add(poster);
  const f = furnishInterior(interiorKind[project.category] || 'office', INT, color, hash(project.name));
  f.position.set(INT.x, 0, INT.z); interior.add(f);
  const mat = box(1.6, 0.05, 1.2, mixHex(color, '#000000', 0.2), exitPoint.x, 0, exitPoint.z, false); interior.add(mat);
  interiorBlockers = [];
}

// ---------- state ----------
const keys = new Set();
const cam = { yaw: Math.PI / 4, targetYaw: Math.PI / 4, zoom: 0.8, panX: 0, panZ: 0, x: 0, z: 0 };
let mode = 'town', path = [], pendingEnter = null, near = null, hover = null, lastTown = { x: 0, z: 1 }, time = 0, fading = false;
const pos = () => player.position;

// ---------- DOM ----------
const pinsEl = document.querySelector('#pins'), hint = document.querySelector('#hint'), card = document.querySelector('#card');
const nameTag = document.querySelector('#you'), exitBtn = document.querySelector('#leave'), fade = document.querySelector('#fade');
const exitPin = document.createElement('div'); exitPin.className = 'pin exit'; exitPin.innerHTML = '<span class="ico">🚪</span><span class="nm">Exit</span>'; pinsEl.append(exitPin); exitPin.hidden = true;
buildings.forEach((b) => {
  const el = document.createElement('div'); el.className = 'pin'; el.style.setProperty('--c', b.color);
  el.innerHTML = '<span class="ico"></span><span class="nm"></span>';
  el.children[0].textContent = b.icon; el.children[1].textContent = b.project.name;
  el.addEventListener('click', () => requestEnter(b));
  pinsEl.append(el); b.pin = el;
});
const v3 = new THREE.Vector3();
function place(el, x, y, z) {
  v3.set(x, y, z).project(camera);
  if (v3.z > 1 || Math.abs(v3.x) > 1.15 || Math.abs(v3.y) > 1.15) { el.style.display = 'none'; return; }
  el.style.display = ''; el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * innerWidth}px, ${(-v3.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
}

const districtNav = document.querySelector('#districts');
cats.forEach((cat) => {
  const b = document.createElement('button'); b.type = 'button'; b.style.setProperty('--c', colorOf(cat));
  b.innerHTML = '<i></i>'; b.append(`${cat} · ${byCat.get(cat).length}`);
  b.addEventListener('click', () => {
    if (mode !== 'town') return;
    const rec = buildings.find((x) => x.project.category === cat); path = []; pendingEnter = null;
    pos().set(rec.door.x, 0, rec.door.z); cam.panX = cam.panZ = 0; closeCard();
  });
  districtNav.append(b);
});

function openCard(rec) {
  card.style.setProperty('--c', rec.color);
  card.querySelector('.cat').textContent = rec.project.category;
  card.querySelector('h2').textContent = rec.project.name;
  card.querySelector('.desc').textContent = rec.project.description;
  const a = card.querySelector('a'); let ok = false;
  if (rec.project.github) { const u = new URL(rec.project.github); ok = u.protocol === 'https:' && u.hostname === 'github.com'; if (ok) a.href = u.href; }
  a.hidden = !ok; card.hidden = false;
}
function closeCard() { card.hidden = true; }
card.querySelector('.x').addEventListener('click', closeCard);

// ---------- enter / exit ----------
function requestEnter(rec) {
  if (mode !== 'town' || fading) return;
  if (Math.hypot(pos().x - rec.door.x, pos().z - rec.door.z) < 2.6) enter(rec);
  else { setGoal(rec.door.x, rec.door.z); pendingEnter = rec; }
}
function transition(fn) {
  fading = true; fade.classList.add('on');
  setTimeout(() => { fn(); fade.classList.remove('on'); setTimeout(() => { fading = false; }, 250); }, 260);
}
function enter(rec) {
  transition(() => {
    lastTown = { x: rec.door.x, z: rec.door.z }; mode = 'inside'; pendingEnter = null; path = [];
    buildInterior(rec); world.visible = false; interior.visible = true;
    pos().set(INT.x + 1.5, 0, INT.z + 1.2); cam.yaw = cam.targetYaw = Math.PI / 4; cam.panX = cam.panZ = 0; cam.zoom = 1.75;
    openCard(rec); exitBtn.hidden = false; districtNav.classList.add('off');
    for (const b of buildings) b.pin.style.display = 'none';
    nearBuilding(true);
  });
}
function leave() {
  if (mode !== 'inside' || fading) return;
  transition(() => {
    mode = 'town'; world.visible = true; interior.visible = false; path = [];
    pos().set(lastTown.x, 0, lastTown.z); cam.zoom = 0.8; cam.panX = cam.panZ = 0; closeCard(); exitBtn.hidden = true; districtNav.classList.remove('off');
  });
}
exitBtn.addEventListener('click', leave);

// ---------- input ----------
const moveKeys = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.activeElement && ['BUTTON', 'A', 'INPUT'].includes(document.activeElement.tagName) && (e.key === ' ' || e.key === 'Enter')) return;
  dismissWelcome();
  if (moveKeys[e.key]) { keys.add(moveKeys[e.key]); path = []; pendingEnter = null; e.preventDefault(); }
  else if (e.key === 'q' || e.key === 'Q') { if (mode === 'town') cam.targetYaw -= Math.PI / 2; }
  else if (e.key === 'r' || e.key === 'R') { if (mode === 'town') cam.targetYaw += Math.PI / 2; }
  else if (e.key === 'Escape') { if (!card.hidden && mode === 'town') closeCard(); else leave(); }
  else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (mode === 'town' && near) enter(near);
    else if (mode === 'inside' && Math.hypot(pos().x - exitPoint.x, pos().z - exitPoint.z) < 2.2) leave();
  }
});
addEventListener('keyup', (e) => keys.delete(moveKeys[e.key]));
addEventListener('blur', () => keys.clear());

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function cast(e) { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); }
function pickBuilding(e) {
  if (mode !== 'town') return null; cast(e);
  const hit = ray.intersectObjects(buildings.map((b) => b.pick), false)[0]; return hit ? hit.object.userData.rec : null;
}
function pickGround(e) { cast(e); return ray.ray.intersectPlane(groundPlane, new THREE.Vector3()); }

let drag = null;
canvas.addEventListener('pointerdown', (e) => { dismissWelcome(); drag = { x: e.clientX, y: e.clientY, px: cam.panX, pz: cam.panZ, moved: false }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; canvas.classList.add('dragging'); }
    if (drag.moved) { // screen-space drag -> world pan
      const s = (viewH() / innerHeight), sy = s / Math.sin(CAM_PITCH);
      const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw), fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
      cam.panX = drag.px - dx * s * rx + dy * sy * fx; cam.panZ = drag.pz - dx * s * rz + dy * sy * fz;
    }
  } else if (e.pointerType === 'mouse') { hover = pickBuilding(e); canvas.classList.toggle('pointing', !!hover); }
});
canvas.addEventListener('pointerup', (e) => {
  const was = drag; drag = null; canvas.classList.remove('dragging');
  if (!was || was.moved) return;
  const b = pickBuilding(e);
  if (b) return requestEnter(b);
  const g = pickGround(e);
  if (g) { pendingEnter = null; setGoal(g.x, g.z); if (mode === 'town') closeCard(); }
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.zoom = Math.max(0.4, Math.min(2.4, cam.zoom * Math.exp(-e.deltaY * 0.0012))); }, { passive: false });

const welcome = document.querySelector('#welcome');
function dismissWelcome() { if (!welcome.hidden) welcome.hidden = true; }
welcome.querySelector('button').addEventListener('click', dismissWelcome);

// ---------- update ----------
const CAM_PITCH = 0.62;                 // radians above the horizon
const viewH = () => 38 / cam.zoom;  // world units visible vertically
function resize() {
  renderer.setSize(Math.round(innerWidth / PX), Math.round(innerHeight / PX), false);
  canvas.style.width = '100%'; canvas.style.height = '100%';
}
addEventListener('resize', resize); resize();

const SPEED = 7.2, R = 0.35;
function blocked(x, z) {
  if (mode === 'inside') return x < INT.x - INT.hx || x > INT.x + INT.hx || z < INT.z - INT.hz || z > INT.z + INT.hz;
  return blockedTown(x, z);
}
function blockedTown(x, z) {
  if (x < WORLD.x1 + 1 || x > WORLD.x2 - 1 || z < WORLD.z1 + 1 || z > WORLD.z2 - 1) return true;
  return colliders.some((c) => x + R > c.x1 && x - R < c.x2 && z + R > c.z1 && z - R < c.z2);
}
function nearBuilding(clear) {
  near = null; if (clear || mode !== 'town') return;
  let best = 3.2;
  for (const b of buildings) { const d = Math.hypot(pos().x - b.door.x, pos().z - b.door.z); if (d < best) { best = d; near = b; } }
}

// A* over a coarse grid of the town, so click-to-walk goes around buildings instead of into them.
const CELL = 0.75, GW = Math.ceil((WORLD.x2 - WORLD.x1) / CELL), GH = Math.ceil((WORLD.z2 - WORLD.z1) / CELL);
const grid = new Int8Array(GW * GH);   // 0 unknown, 1 free, -1 blocked
const cellOf = (x, z) => [Math.floor((x - WORLD.x1) / CELL), Math.floor((z - WORLD.z1) / CELL)];
function isFree(cx, cz) {
  if (cx < 0 || cz < 0 || cx >= GW || cz >= GH) return false;
  const i = cz * GW + cx;
  if (!grid[i]) grid[i] = blockedTown(WORLD.x1 + (cx + 0.5) * CELL, WORLD.z1 + (cz + 0.5) * CELL) ? -1 : 1;
  return grid[i] > 0;
}
function clearLine(a, b) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.3);
  for (let i = 1; i < n; i++) if (blockedTown(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false;
  return true;
}
function findPath(from, to) {
  let [sx, sz] = cellOf(from.x, from.z), [gx, gz] = cellOf(to.x, to.z);
  if (!isFree(gx, gz)) {                                   // goal inside something: use the nearest free cell
    let found = false;
    for (let r = 1; r < 14 && !found; r++) for (let dx = -r; dx <= r && !found; dx++) for (let dz = -r; dz <= r && !found; dz++)
      if (Math.max(Math.abs(dx), Math.abs(dz)) === r && isFree(gx + dx, gz + dz)) { gx += dx; gz += dz; found = true; }
    if (!found) return [];
  }
  const gScore = new Map([[sz * GW + sx, 0]]), came = new Map(), open = [[0, sx, sz]], closed = new Set();
  const h = (x, z) => { const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
  let steps = 0, end = null;
  while (open.length && steps++ < 40000) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, x, z] = open.splice(bi, 1)[0], id = z * GW + x;
    if (closed.has(id)) continue; closed.add(id);
    if (x === gx && z === gz) { end = id; break; }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const nx = x + dx, nz = z + dz, nid = nz * GW + nx;
      if (closed.has(nid) || !isFree(nx, nz) || (dx && dz && (!isFree(x + dx, z) || !isFree(x, z + dz)))) continue;
      const g = gScore.get(id) + (dx && dz ? Math.SQRT2 : 1);
      if (g < (gScore.get(nid) ?? Infinity)) { gScore.set(nid, g); came.set(nid, id); open.push([g + h(nx, nz), nx, nz]); }
    }
  }
  if (end === null) return [];
  const pts = [];
  for (let id = end; id !== undefined; id = came.get(id)) pts.push({ x: WORLD.x1 + ((id % GW) + 0.5) * CELL, z: WORLD.z1 + (Math.floor(id / GW) + 0.5) * CELL });
  pts.reverse(); pts[pts.length - 1] = to.exact && isFree(...cellOf(to.x, to.z)) ? { x: to.x, z: to.z } : pts[pts.length - 1];
  const out = []; let anchor = from, i = 0;                // string-pull: skip waypoints we can see past
  while (i < pts.length) {
    let j = pts.length - 1; while (j > i && !clearLine(anchor, pts[j])) j--;
    out.push(pts[j]); anchor = pts[j]; i = j + 1;
  }
  return out;
}
function setGoal(x, z) {
  if (mode === 'inside') { path = [{ x, z }]; return; }
  path = findPath({ x: pos().x, z: pos().z }, { x, z, exact: true });
}

let moving = false;
function update(dt) {
  // movement
  const f = [-Math.sin(cam.yaw), -Math.cos(cam.yaw)], rgt = [Math.cos(cam.yaw), -Math.sin(cam.yaw)];
  let ix = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), iz = (keys.has('u') ? 1 : 0) - (keys.has('d') ? 1 : 0);
  let dx = rgt[0] * ix + f[0] * iz, dz = rgt[1] * ix + f[1] * iz;
  if (!dx && !dz && path.length) {
    const tx = path[0].x - pos().x, tz = path[0].z - pos().z, d = Math.hypot(tx, tz);
    if (d < 0.3) { path.shift(); if (!path.length && pendingEnter) { const b = pendingEnter; pendingEnter = null; mode === 'town' && enter(b); } }
    else { dx = tx / d; dz = tz / d; }
  }
  const len = Math.hypot(dx, dz), before = pos().clone(); moving = false;
  if (len) {
    const step = SPEED * dt / len, nx = pos().x + dx * step, nz = pos().z + dz * step;
    if (!blocked(nx, pos().z)) pos().x = nx;
    if (!blocked(pos().x, nz)) pos().z = nz;
    moving = before.distanceTo(pos()) > step * 0.2;
    if (moving) player.rotation.y = Math.atan2(dx, dz);
    else if (path.length) { path = []; pendingEnter = null; }
    if (keys.size) { cam.panX *= 0.9; cam.panZ *= 0.9; }
  }
  animateWalk(player, time, moving ? 1 : 0); if (!moving) { player.userData.legL.rotation.x = player.userData.legR.rotation.x = player.userData.armL.rotation.x = player.userData.armR.rotation.x = 0; }
  syncGhost(player, ghost);
  ring.position.set(pos().x, 0.06, pos().z);
  nearBuilding();

  // pedestrians
  if (mode === 'town') for (const w of walkers) {
    const len2 = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z) || 1; w.t += (w.dir * w.speed * dt) / len2;
    if (w.t > 1 || w.t < 0) { w.t = Math.max(0, Math.min(1, w.t)); w.dir *= -1; }
    const x = w.a.x + (w.b.x - w.a.x) * w.t, z = w.a.z + (w.b.z - w.a.z) * w.t;
    w.p.position.set(x, 0, z); w.p.rotation.y = Math.atan2((w.b.x - w.a.x) * w.dir, (w.b.z - w.a.z) * w.dir);
    animateWalk(w.p, time + w.phase, 0.8);
  }
  waterTex.offset.y = (time * 0.04) % 1;

  // camera
  cam.yaw += (cam.targetYaw - cam.yaw) * (1 - Math.pow(0.0004, dt));
  const k = 1 - Math.pow(0.002, dt);
  cam.x += (pos().x + cam.panX - cam.x) * k; cam.z += (pos().z + cam.panZ - cam.z) * k;
  const h = viewH(), w = h * (innerWidth / innerHeight);
  Object.assign(camera, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2 }); camera.updateProjectionMatrix();
  const dist = 120, cx = Math.sin(cam.yaw) * Math.cos(CAM_PITCH), cz = Math.cos(cam.yaw) * Math.cos(CAM_PITCH);
  camera.position.set(cam.x + cx * dist, Math.sin(CAM_PITCH) * dist, cam.z + cz * dist); camera.lookAt(cam.x, 0, cam.z);
  sun.position.set(cam.x + 34, 58, cam.z + 22); sun.target.position.set(cam.x, 0, cam.z); sun.target.updateMatrixWorld();
  camera.updateMatrixWorld();

  // overlay
  if (mode === 'town') {
    for (const b of buildings) {
      place(b.pin, b.x, b.height + 0.6, b.z);
      b.pin.classList.toggle('on', b === near || b === hover);
    }
    exitPin.hidden = true;
    hint.textContent = near ? (matchMedia('(pointer: coarse)').matches ? `Tap ${near.project.name} to enter` : `Press E to enter ${near.project.name}`) : '';
  } else {
    exitPin.hidden = false; place(exitPin, exitPoint.x, 2.2, exitPoint.z);
    const atExit = Math.hypot(pos().x - exitPoint.x, pos().z - exitPoint.z) < 2.2;
    hint.textContent = atExit ? 'Press E to leave' : 'Walk to the mat by the door to leave, or press Esc.';
  }
  place(nameTag, pos().x, 2.1, pos().z);
  hint.hidden = !hint.textContent;
}

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  update(dt); renderer.render(scene, camera);
});
window.__town = { buildings, player, cam, enter, leave, get mode() { return mode; } };
document.body.classList.add('ready');

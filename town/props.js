// Low-poly builders: buildings, people, trees, street furniture and interior furniture.
import * as THREE from 'three';
import { hash, rng, mixHex, facadeTexture, roofTexture, screenTexture, woodTexture, carpetTexture } from './textures.js';

const matCache = new Map();
export const lam = (color, extra = {}) => {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...extra }));
  return matCache.get(key);
};
export function box(w, h, d, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof mat === 'string' ? lam(mat) : mat);
  m.position.set(x, y + h / 2, z); m.castShadow = shadow; m.receiveShadow = true; return m;
}
const cyl = (rt, rb, h, seg, mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof mat === 'string' ? lam(mat) : mat);
  m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; return m;
};

// ---------- people ----------
const SKIN = ['#f2d2b3', '#d9a77c', '#a8754d', '#7a4e32', '#e8bf9a'];
const HAIR = ['#1d1612', '#3a2a1c', '#6b4a2b', '#a8782f', '#d8d0c4', '#8a2a1c'];
const SHIRT = ['#2a3a52', '#a83a19', '#d8d4c8', '#3f6a4a', '#6a3f7a', '#c8a02a', '#2b2b30', '#4a6c9c'];
const PANTS = ['#1f2530', '#3a3328', '#2c3a4a', '#4a4036'];

export function makePerson(seed, { shirt, hair } = {}) {
  const r = rng(seed), pick = (a) => a[Math.floor(r() * a.length)];
  const g = new THREE.Group();
  const skin = pick(SKIN), top = shirt || pick(SHIRT), pants = pick(PANTS), hairC = hair || pick(HAIR);
  const legL = box(0.2, 0.6, 0.22, pants, -0.13, 0, 0), legR = box(0.2, 0.6, 0.22, pants, 0.13, 0, 0);
  legL.geometry.translate(0, 0.3, 0); legR.geometry.translate(0, 0.3, 0);          // pivot at hip
  legL.position.y = 0.6; legR.position.y = 0.6;
  const torso = box(0.52, 0.62, 0.3, top, 0, 0.6, 0);
  const armL = box(0.16, 0.56, 0.18, top, -0.35, 0, 0), armR = box(0.16, 0.56, 0.18, top, 0.35, 0, 0);
  armL.geometry.translate(0, -0.25, 0); armR.geometry.translate(0, -0.25, 0);
  armL.position.y = 1.15; armR.position.y = 1.15;
  const head = box(0.32, 0.32, 0.32, skin, 0, 1.22, 0);
  const hairM = box(0.35, 0.14, 0.35, hairC, 0, 1.46, 0), back = box(0.35, 0.3, 0.1, hairC, 0, 1.22, -0.13);
  g.add(legL, legR, torso, armL, armR, head, hairM, back);
  g.userData = { legL, legR, armL, armR };
  g.scale.setScalar(1.05);
  return g;
}
export function animateWalk(person, t, speed) {
  const { legL, legR, armL, armR } = person.userData, a = Math.sin(t * 9) * 0.7 * speed;
  legL.rotation.x = a; legR.rotation.x = -a; armL.rotation.x = -a; armR.rotation.x = a;
}
export function sitPose(person) {
  const { legL, legR } = person.userData; legL.rotation.x = legR.rotation.x = -1.4; person.position.y = -0.2;
}

// ---------- buildings ----------
export function makeBuilding(project, color) {
  const h = hash(project.name), r = rng(h);
  const floors = 1 + (h >>> 4) % 3, w = 5 + (h % 3) * 0.8, d = 5 + ((h >>> 3) % 3) * 0.7, fh = 3.1;
  const palettes = ['#c9b89a', '#9a8f86', '#8f6a58', '#b7b2a6', '#5a6572', '#d3c3a8'];
  const wall = palettes[(h >>> 7) % palettes.length];
  const roofColor = mixHex(color, '#000000', 0.35 + ((h >>> 11) % 3) * 0.08);
  const g = new THREE.Group();

  const front = lam('#ffffff', { map: facadeTexture({ wall, accent: color, floors, door: true, seed: h }) });
  const side = lam('#ffffff', { map: facadeTexture({ wall, accent: color, floors, door: false, seed: h + 1 }) });
  const roofFlat = lam(mixHex(wall, '#000000', 0.35));
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, floors * fh, d), [side, side, roofFlat, roofFlat, front, side]);
  body.position.y = (floors * fh) / 2; body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  const top = floors * fh, style = (h >>> 14) % 3, roofMat = lam('#ffffff', { map: roofTexture(roofColor, [1, 1]) });
  if (style === 0) {                                  // hip roof
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7071, 1, 4), roofMat);
    cone.rotation.y = Math.PI / 4; cone.scale.set(w + 0.8, 1.9 + r() * 0.5, d + 0.8); cone.position.y = top + cone.scale.y / 2;
    cone.castShadow = true; g.add(cone);
  } else if (style === 1) {                           // gable roof
    const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.3, 0); s.lineTo(w / 2 + 0.3, 0); s.lineTo(0, 1.8); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: d + 0.8, bevelEnabled: false }); geo.translate(0, 0, -(d + 0.8) / 2);
    const m = new THREE.Mesh(geo, roofMat); m.position.y = top; m.castShadow = true; g.add(m);
  } else {                                            // flat roof with parapet and rooftop kit
    g.add(box(w + 0.3, 0.4, d + 0.3, roofFlat, 0, top));
    g.add(box(1.4, 0.8, 1.1, '#6f7680', (r() - 0.5) * (w - 2), top + 0.4, (r() - 0.5) * (d - 2)));
    g.add(box(0.6, 0.5, 0.6, color, w / 2 - 0.8, top + 0.4, -d / 2 + 0.8));
  }
  // entrance step
  g.add(box(2.4, 0.15, 1.2, '#6e6862', 0, 0, d / 2 + 0.5, false));
  g.userData = { w, d, height: top + 2.2, floors };
  return g;
}

// ---------- outdoor props ----------
export function makeLamp() {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.09, 3.6, 6, '#1d2127', 0, 0, 0));
  g.add(box(0.5, 0.2, 0.3, '#1d2127', 0.2, 3.5, 0));
  g.add(box(0.36, 0.1, 0.2, new THREE.MeshBasicMaterial({ color: '#ffe9a8' }), 0.28, 3.4, 0, false));
  return g;
}
export function makeBench() {
  const g = new THREE.Group(), wood = '#7a5a3a';
  g.add(box(1.6, 0.1, 0.5, wood, 0, 0.45, 0), box(1.6, 0.5, 0.08, wood, 0, 0.6, -0.24), box(0.08, 0.45, 0.45, '#1d2127', -0.7, 0, 0), box(0.08, 0.45, 0.45, '#1d2127', 0.7, 0, 0));
  return g;
}
export function makeUmbrellaTable(color) {
  const g = new THREE.Group();
  g.add(cyl(0.45, 0.45, 0.06, 10, '#d8d4c8', 0, 0.8, 0), cyl(0.05, 0.05, 0.8, 6, '#1d2127', 0, 0, 0), cyl(0.04, 0.04, 2, 6, '#1d2127', 0, 0, 0));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 8), lam(color)); cone.position.y = 2.2; cone.castShadow = true; g.add(cone);
  [[0.8, 0], [-0.8, 0]].forEach(([x, z]) => g.add(box(0.4, 0.45, 0.4, '#2b2b30', x, 0, z)));
  return g;
}
export function makeTree(seed) {
  const r = rng(seed), g = new THREE.Group(), s = 0.8 + r() * 0.7;
  const greens = ['#1f4a22', '#2a5a2a', '#24502a', '#33612c'];
  g.add(cyl(0.18 * s, 0.26 * s, 1.8 * s, 5, '#4a3524', 0, 0, 0));
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry((1.7 - i * 0.4) * s, (2 + r() * 0.3) * s, 6), lam(greens[Math.floor(r() * greens.length)]));
    c.position.y = (1.7 + i * 1.1) * s; c.castShadow = true; g.add(c);
  }
  return g;
}
export function makeBush(seed) {
  const r = rng(seed), m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + r() * 0.4, 0), lam('#2f5c2b'));
  m.position.y = 0.4; m.castShadow = true; return m;
}
export function makeSignPost(texture, w = 4.4, h = 1.65) {
  const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ map: texture });
  g.add(box(0.2, 2.4, 0.2, '#3a2c20', -w / 2 + 0.3, 0, 0), box(0.2, 2.4, 0.2, '#3a2c20', w / 2 - 0.3, 0, 0));
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), [lam('#3a2c20'), lam('#3a2c20'), lam('#3a2c20'), lam('#3a2c20'), mat, lam('#3a2c20')]);
  board.position.y = 2.2; board.castShadow = true; g.add(board);
  return g;
}

// ---------- interiors ----------
export function furnishInterior(kind, room, color, seed) {
  const r = rng(seed), f = new THREE.Group();
  const wood = lam('#ffffff', { map: woodTexture([1, 1], '#b08a5a') }), dark = '#262b33', add = (...o) => f.add(...o);
  const desk = (x, z, rot = 0, withPerson = true) => {
    const d = new THREE.Group();
    d.add(box(2.4, 0.1, 1.1, wood, 0, 0.75, 0), box(0.1, 0.75, 1, dark, -1.1, 0, 0), box(0.1, 0.75, 1, dark, 1.1, 0, 0));
    for (const mx of [-0.6, 0.6]) {
      d.add(box(0.7, 0.45, 0.05, '#15181d', mx, 0.9, -0.2));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.38), new THREE.MeshBasicMaterial({ map: screenTexture(color, seed + x * 7 + z * 13 + mx * 5) }));
      scr.position.set(mx, 1.12, -0.17); d.add(scr);
      d.add(box(0.1, 0.18, 0.1, '#15181d', mx, 0.85, -0.2));
    }
    d.add(box(0.6, 0.04, 0.2, '#15181d', 0, 0.85, 0.15));
    d.position.set(x, 0, z); d.rotation.y = rot; f.add(d);
    if (withPerson && r() > 0.25) {
      const p = makePerson(Math.floor(r() * 1e6)); sitPose(p);
      p.position.set(x + Math.sin(rot) * 0 - 0, 0.1, z + 1.05); p.rotation.y = Math.PI; f.add(p);
      add(box(0.6, 0.1, 0.6, dark, x, 0.45, z + 1.1), box(0.6, 0.6, 0.08, dark, x, 0.5, z + 1.4));
    }
  };
  const plant = (x, z) => { add(cyl(0.3, 0.22, 0.5, 6, '#7a4a30', x, 0, z)); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), lam('#2f6a35')); b.position.set(x, 1, z); b.castShadow = true; add(b); };
  const shelf = (x, z, rot = 0) => {
    const s = new THREE.Group(); s.add(box(2.2, 2.6, 0.5, wood, 0, 0, 0));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) s.add(box(0.2, 0.4, 0.4, ['#a83a19', '#2a3a52', '#d8d4c8', '#3f6a4a', '#c8a02a'][Math.floor(r() * 5)], -0.9 + j * 0.26, 0.15 + i * 0.62, 0.06));
    s.position.set(x, 0, z); s.rotation.y = rot; f.add(s);
  };
  const rack = (x, z) => { add(box(1, 2.8, 0.9, '#20252d', x, 0, z)); for (let i = 0; i < 9; i++) add(box(0.8, 0.06, 0.05, r() > 0.5 ? color : '#58d68d', x, 0.35 + i * 0.28, z + 0.46, false)); };
  const frame = (x, y, z, rot, w = 1.4, h = 1) => { const fr = box(w, h, 0.08, '#1d2127', x, y, z); fr.rotation.y = rot; add(fr); const inn = box(w - 0.2, h - 0.2, 0.1, mixHex(color, '#ffffff', r() * 0.6), x, y + 0.1, z); inn.rotation.y = rot; add(inn); };

  if (kind === 'gallery') {
    for (let i = 0; i < 5; i++) frame(-4 + i * 2.6, 1.4, -5.85, 0, 1.6, 1.2);
    for (let i = 0; i < 4; i++) frame(-6.85, 1.4, -4 + i * 2.6, Math.PI / 2, 1.6, 1.2);
    for (let i = 0; i < 3; i++) { add(box(1, 1.1, 1, '#d8d4c8', -2 + i * 3.4, 0, 0)); add(box(0.5, 0.5, 0.5, mixHex(color, '#ffffff', 0.2), -2 + i * 3.4, 1.1, 0)); }
    add(box(2.4, 0.5, 0.7, wood, 2, 0, 3), box(2.4, 0.5, 0.7, wood, -3, 0, 3.5));
  } else if (kind === 'arcade') {
    for (let i = 0; i < 5; i++) { const c = box(1, 2, 0.9, mixHex(color, '#000000', 0.3 + (i % 2) * 0.2), -4.5 + i * 1.6, 0, -5.4); add(c); add(box(0.7, 0.55, 0.05, new THREE.MeshBasicMaterial({ color: ['#58d68d', '#f5b041', '#5dade2', '#ec7063', '#af7ac5'][i] }), -4.5 + i * 1.6, 1.15, -4.93, false)); }
    for (let i = 0; i < 4; i++) { add(box(1.8, 0.1, 1.8, '#1f6a45', -1 + (i % 2) * 4, 0.8, -0.5 + Math.floor(i / 2) * 3)); add(cyl(0.12, 0.12, 0.8, 6, dark, -1 + (i % 2) * 4, 0, -0.5 + Math.floor(i / 2) * 3)); }
    for (let k = 0; k < 4; k++) { const p = makePerson(seed + k * 31); p.position.set(-0.4 + (k % 2) * 4, 0, 1 + Math.floor(k / 2) * 3 - 3); f.add(p); }
  } else {                                                              // office (default), with extras per kind
    desk(-4, -3.9); desk(-4, -0.9); desk(1.5, -3.9); desk(1.5, -0.9, 0, true);
    if (kind === 'study') { shelf(-5.4, -5.45); shelf(-3, -5.45); shelf(-0.6, -5.45); }
    if (kind === 'servers') { rack(-5.5, -5.3); rack(-4.4, -5.3); rack(-3.3, -5.3); }
    if (kind === 'workshop') { add(box(3.4, 0.9, 1.2, wood, 3.5, 0, 2.2), box(0.1, 0.05, 0.1, color, 3.5, 0.9, 2.2)); }
    if (kind === 'travel') { for (let i = 0; i < 4; i++) add(box(0.7, 0.9, 0.35, ['#a83a19', '#2a3a52', '#c8a02a', '#3f6a4a'][i], 4 + (i % 2) * 0.9, 0, -1 + Math.floor(i / 2) * 0.8)); frame(-6.85, 1.8, -1, Math.PI / 2, 3, 2); }
  }
  plant(6, -5); plant(-6.2, 4.5); plant(6, 1);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.2), lam('#ffffff', { map: carpetTexture([1, 1], mixHex(color, '#000000', 0.2)) }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(1, 0.02, 3.4); rug.receiveShadow = true; add(rug);
  return f;
}

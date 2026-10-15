// Procedural pixel-art textures. Everything is drawn onto tiny canvases and sampled with nearest filtering,
// so the whole town keeps a crisp low-res look without shipping any image assets.
import * as THREE from 'three';

export const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const mixHex = (a, b, t) => {
  const x = rgb(a), y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(...repeat);
  t.anisotropy = 1;
  return t;
}
function speckle(g, w, h, colors, n, rand) {
  for (let i = 0; i < n; i++) { g.fillStyle = colors[Math.floor(rand() * colors.length)]; g.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 1, 1); }
}

export function grassTexture(repeat) {
  const [c, g] = canvas(64, 64), r = rng(7);
  g.fillStyle = '#2d4a24'; g.fillRect(0, 0, 64, 64);
  speckle(g, 64, 64, ['#274220', '#35542b', '#2a4621', '#3a5b2e', '#223a1b'], 900, r);
  return tex(c, { repeat });
}
export function pavementTexture(repeat, tint = '#8a7f78') {
  const [c, g] = canvas(32, 32), r = rng(11);
  g.fillStyle = mixHex(tint, '#000000', 0.45); g.fillRect(0, 0, 32, 32);
  for (let y = 0; y < 32; y += 4) for (let x = (y / 4) % 2 ? -4 : 0; x < 32; x += 8) {
    g.fillStyle = mixHex(tint, r() > 0.5 ? '#ffffff' : '#000000', r() * 0.18); g.fillRect(x + 1, y + 1, 7, 3);
  }
  return tex(c, { repeat });
}
export function dirtTexture(repeat) {
  const [c, g] = canvas(32, 32), r = rng(3);
  g.fillStyle = '#8a6b46'; g.fillRect(0, 0, 32, 32);
  speckle(g, 32, 32, ['#7a5d3b', '#96774f', '#6e5334'], 220, r);
  return tex(c, { repeat });
}
export function waterTexture(repeat) {
  const [c, g] = canvas(64, 64), r = rng(5);
  g.fillStyle = '#2f6f96'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 70; i++) { g.fillStyle = r() > 0.5 ? '#4b92b8' : '#235a7c'; g.fillRect(Math.floor(r() * 56), Math.floor(r() * 64), 4 + Math.floor(r() * 6), 1); }
  return tex(c, { repeat });
}
export function woodTexture(repeat, base = '#a07a4c') {
  const [c, g] = canvas(32, 32), r = rng(13);
  for (let y = 0; y < 32; y += 8) { g.fillStyle = mixHex(base, r() > 0.5 ? '#ffffff' : '#000000', r() * 0.15); g.fillRect(0, y, 32, 7); g.fillStyle = mixHex(base, '#000000', 0.35); g.fillRect(0, y + 7, 32, 1); }
  speckle(g, 32, 32, [mixHex(base, '#000000', 0.2)], 40, r);
  return tex(c, { repeat });
}
export function carpetTexture(repeat, base) {
  const [c, g] = canvas(16, 16), r = rng(17);
  g.fillStyle = base; g.fillRect(0, 0, 16, 16);
  speckle(g, 16, 16, [mixHex(base, '#000000', 0.15), mixHex(base, '#ffffff', 0.08)], 80, r);
  return tex(c, { repeat });
}

// Building facade: `floors` rows of windows, optional door on the ground floor.
export function facadeTexture({ wall, accent, floors, door, seed }) {
  const r = rng(seed), W = 96, FH = 48, H = FH * floors, [c, g] = canvas(W, H);
  g.fillStyle = wall; g.fillRect(0, 0, W, H);
  speckle(g, W, H, [mixHex(wall, '#000000', 0.08), mixHex(wall, '#ffffff', 0.06)], 500, r);
  for (let f = 0; f < floors; f++) {
    const y0 = H - (f + 1) * FH;
    g.fillStyle = mixHex(wall, '#000000', 0.22); g.fillRect(0, y0, W, 2);          // floor line
    const cols = [14, 41, 68];
    cols.forEach((x, i) => {
      if (f === 0 && door && i === 1) return;
      const wy = y0 + 12, glass = r() > 0.3 ? '#27394d' : '#3b5069';
      g.fillStyle = mixHex(wall, '#000000', 0.35); g.fillRect(x - 1, wy - 1, 18, 25);
      g.fillStyle = glass; g.fillRect(x, wy, 16, 23);
      g.fillStyle = '#6f8fae'; g.fillRect(x + 1, wy + 1, 3, 9);                      // glint
      g.fillStyle = mixHex(wall, '#000000', 0.35); g.fillRect(x + 7, wy, 2, 23); g.fillRect(x, wy + 11, 16, 2);
    });
  }
  if (door) {
    g.fillStyle = accent; g.fillRect(37, H - 36, 22, 4);                              // awning
    g.fillStyle = mixHex(accent, '#000000', 0.3); g.fillRect(37, H - 32, 22, 2);
    g.fillStyle = '#1b2430'; g.fillRect(40, H - 30, 16, 30);
    g.fillStyle = '#7f9bb5'; g.fillRect(42, H - 28, 5, 12); g.fillRect(49, H - 28, 5, 12);
    g.fillStyle = mixHex(wall, '#000000', 0.4); g.fillRect(47, H - 30, 2, 30);
  }
  g.fillStyle = mixHex(wall, '#000000', 0.3); g.fillRect(0, H - 3, W, 3);            // plinth
  return tex(c, { wrap: false });
}
export function roofTexture(color, repeat) {
  const [c, g] = canvas(16, 16), r = rng(hash(color));
  g.fillStyle = color; g.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y += 4) { g.fillStyle = mixHex(color, '#000000', 0.25); g.fillRect(0, y + 3, 16, 1); }
  speckle(g, 16, 16, [mixHex(color, '#ffffff', 0.1), mixHex(color, '#000000', 0.1)], 40, r);
  return tex(c, { repeat });
}

// A signboard: coloured plate with a title and optional subtitle, used for district signs and wall posters.
export function signTexture(title, sub, color, { w = 256, h = 96, fg = '#ffffff' } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  g.fillStyle = mixHex(color, '#000000', 0.25); g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${sub ? 38 : 44}px Newsreader, Georgia, serif`;
  g.fillText(title, w / 2, sub ? h * 0.42 : h / 2, w - 24);
  if (sub) { g.font = '16px "IBM Plex Sans", sans-serif'; g.globalAlpha = 0.85; g.fillText(sub, w / 2, h * 0.78, w - 24); }
  return tex(c, { wrap: false });
}

// A poster for interior walls: title, category, wrapped description.
export function posterTexture(p, color) {
  const w = 512, h = 256, [c, g] = canvas(w, h);
  g.fillStyle = '#f5f1e6'; g.fillRect(0, 0, w, h);
  g.fillStyle = color; g.fillRect(0, 0, w, 22); g.fillRect(0, h - 22, w, 22);
  g.fillStyle = color; g.font = '700 30px "IBM Plex Sans", sans-serif'; g.textBaseline = 'top'; g.fillText(p.category.toUpperCase(), 28, 40);
  g.fillStyle = '#1c1c1a'; g.font = '700 66px Newsreader, Georgia, serif';
  wrapText(g, p.name, w - 56, 2).forEach((l, i) => g.fillText(l, 28, 86 + i * 70));
  return tex(c, { wrap: false });
}
function wrapText(g, text, max, maxLines) {
  const out = []; let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > max && line) { out.push(line); line = word; } else line = next;
  }
  out.push(line);
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/.{0,2}$/, '…'); }
  return out;
}

export function screenTexture(color, seed) {
  const [c, g] = canvas(32, 20), r = rng(seed);
  g.fillStyle = '#0d1520'; g.fillRect(0, 0, 32, 20);
  for (let y = 2; y < 18; y += 3) { g.fillStyle = r() > 0.35 ? color : '#5d7a99'; g.fillRect(2 + Math.floor(r() * 4), y, 4 + Math.floor(r() * 20), 1); }
  return tex(c, { wrap: false });
}

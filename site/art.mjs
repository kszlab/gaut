// Generated vector art for the public site: logos and isometric building illustrations.
// Everything is inline SVG that is coloured through CSS variables, so every theme restyles it.

const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
const K = 38; // 1 model unit = 38 viewBox px
const iso = (x, y, z) => [(x - y) * COS * K, ((x + y) * SIN - z) * K];
const pt = p => p.map(n => n.toFixed(1)).join(',');
const poly = (cls, pts) => `<polygon class="${cls}" points="${pts.map(pt).join(' ')}"/>`;
const line = (a, b) => `<line class="b-line" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"/>`;

// Scenes: boxes are {x, y, w, d, h, floors}; sys is the highlighted "system path" drawn on the front-right face of one box.
export const SCENES = {
  hero: { ground: [-1.5, -1.5, 9.5, 8.5], boxes: [
    { x: 0, y: 0, w: 5, d: 4, h: 3, floors: 3 }, { x: 0, y: 4, w: 4, d: 3, h: 4.4, floors: 4 },
    { x: 4, y: 0, w: 4, d: 3, h: 2.2, floors: 2 }, { x: 5, y: 3, w: 3, d: 3, h: 1.1, floors: 1 }],
    sys: { box: 1, face: 'l', pts: [[0.15, 0], [0.15, 0.5], [0.8, 0.5], [0.8, 1]] }, sys2: { box: 3, face: 'r', pts: [[0.2, 0], [0.2, 0.6], [0.8, 0.6], [0.8, 1]] } },
  tower: { boxes: [{ x: 0, y: 0, w: 3, d: 3, h: 6, floors: 8 }, { x: 3, y: 0, w: 2, d: 3, h: 2, floors: 3 }],
    sys: { box: 0, face: 'l', pts: [[0.25, 0], [0.25, 0.6], [0.75, 0.6], [0.75, 1]] } },
  warehouse: { boxes: [{ x: 0, y: 0, w: 8, d: 4, h: 1.8, floors: 1 }, { x: 8, y: 0, w: 2, d: 4, h: 3, floors: 2 }],
    sys: { box: 0, face: 'l', pts: [[0.1, 0], [0.1, 0.55], [0.6, 0.55], [0.6, 1]] } },
  school: { boxes: [{ x: 0, y: 0, w: 7, d: 2.5, h: 2.4, floors: 2 }, { x: 0, y: 2.5, w: 2.5, d: 4, h: 2.4, floors: 2 }, { x: 4.5, y: 2.5, w: 2.5, d: 2, h: 1.2, floors: 1 }],
    sys: { box: 1, face: 'l', pts: [[0.2, 0], [0.2, 0.5], [0.8, 0.5], [0.8, 1]] } },
  hotel: { boxes: [{ x: 0, y: 0, w: 2.6, d: 6, h: 5, floors: 6 }, { x: 2.6, y: 0, w: 4, d: 3, h: 1.6, floors: 2 }],
    sys: { box: 0, face: 'l', pts: [[0.2, 0], [0.2, 0.7], [0.8, 0.7], [0.8, 1]] } },
  clinic: { boxes: [{ x: 0, y: 0, w: 5, d: 3, h: 3.2, floors: 4 }, { x: 5, y: 0, w: 3, d: 5, h: 2, floors: 2 }, { x: 0, y: 3, w: 2, d: 2, h: 1.2, floors: 1 }],
    sys: { box: 1, face: 'l', pts: [[0.2, 0], [0.2, 0.5], [0.8, 0.5], [0.8, 1]] } },
  hall: { boxes: [{ x: 0, y: 0, w: 4, d: 4, h: 1.6, floors: 1 }, { x: 4, y: 1, w: 3, d: 3, h: 2.6, floors: 3 }],
    sys: { box: 1, face: 'l', pts: [[0.2, 0], [0.2, 0.55], [0.8, 0.55], [0.8, 1]] } },
  plant: { boxes: [{ x: 0, y: 0, w: 6, d: 4, h: 2, floors: 2 }, { x: 6, y: 0, w: 1.5, d: 1.5, h: 4, floors: 0 }, { x: 6, y: 2.2, w: 1.5, d: 1.5, h: 3, floors: 0 }],
    sys: { box: 0, face: 'l', pts: [[0.2, 0], [0.2, 0.6], [0.8, 0.6], [0.8, 1]] } }
};

function faceLine(box, face, t) {
  const { x, y, w, d, h } = box, z = h * t;
  return face === 'l' ? [iso(x, y + d, z), iso(x + w, y + d, z)] : [iso(x + w, y, z), iso(x + w, y + d, z)];
}
function onFace(box, face, u, v) { // u 0..1 along the face, v 0..1 up
  const { x, y, w, d, h } = box;
  return face === 'l' ? iso(x + w * u, y + d, h * v) : iso(x + w, y + d * u, h * v);
}

export function buildingSvg(kind, { label = '', ground = false } = {}) {
  const scene = SCENES[kind] || SCENES.tower;
  const boxes = [...scene.boxes].map((b, i) => ({ ...b, i })).sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.i - b.i);
  const parts = [];
  const all = [];
  if (ground && scene.ground) {
    const [x0, y0, x1, y1] = scene.ground;
    const g = [iso(x0, y0, 0), iso(x1, y0, 0), iso(x1, y1, 0), iso(x0, y1, 0)];
    parts.push(poly('b-ground', g)); all.push(...g);
    for (let i = 0; i <= 10; i++) { const t = i / 10; parts.push(line(iso(x0 + (x1 - x0) * t, y0, 0), iso(x0 + (x1 - x0) * t, y1, 0)).replace('b-line', 'b-grid')); }
  }
  for (const b of boxes) {
    const { x, y, w, d, h } = b;
    const top = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
    const fl = [iso(x, y + d, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x, y + d, h)];
    const fr = [iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x + w, y, h)];
    all.push(...top, ...fl, ...fr);
    parts.push(poly('b-fl', fl), poly('b-fr', fr), poly('b-top', top));
    for (let f = 1; f < b.floors; f++) { const t = f / b.floors; parts.push(line(...faceLine(b, 'l', t)), line(...faceLine(b, 'r', t))); }
    // window ticks: short vertical lines on each face per floor
    for (const face of ['l', 'r']) {
      const n = Math.max(2, Math.round((face === 'l' ? w : d) * 1.6));
      for (let k = 1; k < n; k++) for (let f = 0; f < Math.max(1, b.floors); f++) {
        const u = k / n, v0 = (f + 0.18) / Math.max(1, b.floors), v1 = (f + 0.78) / Math.max(1, b.floors);
        const p = onFace(b, face, u, v0), q = onFace(b, face, u, v1);
        parts.push(`<line class="b-win" x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}"/>`);
      }
    }
  }
  for (const key of ['sys', 'sys2']) {
    const s = scene[key]; if (!s) continue;
    const b = scene.boxes[s.box];
    const pts = s.pts.map(([u, v]) => onFace(b, s.face, u, v));
    all.push(...pts);
    parts.push(`<polyline class="b-sys" points="${pts.map(pt).join(' ')}"/>`);
    const last = pts.at(-1);
    parts.push(`<rect class="b-node" x="${(last[0] - 4).toFixed(1)}" y="${(last[1] - 4).toFixed(1)}" width="8" height="8"/>`);
  }
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const pad = 0.5 * K;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  const body = parts.join('');
  const vb = [minX, minY, maxX - minX, maxY - minY].map(n => Math.round(n)).join(' ');
  const aria = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<svg class="building" viewBox="${vb}" ${aria} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}

// Three logo marks (draft redraws of the concept boards, not final identity artwork).
export const LOGOS = {
  rendszer: '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M54 14H16v36h38V32H34" fill="none" stroke="currentColor" stroke-width="11" stroke-linejoin="miter"/><rect class="mark-accent" x="30" y="27" width="10" height="10"/></svg>',
  struktura: '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><polygon points="4,20 30,5 30,56 4,56" fill="currentColor"/><polygon points="12,34 22,28 22,48 12,48" fill="var(--bg)"/><polygon class="mark-accent" points="30,5 60,22 60,56 40,56 40,32 30,26"/></svg>',
  szinkron: '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="6" width="38" height="12" fill="currentColor"/><rect x="6" y="26" width="38" height="12" fill="currentColor"/><rect class="mark-accent" x="14" y="46" width="38" height="12"/><rect x="48" y="6" width="12" height="52" fill="currentColor"/></svg>'
};

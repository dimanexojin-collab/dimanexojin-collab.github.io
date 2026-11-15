// Вырезка балерины из фона: src/assets/hero/ballerina.png → ballerina-cutout.png (RGBA).
// Запуск: node scripts/cutout-hero.mjs [--preview <папка>]
//
// Алгоритм (без нейросетей, только sharp + пиксельная математика):
//  1. оценка локального фона: нормализованная свёртка (blur) по «фоновым» пикселям (светлые, без бликов);
//  2. маска ядра: тёмные пиксели (фигура, тени ленты) + яркие блики ленты рядом с ними;
//  3. морфологическое закрытие, заливка дыр, отброс мелких компонент (жемчужины, искры, лучи);
//  4. мягкий край: альфа = |яркость − фон| / K на границе, 1 внутри; цвет «распремножается»
//     относительно фона, чтобы ореол не давал белой обводки на любом фоне.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/assets/hero/ballerina.png', import.meta.url));
const OUT = fileURLToPath(new URL('../src/assets/hero/ballerina-cutout.png', import.meta.url));
const previewIdx = process.argv.indexOf('--preview');
const PREVIEW = previewIdx > 0 ? process.argv[previewIdx + 1] : null;

const P = {
  dark: 185,      // ядро: яркость ниже порога
  up: 10,         // блик: светлее локального фона на столько
  near: 4,        // блик учитывается не дальше N px от тёмного ядра
  close: 3,       // радиус морфологического закрытия
  minArea: 1500,  // компоненты меньше — мусор (жемчужины, искры)
  core: 3,        // эрозия заполненной маски → сплошная внутренняя часть
  k: 34,          // ширина перехода альфы по разнице с фоном
};

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const N = W * H;
const lum = new Float32Array(N);
for (let i = 0; i < N; i++) lum[i] = 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2];

const nbrs = (i) => {
  const x = i % W, y = (i / W) | 0;
  return [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
};
function morph(a, rad, dilate) {
  const o = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = dilate ? 0 : 1;
    outer: for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > rad * rad) continue;
      const yy = y + dy, xx = x + dx;
      const s = yy < 0 || yy >= H || xx < 0 || xx >= W ? 0 : a[yy * W + xx];
      if (dilate && s) { v = 1; break outer; }
      if (!dilate && !s) { v = 0; break outer; }
    }
    o[y * W + x] = v;
  }
  return o;
}
async function blur(arr, sigma, ch = 1) {
  const max = Math.max(...arr, 1e-6);
  const buf = Buffer.alloc(arr.length);
  for (let i = 0; i < arr.length; i++) buf[i] = Math.round((arr[i] / max) * 255);
  const out = await sharp(buf, { raw: { width: W, height: H, channels: ch } }).blur(sigma).raw().toBuffer();
  return Float32Array.from(out, (v) => (v / 255) * max);
}

// 1. локальный фон (яркость и цвет)
const w = new Float32Array(N);
for (let i = 0; i < N; i++) w[i] = lum[i] > 200 && lum[i] < 240 ? 1 : 0;
const bw = await blur(w, 14);
const bgLum = new Float32Array(N);
const bgRGB = [0, 1, 2].map(() => new Float32Array(N));
{
  const lw = new Float32Array(N); for (let i = 0; i < N; i++) lw[i] = w[i] * lum[i];
  const bl = await blur(lw, 14);
  for (let i = 0; i < N; i++) bgLum[i] = bw[i] > 0.02 ? bl[i] / bw[i] : 225;
  for (let c = 0; c < 3; c++) {
    const cw = new Float32Array(N); for (let i = 0; i < N; i++) cw[i] = w[i] * data[i * 3 + c];
    const bc = await blur(cw, 14);
    for (let i = 0; i < N; i++) bgRGB[c][i] = bw[i] > 0.02 ? bc[i] / bw[i] : bgLum[i];
  }
}

// 2. маска ядра + блики рядом
let m = new Uint8Array(N);
for (let i = 0; i < N; i++) m[i] = lum[i] < P.dark ? 1 : 0;
const near = morph(m, P.near, true);
for (let i = 0; i < N; i++) if (!m[i] && near[i] && lum[i] > bgLum[i] + P.up) m[i] = 1;

// 3. закрытие, заливка дыр, крупные компоненты
m = morph(morph(m, P.close, true), P.close, false);
const reach = new Uint8Array(N);
const q = [];
for (let i = 0; i < N; i++) {
  const x = i % W, y = (i / W) | 0;
  if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && !m[i]) { reach[i] = 1; q.push(i); }
}
while (q.length) for (const j of nbrs(q.pop())) if (j >= 0 && !m[j] && !reach[j]) { reach[j] = 1; q.push(j); }
const fill = new Uint8Array(N);
for (let i = 0; i < N; i++) fill[i] = reach[i] ? 0 : 1;
{
  const lab = new Int32Array(N); const sizes = [0];
  for (let s = 0; s < N; s++) if (fill[s] && !lab[s]) {
    const id = sizes.length; let c = 0; const st = [s]; lab[s] = id;
    while (st.length) { const i = st.pop(); c++; for (const j of nbrs(i)) if (j >= 0 && fill[j] && !lab[j]) { lab[j] = id; st.push(j); } }
    sizes.push(c);
  }
  for (let i = 0; i < N; i++) if (fill[i] && sizes[lab[i]] < P.minArea) fill[i] = 0;
}

// 4. мягкая альфа и цвет
const core = morph(fill, P.core, false);
const zone = morph(fill, 1, true);
const rgba = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  let a = 0;
  if (core[i]) a = 1;
  else if (zone[i]) a = Math.min(1, Math.abs(lum[i] - bgLum[i]) / P.k);
  for (let c = 0; c < 3; c++) {
    const v = data[i * 3 + c];
    const bgc = bgRGB[c][i];
    rgba[i * 4 + c] = a > 0.02 ? Math.max(0, Math.min(255, Math.round(bgc + (v - bgc) / a))) : v;
  }
  rgba[i * 4 + 3] = Math.round(a * 255);
}
// обрезаем пустые поля, чтобы картинка не была шире фигуры
const cut = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
const { info: trimInfo, data: trimmed } = await sharp(cut).trim({ threshold: 1 }).png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
await sharp(trimmed).toFile(OUT);
console.log(`ballerina-cutout.png ${trimInfo.width}×${trimInfo.height} (исходник ${W}×${H})`);

if (PREVIEW) {
  for (const [name, bg] of [['light', '#ECEAE7'], ['dark', '#2f5f93']]) {
    await sharp({ create: { width: trimInfo.width + 40, height: trimInfo.height + 40, channels: 3, background: bg } })
      .composite([{ input: trimmed, left: 20, top: 20 }]).png().toFile(`${PREVIEW}/cutout-${name}.png`);
  }
}

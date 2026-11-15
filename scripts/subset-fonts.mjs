// Сабсет Manrope Variable (ось wght сохраняется) → src/assets/fonts/*.woff2.
// Оставляем только глифы, которые реально нужны русскоязычному сайту: базовая кириллица + ASCII + типографика + ₽.
// Диапазоны ДОЛЖНЫ совпадать с unicode-range в src/layouts/Base.astro.
// Запуск: node scripts/subset-fonts.mjs (после обновления @fontsource-variable/manrope).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import subsetFont from 'subset-font';

const require = createRequire(import.meta.url);
const dir = (f) => require.resolve(`@fontsource-variable/manrope/files/${f}`);
const OUT = new URL('../src/assets/fonts/', import.meta.url);

const FONT_RANGES = {
  cyr: [[0x0401, 0x0401], [0x0410, 0x044f], [0x0451, 0x0451], [0x2116, 0x2116]],
  lat: [
    [0x0020, 0x007e], [0x00a0, 0x00a0], [0x00a9, 0x00a9], [0x00ab, 0x00ab], [0x00b0, 0x00b0], [0x00b7, 0x00b7],
    [0x00bb, 0x00bb], [0x00d7, 0x00d7], [0x2013, 0x2014], [0x2018, 0x201e], [0x2022, 0x2022], [0x2026, 0x2026],
    [0x20bd, 0x20bd], [0x2192, 0x2192], [0x2212, 0x2212],
  ],
};
const text = (ranges) => ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i))).join('');

await mkdir(OUT, { recursive: true });
for (const [key, file] of [['cyr', 'manrope-cyrillic-wght-normal.woff2'], ['lat', 'manrope-latin-wght-normal.woff2']]) {
  const src = await readFile(dir(file));
  const out = await subsetFont(src, text(FONT_RANGES[key]), { targetFormat: 'woff2' });
  await writeFile(new URL(`manrope-${key}.woff2`, OUT), out);
  console.log(`manrope-${key}.woff2: ${(src.length / 1024).toFixed(1)} → ${(out.length / 1024).toFixed(1)} КБ`);
}

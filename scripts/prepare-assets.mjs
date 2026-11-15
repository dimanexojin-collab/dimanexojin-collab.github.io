// Подготовка ассетов из референса (макет прайса 1055×1491).
// Использование: node scripts/prepare-assets.mjs [путь-к-1.webp]
// Результат:
//   src/assets/hero/header.png, hero/ballerina.png      — исходники для astro:assets (оптимизация в avif/webp при сборке)
//   src/assets/logo/figure.png|.avif|.webp, logo/wordmark.png|.avif|.webp
//   public/favicon.svg, favicon.ico, favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png
//   public/og/default.jpg (1200×630)
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] ?? process.env.KONTUR_REF;
if (!src) {
  console.error('Укажите путь к референсу: node scripts/prepare-assets.mjs <путь к 1.webp>');
  process.exit(1);
}

const meta = await sharp(src).metadata();
if (meta.width !== 1055 || meta.height !== 1491) {
  console.warn(`Внимание: ожидался референс 1055×1491, получено ${meta.width}×${meta.height} — координаты вырезки могут не совпасть.`);
}

// Координаты в пикселях исходника.
const BOX = {
  header: { left: 0, top: 0, width: 1055, height: 385 },
  ballerina: { left: 120, top: 10, width: 330, height: 370 },
  figure: { left: 145, top: 14, width: 275, height: 352 },
  wordmark: { left: 500, top: 112, width: 395, height: 152 },
  icon: { left: 108, top: 14, width: 352, height: 352 },
};

const p = (...parts) => join(root, ...parts);
await Promise.all(['src/assets/hero', 'src/assets/logo', 'public/og'].map((d) => mkdir(p(d), { recursive: true })));

const crop = (box) => sharp(src).extract(box);

// Исходники для astro:assets (PNG без потерь — оптимизация на этапе сборки)
await crop(BOX.header).png().toFile(p('src/assets/hero/header.png'));
await crop(BOX.ballerina).png().toFile(p('src/assets/hero/ballerina.png'));

// Логотип: PNG-исходник + готовые avif/webp
for (const [name, box] of [['figure', BOX.figure], ['wordmark', BOX.wordmark]]) {
  await crop(box).png().toFile(p(`src/assets/logo/${name}.png`));
  await crop(box).avif({ quality: 60 }).toFile(p(`src/assets/logo/${name}.avif`));
  await crop(box).webp({ quality: 80 }).toFile(p(`src/assets/logo/${name}.webp`));
}

// Иконки
const icon = (size) => crop(BOX.icon).resize(size, size).png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 });
await icon(180).toFile(p('public/apple-touch-icon.png'));
await icon(192).toFile(p('public/icon-192.png'));
await icon(512).toFile(p('public/icon-512.png'));
const png32 = await icon(32).toBuffer();
await writeFile(p('public/favicon-32.png'), png32);

// favicon.ico с PNG-содержимым (поддерживается всеми современными браузерами)
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png32.length, 14); ico.writeUInt32LE(22, 18);
await writeFile(p('public/favicon.ico'), Buffer.concat([ico, png32]));

// favicon.svg: растровая вырезка внутри SVG (пока нет векторного логотипа — см. QUESTIONS.md)
const png64 = await icon(64).toBuffer();
await writeFile(
  p('public/favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64"><image width="64" height="64" xlink:href="data:image/png;base64,${png64.toString('base64')}"/></svg>\n`,
);

// OG 1200×630: размытая подложка + шапка по центру
const W = 1200, H = 630;
const headerW = W, headerH = Math.round((BOX.header.height / BOX.header.width) * W);
const bg = await crop(BOX.header).resize(W, H, { fit: 'cover' }).blur(30).modulate({ brightness: 1.04 }).toBuffer();
const fg = await crop(BOX.header).resize(headerW, headerH).toBuffer();
await sharp(bg)
  .composite([{ input: fg, top: Math.round((H - headerH) / 2), left: 0 }])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(p('public/og/default.jpg'));

console.log('Ассеты готовы: src/assets/{hero,logo}, public/{favicon.*,apple-touch-icon.png,icon-*.png,og/default.jpg}');

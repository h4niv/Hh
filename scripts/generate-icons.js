import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const svgBuffer = fs.readFileSync(path.resolve('./public/icon.svg'));

async function generate() {
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.resolve('./public/pwa-192x192.png'));

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.resolve('./public/pwa-512x512.png'));

  // Maskable with safe padding (80% inner scale with solid background)
  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: { r: 79, g: 70, b: 229, alpha: 1 }
    })
    .resize(512, 512)
    .png()
    .toFile(path.resolve('./public/pwa-maskable-512x512.png'));

  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.resolve('./public/apple-touch-icon.png'));

  await sharp(svgBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.resolve('./public/favicon.ico'));

  console.log('PWA icons successfully generated!');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});

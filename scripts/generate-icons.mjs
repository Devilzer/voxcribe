// Generates placeholder PNG icons (no dependencies). Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'resources', 'icons');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel((x + 0.5) / size, (y + 0.5) / size);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Microphone glyph: rounded capsule + stand, on a filled circle.
function mic(x, y) {
  const capsule = Math.abs(x - 0.5) < 0.12 && y > 0.22 && y < 0.58
    ? true
    : Math.hypot(x - 0.5, y - 0.22) < 0.12 || Math.hypot(x - 0.5, y - 0.58) < 0.12;
  const arcR = Math.hypot(x - 0.5, y - 0.52);
  const arc = y > 0.52 && arcR > 0.19 && arcR < 0.24;
  const stem = Math.abs(x - 0.5) < 0.03 && y > 0.74 && y < 0.84;
  const base = Math.abs(x - 0.5) < 0.14 && y > 0.82 && y < 0.87;
  return capsule || arc || stem || base;
}

const appIcon = (x, y) => {
  const inCircle = Math.hypot(x - 0.5, y - 0.5) < 0.48;
  if (!inCircle) return [0, 0, 0, 0];
  return mic(x, y) ? [255, 255, 255, 255] : [79, 70, 229, 255];
};
const trayIconDark = (x, y) => (mic(x, y) ? [0, 0, 0, 255] : [0, 0, 0, 0]);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'icon.png'), png(512, appIcon));
writeFileSync(join(outDir, 'tray.png'), png(32, appIcon));
writeFileSync(join(outDir, 'trayTemplate.png'), png(22, trayIconDark));
writeFileSync(join(outDir, 'trayTemplate@2x.png'), png(44, trayIconDark));
console.log(`Icons written to ${outDir}`);

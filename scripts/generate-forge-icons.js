const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 1024;
const BG = [11, 13, 10, 255];
const LIME = [185, 248, 91, 255];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const target = y * (stride + 1);
    raw[target] = 0;
    rgba.copy(raw, target + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeCanvas(background) {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    pixels[i * 4] = background[0];
    pixels[i * 4 + 1] = background[1];
    pixels[i * 4 + 2] = background[2];
    pixels[i * 4 + 3] = background[3];
  }
  return pixels;
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const index = (Math.floor(y) * SIZE + Math.floor(x)) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function fillCircle(pixels, cx, cy, radius, color) {
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(SIZE - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(SIZE - 1, Math.ceil(cy + radius));
  const radiusSq = radius * radius;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= radiusSq) setPixel(pixels, x, y, color);
    }
  }
}

function fillRoundedRect(pixels, x, y, width, height, radius, color) {
  const right = x + width;
  const bottom = y + height;
  for (let py = Math.floor(y); py < Math.ceil(bottom); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(right); px += 1) {
      const cx = Math.max(x + radius, Math.min(px + 0.5, right - radius));
      const cy = Math.max(y + radius, Math.min(py + 0.5, bottom - radius));
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      if (dx * dx + dy * dy <= radius * radius) setPixel(pixels, px, py, color);
    }
  }
}

function drawMark(pixels) {
  fillRoundedRect(pixels, 320, 252, 92, 520, 46, LIME);
  fillRoundedRect(pixels, 360, 252, 304, 92, 46, LIME);
  fillCircle(pixels, 675, 298, 56, LIME);
  fillRoundedRect(pixels, 360, 452, 238, 92, 46, LIME);
  fillCircle(pixels, 610, 498, 50, LIME);
}

function writeIcon(filepath, background) {
  const pixels = makeCanvas(background);
  drawMark(pixels);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, encodePng(SIZE, SIZE, pixels));
}

function ensureForgeIcons(rootDir = path.resolve(__dirname, '..')) {
  const assets = path.join(rootDir, 'assets');
  const full = path.join(assets, 'forge-icon.png');
  const adaptive = path.join(assets, 'forge-adaptive-icon.png');
  writeIcon(full, BG);
  writeIcon(adaptive, [0, 0, 0, 0]);
  return { full, adaptive };
}

if (require.main === module) ensureForgeIcons(process.cwd());

module.exports = { ensureForgeIcons };

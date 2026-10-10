// Generates assets/tray-icon.ico: a 32x32 icon showing a download (down) and
// upload (up) arrow, matching the up/down theme of the speed monitor.
//
// Kept as a standalone build asset generator so the committed .ico can be
// inspected/regenerated without pulling in an image library at runtime. A
// 32-bit BGRA ICO is written by hand (ICONDIR + BITMAPINFOHEADER + XOR pixels
// + AND mask), which is enough for the Windows system tray.
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SIZE = 32;
const DOWN = [0x38, 0xbd, 0xf8]; // cyan  (download) as R,G,B
const UP = [0x34, 0xd3, 0x99];   // green (upload)   as R,G,B

// RGBA canvas, transparent by default.
const px = new Uint8Array(SIZE * SIZE * 4);

function set(x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = a;
}

// Draw a vertical arrow inside the column band [xStart, xEnd].
// direction: 'down' => head at bottom, 'up' => head at top.
function drawArrow(xStart, xEnd, color, direction) {
  const cx = (xStart + xEnd) / 2;
  const top = 6;
  const bottom = SIZE - 6;
  const stemHalf = 1.5;        // half-width of the shaft
  const headHalf = (xEnd - xStart) / 2; // half-width of the arrow head base
  const headLen = 9;           // height of the triangular head

  for (let y = top; y <= bottom; y++) {
    if (direction === 'down') {
      if (y < bottom - headLen) {
        for (let x = Math.round(cx - stemHalf); x <= Math.round(cx + stemHalf); x++) set(x, y, color);
      } else {
        const t = (bottom - y) / headLen; // 1 at head top, 0 at tip
        const half = headHalf * t;
        for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) set(x, y, color);
      }
    } else {
      if (y > top + headLen) {
        for (let x = Math.round(cx - stemHalf); x <= Math.round(cx + stemHalf); x++) set(x, y, color);
      } else {
        const t = (y - top) / headLen; // 0 at tip, 1 at head bottom
        const half = headHalf * t;
        for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) set(x, y, color);
      }
    }
  }
}

drawArrow(3, 14, DOWN, 'down');
drawArrow(17, 28, UP, 'up');

// --- Encode as a 32-bit BGRA .ico ------------------------------------------
const rowMaskBytes = Math.ceil(SIZE / 32) * 4; // AND mask row, 32-bit aligned
const xorSize = SIZE * SIZE * 4;
const andSize = rowMaskBytes * SIZE;
const dibSize = 40 + xorSize + andSize;

const header = Buffer.alloc(6 + 16);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // image count
header.writeUInt8(SIZE === 256 ? 0 : SIZE, 6);  // width
header.writeUInt8(SIZE === 256 ? 0 : SIZE, 7);  // height
header.writeUInt8(0, 8);    // palette count
header.writeUInt8(0, 9);    // reserved
header.writeUInt16LE(1, 10);  // color planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(dibSize, 14); // size of DIB
header.writeUInt32LE(22, 18);      // offset to DIB

const dib = Buffer.alloc(dibSize);
dib.writeUInt32LE(40, 0);            // BITMAPINFOHEADER size
dib.writeInt32LE(SIZE, 4);           // width
dib.writeInt32LE(SIZE * 2, 8);       // height (XOR + AND)
dib.writeUInt16LE(1, 12);            // planes
dib.writeUInt16LE(32, 14);           // bpp
dib.writeUInt32LE(0, 16);            // compression (BI_RGB)
dib.writeUInt32LE(xorSize, 20);      // image size

let off = 40;
// XOR pixel data, bottom-up, BGRA.
for (let y = SIZE - 1; y >= 0; y--) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    dib[off++] = px[i + 2]; // B
    dib[off++] = px[i + 1]; // G
    dib[off++] = px[i];     // R
    dib[off++] = px[i + 3]; // A
  }
}
// AND mask: transparency is carried by the alpha channel, so leave it all 0
// (fully opaque mask); the bytes are already zero-initialised.

const ico = Buffer.concat([header, dib]);

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'tray-icon.ico');
writeFileSync(outPath, ico);
console.log(`Wrote ${outPath} (${ico.length} bytes)`);

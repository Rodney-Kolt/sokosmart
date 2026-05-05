/**
 * make-screenshot.js
 * Generates a 390x844 placeholder screenshot PNG for the PWA manifest.
 * Run: node make-screenshot.js
 */

const fs   = require("fs");
const zlib = require("zlib");

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf  = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makeScreenshot(w, h) {
  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    row[0] = 0;
    for (let x = 0; x < w; x++) {
      // Dark gradient background
      const t = y / h;
      row[1 + x * 3] = Math.round(13 + t * 10);   // R
      row[2 + x * 3] = Math.round(17 + t * 8);    // G
      row[3 + x * 3] = Math.round(23 + t * 15);   // B

      // Green header bar (top 60px)
      if (y < 60) {
        row[1 + x * 3] = 7;
        row[2 + x * 3] = 94;
        row[3 + x * 3] = 84;
      }

      // Bottom nav bar (bottom 64px)
      if (y > h - 64) {
        row[1 + x * 3] = 22;
        row[2 + x * 3] = 27;
        row[3 + x * 3] = 34;
      }

      // Green accent strip in middle
      if (y > h / 2 - 2 && y < h / 2 + 2) {
        row[1 + x * 3] = 37;
        row[2 + x * 3] = 211;
        row[3 + x * 3] = 102;
      }
    }
    rows.push(row);
  }

  const raw        = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const png = makeScreenshot(390, 844);
fs.writeFileSync("public/screenshot-mobile.png", png);
console.log(`✅  public/screenshot-mobile.png  (390x844, ${png.length} bytes)`);

/**
 * make-icons.js – generates icon-192.png, icon-512.png, apple-touch-icon.png
 * Pure Node.js, no external dependencies.
 * Run: node make-icons.js
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

function makePNG(size, bgR, bgG, bgB, circleR, circleG, circleB) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bit depth=8, color type=2 (RGB), compression=0, filter=0, interlace=0
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;

  // Build raw image rows
  const cx = size / 2, cy = size / 2, radius = size * 0.44;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const inCircle = Math.sqrt(dx * dx + dy * dy) <= radius;
      // Gradient: lighter at top-left
      const factor = inCircle ? Math.max(0.7, 1 - (dx + dy) / (size * 1.5)) : 0;
      row[1 + x * 3] = inCircle ? Math.min(255, Math.round(circleR * factor + 20)) : bgR;
      row[2 + x * 3] = inCircle ? Math.min(255, Math.round(circleG * factor + 10)) : bgG;
      row[3 + x * 3] = inCircle ? Math.min(255, Math.round(circleB * factor))      : bgB;
    }
    rows.push(row);
  }

  const raw        = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Sokoni green (#25D366) on dark (#0d1117)
const sizes = [
  { size: 192, file: "public/icon-192.png" },
  { size: 512, file: "public/icon-512.png" },
  { size: 180, file: "public/apple-touch-icon.png" },
];

for (const { size, file } of sizes) {
  const png = makePNG(size, 13, 17, 23, 37, 211, 102);
  fs.writeFileSync(file, png);
  console.log(`✅  ${file}  (${size}x${size}, ${png.length} bytes)`);
}

const fs = require("fs");
const zlib = require("zlib");

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    let byte = b ^ (c & 0xff);
    for (let i = 0; i < 8; i++)
      byte = byte & 1 ? (0xedb88320 ^ (byte >>> 1)) : byte >>> 1;
    c = byte ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// 16x16 RGBA PNG — black opaque pixels inside a 2px transparent border.
// Template images need transparency so macOS can invert them for dark/light
// menu bar. Black+opaque = shape; transparent = background.
const W = 16, H = 16;
const MARGIN = 2;

// IHDR: color type 6 = RGBA
const ihdrData = Buffer.alloc(13, 0);
ihdrData.writeUInt32BE(W, 0);
ihdrData.writeUInt32BE(H, 4);
ihdrData[8] = 8; // bit depth
ihdrData[9] = 6; // RGBA

// Raw scanlines: 1 filter byte + 4 bytes per pixel (R,G,B,A)
const rowSize = 1 + W * 4;
const raw = Buffer.alloc(H * rowSize, 0); // all transparent by default

for (let y = 0; y < H; y++) {
  // filter byte at start of row is already 0
  for (let x = 0; x < W; x++) {
    const inShape = x >= MARGIN && x < W - MARGIN && y >= MARGIN && y < H - MARGIN;
    const offset = y * rowSize + 1 + x * 4;
    raw[offset + 0] = 0;   // R
    raw[offset + 1] = 0;   // G
    raw[offset + 2] = 0;   // B
    raw[offset + 3] = inShape ? 255 : 0; // A: opaque inside, transparent outside
  }
}

const idat = zlib.deflateSync(raw);

const out = Buffer.concat([
  sig,
  chunk("IHDR", ihdrData),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

const dest = "apps/desktop/assets/trayIconTemplate.png";
fs.writeFileSync(dest, out);
console.log("wrote", out.length, "bytes to", dest);

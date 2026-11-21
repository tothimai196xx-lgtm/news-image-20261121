// news-image-20261121 — sums up Saturday 21 November 2026 world news in one image.
// Node 22, standard library only. No network. Deterministic: two runs write
// identical bytes. Writes /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png).
// The image is drawn from scratch: a bitmap-font text renderer over a flat
// RGB canvas, encoded as PNG with node:zlib (deflate) and a hand-rolled CRC32.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// ---------------------------------------------------------------- PNG out
const W = 1024;
const H = 1024;

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePng(rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // Filter 0 (None) on every scanline: flat colours compress well and the
  // output is fully deterministic.
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(rgb.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- canvas
type RGB = [number, number, number];
const canvas = new Uint8Array(W * H * 3);

function fill(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      canvas[i] = c[0]; canvas[i + 1] = c[1]; canvas[i + 2] = c[2];
    }
  }
}
function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  canvas[i] = c[0]; canvas[i + 1] = c[1]; canvas[i + 2] = c[2];
}
function outline(x: number, y: number, w: number, h: number, c: RGB): void {
  fill(x, y, w, 1, c); fill(x, y + h - 1, w, 1, c);
  fill(x, y, 1, h, c); fill(x + w - 1, y, 1, h, c);
}
function circle(cx: number, cy: number, r: number, c: RGB, filled: boolean): void {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = dx * dx + dy * dy;
      if (filled ? d <= r * r : d <= r * r && d >= (r - 1) * (r - 1)) px(cx + dx, cy + dy, c);
    }
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows, 5 bits (bit 4 = leftmost pixel). Written from scratch.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11], B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e], D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f], F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f], H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e], J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11], L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11], N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e], P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d], R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e], T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e], V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11], X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04], Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  a: [0x00, 0x0e, 0x01, 0x0f, 0x11, 0x11, 0x0f], b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e],
  c: [0x00, 0x0e, 0x11, 0x10, 0x10, 0x11, 0x0e], d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f],
  e: [0x00, 0x0e, 0x11, 0x1f, 0x10, 0x11, 0x0e], f: [0x06, 0x08, 0x08, 0x1e, 0x08, 0x08, 0x08],
  g: [0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x0e], h: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x11],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e], j: [0x02, 0x00, 0x06, 0x02, 0x02, 0x12, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12], l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0x00, 0x1a, 0x15, 0x15, 0x15, 0x15, 0x15], n: [0x00, 0x1e, 0x11, 0x11, 0x11, 0x11, 0x11],
  o: [0x00, 0x0e, 0x11, 0x11, 0x11, 0x11, 0x0e], p: [0x00, 0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10],
  q: [0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x01], r: [0x00, 0x16, 0x19, 0x10, 0x10, 0x10, 0x10],
  s: [0x00, 0x0f, 0x10, 0x0e, 0x01, 0x01, 0x1e], t: [0x08, 0x08, 0x1e, 0x08, 0x08, 0x09, 0x06],
  u: [0x00, 0x11, 0x11, 0x11, 0x11, 0x13, 0x0d], v: [0x00, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0x00, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a], x: [0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  y: [0x00, 0x11, 0x11, 0x11, 0x0f, 0x01, 0x0e], z: [0x00, 0x1f, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e], "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f], "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02], "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e], "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e], "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0], ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08], ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08], "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04], "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0], '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02], ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10], "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0], "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d], "$": [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a], "*": [0, 0x04, 0x15, 0x0e, 0x15, 0x04, 0],
  "_": [0, 0, 0, 0, 0, 0, 0x1f], "[": [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e],
  "]": [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e], "<": [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
  "@": [0x0e, 0x11, 0x17, 0x15, 0x16, 0x10, 0x0e],
};

// Advance in px for a scale: glyph is 5*scale wide, plus 1*scale gap.
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
// Tight text: 1px gap whatever the scale, for dense one-line story rows.
function textWidthTight(s: string, scale: number): number {
  return s.length * (5 * scale + 1) - 1;
}
function drawTextTight(x: number, y: number, s: string, scale: number, c: RGB): void {
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if ((g[r] >> (4 - col)) & 1) {
          fill(x + i * (5 * scale + 1) + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if ((g[r] >> (4 - col)) & 1) {
          fill(x + i * 6 * scale + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }
}
// Wrap text to lines of at most maxChars characters (word-aware).
function wrap(s: string, maxChars: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function trunc(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars - 1) + ".";
}

// Confidence dots: 3 = confirmed, 2 = reported, 1 = developing.
// Filled dot = solid colour, empty dot = outline only.
function drawConfidence(x: number, y: number, conf: 3 | 2 | 1, s: number): void {
  const d = 5 * s; // dot diameter
  const gap = 2 * s;
  for (let i = 0; i < 3; i++) {
    const cx = x + i * (d + gap) + Math.floor(d / 2);
    const cy = y + Math.floor(d / 2);
    const col: RGB = conf === 3 ? [16, 120, 60] : conf === 2 ? [176, 124, 0] : [178, 58, 32];
    if (i < conf) circle(cx, cy, Math.floor(d / 2), col, true);
    else circle(cx, cy, Math.floor(d / 2), [150, 150, 150], false);
  }
}

// ---------------------------------------------------------------- palette
const NAVY: RGB = [15, 42, 68];
const NAVY2: RGB = [23, 62, 96];
const PAPER: RGB = [247, 245, 239];
const INK: RGB = [22, 28, 36];
const MUTED: RGB = [90, 96, 104];
const RED: RGB = [178, 58, 32];
const GOLD: RGB = [176, 124, 0];
const GREEN: RGB = [16, 120, 60];
const WHITE: RGB = [255, 255, 255];
const LINE: RGB = [205, 200, 188];
const CARD: RGB = [255, 255, 255];

// ---------------------------------------------------------------- the news
// conf: 3 confirmed by several outlets, 2 reported (one/few sources),
// 1 developing or an unverified claim. Sources are the outlet that reported it.
type Story = { t: string; src: string; conf: 3 | 2 | 1 };
type Lead = { k: string; title: string; detail: string; src: string; conf: 3 | 2 | 1 };

const LEADS: Lead[] = [
  { k: "1", title: "RUSSIA'S BIGGEST BARRAGE: 400+ drones, 110 missiles hit Kyiv; 8 killed",
    detail: "Two missiles and a suspected drone also fell in Poland. Warsaw calls it a deliberate provocation; NATO calls it a grave violation.",
    src: "France 24 / CBS", conf: 3 },
  { k: "2", title: "AI SELL-OFF: S&P 500 -3.7% into correction; Nasdaq erases all 2026 gains",
    detail: "Nikkei -5.1% in Asia. Anthropic fell about 11% a day after its record IPO as investors doubt AI spending.",
    src: "BBC / Guardian", conf: 3 },
  { k: "3", title: "WORLD COURT: Myanmar committed genocide against the Rohingya",
    detail: "First time the ICJ has held a state responsible. Ruled 19 Nov, 9-6; reparations and right of return ordered.",
    src: "ICJ / HRW", conf: 3 },
  { k: "4", title: "TRUMP AFTER SHENZHEN SUMMIT calls Putin a friend",
    detail: "Zelensky answered: \"He's a killer.\" 90-minute press conference after the first US-China-Russia leaders' meeting.",
    src: "BBC", conf: 3 },
  { k: "5", title: "HOUTHI MISSILES AT RIYADH shot down, 3rd night; Hormuz attacks go on",
    detail: "Saudi-led coalition struck Hodeidah port. US-Iran talks stall as shipping attacks continue in the Gulf.",
    src: "Al Jazeera", conf: 3 },
];

const SECTIONS: { name: string; color: RGB; stories: Story[] }[] = [
  { name: "EUROPE", color: [23, 62, 96], stories: [
    { t: "Denmark expels Russian diplomat", src: "AJ", conf: 2 },
    { t: "Estonia to shut 5 Russia crossings", src: "AJ", conf: 3 },
    { t: "UK-EU sign 3 post-Brexit deals", src: "GDN", conf: 3 },
    { t: "Gen Z protests in 25 EU states", src: "BBC", conf: 2 },
    { t: "Spain votes 29 Nov; Feijoo gains", src: "F24", conf: 2 },
    { t: "Villepin to run for president", src: "F24", conf: 3 },
    { t: "COP31 runs past deadline in Antalya", src: "AJ", conf: 3 },
  ]},
  { name: "NORTH AMERICA", color: [178, 58, 32], stories: [
    { t: "Palisades fire arsonist convicted", src: "BBC", conf: 3 },
    { t: "FBI crime database reported hacked", src: "CNN", conf: 2 },
    { t: "Mamdani: close Rikers jail by 2032", src: "BBC", conf: 3 },
    { t: "Texas execution lasts over an hour", src: "BBC", conf: 3 },
    { t: "Hippo Fiona dies after eating a hat", src: "AP", conf: 3 },
    { t: "Trump threatens tax on data centres", src: "FT", conf: 3 },
    { t: "YouTube near $3bn schools settlement", src: "ST", conf: 2 },
  ]},
  { name: "MIDDLE EAST", color: [120, 72, 20], stories: [
    { t: "Gaza strikes kill 6; settler attacks", src: "AJ", conf: 3 },
    { t: "Iraq forces enter Jurf al-Sakhar", src: "AJ", conf: 2 },
    { t: "Saudi, Japan agree oil stockpile", src: "JT", conf: 2 },
    { t: "Brent crude holds near $90 a barrel", src: "OP", conf: 2 },
    { t: "US sanctions 4 Iranian oil trustees", src: "JT", conf: 2 },
  ]},
  { name: "ASIA-PACIFIC", color: [16, 120, 60], stories: [
    { t: "Trump wants Nvidia's Huang back", src: "GDN", conf: 2 },
    { t: "AI-aided Riemann proof claimed", src: "BBC", conf: 1 },
    { t: "Japan-China ties at record low", src: "JT", conf: 2 },
    { t: "S. Korea moves to impeach top judge", src: "YNA", conf: 2 },
    { t: "Nepal PM Shah to visit India 22 Nov", src: "BBC", conf: 3 },
    { t: "Record INR 1.22 lakh cr into India", src: "DEP", conf: 3 },
    { t: "Rahul completes SENA Test 100 set", src: "IANS", conf: 3 },
    { t: "Pakistan beat Sri Lanka in series", src: "IANS", conf: 3 },
  ]},
  { name: "AFRICA", color: [106, 62, 140], stories: [
    { t: "Nigeria boat sinks; 300 feared lost", src: "AJ", conf: 1 },
    { t: "Lissu convicted of sedition", src: "BBC", conf: 3 },
    { t: "Uganda curbs gatherings over Ebola", src: "AA", conf: 2 },
    { t: "Kenya starts onshore oil drilling", src: "AA", conf: 3 },
    { t: "Taung Child study rethinks ancestors", src: "SD", conf: 2 },
  ]},
  { name: "LATIN AMERICA", color: [0, 130, 135], stories: [
    { t: "Peru quake M6.8 felt in Lima", src: "IGP", conf: 2 },
    { t: "Bolsonaro in hospital, bowel blocked", src: "DW", conf: 3 },
    { t: "Argentina risk tops 1,000 points", src: "BAT", conf: 2 },
    { t: "Isolated Awa visit Brazil outpost", src: "EURO", conf: 2 },
    { t: "2 Salvadoran troops die in Haiti", src: "AJ", conf: 3 },
  ]},
  { name: "SCIENCE, CULTURE & SPORT", color: [150, 40, 90], stories: [
    { t: "GTA VI earns $3.8bn on day one", src: "BBC", conf: 3 },
    { t: "BepiColombo reaches Mercury orbit", src: "GDN", conf: 3 },
    { t: "Cancer pill clears tumours, 1 in 12", src: "GDN", conf: 3 },
    { t: "CERN sees ultra-rare particle decay", src: "SD", conf: 2 },
    { t: "Voyager 1 now 24 light-hours away", src: "SD", conf: 3 },
    { t: "Alcaraz unbeaten at ATP Finals", src: "BBC", conf: 3 },
  ]},
];

const NUMBERS: [string, string][] = [
  ["S&P 500", "-3.7%"], ["NASDAQ", "-5.3%"], ["NIKKEI", "-5.1%"],
  ["DRONES AT UKRAINE", "400+"], ["MISSILES", "110"], ["GTA VI DAY ONE", "$3.8bn"],
];

const TIMELINE: [string, string][] = [
  ["~00:00", "Russia's overnight barrage hits Kyiv"],
  ["~07:00", "Two Russian missiles fall in Poland"],
  ["~08:00", "Asian markets plunge; Nikkei -5.1%"],
  ["~14:30", "US markets open; S&P 500 into correction"],
  ["~20:00", "COP31 talks run past deadline in Antalya"],
];

// ---------------------------------------------------------------- draw
function main(): void {
  fill(0, 0, W, H, PAPER);
  const totalStories = LEADS.length + SECTIONS.reduce((n, s) => n + s.stories.length, 0);

  // ---- header
  fill(0, 0, W, 84, NAVY);
  fill(0, 80, W, 4, GOLD);
  // globe mark
  circle(962, 40, 28, WHITE, false);
  fill(934, 40, 56, 2, WHITE);
  fill(962, 12, 2, 56, WHITE);
  circle(962, 40, 28, GOLD, false);
  drawText(20, 10, "SATURDAY 21 NOVEMBER 2026", 3, WHITE);
  drawText(20, 48, "THE WORLD IN ONE DAY", 2, [255, 205, 90]);
  drawText(20, 66, `${totalStories} sourced stories  -  7 regions  -  every story marked how sure we are`, 1, [200, 212, 224]);

  // ---- day in numbers
  let y = 92;
  drawText(20, y, "DAY IN NUMBERS", 1, MUTED);
  y += 14;
  const bw = Math.floor((W - 40) / NUMBERS.length);
  NUMBERS.forEach(([label, val], i) => {
    const x = 20 + i * bw;
    fill(x, y, bw - 8, 32, CARD);
    outline(x, y, bw - 8, 32, LINE);
    drawText(x + 8, y + 3, label, 1, MUTED);
    drawText(x + 8, y + 15, val, 2, val.startsWith("-") ? RED : INK);
  });
  y += 40;

  // ---- top stories
  drawText(20, y, "TOP STORIES", 2, RED);
  drawText(20 + textWidth("TOP STORIES", 2) + 14, y + 2, "the five stories that defined the day", 1, MUTED);
  y += 22;
  const leadX = 20, leadW = W - 40;
  for (const lead of LEADS) {
    fill(leadX, y, leadW, 36, CARD);
    outline(leadX, y, leadW, 36, LINE);
    fill(leadX, y, 34, 36, RED);
    drawText(leadX + 11, y + 11, lead.k, 2, WHITE);
    const tx = leadX + 44;
    // Title must stop before the confidence dots at the right edge.
    const titleMax = Math.floor((leadW - 44 - 70) / 12);
    drawText(tx, y + 3, trunc(lead.title, titleMax), 2, INK);
    const src = `(${lead.src})`;
    // Detail uses the full width minus the right-aligned source tag.
    const detailMax = Math.floor((leadW - 44 - textWidth(src, 1) - 16) / 6);
    drawText(tx, y + 20, trunc(lead.detail, detailMax), 1, MUTED);
    drawText(leadX + leadW - textWidth(src, 1) - 8, y + 20, src, 1, MUTED);
    drawConfidence(leadX + leadW - 62, y + 4, lead.conf, 1);
    y += 40;
  }
  y += 4;

  // ---- region grid, two columns
  const colW = 484;
  const colX = [20, 520];
  const leftSecs = [SECTIONS[0], SECTIONS[2], SECTIONS[4], SECTIONS[5]]; // EU, ME, Africa, LatAm
  const rightSecs = [SECTIONS[1], SECTIONS[3], SECTIONS[6]]; // N America, Asia-Pac, Science
  const gridTop = y;
  let gridBottom = gridTop;
  [leftSecs, rightSecs].forEach((secs, ci) => {
    let yy = gridTop;
    for (const sec of secs) {
      fill(colX[ci], yy, colW, 22, sec.color);
      drawText(colX[ci] + 8, yy + 4, sec.name, 2, WHITE);
      drawText(colX[ci] + colW - textWidth(`${sec.stories.length} stories`, 1) - 8, yy + 7, `${sec.stories.length} stories`, 1, [230, 230, 230]);
      yy += 24;
      for (const st of sec.stories) {
        drawConfidence(colX[ci] + 2, yy + 3, st.conf, 1);
        // Truncate the title only: the source tag must never be cut off.
        const titleMax = 41 - (st.src.length + 3);
        drawTextTight(colX[ci] + 26, yy + 2, trunc(st.t, titleMax) + " (" + st.src + ")", 2, INK);
        yy += 18;
      }
      yy += 4;
    }
    gridBottom = Math.max(gridBottom, yy);
  });
  y = gridBottom + 4;

  // ---- UTC timeline
  fill(20, y, W - 40, 60, NAVY2);
  drawText(32, y + 5, "UTC TIMELINE  -  SATURDAY 21 NOVEMBER 2026  (approx. times)", 1, [255, 205, 90]);
  const tw = (W - 64) / TIMELINE.length;
  TIMELINE.forEach(([t, label], i) => {
    const x = 32 + i * tw;
    fill(x, y + 24, 10, 10, GOLD);
    drawText(x + 16, y + 22, t, 1, WHITE);
    const lines = wrap(label, 22);
    lines.forEach((ln, li) => drawText(x, y + 36 + li * 9, ln, 1, [210, 220, 230]));
  });
  y += 68;

  // ---- footer: confidence legend + date check + sources
  drawText(20, y, "HOW SURE:  ", 1, INK);
  drawConfidence(20 + textWidth("HOW SURE:  ", 1), y, 3, 1);
  drawText(20 + textWidth("HOW SURE:  ", 1) + 34, y, "confirmed by several outlets", 1, INK);
  const mid = 430;
  drawConfidence(mid, y, 2, 1);
  drawText(mid + 34, y, "reported, few sources so far", 1, INK);
  const right = 720;
  drawConfidence(right, y, 1, 1);
  drawText(right + 34, y, "developing / unverified claim", 1, INK);
  y += 14;
  drawText(20, y, "DATE-CHECK: every story was first reported 19-21 Nov 2026. ICJ ruling 19 Nov; reactions on 21 Nov.", 1, MUTED);
  y += 12;
  drawText(20, y, "SOURCES: BBC, France 24, CBS, Guardian (GDN), Al Jazeera (AJ), CNN, FT, DW, Yonhap (YNA), IANS,", 1, MUTED);
  y += 10;
  drawText(20, y, "Japan Times (JT), Euronews (EURO), ScienceDaily (SD), OilPrice (OP), AllAfrica (AA), AP, Straits Times,", 1, MUTED);
  y += 10;
  drawText(20, y, "Buenos Aires Times (BAT), depository data (DEP), IGP, ICJ, HRW.", 1, MUTED);
  y += 12;
  drawText(20, y, `48 stories  -  7 regions  -  Saturday 21 November 2026  -  drawn, not photographed`, 1, MUTED);

  if (y > H) throw new Error(`layout overflow: y=${y} > ${H}`);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/entry.png`, encodePng(canvas));
}

main();

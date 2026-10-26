import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { TEXTURE_PRESET_INFO, type TexturePresetId } from "@/lib/kfl/texturePresets";

export { isTexturePreset } from "@/lib/kfl/texturePresets";

// KFL "Texture": local, procedural texture effects applied with Sharp on the server.
// No AI and no external API: the photo is never regenerated, only overlaid with
// grain / dust / scratches / paper / concrete and light tonal touches.

/**
 * Every value is the strength at intensity 100; intensity scales them linearly.
 * Values are capped so that even 100 never destroys the photo.
 */
type PresetParams = {
  grain?: { amount: number; size: number }; // amount: luminance std-dev (0..1); size: grain size in px at ~1800px
  clarity?: number; // mid-tone local contrast
  sharpen?: number; // fine detail
  contrast?: number; // S-curve strength
  deepShadows?: number; // darkens shadows only
  fade?: number; // lifted blacks
  warmth?: number; // tiny warm tint for fade (old film)
  vignette?: number; // edge darkening
  dust?: number; // specks per megapixel
  scratches?: number; // number of scratches per photo
  paper?: number; // paper fibre texture strength
  concrete?: number; // grunge strength (mostly in shadows/background)
};

/** Effect parameters per preset (names and default intensities are in texturePresets.ts). */
export const TEXTURE_PARAMS: Record<TexturePresetId, PresetParams> = {
  none: {},
  editorial: { grain: { amount: 0.05, size: 1 }, clarity: 0.35, vignette: 0.22 },
  "film-grain": { grain: { amount: 0.09, size: 1.1 } },
  gritty: { grain: { amount: 0.11, size: 1.7 }, contrast: 0.22, clarity: 0.45, sharpen: 0.45, vignette: 0.4 },
  cinematic: { grain: { amount: 0.07, size: 1.2 }, contrast: 0.26, deepShadows: 0.3, vignette: 0.35 },
  dust: { dust: 320 },
  "dust-scratches": { grain: { amount: 0.06, size: 1.1 }, dust: 170, scratches: 6 },
  "old-film": { grain: { amount: 0.1, size: 1.5 }, dust: 200, scratches: 9, fade: 0.16, warmth: 0.015, vignette: 0.3 },
  paper: { paper: 0.6 },
  concrete: { concrete: 0.55 },
};

export const TEXTURE_PRESETS = TEXTURE_PRESET_INFO;

export const MAX_TEXTURE_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 8000;
const MAX_PIXELS = 40_000_000;
const PREVIEW_SIDE = 1200;

export class TextureInputError extends Error {}

// Seeded PRNG (mulberry32), so the same seed gives the same texture: preview == Apply.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const yieldToEventLoop = () => new Promise<void>((resolve) => setImmediate(resolve));
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Real surface scans (ambientCG, CC0) — see public/assets/textures/LICENSE.md.
const TEXTURE_DIR = path.join(process.cwd(), "public", "assets", "textures");
export const TEXTURE_ASSETS = {
  paper: ["paper-fibre-a.jpg", "paper-crease-b.jpg"],
  concrete: ["concrete-light-a.jpg", "concrete-rough-b.jpg", "concrete-old-c.jpg"],
};
const assetCache = new Map<string, Promise<Buffer>>();
function loadAsset(file: string) {
  if (!/^[a-z0-9-]+\.jpg$/.test(file)) throw new Error("Texture asset i pavlefshëm.");
  const cached = assetCache.get(file);
  if (cached) return cached;
  const loading: Promise<Buffer> = readFile(path.join(TEXTURE_DIR, file));
  loading.catch(() => assetCache.delete(file)); // retry next time if the file was missing
  assetCache.set(file, loading);
  return loading;
}

/**
 * A scanned texture placed over the photo with a random rotation (90° steps), flip, zoom and offset,
 * so no two photos share the same pattern. Returns -1..1 (std≈0.33). Preview and Apply look the same
 * because zoom/offset are relative to the photo size and come from the same seed.
 */
async function assetLayer(width: number, height: number, files: string[], random: () => number) {
  const file = files[Math.floor(random() * files.length) % files.length];
  const quarter = Math.floor(random() * 4), flipH = random() < 0.5, flipV = random() < 0.5;
  const zoom = 1 + random() * 0.6, offsetX = random(), offsetY = random();
  let oriented = sharp(await loadAsset(file)).rotate(quarter * 90);
  if (flipH) oriented = oriented.flop();
  if (flipV) oriented = oriented.flip();
  const { data: rotated, info } = await oriented.toBuffer({ resolveWithObject: true });
  const scale = Math.max(width / info.width, height / info.height) * zoom;
  const rw = Math.max(width, Math.ceil(info.width * scale)), rh = Math.max(height, Math.ceil(info.height * scale));
  const out = await sharp(rotated).resize(rw, rh, { kernel: "lanczos3", fit: "fill" })
    .extract({ left: Math.floor((rw - width) * offsetX), top: Math.floor((rh - height) * offsetY), width, height })
    .extractChannel(0).raw().toBuffer();
  if (out.length !== width * height) throw new Error("Texture: madhësi e papritur e asset-it.");
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) values[i] = Math.max(-1, Math.min(1, (out[i] - 128) / 104));
  return values;
}

/** Monochromatic film grain: gaussian-like, softened so it never looks like harsh pixel noise. Returns -1..1 (std≈0.33). */
async function grainLayer(width: number, height: number, size: number, random: () => number) {
  const cell = Math.max(1, size * Math.max(1, Math.max(width, height) / 1800));
  const gw = Math.max(2, Math.round(width / cell));
  const gh = Math.max(2, Math.round(height / cell));
  const grid = Buffer.alloc(gw * gh);
  for (let i = 0; i < grid.length; i++) {
    const g = (random() + random() + random() - 1.5) / 1.5; // ~gaussian in -1..1
    grid[i] = Math.max(0, Math.min(255, Math.round(128 + g * 127)));
  }
  let pipeline = sharp(grid, { raw: { width: gw, height: gh, channels: 1 } });
  if (gw !== width || gh !== height) pipeline = pipeline.resize(width, height, { kernel: "cubic", fit: "fill" });
  const out = await pipeline.blur(0.55).extractChannel(0).raw().toBuffer();
  if (out.length !== width * height) throw new Error("Texture: madhësi e papritur e shtresës së grain.");
  const values = new Float32Array(width * height);
  // Blur lowers the spread; re-normalise to keep the requested strength.
  let sum = 0, sumSq = 0;
  for (let i = 0; i < out.length; i += 7) { const v = (out[i] - 128) / 127; sum += v; sumSq += v * v; }
  const n = Math.ceil(out.length / 7);
  const std = Math.sqrt(Math.max(1e-6, sumSq / n - (sum / n) ** 2));
  const gain = 0.33 / std;
  for (let i = 0; i < values.length; i++) values[i] = Math.max(-1, Math.min(1, ((out[i] - 128) / 127) * gain));
  return values;
}

/** Dust specks: soft light/dark dots, random size and placement. Adds signed luminance to `overlay`. */
function drawDust(overlay: Float32Array, width: number, height: number, perMegapixel: number, random: () => number) {
  const scale = Math.max(1, Math.max(width, height) / 1500);
  const count = Math.round((width * height / 1e6) * perMegapixel);
  for (let k = 0; k < count; k++) {
    const cx = random() * width, cy = random() * height;
    const big = random() < 0.08;
    const radius = (big ? 1.6 + random() * 1.8 : 0.45 + random() * 1.1) * scale;
    const light = random() < 0.72; // mostly bright dust, like film specks
    const strength = (0.25 + random() * 0.45) * (light ? 1 : -0.8);
    const stretch = 1 + random() * (big ? 2.2 : 0.6); // a few hairs / fibres
    const angle = random() * Math.PI;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const reach = Math.ceil(radius * stretch + 1);
    for (let y = Math.max(0, Math.floor(cy - reach)); y <= Math.min(height - 1, Math.ceil(cy + reach)); y++) {
      for (let x = Math.max(0, Math.floor(cx - reach)); x <= Math.min(width - 1, Math.ceil(cx + reach)); x++) {
        const dx = x - cx, dy = y - cy;
        const u = (dx * cos + dy * sin) / stretch, v = -dx * sin + dy * cos;
        const d = Math.sqrt(u * u + v * v) / radius;
        if (d < 1) overlay[y * width + x] += strength * (1 - d * d);
      }
    }
  }
}

/** Sparse, thin, mostly vertical scratches with slight wander. */
function drawScratches(overlay: Float32Array, width: number, height: number, count: number, random: () => number) {
  const scale = Math.max(1, Math.max(width, height) / 1500);
  const lines = Math.max(1, Math.round(count * (0.6 + random() * 0.8)));
  for (let k = 0; k < lines; k++) {
    let x = random() * width;
    const startY = random() * height * 0.6;
    const length = height * (0.2 + random() * 0.7);
    const drift = (random() - 0.5) * 0.12; // slight tilt
    const halfWidth = (0.35 + random() * 0.45) * scale;
    const light = random() < 0.75;
    const strength = (0.18 + random() * 0.22) * (light ? 1 : -0.7);
    let gapLeft = 0;
    for (let y = Math.floor(startY); y < Math.min(height, startY + length); y++) {
      x += drift + (random() - 0.5) * 0.25;
      if (gapLeft > 0) { gapLeft--; continue; }
      if (random() < 0.004) gapLeft = Math.round((5 + random() * 40) * scale); // broken scratch
      const fadeEnds = Math.min(1, (y - startY) / (30 * scale), (startY + length - y) / (30 * scale));
      for (let px = Math.floor(x - halfWidth - 1); px <= Math.ceil(x + halfWidth + 1); px++) {
        if (px < 0 || px >= width) continue;
        const d = Math.abs(px - x) / (halfWidth + 0.5);
        if (d < 1) overlay[y * width + px] += strength * (1 - d) * fadeEnds;
      }
    }
  }
}

export type TextureOptions = { preset: TexturePresetId; intensity: number; seed: number; preview: boolean; signal?: AbortSignal };
export type TextureResult = { data: Buffer; contentType: string; width: number; height: number; ms: number };

export async function applyTexture(input: Buffer, options: TextureOptions): Promise<TextureResult> {
  const started = Date.now();
  const check = () => { if (options.signal?.aborted) throw new Error("Texture zgjati shumë dhe u ndal."); };
  const metadata = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata().catch(() => {
    throw new TextureInputError("Skedari nuk është foto e vlefshme JPG, PNG ose WebP (ose kalon 40 MP).");
  });
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) throw new TextureInputError("Texture pranon vetëm foto JPG, PNG ose WebP.");
  if (!metadata.width || !metadata.height || metadata.width > MAX_SIDE || metadata.height > MAX_SIDE) throw new TextureInputError("Përmasat e fotos nuk pranohen (maksimumi 8000 px).");
  if ((metadata.pages ?? 1) > 1) throw new TextureInputError("Fotot e animuara nuk pranohen.");

  const t = Math.max(0, Math.min(100, options.intensity)) / 100;
  const p = TEXTURE_PARAMS[options.preset];

  // .rotate() applies EXIF orientation, so the result is upright and keeps its real dimensions.
  let base = sharp(input, { limitInputPixels: MAX_PIXELS }).rotate().toColourspace("srgb");
  if (options.preview) base = base.resize({ width: PREVIEW_SIDE, height: PREVIEW_SIDE, fit: "inside", withoutEnlargement: true });
  const { data, info } = await base.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixels = width * height;
  const random = rng(options.seed);
  check();

  // Layers (all procedural, seeded).
  const long = Math.max(width, height);
  const grain = p.grain && t > 0 ? await grainLayer(width, height, p.grain.size, random) : null;
  const wideBlur = (p.clarity || p.concrete) && t > 0
    ? await sharp(data, { raw: { width, height, channels } }).blur(Math.max(1, long * 0.008)).raw().toBuffer() : null;
  const fineBlur = p.sharpen && t > 0 ? await sharp(data, { raw: { width, height, channels } }).blur(1).raw().toBuffer() : null;
  let surface: Float32Array | null = null;
  if (p.paper && t > 0) surface = await assetLayer(width, height, TEXTURE_ASSETS.paper, random);
  else if (p.concrete && t > 0) surface = await assetLayer(width, height, TEXTURE_ASSETS.concrete, random);
  let overlay: Float32Array | null = null;
  if ((p.dust || p.scratches) && t > 0) {
    overlay = new Float32Array(pixels);
    // Higher intensity shows more specks, and each one more clearly.
    if (p.dust) drawDust(overlay, width, height, p.dust * (0.35 + 0.65 * t), random);
    if (p.scratches) drawScratches(overlay, width, height, p.scratches * (0.4 + 0.6 * t), random);
  }
  check();

  const out = Buffer.alloc(data.length);
  const cx = width / 2, cy = height / 2, maxDist = Math.sqrt(cx * cx + cy * cy);
  for (let y = 0; y < height; y++) {
    if (y % 128 === 0) { await yieldToEventLoop(); check(); } // keep the server responsive
    for (let x = 0; x < width; x++) {
      const i = y * width + x, o = i * channels;
      const r = data[o] / 255, g = data[o + 1] / 255, b = data[o + 2] / 255;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const mid = 1 - (2 * l - 1) * (2 * l - 1);
      let add = 0;

      if (wideBlur && p.clarity) {
        const lb = (0.2126 * wideBlur[o] + 0.7152 * wideBlur[o + 1] + 0.0722 * wideBlur[o + 2]) / 255;
        add += p.clarity * t * 1.4 * (l - lb) * mid;
      }
      if (fineBlur && p.sharpen) {
        const lf = (0.2126 * fineBlur[o] + 0.7152 * fineBlur[o + 1] + 0.0722 * fineBlur[o + 2]) / 255;
        add += p.sharpen * t * 1.2 * (l - lf);
      }
      if (p.contrast) add += p.contrast * t * (l - 0.5) * mid * 0.9;
      if (p.deepShadows) add -= p.deepShadows * t * (1 - smoothstep(0, 0.45, l)) * l * 0.55;
      if (p.fade) add += p.fade * t * (1 - l) * 0.32 - p.fade * t * l * 0.06;
      if (grain && p.grain) add += grain[i] * p.grain.amount * t * (0.35 + 0.65 * mid); // softer in deep shadows & highlights
      if (surface && p.paper) add += surface[i] * p.paper * t * 0.16 * (0.4 + 0.6 * mid);
      if (surface && p.concrete && wideBlur) {
        const lb = (0.2126 * wideBlur[o] + 0.7152 * wideBlur[o + 1] + 0.0722 * wideBlur[o + 2]) / 255;
        // Strongest in dark / background areas; mid-tones (skin) and highlights stay light.
        const shadowWeight = 0.12 + 0.88 * (1 - smoothstep(0.12, 0.42, lb));
        add += surface[i] * p.concrete * t * 0.19 * shadowWeight;
      }
      if (overlay) add += overlay[i] * t * (0.55 + 0.45 * (1 - l));

      let v = 1;
      if (p.vignette) {
        const dx = x - cx, dy = y - cy;
        v = 1 - p.vignette * t * 0.55 * smoothstep(0.35, 1, Math.sqrt(dx * dx + dy * dy) / maxDist);
      }
      const warm = p.warmth ? p.warmth * t : 0;
      // Same luminance offset on R, G and B: monochromatic texture, colours preserved.
      out[o] = Math.max(0, Math.min(255, Math.round((r + add + warm) * v * 255)));
      out[o + 1] = Math.max(0, Math.min(255, Math.round((g + add + warm * 0.3) * v * 255)));
      out[o + 2] = Math.max(0, Math.min(255, Math.round((b + add - warm) * v * 255)));
      if (channels === 4) out[o + 3] = data[o + 3]; // alpha untouched
    }
  }

  const image = sharp(out, { raw: { width, height, channels } });
  let encoded: Buffer;
  let contentType: string;
  if (options.preview) {
    encoded = channels === 4 ? await image.png({ compressionLevel: 3 }).toBuffer() : await image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    contentType = channels === 4 ? "image/png" : "image/jpeg";
  } else if (metadata.format === "png") {
    encoded = await image.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer(); // PNG stays PNG, transparency kept
    contentType = "image/png";
  } else if (metadata.format === "webp") {
    encoded = await image.webp({ quality: 93 }).toBuffer();
    contentType = "image/webp";
  } else {
    encoded = await image.jpeg({ quality: 93, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer();
    contentType = "image/jpeg";
  }
  return { data: encoded, contentType, width, height, ms: Date.now() - started };
}

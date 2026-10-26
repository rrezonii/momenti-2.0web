// KFL "Rregullime" (A): photo-aware tone and detail adjustments, rendered with WebGL2
// in the browser. Unlike a LUT, Auto measures each photo before correcting it.

export type AdjustSettings = {
  auto: boolean;
  exposure: number; // -100..100
  contrast: number; // -100..100
  highlights: number; // -100..100
  shadows: number; // -100..100
  warmth: number; // -100..100
  vibrance: number; // -100..100
  clarity: number; // 0..100
  sharpen: number; // 0..100
  dehaze: number; // 0..100
  vignette: number; // 0..100
};

export type AdjustSlider = { key: Exclude<keyof AdjustSettings, "auto">; label: string; min: number; max: number };

export const NEUTRAL_ADJUST: AdjustSettings = {
  auto: false, exposure: 0, contrast: 0, highlights: 0, shadows: 0, warmth: 0,
  vibrance: 0, clarity: 0, sharpen: 0, dehaze: 0, vignette: 0,
};

export const ADJUST_SLIDERS: AdjustSlider[] = [
  { key: "exposure", label: "Ekspozimi", min: -100, max: 100 },
  { key: "contrast", label: "Kontrasti", min: -100, max: 100 },
  { key: "highlights", label: "Dritat", min: -100, max: 100 },
  { key: "shadows", label: "Hijet", min: -100, max: 100 },
  { key: "warmth", label: "Ngrohtësia", min: -100, max: 100 },
  { key: "vibrance", label: "Gjallëria", min: -100, max: 100 },
  { key: "clarity", label: "Qartësia", min: 0, max: 100 },
  { key: "sharpen", label: "Mprehtësia", min: 0, max: 100 },
  { key: "dehaze", label: "Dehaze", min: 0, max: 100 },
  { key: "vignette", label: "Vinjeta", min: 0, max: 100 },
];

export const ADJUST_PRESETS: Array<{ id: string; name: string; settings: AdjustSettings }> = [
  { id: "auto", name: "Auto", settings: { ...NEUTRAL_ADJUST, auto: true } },
  { id: "news-clear", name: "Lajm i qartë", settings: { ...NEUTRAL_ADJUST, auto: true, contrast: 6, vibrance: 15, clarity: 30, sharpen: 35 } },
  { id: "night", name: "Natë / protestë", settings: { ...NEUTRAL_ADJUST, auto: true, exposure: 6, highlights: -40, shadows: 45, warmth: -8, vibrance: 10, clarity: 20, sharpen: 20 } },
  { id: "indoor", name: "Ambient i errët", settings: { ...NEUTRAL_ADJUST, auto: true, exposure: 12, highlights: -15, shadows: 35, warmth: 6, vibrance: 8, clarity: 15, sharpen: 20 } },
  { id: "dramatic", name: "Dramatik", settings: { ...NEUTRAL_ADJUST, auto: true, contrast: 18, highlights: -22, shadows: 12, vibrance: 6, clarity: 45, sharpen: 25, dehaze: 15, vignette: 35 } },
];

export function isNeutralAdjust(settings: AdjustSettings) {
  return (Object.keys(NEUTRAL_ADJUST) as Array<keyof AdjustSettings>).every((key) => settings[key] === NEUTRAL_ADJUST[key]);
}

export function normalizeAdjust(value: unknown): AdjustSettings {
  if (!value || typeof value !== "object") return NEUTRAL_ADJUST;
  const input = value as Partial<Record<keyof AdjustSettings, unknown>>;
  const result: AdjustSettings = { ...NEUTRAL_ADJUST, auto: input.auto === true };
  for (const slider of ADJUST_SLIDERS) {
    const number = Number(input[slider.key]);
    if (Number.isFinite(number)) result[slider.key] = Math.max(slider.min, Math.min(slider.max, Math.round(number)));
  }
  return result;
}

export type AutoParams = { black: number; white: number; gain: [number, number, number]; gamma: number };
export const NEUTRAL_AUTO: AutoParams = { black: 0, white: 1, gain: [1, 1, 1], gamma: 1 };

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Measures black/white points, colour cast and brightness from a small copy of the photo. */
export function analyzePhoto(source: HTMLCanvasElement | HTMLImageElement): AutoParams {
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!width || !height) return NEUTRAL_AUTO;
  const scale = Math.min(1, 320 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return NEUTRAL_AUTO;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

  const histogram = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    histogram[Math.round(luma(data[i], data[i + 1], data[i + 2]))]++;
    count++;
  }
  const percentile = (fraction: number) => {
    const target = count * fraction;
    let sum = 0;
    for (let value = 0; value < 256; value++) { sum += histogram[value]; if (sum >= target) return value / 255; }
    return 1;
  };
  // Clip only a sliver, and never stretch dramatically: news photos must stay truthful.
  const black = Math.min(0.05, percentile(0.004));
  const white = Math.max(0.8, percentile(0.996));
  const range = Math.max(0.2, white - black);

  // Grey-world white balance from mid-tones, applied at partial strength.
  let r = 0, g = 0, b = 0, midCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = luma(data[i], data[i + 1], data[i + 2]) / 255;
    if (l < 0.12 || l > 0.9) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; midCount++;
  }
  let gain: [number, number, number] = [1, 1, 1];
  if (midCount > 50) {
    const average = (r + g + b) / 3;
    gain = [r, g, b].map((channel) => {
      const full = Math.max(0.82, Math.min(1.22, average / Math.max(1, channel)));
      return 1 + (full - 1) * 0.6;
    }) as [number, number, number];
    const gainLuma = luma(gain[0], gain[1], gain[2]);
    gain = gain.map((value) => value / gainLuma) as [number, number, number];
  }

  // Gamma that moves the median brightness towards a natural mid-grey.
  const median = Math.min(0.95, Math.max(0.03, (percentile(0.5) - black) / range));
  const fullGamma = Math.max(0.72, Math.min(1.35, Math.log(0.46) / Math.log(median)));
  const gamma = 1 + (fullGamma - 1) * 0.7;
  return { black, white, gain, gamma };
}

const VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 uv;
void main() {
  vec2 p = gl_VertexID == 0 ? vec2(-1.0, -1.0) : gl_VertexID == 1 ? vec2(3.0, -1.0) : vec2(-1.0, 3.0);
  uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColor;
uniform sampler2D src;
uniform vec2 texel;
uniform float blurLod;
uniform float hazeLod;
uniform float blackPoint;
uniform float whitePoint;
uniform vec3 wbGain;
uniform float autoGamma;
uniform float exposure;
uniform float contrast;
uniform float highlights;
uniform float shadows;
uniform float warmth;
uniform float vibrance;
uniform float clarity;
uniform float sharpen;
uniform float dehaze;
uniform float vignette;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 removeHaze(vec3 c, float haze) {
  return (c - haze) / max(1.0 - haze, 0.08);
}

vec3 tone(vec3 c) {
  // Levels and gamma act on brightness only, so dark colours keep their hue.
  c = max(c, 0.0) * wbGain;
  float l = max(luma(c), 1e-4);
  float leveled = clamp((l - blackPoint) / max(whitePoint - blackPoint, 0.05), 0.0, 1.5);
  float curved = pow(leveled, autoGamma);
  return c * (curved / l) * exp2(exposure * 1.4);
}

void main() {
  vec3 base = texture(src, uv).rgb;

  // Fine detail (sharpen): difference from the 4 neighbours, 1.5 px apart.
  vec2 o = texel * 1.5;
  vec3 neighbours = (texture(src, uv + vec2(o.x, 0.0)).rgb + texture(src, uv - vec2(o.x, 0.0)).rgb
    + texture(src, uv + vec2(0.0, o.y)).rgb + texture(src, uv - vec2(0.0, o.y)).rgb) * 0.25;
  vec3 c = base + sharpen * 1.6 * (base - neighbours);

  // Dehaze: estimate the veil from a very blurred dark channel.
  vec3 hazeSample = textureLod(src, uv, hazeLod).rgb;
  float haze = min(min(hazeSample.r, hazeSample.g), hazeSample.b) * 0.9 * dehaze;
  c = removeHaze(c, haze);

  vec3 blurred = tone(removeHaze(textureLod(src, uv, blurLod).rgb, haze));
  c = tone(c);

  // Shadows / highlights, masked by local brightness so faces lift without flattening.
  float l = luma(c);
  float local = mix(l, luma(blurred), 0.65);
  float shadowMask = 1.0 - smoothstep(0.0, 0.55, local);
  float highlightMask = smoothstep(0.45, 1.0, local);
  float gain = 1.0 + shadows * 1.1 * shadowMask * (1.0 - local) + highlights * 0.42 * highlightMask;
  c *= max(gain, 0.2);
  blurred *= max(gain, 0.2);

  // Clarity: mid-tone local contrast.
  l = luma(c);
  float detail = l - luma(blurred);
  float midMask = 1.0 - pow(abs(2.0 * clamp(l, 0.0, 1.0) - 1.0), 2.0);
  c += vec3(clarity * 1.3 * detail * midMask);

  // Global contrast around mid-grey.
  c = (c - 0.5) * (1.0 + contrast * 0.6) + 0.5;

  // Warmth.
  c *= vec3(1.0 + warmth * 0.09, 1.0 + warmth * 0.01, 1.0 - warmth * 0.09);

  // Vibrance: boosts muted colours more than saturated ones (protects skin).
  l = luma(c);
  float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  float amount = (vibrance + dehaze * 0.2) * (1.0 - clamp(sat, 0.0, 1.0));
  c = mix(vec3(l), c, 1.0 + amount);

  // Vignette.
  float d = length(uv - 0.5) * 1.414;
  c *= 1.0 - vignette * 0.55 * smoothstep(0.35, 1.0, d);

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL nuk mundi të krijojë shader-in e Rregullimeve.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Shader-i i Rregullimeve nuk u përpilua.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

const MAX_SIDE = 4096;

export class AdjustRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly texture: WebGLTexture;
  private readonly vertexArray: WebGLVertexArrayObject;
  private uploaded: HTMLCanvasElement | HTMLImageElement | null = null;
  private width = 0;
  private height = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2", { alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error("Ky shfletues nuk e mbështet WebGL2 për Rregullimet.");
    this.gl = gl;
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error("WebGL nuk mundi të krijojë programin e Rregullimeve.");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Programi i Rregullimeve nuk u lidh.");
    this.program = program;
    this.vertexArray = gl.createVertexArray() ?? (() => { throw new Error("WebGL: mungon vertex array."); })();
    this.texture = gl.createTexture() ?? (() => { throw new Error("WebGL: mungon tekstura."); })();
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "src"), 0);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
  }

  private upload(source: HTMLCanvasElement | HTMLImageElement) {
    if (this.uploaded === source) return;
    const gl = this.gl;
    const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(sourceWidth, sourceHeight), gl.getParameter(gl.MAX_TEXTURE_SIZE) / Math.max(sourceWidth, sourceHeight));
    let pixels: HTMLCanvasElement | HTMLImageElement = source;
    this.width = Math.max(1, Math.round(sourceWidth * scale));
    this.height = Math.max(1, Math.round(sourceHeight * scale));
    if (scale < 1) {
      const resized = document.createElement("canvas");
      resized.width = this.width;
      resized.height = this.height;
      const context = resized.getContext("2d");
      if (!context) throw new Error("Canvas nuk është i disponueshëm.");
      context.imageSmoothingQuality = "high";
      context.drawImage(source, 0, 0, this.width, this.height);
      pixels = resized;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (gl.getError() !== gl.NO_ERROR) throw new Error("Fotoja nuk u ngarkua në WebGL për Rregullimet.");
    this.uploaded = source;
  }

  /** Returns a new 2D canvas with the adjusted photo (same aspect ratio as the source). */
  render(source: HTMLCanvasElement | HTMLImageElement, settings: AdjustSettings, auto: AutoParams): HTMLCanvasElement {
    const gl = this.gl;
    this.upload(source);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    gl.viewport(0, 0, this.width, this.height);
    gl.bindVertexArray(this.vertexArray);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    const a = settings.auto ? auto : NEUTRAL_AUTO;
    const long = Math.max(this.width, this.height);
    const set = (name: string, value: number) => gl.uniform1f(gl.getUniformLocation(this.program, name), value);
    gl.uniform2f(gl.getUniformLocation(this.program, "texel"), 1 / this.width, 1 / this.height);
    set("blurLod", Math.max(1, Math.log2(long * 0.012)));
    set("hazeLod", Math.max(2, Math.log2(long * 0.06)));
    set("blackPoint", a.black);
    set("whitePoint", a.white);
    gl.uniform3f(gl.getUniformLocation(this.program, "wbGain"), a.gain[0], a.gain[1], a.gain[2]);
    set("autoGamma", a.gamma);
    set("exposure", settings.exposure / 100);
    set("contrast", settings.contrast / 100);
    set("highlights", settings.highlights / 100);
    set("shadows", settings.shadows / 100);
    set("warmth", settings.warmth / 100);
    set("vibrance", settings.vibrance / 100);
    set("clarity", settings.clarity / 100);
    set("sharpen", settings.sharpen / 100);
    set("dehaze", settings.dehaze / 100);
    set("vignette", settings.vignette / 100);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (gl.getError() !== gl.NO_ERROR) throw new Error("Rregullimet nuk u vizatuan në WebGL.");
    const output = document.createElement("canvas");
    output.width = this.width;
    output.height = this.height;
    const context = output.getContext("2d");
    if (!context) throw new Error("Canvas nuk është i disponueshëm.");
    context.drawImage(this.canvas, 0, 0);
    return output;
  }
}

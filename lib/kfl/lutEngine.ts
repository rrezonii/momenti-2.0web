export type LutPreset = {
  id: string;
  name: string;
  file: string;
  defaultIntensity: number;
};

export type LutCube = {
  size: number;
  values: Uint8Array;
};

export function parseCube(text: string): LutCube {
  let size = 0;
  const values: number[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === "TITLE" || parts[0] === "DOMAIN_MIN" || parts[0] === "DOMAIN_MAX") continue;
    if (parts[0] === "LUT_3D_SIZE") {
      size = Number(parts[1]);
      continue;
    }
    if (parts.length === 3) {
      const color = parts.map(Number);
      if (color.every(Number.isFinite)) values.push(...color);
    }
  }
  if (!Number.isInteger(size) || size < 2 || size > 65 || values.length !== size ** 3 * 3) {
    throw new Error("Skedari LUT .cube është i pavlefshëm.");
  }
  // LUTs are color transforms, so 8-bit channels are more than sufficient and
  // avoid fragile RGBA32F texture support on mobile/older WebGL drivers.
  const rgba = new Uint8Array(size ** 3 * 4);
  for (let i = 0, j = 0; i < values.length; i += 3, j += 4) {
    rgba[j] = Math.round(Math.max(0, Math.min(1, values[i])) * 255);
    rgba[j + 1] = Math.round(Math.max(0, Math.min(1, values[i + 1])) * 255);
    rgba[j + 2] = Math.round(Math.max(0, Math.min(1, values[i + 2])) * 255);
    rgba[j + 3] = 255;
  }
  return { size, values: rgba };
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
uniform sampler2D sourceImage;
uniform sampler2D lutImage;
uniform float lutSize;
uniform float intensity;
vec3 lutFetch(ivec3 p) {
  int size = int(lutSize);
  return texelFetch(lutImage, ivec2(p.r + p.g * size, p.b), 0).rgb;
}
vec3 sampleLut(vec3 color) {
  vec3 p = clamp(color, 0.0, 1.0) * (lutSize - 1.0);
  ivec3 lo = ivec3(floor(p));
  ivec3 hi = min(lo + ivec3(1), ivec3(int(lutSize) - 1));
  vec3 f = fract(p);
  vec3 c000 = lutFetch(ivec3(lo.r, lo.g, lo.b));
  vec3 c100 = lutFetch(ivec3(hi.r, lo.g, lo.b));
  vec3 c010 = lutFetch(ivec3(lo.r, hi.g, lo.b));
  vec3 c110 = lutFetch(ivec3(hi.r, hi.g, lo.b));
  vec3 c001 = lutFetch(ivec3(lo.r, lo.g, hi.b));
  vec3 c101 = lutFetch(ivec3(hi.r, lo.g, hi.b));
  vec3 c011 = lutFetch(ivec3(lo.r, hi.g, hi.b));
  vec3 c111 = lutFetch(ivec3(hi.r, hi.g, hi.b));
  vec3 c00 = mix(c000, c100, f.r);
  vec3 c10 = mix(c010, c110, f.r);
  vec3 c01 = mix(c001, c101, f.r);
  vec3 c11 = mix(c011, c111, f.r);
  return mix(mix(c00, c10, f.g), mix(c01, c11, f.g), f.b);
}
void main() {
  vec4 original = texture(sourceImage, uv);
  vec3 graded = sampleLut(original.rgb);
  outColor = vec4(mix(original.rgb, graded, intensity), original.a);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL nuk mundi të krijojë shader-in e LUT-it.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Shader-i i LUT-it nuk u përpilua.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export class LutRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly sourceTexture: WebGLTexture;
  private readonly lutTexture: WebGLTexture;
  private readonly vertexArray: WebGLVertexArrayObject;

  constructor() {
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error("Ky shfletues nuk e mbështet WebGL2 për Filters.");
    this.gl = gl;
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error("WebGL nuk mundi të krijojë programin e LUT-it.");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || "Programi WebGL i LUT-it nuk u lidh.";
      gl.deleteProgram(program);
      throw new Error(message);
    }
    this.program = program;
    const vertexArray = gl.createVertexArray();
    if (!vertexArray) throw new Error("WebGL nuk mundi të krijojë objektin e vertices për Filters.");
    this.vertexArray = vertexArray;
    gl.bindVertexArray(this.vertexArray);
    this.sourceTexture = gl.createTexture() ?? (() => { throw new Error("WebGL nuk mundi të krijojë teksturën e fotos."); })();
    this.lutTexture = gl.createTexture() ?? (() => { throw new Error("WebGL nuk mundi të krijojë teksturën LUT."); })();
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "sourceImage"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "lutImage"), 1);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
  }

  render(source: HTMLCanvasElement | HTMLImageElement, lut: LutCube, intensity: number, width: number, height: number) {
    const gl = this.gl;
    const checkError = (stage: string) => {
      const error = gl.getError();
      if (error === gl.NO_ERROR) return;
      const errorNames: Record<number, string> = {
        [gl.INVALID_ENUM]: "INVALID_ENUM",
        [gl.INVALID_VALUE]: "INVALID_VALUE",
        [gl.INVALID_OPERATION]: "INVALID_OPERATION",
        [gl.INVALID_FRAMEBUFFER_OPERATION]: "INVALID_FRAMEBUFFER_OPERATION",
        [gl.OUT_OF_MEMORY]: "OUT_OF_MEMORY",
        [gl.CONTEXT_LOST_WEBGL]: "CONTEXT_LOST_WEBGL",
      };
      throw new Error(`WebGL Filters: ${errorNames[error] ?? `gabim ${error}`} (${stage}).`);
    };
    this.canvas.width = width;
    this.canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.bindVertexArray(this.vertexArray);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    checkError("ngarkimi i fotos");
    gl.activeTexture(gl.TEXTURE1);
    // A 2D atlas avoids inconsistent 3D texture support in mobile WebGL
    // drivers. Red varies fastest, then green, then blue in .cube files.
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // The photo upload needs vertical flipping, but the LUT atlas is raw
    // row-major data where each row is one blue-channel slice. Do not flip it.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, lut.size * lut.size, lut.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut.values);
    checkError("ngarkimi i LUT-it");
    gl.uniform1f(gl.getUniformLocation(this.program, "lutSize"), lut.size);
    gl.uniform1f(gl.getUniformLocation(this.program, "intensity"), Math.max(0, Math.min(100, intensity)) / 100);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    checkError("renderimi");
    return this.canvas;
  }
}

export async function loadCube(preset: LutPreset): Promise<LutCube> {
  const response = await fetch(preset.file, { cache: "force-cache" });
  if (!response.ok) throw new Error(`LUT-i ${preset.name} nuk u ngarkua.`);
  return parseCube(await response.text());
}

import { isKflAuthenticated } from "@/lib/kfl/auth";
import { isSameOriginRequest } from "@/lib/kfl/origin";
import { applyTexture, isTexturePreset, MAX_TEXTURE_INPUT_BYTES, TextureInputError } from "@/lib/kfl/textureEngine";

// POST /kycu/api/texture?preset=film-grain&intensity=25&seed=123456&mode=preview|apply
// Body: the photo bytes (image/jpeg, image/png or image/webp). Response: the textured photo.
// Processing is local (Sharp) — no AI, no external API, no shell commands, no temp files.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_CONCURRENT = 2;
let running = 0;

async function readBoundedBody(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_TEXTURE_INPUT_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_TEXTURE_INPUT_BYTES) { await reader.cancel(); return null; }
    chunks.push(Buffer.from(value));
  }
  return total ? Buffer.concat(chunks) : null;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Kërkesë e pavlefshme." }, { status: 403 });
  if (!(await isKflAuthenticated())) return Response.json({ error: "Sesioni KFL ka përfunduar. Hyr përsëri." }, { status: 401 });

  const url = new URL(request.url);
  const preset = url.searchParams.get("preset");
  const intensity = Number(url.searchParams.get("intensity"));
  const seed = Number(url.searchParams.get("seed"));
  const mode = url.searchParams.get("mode");
  if (!isTexturePreset(preset) || preset === "none") return Response.json({ error: "Preset i panjohur." }, { status: 400 });
  if (!Number.isInteger(intensity) || intensity < 0 || intensity > 100) return Response.json({ error: "Intensity duhet të jetë 0–100." }, { status: 400 });
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return Response.json({ error: "Seed i pavlefshëm." }, { status: 400 });
  if (mode !== "preview" && mode !== "apply") return Response.json({ error: "Mode i pavlefshëm." }, { status: 400 });

  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) return Response.json({ error: "Texture pranon vetëm foto JPG, PNG ose WebP." }, { status: 415 });
  if (running >= MAX_CONCURRENT) return Response.json({ error: "Texture po përpunon foto të tjera. Provo pas pak sekondash." }, { status: 429 });

  running++;
  try {
    const input = await readBoundedBody(request);
    if (!input) return Response.json({ error: "Fotografia është bosh ose kalon kufirin 20 MB." }, { status: 413 });
    const result = await applyTexture(input, {
      preset, intensity, seed, preview: mode === "preview",
      signal: AbortSignal.timeout(mode === "preview" ? 15_000 : 45_000),
    });
    return new Response(new Uint8Array(result.data), {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Texture-Width": String(result.width),
        "X-Texture-Height": String(result.height),
        "X-Texture-Ms": String(result.ms),
      },
    });
  } catch (error) {
    if (error instanceof TextureInputError) return Response.json({ error: error.message }, { status: 422 });
    console.error("KFL texture failed:", error);
    const message = error instanceof Error && /zgjati/.test(error.message) ? error.message : "Texture nuk u aplikua. Fotografia origjinale nuk u ndryshua.";
    return Response.json({ error: message }, { status: 500 });
  } finally {
    running--;
  }
}

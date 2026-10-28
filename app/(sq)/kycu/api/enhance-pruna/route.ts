import { createHash } from "node:crypto";
import sharp from "sharp";
import { isKflAuthenticated } from "@/lib/kfl/auth";
import { isSameOriginRequest } from "@/lib/kfl/origin";

export const runtime = "nodejs";
export const maxDuration = 180;

const API = "https://api.pruna.ai";
const MAX_BYTES = 20 * 1024 * 1024;
const jobs = new Map<string, { expires: number; result: Promise<Result> }>();
let busy = false;
type Result = { image: Buffer; headers: Record<string, string> };
type Prediction = { id?: string; status?: string; error?: unknown; logs?: unknown; generation_url?: string; cost?: number; metadata?: { cost?: number }; usage?: { cost?: number } };

async function boundedBody(response: Request | Response) {
  const reader = response.body?.getReader();
  if (!reader || Number(response.headers.get("content-length")) > MAX_BYTES) throw new Error("Fotografia është bosh ose kalon kufirin 20 MB.");
  const chunks: Buffer[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error("Fotografia kalon kufirin 20 MB."); }
    chunks.push(Buffer.from(value));
  }
  if (!size) throw new Error("Fotografia është bosh.");
  return Buffer.concat(chunks);
}

// Pruna's own failure reason, trimmed for display (e.g. a safety-checker rejection).
function prunaReason(value: unknown) {
  const text = typeof value === "string" ? value : value && typeof value === "object" ? JSON.stringify(value) : "";
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

// "Stil AI": the Momenti editorial look made by Pruna's prompt-based editor (p-image-edit, $0.01/foto).
// The background description stays fixed so every post gets the same recognisable backdrop.
const BW_PROMPT = "Restyle image 1 as a gritty editorial news-magazine cover photo. Keep the photo in colour: "
  + "slightly desaturated, natural warm skin tones, strong contrast and local clarity, crisp detail in face, hair and clothing, deep rich shadows, dramatic soft side light. "
  + "Replace the background with a weathered dark teal-blue plaster wall with soft mottled stains and subtle depth, slightly out of focus behind the person. "
  + "Over the whole image add a vintage printed-paper texture: fine film grain, light dust specks, a few thin scratches and faint creases, slightly worn edges. "
  + "Keep every person exactly the same: same face, identity, expression, pose, clothing, framing and composition. Do not add any text, letters, logos or new objects.";

async function enhance(input: Buffer, contentType: string, apiKey: string, target = 4, style: "bw" | null = null): Promise<Result> {
  const started = Date.now();
  const signal = AbortSignal.timeout(170_000);
  const source = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
  if (!source.width || !source.height || (source.pages ?? 1) > 1) throw new Error("Përdor një fotografi JPG, PNG ose WebP jo të animuar.");
  const swap = [5, 6, 7, 8].includes(source.orientation ?? 1);
  const width = swap ? source.height : source.width;
  const height = swap ? source.width : source.height;
  const headers = { apikey: apiKey };
  const form = new FormData();
  form.set("content", new Blob([new Uint8Array(input)], { type: contentType }), `source.${source.format === "jpeg" ? "jpg" : source.format}`);
  const prepared = Date.now();
  const upload = await fetch(`${API}/v1/files`, { method: "POST", headers, body: form, signal, redirect: "error", cache: "no-store" });
  const uploaded = Date.now();
  if (!upload.ok) {
    const detail = prunaReason(await upload.text().catch(() => ""));
    console.error("Pruna upload rejected", upload.status, detail);
    throw new Error(`Pruna nuk e pranoi fotografinë (${upload.status}${detail ? `: ${detail}` : ""}).`);
  }
  const file = await upload.json() as { id?: string; urls?: { get?: string } };
  // Use the documented file URL rather than assuming IDs contain only \w/-.
  const uploadedUrl = file.urls?.get ?? (typeof file.id === "string" && file.id ? `${API}/v1/files/${encodeURIComponent(file.id)}` : "");
  if (!uploadedUrl) {
    console.error("Pruna upload missing file reference; response fields:", Object.keys(file));
    throw new Error("Pruna nuk ktheu një skedar të vlefshëm.");
  }
  const imageUrl = new URL(uploadedUrl);
  if (imageUrl.origin !== API || !imageUrl.pathname.startsWith("/v1/files/")) throw new Error("Adresa e skedarit Pruna është e pavlefshme.");

  // Submit exactly once. Only status GETs follow; never retry a paid POST.
  const response = await fetch(`${API}/v1/predictions`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json", Model: style ? "p-image-edit" : "p-image-upscale", "Try-Sync": "true" },
    // Editorial decision: news photos (protests, injuries) must not be blocked by Pruna's
    // "violence" safety checker, so it is turned off for KFL. Content responsibility stays with the newsroom.
    body: JSON.stringify({ input: style
      ? { prompt: BW_PROMPT, images: [imageUrl.toString()], aspect_ratio: "match_input_image", turbo: false, disable_safety_checker: true }
      : { image: imageUrl.toString(), target, enhance_details: true, enhance_realism: false, output_format: "jpg", output_quality: 92, disable_safety_checker: true } }),
    signal, redirect: "error", cache: "no-store",
  });
  if (!response.ok) {
    const detail = prunaReason(await response.text().catch(() => ""));
    console.error("Pruna prediction request rejected", response.status, detail);
    throw new Error(`Pruna nuk e përfundoi kërkesën (${response.status}${detail ? `: ${detail}` : ""}). Kontrollo kreditë në panelin Pruna para se të provosh përsëri.`);
  }
  let prediction = await response.json() as Prediction;
  const id = prediction.id;
  while (prediction.status !== "succeeded") {
    if (["failed", "canceled"].includes(prediction.status ?? "")) {
      const reason = prunaReason(prediction.error);
      console.error("Pruna prediction failed", prediction.id ?? id, prediction.status, reason, prunaReason(prediction.logs));
      throw new Error(`Përpunimi Pruna dështoi${reason ? `: ${reason}` : ""}. Fotografia origjinale është ruajtur.`);
    }
    if (!id || typeof id !== "string") throw new Error("Pruna nuk ktheu identifikuesin e kërkesës.");
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new Error("Pruna zgjati shumë. Kontrollo kërkesën në panelin Pruna para se ta përsëritësh.")); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 750);
      if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
    });
    const status = await fetch(`${API}/v1/predictions/status/${encodeURIComponent(id)}`, { headers, signal, redirect: "error", cache: "no-store" });
    if (!status.ok) throw new Error("Nuk u lexua statusi Pruna. Kontrollo kërkesën në panelin Pruna para se ta përsëritësh.");
    prediction = await status.json() as Prediction;
  }
  const generated = Date.now();
  const url = new URL(prediction.generation_url ?? "");
  if (url.origin !== API || !url.pathname.startsWith("/v1/predictions/delivery/")) throw new Error("Adresa e rezultatit Pruna është e pavlefshme.");
  const download = await fetch(url, { headers, signal, redirect: "error", cache: "no-store" });
  if (!download.ok) throw new Error("Nuk u shkarkua rezultati Pruna. Fotografia origjinale është ruajtur.");
  const pipeline = sharp(await boundedBody(download), { limitInputPixels: 8_000_000 }).rotate();
  if (style) {
    // The editor rounds its output size, so trim the few pixels needed to match the original ratio exactly.
    const meta = await pipeline.clone().metadata();
    const ow = meta.width ?? 0, oh = meta.height ?? 0;
    if (!ow || !oh) throw new Error("Rezultati Pruna është i pavlefshëm.");
    if (Math.abs((ow / oh) / (width / height) - 1) > 0.06) throw new Error("Pruna ndryshoi raportin e fotos. Fotografia origjinale është ruajtur.");
    const fitW = Math.min(ow, Math.round(oh * width / height));
    pipeline.resize({ width: fitW, height: Math.min(oh, Math.round(fitW * height / width)), fit: "cover", position: "centre" });
  }
  const output = await pipeline.jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true });
  if (Math.abs((output.info.width / output.info.height) / (width / height) - 1) > 0.02) throw new Error("Pruna ndryshoi raportin e fotos. Fotografia origjinale është ruajtur.");
  const cost = prediction.cost ?? prediction.usage?.cost ?? prediction.metadata?.cost;
  const finished = Date.now();
  // Where the time goes (pm2 logs), to tell a slow upload from a slow Pruna job.
  console.info(`Pruna timing: upload ${uploaded - prepared}ms (${Math.round(input.length / 1024)} KB, ${width}x${height}) · generate ${generated - uploaded}ms · download ${finished - generated}ms`);
  return { image: output.data, headers: {
    "Content-Type": "image/jpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    "X-Pruna-Input-Resolution": `${width}x${height}`, "X-Pruna-Output-Resolution": `${output.info.width}x${output.info.height}`,
    "X-Pruna-Processing-Ms": String(Date.now() - started),
    "X-Pruna-Timing": `upload ${uploaded - prepared}ms; generate ${generated - uploaded}ms; download ${finished - generated}ms`,
    ...(id ? { "X-Pruna-Prediction-Id": id } : {}),
    ...(typeof cost === "number" && Number.isFinite(cost) ? { "X-Pruna-Reported-Cost": String(cost) } : {}),
  } };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Kërkesë e pavlefshme." }, { status: 403 });
  if (!(await isKflAuthenticated())) return Response.json({ error: "Sesioni KFL ka përfunduar. Hyr përsëri." }, { status: 401 });
  const apiKey = process.env.PRUNA_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Pruna Enhance nuk është konfiguruar. Shto PRUNA_API_KEY në .env.local të serverit." }, { status: 503 });
  const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) return Response.json({ error: "Përdor fotografi JPG, PNG ose WebP." }, { status: 415 });
  try {
    const input = await boundedBody(request);
    // ?target=2 for the small round / 4:5 photos: they never show above ~600 px, so a 2 MP
    // result is enough and comes back faster. The main photo keeps 4 MP.
    const params = new URL(request.url).searchParams;
    const target = params.get("target") === "2" ? 2 : 4;
    const style = params.get("style") === "bw" ? "bw" : null;
    const key = createHash("sha256").update(style ? "v2-style-editorial" : `v3-target-${target}`).update(request.headers.get("cookie") ?? "").update(input).digest("hex");
    for (const [key, job] of jobs) if (job.expires < Date.now()) jobs.delete(key);
    let job = jobs.get(key);
    if (!job) {
      if (busy || jobs.size >= 8) return Response.json({ error: "Pruna është duke përpunuar një foto. Provo më vonë." }, { status: 429 });
      busy = true;
      // Share duplicate requests and retain the outcome (including errors) for
      // ten minutes, so a double-click/reconnect cannot submit another paid job.
      const result = enhance(input, contentType, apiKey, target, style).finally(() => { busy = false; });
      job = { expires: Date.now() + 600_000, result };
      jobs.set(key, job);
    }
    const result = await job.result;
    return new Response(new Uint8Array(result.image), { headers: result.headers });
  } catch (error) {
    const message = error instanceof Error && error.name !== "TimeoutError" && error.name !== "TypeError"
      ? error.message : "Pruna nuk u përgjigj. Kontrollo kërkesën në panelin Pruna para se ta përsëritësh. Fotografia origjinale është ruajtur.";
    return Response.json({ error: message }, { status: 502 });
  }
}

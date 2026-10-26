import { NextResponse } from "next/server";
import sharp from "sharp";
import { isKflAuthenticated } from "@/lib/kfl/auth";
import { isSameOriginRequest } from "@/lib/kfl/origin";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 900 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg"]);
function buildExportXmp() {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="KFL by Momenti">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      photoshop:Credit="Momenti"
      xmp:CreatorTool="KFL by Momenti">
      <dc:creator><rdf:Seq><rdf:li>Momenti</rdf:li></rdf:Seq></dc:creator>
      <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">© Momenti</rdf:li></rdf:Alt></dc:rights>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

async function readBoundedBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_INPUT_BYTES) return null;

  const reader = request.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_INPUT_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return totalBytes ? Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes) : null;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Kërkesë e pavlefshme." }, { status: 403 });
  }
  if (!(await isKflAuthenticated())) {
    return NextResponse.json({ error: "Sesioni KFL ka përfunduar. Hyr përsëri." }, { status: 401 });
  }

  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Përdor eksport PNG ose JPG nga editori KFL." }, { status: 415 });
  }
  const input = await readBoundedBody(request);
  if (!input) {
    return NextResponse.json({ error: "Fotografia është bosh ose kalon kufirin 20 MB." }, { status: 413 });
  }

  try {
    const metadata = await sharp(input, { limitInputPixels: 3_000_000, failOn: "error" }).metadata();
    if (!metadata.width || !metadata.height || metadata.width > 5000 || metadata.height > 5000) {
      return NextResponse.json({ error: "Përmasat e fotografisë së eksportit nuk janë të vlefshme." }, { status: 422 });
    }

    const base = sharp(input, { limitInputPixels: 3_000_000, failOn: "error" })
      .rotate()
      .resize(1080, 1350, {
        fit: "cover",
        position: sharp.strategy.attention,
        kernel: sharp.kernel.lanczos3,
      })
      .toColourspace("srgb")
      .sharpen({ sigma: 1.3, m1: 0.3, m2: 0.3, x1: 0 })
      .keepMetadata()
      .withExifMerge({ IFD0: { Artist: "Momenti", Copyright: "© Momenti", Software: "KFL by Momenti" } })
      .withXmp(buildExportXmp())
      .withIccProfile("srgb");

    let data = Buffer.alloc(0);
    let info: { size: number; width: number; height: number } | undefined;
    let quality = 90;
    for (; quality >= 1; quality = Math.max(1, quality - (quality > 10 ? 5 : 1))) {
      const result = await base.clone().jpeg({
        quality,
        progressive: true,
        chromaSubsampling: "4:4:4",
        mozjpeg: true,
        optimiseScans: true,
      }).toBuffer({ resolveWithObject: true });
      data = result.data;
      info = result.info;
      if (data.byteLength <= MAX_OUTPUT_BYTES || quality === 1) break;
    }

    if (!info || data.byteLength > MAX_OUTPUT_BYTES) {
      return NextResponse.json({ error: "Fotoja nuk mund të zvogëlohet nën 900 KB pa ulur dimensionet." }, { status: 422 });
    }

    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "image/jpeg",
        "Content-Length": String(info.size),
        "X-Image-Width": String(info.width),
        "X-Image-Height": String(info.height),
        "X-JPEG-Quality": String(quality),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("KFL Facebook JPEG export failed:", error);
    return NextResponse.json({ error: "Eksporti JPG nuk u përfundua. Provo përsëri." }, { status: 500 });
  }
}

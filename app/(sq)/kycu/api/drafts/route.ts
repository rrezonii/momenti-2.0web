import { isKflAuthenticated } from "@/lib/kfl/auth";
import { listStoredDrafts, storeDraftFiles, toDraftSummary, validDraftId, type DraftDocument } from "@/lib/kfl/draft-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_DRAFT_BYTES = 80 * 1024 * 1024;
type UploadedImage = { name: string; type: string; data: Buffer };

function imageFile(form: FormData, key: string, filename: string): Promise<UploadedImage>;
function imageFile(form: FormData, key: string, filename: string, optional: true): Promise<UploadedImage | null>;
async function imageFile(form: FormData, key: string, filename: string, optional = false): Promise<UploadedImage | null> {
  const value = form.get(key);
  if (value == null && optional) return null;
  if (!(value instanceof File) || !value.size || !value.type.startsWith("image/")) {
    throw new Error("Fotografia e Draft-it është e pavlefshme.");
  }
  if (value.size > MAX_ASSET_BYTES) throw new Error("Një fotografi është mbi kufirin 25 MB.");
  return { name: filename, type: value.type, data: Buffer.from(await value.arrayBuffer()) };
}

export async function GET() {
  if (!(await isKflAuthenticated())) return Response.json({ error: "Duhet të kyçesh në KFL." }, { status: 401 });
  try {
    const drafts = await listStoredDrafts();
    return Response.json(drafts.map(toDraftSummary), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Draft-et nuk mundën të lexohen." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isKflAuthenticated())) return Response.json({ error: "Duhet të kyçesh në KFL." }, { status: 401 });
  try {
    const form = await request.formData();
    const metadataValue = form.get("metadata");
    if (typeof metadataValue !== "string" || metadataValue.length > 128_000) return Response.json({ error: "Të dhënat e Draft-it janë të pavlefshme." }, { status: 400 });
    const metadata = JSON.parse(metadataValue) as Record<string, unknown>;
    const id = String(metadata.id || "");
    if (!validDraftId(id)) return Response.json({ error: "ID-ja e Draft-it nuk është e vlefshme." }, { status: 400 });
    if (metadata.brand !== "momenti" && metadata.brand !== "ballina") return Response.json({ error: "Dizajni i Draft-it nuk është i vlefshëm." }, { status: 400 });
    if (!metadata.article || typeof metadata.article !== "object" || !Array.isArray(metadata.overlays) || metadata.overlays.length > 100) {
      return Response.json({ error: "Artikulli ose fotot shtesë të Draft-it janë të pavlefshme." }, { status: 400 });
    }

    const mainImage = await imageFile(form, "mainImage", "main.bin");
    const previewImage = await imageFile(form, "previewImage", "preview.bin", true);
    const enhancedImage = await imageFile(form, "enhancedImage", "enhanced.bin", true);
    const aiEnhancedImage = await imageFile(form, "aiEnhancedImage", "ai-enhanced.bin", true);
    let prunaOriginalImage = await imageFile(form, "prunaOriginalImage", "pruna-original.bin", true);
    let prunaEnhancedImage = await imageFile(form, "prunaEnhancedImage", "pruna-enhanced.bin", true);
    if (!prunaOriginalImage || !prunaEnhancedImage) { prunaOriginalImage = null; prunaEnhancedImage = null; }
    const overlayFiles = await Promise.all(metadata.overlays.map((_, index) => imageFile(form, `overlay-${index}`, `overlay-${index}.bin`)));
    const allFiles = [mainImage!, ...(previewImage ? [previewImage] : []), ...(enhancedImage ? [enhancedImage] : []), ...(aiEnhancedImage ? [aiEnhancedImage] : []), ...(prunaOriginalImage && prunaEnhancedImage ? [prunaOriginalImage, prunaEnhancedImage] : []), ...overlayFiles];
    const totalBytes = allFiles.reduce((total, file) => total + file.data.byteLength, 0);
    if (totalBytes > MAX_DRAFT_BYTES) return Response.json({ error: "Fotot e Draft-it kalojnë kufirin 80 MB." }, { status: 413 });

    const overlays = metadata.overlays.map((value, index) => {
      if (!value || typeof value !== "object") throw new Error("Një foto shtesë ka të dhëna të pavlefshme.");
      return { ...(value as Record<string, unknown>), image: { file: overlayFiles[index].name, type: overlayFiles[index].type } };
    });
    const document = {
      ...metadata,
      savedAt: Number.isFinite(metadata.savedAt) ? Number(metadata.savedAt) : Date.now(),
      mainImage: { file: mainImage!.name, type: mainImage!.type },
      previewImage: previewImage ? { file: previewImage.name, type: previewImage.type } : null,
      enhancedImage: enhancedImage ? { file: enhancedImage.name, type: enhancedImage.type } : null,
      aiEnhancedImage: aiEnhancedImage ? { file: aiEnhancedImage.name, type: aiEnhancedImage.type } : null,
      prunaOriginalImage: prunaOriginalImage ? { file: prunaOriginalImage.name, type: prunaOriginalImage.type } : null,
      prunaEnhancedImage: prunaEnhancedImage ? { file: prunaEnhancedImage.name, type: prunaEnhancedImage.type } : null,
      prunaShowing: metadata.prunaShowing === "original" ? "original" : "enhanced",
      overlays,
    } as DraftDocument;

    await storeDraftFiles(document, allFiles.map(({ name, data }) => ({ name, data })));
    return Response.json({ id, savedAt: document.savedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft-i nuk mundi të ruhet.";
    const status = /mbi kufirin|kalojnë kufirin/i.test(message) ? 413 : 400;
    return Response.json({ error: message }, { status });
  }
}

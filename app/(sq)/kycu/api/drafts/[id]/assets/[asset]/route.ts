import { isKflAuthenticated } from "@/lib/kfl/auth";
import { readDraftAsset, validDraftId } from "@/lib/kfl/draft-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; asset: string }> }) {
  if (!(await isKflAuthenticated())) return Response.json({ error: "Duhet të kyçesh në KFL." }, { status: 401 });
  const { id, asset } = await params;
  if (!validDraftId(id)) return Response.json({ error: "Fotoja e Draft-it nuk u gjet." }, { status: 404 });
  const file = await readDraftAsset(id, asset);
  if (!file) return Response.json({ error: "Fotoja e Draft-it nuk u gjet." }, { status: 404 });
  return new Response(file.data, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Length": String(file.data.byteLength),
      "Content-Type": file.type,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

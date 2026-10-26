import { isKflAuthenticated } from "@/lib/kfl/auth";
import { getStoredDraft, toDraftSummary, validDraftId } from "@/lib/kfl/draft-store";
import { rm } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isKflAuthenticated())) return Response.json({ error: "Duhet të kyçesh në KFL." }, { status: 401 });
  const { id } = await params;
  if (!validDraftId(id)) return Response.json({ error: "Draft-i nuk u gjet." }, { status: 404 });
  const draft = await getStoredDraft(id);
  if (!draft) return Response.json({ error: "Draft-i nuk u gjet." }, { status: 404 });
  return Response.json(toDraftSummary(draft), { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isKflAuthenticated())) return Response.json({ error: "Duhet të kyçesh në KFL." }, { status: 401 });
  const { id } = await params;
  if (!validDraftId(id)) return Response.json({ error: "Draft-i nuk u gjet." }, { status: 404 });
  if (!(await getStoredDraft(id))) return Response.json({ error: "Draft-i nuk u gjet." }, { status: 404 });
  const root = process.env.KFL_DRAFTS_DIR || path.join(process.cwd(), "data", "kfl-drafts");
  await rm(path.join(root, id), { recursive: true, force: true });
  return new Response(null, { status: 204 });
}

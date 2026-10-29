import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { KflDraftSummary } from "@/lib/kfl/drafts";

// Drafts are kept only for today and yesterday (Kosovo time); older ones are deleted.
// MAX_DRAFTS is just a safety limit for the disk.
const MAX_DRAFTS = 400;
const TIME_ZONE = "Europe/Belgrade";
const dayKey = (time: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));
function keptDays() {
  const now = Date.now();
  return new Set([dayKey(now), dayKey(now - 24 * 60 * 60 * 1000)]);
}
const ROOT = process.env.KFL_DRAFTS_DIR || path.join(process.cwd(), "data", "kfl-drafts");
const ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

type AssetInfo = { file: string; type: string };
export type DraftDocument = Omit<KflDraftSummary, "mainImageUrl" | "previewImageUrl" | "enhancedImageUrl" | "aiEnhancedImageUrl" | "prunaOriginalImageUrl" | "prunaEnhancedImageUrl" | "overlays"> & {
  mainImage: AssetInfo;
  previewImage?: AssetInfo | null;
  enhancedImage: AssetInfo | null;
  aiEnhancedImage: AssetInfo | null;
  prunaOriginalImage?: AssetInfo | null;
  prunaEnhancedImage?: AssetInfo | null;
  overlays: Array<Omit<KflDraftSummary["overlays"][number], "imageUrl"> & { image: AssetInfo }>;
};

export function validDraftId(id: string) {
  return ID_PATTERN.test(id);
}

function draftPath(id: string) {
  if (!validDraftId(id)) throw new Error("Invalid Draft ID");
  return path.join(ROOT, id);
}

export async function getStoredDraft(id: string): Promise<DraftDocument | null> {
  try {
    const value = await readFile(path.join(draftPath(id), "draft.json"), "utf8");
    return JSON.parse(value) as DraftDocument;
  } catch {
    return null;
  }
}

export async function listStoredDrafts(): Promise<DraftDocument[]> {
  await mkdir(ROOT, { recursive: true });
  const entries = await readdir(ROOT, { withFileTypes: true });
  const drafts = await Promise.all(entries.filter((entry) => entry.isDirectory() && validDraftId(entry.name)).map((entry) => getStoredDraft(entry.name)));
  const days = keptDays();
  const kept: DraftDocument[] = [];
  for (const draft of drafts) {
    if (!draft) continue;
    if (days.has(dayKey(draft.savedAt))) kept.push(draft);
    else await rm(draftPath(draft.id), { recursive: true, force: true }).catch(() => undefined);
  }
  return kept.sort((a, b) => b.savedAt - a.savedAt);
}

export async function storeDraftFiles(document: DraftDocument, files: Array<{ name: string; data: Buffer }>) {
  await mkdir(ROOT, { recursive: true });
  const target = draftPath(document.id);
  const temporary = path.join(ROOT, `.tmp-${randomUUID()}`);
  await mkdir(temporary, { recursive: false });
  try {
    for (const file of files) await writeFile(path.join(temporary, file.name), file.data, { flag: "wx" });
    await writeFile(path.join(temporary, "draft.json"), JSON.stringify(document), "utf8");
    await rm(target, { recursive: true, force: true });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }

  const drafts = await listStoredDrafts();
  for (const expired of drafts.slice(MAX_DRAFTS)) {
    await rm(draftPath(expired.id), { recursive: true, force: true });
  }
}

export async function readDraftAsset(id: string, asset: string) {
  const draft = await getStoredDraft(id);
  if (!draft) return null;
  let info: AssetInfo | undefined;
  if (asset === "main") info = draft.mainImage;
  else if (asset === "preview") info = draft.previewImage ?? undefined;
  else if (asset === "enhanced") info = draft.enhancedImage ?? undefined;
  else if (asset === "ai-enhanced") info = draft.aiEnhancedImage ?? undefined;
  else if (asset === "pruna-original") info = draft.prunaOriginalImage ?? undefined;
  else if (asset === "pruna-enhanced") info = draft.prunaEnhancedImage ?? undefined;
  else {
    const match = /^overlay-(\d+)$/.exec(asset);
    if (match) info = draft.overlays[Number(match[1])]?.image;
  }
  if (!info || !/^[a-z0-9-]+\.bin$/.test(info.file)) return null;
  try {
    const filePath = path.join(draftPath(id), info.file);
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) return null;
    return { data: await readFile(filePath), type: info.type || "application/octet-stream" };
  } catch {
    return null;
  }
}

export function draftAssetUrl(id: string, asset: string) {
  return `/kycu/api/drafts/${encodeURIComponent(id)}/assets/${asset}`;
}

export function toDraftSummary(document: DraftDocument): KflDraftSummary {
  return {
    id: document.id,
    savedAt: document.savedAt,
    brand: document.brand,
    article: document.article,
    title: document.title,
    titleSize: document.titleSize,
    titleY: document.titleY,
    badge: document.badge,
    badgeVisible: document.badgeVisible,
    badgeFontSize: document.badgeFontSize,
    badgeGap: document.badgeGap,
    gradientCoverage: document.gradientCoverage,
    logoPosition: document.logoPosition,
    logoVisible: document.logoVisible ?? true,
    mainTransform: document.mainTransform,
    enhanceEnabled: document.enhanceEnabled,
    enhanceAiEnabled: document.enhanceAiEnabled,
    filterId: document.filterId,
    filterIntensity: document.filterIntensity,
    prunaShowing: document.prunaShowing === "original" ? "original" : "enhanced",
    adjust: document.adjust,
    mainImageUrl: draftAssetUrl(document.id, "main"),
    previewImageUrl: document.previewImage ? draftAssetUrl(document.id, "preview") : null,
    enhancedImageUrl: document.enhancedImage ? draftAssetUrl(document.id, "enhanced") : null,
    aiEnhancedImageUrl: document.aiEnhancedImage ? draftAssetUrl(document.id, "ai-enhanced") : null,
    prunaOriginalImageUrl: document.prunaOriginalImage && document.prunaEnhancedImage ? draftAssetUrl(document.id, "pruna-original") : null,
    prunaEnhancedImageUrl: document.prunaOriginalImage && document.prunaEnhancedImage ? draftAssetUrl(document.id, "pruna-enhanced") : null,
    overlays: document.overlays.map(({ image, ...overlay }, index) => { void image; return { ...overlay, imageUrl: draftAssetUrl(document.id, `overlay-${index}`) }; }),
  };
}

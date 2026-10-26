import type { Article } from "@/lib/types";
import type { AdjustSettings } from "@/lib/kfl/adjustEngine";

const LEGACY_DATABASE = "momenti-kfl-drafts";
const LEGACY_STORE = "drafts";

export type EditorOverlay = {
  id: number;
  kind: "circle" | "portrait";
  source: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
  flipX: boolean;
};

export type DraftOverlay = Omit<EditorOverlay, "source"> & { image: Blob };

type DraftFields = {
  id: string;
  savedAt: number;
  brand: "momenti" | "ballina";
  article: Pick<Article, "id" | "title" | "slug" | "category" | "date" | "time" | "publishedAt" | "image" | "excerpt" | "author">;
  title: string;
  titleSize: number;
  titleY: number;
  badge: string;
  badgeVisible: boolean;
  badgeFontSize: number;
  badgeGap: number;
  gradientCoverage: number;
  logoPosition: { x: number; y: number };
  logoVisible?: boolean;
  mainTransform: { x: number | null; y: number | null; zoom: number };
  enhanceEnabled: boolean;
  enhanceAiEnabled: boolean;
  filterId?: string;
  filterIntensity?: number;
  prunaShowing?: "original" | "enhanced";
  adjust?: AdjustSettings;
};

export type KflDraft = DraftFields & {
  mainImage: Blob;
  previewImage?: Blob | null;
  enhancedImage: Blob | null;
  aiEnhancedImage: Blob | null;
  prunaOriginalImage?: Blob | null;
  prunaEnhancedImage?: Blob | null;
  overlays: DraftOverlay[];
};

export type KflDraftSummary = DraftFields & {
  mainImageUrl: string;
  previewImageUrl?: string | null;
  enhancedImageUrl: string | null;
  aiEnhancedImageUrl: string | null;
  prunaOriginalImageUrl?: string | null;
  prunaEnhancedImageUrl?: string | null;
  overlays: Array<Omit<DraftOverlay, "image"> & { imageUrl: string }>;
};

async function readLegacyDrafts(): Promise<KflDraft[]> {
  if (typeof indexedDB === "undefined") return [];
  return new Promise((resolve) => {
    const open = indexedDB.open(LEGACY_DATABASE, 1);
    open.onerror = () => resolve([]);
    open.onupgradeneeded = () => open.transaction?.abort();
    open.onsuccess = () => {
      const database = open.result;
      if (!database.objectStoreNames.contains(LEGACY_STORE)) {
        database.close();
        resolve([]);
        return;
      }
      const request = database.transaction(LEGACY_STORE, "readonly").objectStore(LEGACY_STORE).getAll();
      request.onsuccess = () => { database.close(); resolve(request.result as KflDraft[]); };
      request.onerror = () => { database.close(); resolve([]); };
    };
  });
}

async function deleteLegacyDraft(id: string) {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const open = indexedDB.open(LEGACY_DATABASE, 1);
    open.onerror = () => resolve();
    open.onsuccess = () => {
      const database = open.result;
      if (!database.objectStoreNames.contains(LEGACY_STORE)) { database.close(); resolve(); return; }
      const request = database.transaction(LEGACY_STORE, "readwrite").objectStore(LEGACY_STORE).delete(id);
      request.onsuccess = request.onerror = () => { database.close(); resolve(); };
    };
  });
}

async function postKflDraft(draft: KflDraft) {
  const form = new FormData();
  const { mainImage, previewImage, enhancedImage, aiEnhancedImage, prunaOriginalImage, prunaEnhancedImage, overlays, ...metadata } = draft;
  form.set("metadata", JSON.stringify({ ...metadata, overlays: overlays.map(({ image, ...overlay }) => { void image; return overlay; }) }));
  form.set("mainImage", mainImage, "main-image");
  if (previewImage) form.set("previewImage", previewImage, "preview-image");
  if (enhancedImage) form.set("enhancedImage", enhancedImage, "enhanced-image");
  if (aiEnhancedImage) form.set("aiEnhancedImage", aiEnhancedImage, "ai-enhanced-image");
  // Both Pruna versions are kept so reopening a Draft can switch them without a new paid request.
  if (prunaOriginalImage && prunaEnhancedImage) {
    form.set("prunaOriginalImage", prunaOriginalImage, "pruna-original-image");
    form.set("prunaEnhancedImage", prunaEnhancedImage, "pruna-enhanced-image");
  }
  overlays.forEach((overlay, index) => form.set(`overlay-${index}`, overlay.image, `overlay-${index}`));
  const response = await fetch("/kycu/api/drafts", { method: "POST", body: form, credentials: "same-origin" });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(detail?.error || "Draft-i nuk mundi të ruhet në server.");
  }
}

async function migrateLegacyDrafts(existing: KflDraftSummary[]) {
  const knownIds = new Set(existing.map((draft) => draft.id));
  const legacy = await readLegacyDrafts();
  let migrated = false;
  for (const draft of legacy.sort((a, b) => a.savedAt - b.savedAt)) {
    try {
      const id = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(draft.id)
        ? draft.id
        : crypto.randomUUID();
      if (!knownIds.has(id)) await postKflDraft({ ...draft, id });
      await deleteLegacyDraft(draft.id);
      migrated = true;
    } catch {
      // Keep the old local copy if the server cannot accept it yet.
    }
  }
  return migrated;
}

export async function listKflDrafts(): Promise<KflDraftSummary[]> {
  const load = async () => {
    const response = await fetch("/kycu/api/drafts", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("Draft-et nuk mundën të ngarkohen nga serveri.");
    return response.json() as Promise<KflDraftSummary[]>;
  };
  const existing = await load();
  if (await migrateLegacyDrafts(existing)) return load();
  return existing;
}

export async function getKflDraft(id: string): Promise<KflDraftSummary> {
  const response = await fetch(`/kycu/api/drafts/${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Draft-i nuk mund të hapet nga serveri.");
  return response.json() as Promise<KflDraftSummary>;
}

export async function saveKflDraft(draft: KflDraft) {
  await postKflDraft(draft);
  return draft.id;
}

export async function deleteKflDraft(id: string) {
  const response = await fetch(`/kycu/api/drafts/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
  if (!response.ok) throw new Error("Draft-i nuk mundi të fshihet.");
}

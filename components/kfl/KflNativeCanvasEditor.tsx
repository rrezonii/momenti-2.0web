"use client";

import Link from "next/link";
import { ChangeEvent, PointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Article } from "@/lib/types";
import { getKflDraft, saveKflDraft, type KflDraft } from "@/lib/kfl/drafts";
import { loadCube, LutRenderer, type LutCube, type LutPreset } from "@/lib/kfl/lutEngine";
import { DEFAULT_TEXTURE_INTENSITY, TEXTURE_PRESET_INFO, type TexturePresetId } from "@/lib/kfl/texturePresets";
import { ADJUST_PRESETS, ADJUST_SLIDERS, AdjustRenderer, analyzePhoto, isNeutralAdjust, NEUTRAL_ADJUST, normalizeAdjust, type AdjustSettings, type AutoParams } from "@/lib/kfl/adjustEngine";
import KflWorkspaceHeader from "./KflWorkspaceHeader";

const WIDTH = 1080;
const HEIGHT = 1350;
const HISTORY_LIMIT = 50;
const OVERLAY_MAX_WIDTH = 800;
const LOGO_WIDTH = Math.round(473 * 0.9);
const BALLINA_LOGO_WIDTH = Math.round(154 * 0.85);
const DEFAULT_BADGE_FONT_SIZE = 54;
const TITLE_X = 72;
const TITLE_WIDTH = WIDTH - TITLE_X * 2;
const TITLE_BOTTOM_GAP = 45;
const TITLE_MIN_Y = 100;
const BADGE_TITLE_GAP = 6;
const DESKTOP_BADGE_LIFT = 8;
const DESKTOP_EDITOR_QUERY = "(min-width: 681px)";
const GOLD = "#f5e7cc";
const BALLINA_NAVY = "#0c2742";
type KflBrand = "momenti" | "ballina";
type MainTransform = { x: number | null; y: number | null; zoom: number };
type OverlayKind = "circle" | "portrait";
type ImageOverlay = { id: number; kind: OverlayKind; source: string; x: number; y: number; width: number; height: number; zoom: number; offsetX: number; offsetY: number; flipX: boolean };
type DragKind = "main" | "overlay" | "overlayImage" | "logo" | "badge" | "titleResize";
type DragState = { kind: DragKind; pointerX: number; pointerY: number; startX: number; startY: number; overlayId?: number };
type EditorSnapshot = {
  mainSource: string;
  mainTransform: MainTransform;
  selectedFilterId: string;
  filterIntensity: number;
  filterIntensities: Record<string, number>;
  adjust: AdjustSettings;
  title: string;
  titleSize: number;
  titleY: number;
  badge: string;
  badgeVisible: boolean;
  badgeFontSize: number;
  badgeGap: number;
  gradientCoverage: number;
  logoPosition: { x: number; y: number };
  logoVisible: boolean;
  overlays: ImageOverlay[];
};
type PinchState =
  | { kind: "main"; distance: number; zoom: number; x: number; y: number; anchorX: number; anchorY: number; baseScale: number; imageWidth: number; imageHeight: number }
  | { kind: "overlay"; id: number; distance: number; zoom: number; offsetX: number; offsetY: number; midpointX: number; midpointY: number }
  | { kind: "badge" | "title"; distance: number; size: number };

function subscribeDesktopEditor(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_EDITOR_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isDesktopEditor() {
  return window.matchMedia(DESKTOP_EDITOR_QUERY).matches;
}

function useBrowserImages(overlays: ImageOverlay[]) {
  const [images, setImages] = useState<Record<number, HTMLImageElement>>({});
  const [loadedSources, setLoadedSources] = useState("[]");
  const [corsIds, setCorsIds] = useState<number[]>([]);
  const sources = JSON.stringify(overlays.map(({ id, source }) => ({ id, source })));
  useEffect(() => {
    let active = true;
    const entries = JSON.parse(sources) as Array<{ id: number; source: string }>;
    Promise.all(entries.map(({ id, source }) => new Promise<{ id: number; image: HTMLImageElement | null; corsIssue: boolean }>((resolve) => {
      let canvasSource = source;
      try {
        const remote = new URL(source);
        if (remote.origin !== window.location.origin) canvasSource = `/kycu/api/image?url=${encodeURIComponent(remote.toString())}`;
      } catch {}
      const image = new window.Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve({ id, image, corsIssue: false });
      image.onerror = () => {
        if (!/^https?:\/\//i.test(source)) return resolve({ id, image: null, corsIssue: false });
        const preview = new window.Image();
        preview.onload = () => resolve({ id, image: preview, corsIssue: true });
        preview.onerror = () => resolve({ id, image: null, corsIssue: false });
        preview.src = source;
      };
      image.src = canvasSource;
    })) ).then((results) => {
      if (!active) return;
      setImages(Object.fromEntries(results.flatMap(({ id, image }) => image ? [[id, image]] : [])));
      setLoadedSources(sources);
      setCorsIds(results.filter((entry) => entry.corsIssue).map((entry) => entry.id));
    });
    return () => { active = false; };
  }, [sources]);
  return { images, corsIds, loaded: sources === loadedSources && overlays.every(({ id }) => Boolean(images[id])) };
}

function useBrowserImage(source: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [corsIssue, setCorsIssue] = useState(false);
  useEffect(() => {
    let active = true;
    if (!source) {
      queueMicrotask(() => {
        if (active) { setImage(null); setError(false); setCorsIssue(false); }
      });
      return () => { active = false; };
    }
    let canvasSource = source;
    try {
      if (/^https?:\/\//i.test(source)) {
        const remote = new URL(source);
        if (remote.origin !== window.location.origin) {
          canvasSource = `/kycu/api/image?url=${encodeURIComponent(remote.toString())}`;
        }
      }
    } catch {
      // Let the normal image error handling report malformed URLs.
    }
    const element = new window.Image();
    element.crossOrigin = "anonymous";
    element.onload = () => { if (active) { setImage(element); setLoadedSource(source); setError(false); setCorsIssue(false); } };
    element.onerror = () => {
      if (!active) return;
      if (/^https?:\/\//i.test(source)) {
        const previewOnly = new window.Image();
        previewOnly.onload = () => { if (active) { setImage(previewOnly); setLoadedSource(source); setError(false); setCorsIssue(true); } };
        previewOnly.onerror = () => { if (active) { setImage(null); setError(true); } };
        previewOnly.src = source;
      } else {
        setImage(null);
        setError(true);
      }
    };
    element.src = canvasSource;
    return () => { active = false; element.onload = null; element.onerror = null; };
  }, [source]);
  return { image, error, corsIssue, loaded: Boolean(image) && loadedSource === source };
}

function safeFilename(value: string) {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "fotolajm";
}

function canUsePhotosSharing() {
  if (typeof navigator === "undefined" || !window.isSecureContext) return false;
  const appleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!appleMobile || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    const probe = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "photo.jpg", { type: "image/jpeg" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

function subscribePhotosSharing() {
  return () => {};
}

function photoExportError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /tainted|cross-origin|securityerror/i.test(message)
    ? "Eksporti u bllokua nga burimi i fotos. Ngarko foton kryesore dhe fotot shtesë nga pajisja."
    : message || "Eksporti JPG nuk u përfundua. Provo përsëri.";
}

type TitleWord = { text: string; highlighted: boolean; spaceBefore: boolean; breakBefore: boolean };

function parseTitleWords(value: string): TitleWord[] {
  const segments: Array<{ text: string; highlighted: boolean }> = [];
  const marker = /@([^@]+)@/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(value))) {
    if (match.index > cursor) segments.push({ text: value.slice(cursor, match.index), highlighted: false });
    segments.push({ text: match[1], highlighted: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) segments.push({ text: value.slice(cursor), highlighted: false });

  const words: TitleWord[] = [];
  let pendingSpace = false;
  let pendingBreak = false;
  for (const segment of segments) {
    for (const chunk of segment.text.match(/\s+|\S+/g) ?? []) {
      if (/^\s+$/.test(chunk)) {
        if (/[\r\n]/.test(chunk)) {
          pendingBreak = true;
          pendingSpace = false;
        } else pendingSpace = true;
        continue;
      }
      words.push({ text: chunk, highlighted: segment.highlighted, spaceBefore: pendingSpace, breakBefore: pendingBreak });
      pendingSpace = false;
      pendingBreak = false;
    }
  }
  return words;
}

function wrapTitle(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const lines: TitleWord[][] = [];
  let line: TitleWord[] = [];
  let lineWidth = 0;
  const spaceWidth = context.measureText(" ").width;
  for (const word of parseTitleWords(value)) {
    if (word.breakBefore && line.length) {
      lines.push(line);
      line = [];
      lineWidth = 0;
    }
    let wordSpace = line.length && word.spaceBefore ? spaceWidth : 0;
    const wordWidth = context.measureText(word.text).width;
    if (line.length && lineWidth + wordSpace + wordWidth > maxWidth) {
      lines.push(line);
      line = [];
      lineWidth = 0;
      wordSpace = 0;
    }
    line.push({ ...word, spaceBefore: line.length > 0 && word.spaceBefore, breakBefore: false });
    lineWidth += wordSpace + wordWidth;
  }
  if (line.length) lines.push(line);
  return lines;
}

function getTitleLayout(context: CanvasRenderingContext2D, title: string, size: number, fontFamily: string, offsetY: number) {
  context.font = `900 ${size}px ${fontFamily}`;
  const lines = wrapTitle(context, title, TITLE_WIDTH);
  const lineHeight = size * 1.06;
  const textHeight = lines.length * lineHeight;
  const bottomAlignedTop = HEIGHT - TITLE_BOTTOM_GAP - textHeight;
  const titleTop = Math.max(TITLE_MIN_Y, Math.min(HEIGHT - textHeight, bottomAlignedTop + offsetY));
  return { lines, lineHeight, textHeight, titleTop };
}

type CanvasImage = HTMLImageElement | HTMLCanvasElement;

const canvasImageKeys = new WeakMap<object, number>();
let nextCanvasImageKey = 1;

function canvasImageKey(image: CanvasImage) {
  let key = canvasImageKeys.get(image);
  if (!key) {
    key = nextCanvasImageKey++;
    canvasImageKeys.set(image, key);
  }
  return key;
}

function imageDimensions(image: CanvasImage) {
  return image instanceof HTMLCanvasElement
    ? { width: image.width, height: image.height }
    : { width: image.naturalWidth, height: image.naturalHeight };
}

function coverLayout(image: CanvasImage, transform: MainTransform) {
  const { width: imageWidth, height: imageHeight } = imageDimensions(image);
  const baseScale = Math.max(WIDTH / imageWidth, HEIGHT / imageHeight);
  const scale = baseScale * transform.zoom;
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: transform.x ?? (WIDTH - width) / 2,
    y: transform.y ?? (HEIGHT - height) / 2,
    width,
    height,
    baseScale,
  };
}

// Line icons for the photo tools (same stroke style as the other KFL icons).
type PrunaTarget = 4 | 8;

function ToolIcon({ name }: { name: "pruna" | "filters" | "adjust" | "texture" }) {
  return (
    <svg className="kfl-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === "pruna" && <>
        <path d="M4.5 19.5 14 10" />
        <path d="m12.5 8.5 3 3" />
        <path d="M17.5 2.8v3.4M15.8 4.5h3.4" />
        <path d="M20.2 9.6v2.2M19.1 10.7h2.2" />
        <path d="M9.6 3.6v2.2M8.5 4.7h2.2" />
      </>}
      {name === "filters" && <>
        <circle cx="9" cy="9.2" r="5" />
        <circle cx="15" cy="9.2" r="5" />
        <circle cx="12" cy="14.6" r="5" />
      </>}
      {name === "texture" && <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
        <path d="M7.5 8h.01M12 7h.01M16.5 8.5h.01M8.5 12.5h.01M13 12h.01M16 15.5h.01M7.5 16.5h.01M11.5 16.5h.01" />
      </>}
      {name === "adjust" && <>
        <path d="M4 6h8.5M17.5 6H20M4 12h2.5M11.5 12H20M4 18h10.5M19.5 18h.5" />
        <circle cx="15" cy="6" r="2.2" />
        <circle cx="9" cy="12" r="2.2" />
        <circle cx="17" cy="18" r="2.2" />
      </>}
    </svg>
  );
}

function clampImageAxis(position: number, imageSize: number, canvasSize: number) {
  if (imageSize <= canvasSize) return Math.max(0, Math.min(canvasSize - imageSize, position));
  return Math.max(canvasSize - imageSize, Math.min(0, position));
}

function clampOverlayAxis(position: number, size: number, canvasSize: number) {
  return Math.max(32 - size, Math.min(canvasSize - 32, position));
}

function clampOverlayOffset(offset: number, size: number, zoom: number) {
  const maxOffset = Math.max(0, size * (zoom - 1) / 2);
  return Math.max(-maxOffset, Math.min(maxOffset, offset));
}

function badgeLayout(context: CanvasRenderingContext2D, value: string, fontSize: number, fontWeight = 400, scale = 1) {
  const badgeText = value.toUpperCase();
  context.save();
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  const maxBadgeWidth = WIDTH - 144;
  let fittedFontSize = fontSize;
  let metrics = context.measureText(badgeText);
  let padding = fittedFontSize * 6 / 39;

  while (fittedFontSize > 20) {
    context.font = `${fontWeight} ${fittedFontSize}px "Lato", Arial, sans-serif`;
    metrics = context.measureText(badgeText);
    padding = fittedFontSize * 6 / 39;
    if (metrics.width + padding * 2 <= maxBadgeWidth - 4) break;
    fittedFontSize -= 1;
  }

  // Scale the entire badge, including restored drafts and fitted long labels.
  fittedFontSize *= 0.8667 * scale;
  context.font = `${fontWeight} ${fittedFontSize}px "Lato", Arial, sans-serif`;
  metrics = context.measureText(badgeText);
  padding = fittedFontSize * 6 / 39;
  const ascent = metrics.actualBoundingBoxAscent || fittedFontSize * 0.75;
  const descent = metrics.actualBoundingBoxDescent;
  const textHeight = ascent + descent || fittedFontSize;
  const layout = {
    badgeText,
    padding,
    metrics,
    ascent,
    fontSize: fittedFontSize,
    width: metrics.width + padding * 2,
    height: textHeight + padding * 2,
  };
  context.restore();
  return layout;
}

export default function KflNativeCanvasEditor({ article, brand = "momenti", draftId }: { article: Article; brand?: KflBrand; draftId?: string }) {
  const router = useRouter();
  const isBallina = brand === "ballina";
  const desktopEditor = useSyncExternalStore(subscribeDesktopEditor, isDesktopEditor, () => false);
  const photosSharingEnabled = useSyncExternalStore(subscribePhotosSharing, canUsePhotosSharing, () => false);
  const desktopBadgeLift = !isBallina && desktopEditor ? DESKTOP_BADGE_LIFT : 0;
  const badgeDefault = isBallina ? "LAJMI I FUNDIT" : "MOMENTI I FUNDIT";
  const badgeWeight = isBallina ? 900 : 400;
  const defaultTitleY = isBallina ? 985 : 970;
  const logoWidth = isBallina ? BALLINA_LOGO_WIDTH : LOGO_WIDTH;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleFieldRef = useRef<HTMLTextAreaElement>(null);
  const mainFileInput = useRef<HTMLInputElement>(null);
  const overlayFileInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());
  const prunaAbortController = useRef<AbortController | null>(null);
  const lutRenderer = useRef<LutRenderer | null>(null);
  const adjustRenderer = useRef<AdjustRenderer | null>(null);
  const textureAdjustRenderer = useRef<AdjustRenderer | null>(null);
  const textureSmallSource = useRef<{ source: string; blob: Blob } | null>(null);
  const textureAbort = useRef<AbortController | null>(null);
  const autoParamsCache = useRef(new WeakMap<object, AutoParams>());
  const photoLayerCanvas = useRef<HTMLCanvasElement | null>(null);
  const filteredMainCanvas = useRef<HTMLCanvasElement | null>(null);
  const filteredMainCacheKey = useRef("");
  const filteredOverlayCache = useRef(new Map<number, { key: string; canvas: HTMLCanvasElement }>());
  const filterThumbnailSourceKey = useRef<number | null>(null);
  const filterAssetsPromise = useRef<Promise<void> | null>(null);
  const restoredDraftId = useRef<string | null>(null);
  const currentDraftId = useRef<string | null>(draftId ?? null);
  const pendingOverlay = useRef<{ kind: OverlayKind; id?: number } | null>(null);
  const nextOverlayId = useRef(1);
  const dragState = useRef<DragState | null>(null);
  const overlayHandleDrags = useRef(new Map<number, { id: number; pointerX: number; pointerY: number; startX: number; startY: number }>());
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchState = useRef<PinchState | null>(null);
  const editorHistory = useRef<{ previous: EditorSnapshot | null; undo: EditorSnapshot[]; redo: EditorSnapshot[]; restoring: boolean; grouping: boolean; timer: ReturnType<typeof setTimeout> | null }>({ previous: null, undo: [], redo: [], restoring: false, grouping: false, timer: null });
  const [historyAvailable, setHistoryAvailable] = useState({ undo: false, redo: false });
  // A blank editor (the "+" button) has no WordPress article behind it.
  const isBlankEditor = article.id === 0 && article.slug === "new";
  const fileSlug = isBlankEditor ? `fotolajm-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}` : article.slug;
  const [mainSource, setMainSource] = useState(article.image);
  const [mainTransform, setMainTransform] = useState<MainTransform>({ x: null, y: null, zoom: 1 });
  const [prunaProcessing, setPrunaProcessing] = useState(false);
  // Enhance for a single round / 4:5 photo (its own Pruna request), with ON/OFF like the main photo.
  const [overlayEnhancing, setOverlayEnhancing] = useState<number | null>(null);
  const [overlayPruna, setOverlayPruna] = useState<Record<number, { original: string; enhanced: string }>>({});
  // overlays: extra photos (circle / 4:5) enhanced in the same Pruna request, keyed by overlay id.
  const [prunaComparison, setPrunaComparison] = useState<{ original: string; enhanced: string; overlays?: Record<number, { original: string; enhanced: string }> } | null>(null);
  // A/B test: "Enhance 8MP" keeps its own result next to the 4MP one (prunaComparison).
  // Remove this state, the 8 in PRUNA_TARGETS and the 8MP buttons to drop the test; 4MP is untouched.
  const [prunaComparison8, setPrunaComparison8] = useState<{ original: string; enhanced: string } | null>(null);
  const [prunaTarget, setPrunaTarget] = useState<PrunaTarget | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [filterError, setFilterError] = useState("");
  const [filterPresets, setFilterPresets] = useState<LutPreset[]>([]);
  const [lutCubes, setLutCubes] = useState<Record<string, LutCube>>({});
  const [filterThumbnails, setFilterThumbnails] = useState<Record<string, string>>({});
  const [selectedFilterId, setSelectedFilterId] = useState("original");
  const [filterIntensity, setFilterIntensity] = useState(70);
  const [filterIntensities, setFilterIntensities] = useState<Record<string, number>>({});
  // "A" (Rregullime): photo-aware adjustments, kept separate from the LUT Filters (F) for comparison.
  const [adjust, setAdjust] = useState<AdjustSettings>(NEUTRAL_ADJUST);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustCompare, setAdjustCompare] = useState(false);
  const [adjustError, setAdjustError] = useState("");
  const [adjusted, setAdjusted] = useState<{ canvas: HTMLCanvasElement; key: string } | null>(null);
  // "Texture": local, procedural texture applied on the server (Sharp). Preview is low-res; Apply replaces the main photo.
  const [textureOpen, setTextureOpen] = useState(false);
  const [texturePreset, setTexturePreset] = useState<TexturePresetId>("none");
  const [textureIntensity, setTextureIntensity] = useState(DEFAULT_TEXTURE_INTENSITY);
  const [textureSeed, setTextureSeed] = useState(() => Math.floor(Math.random() * 0xffffffff));
  const [texturePreview, setTexturePreview] = useState<{ canvas: HTMLCanvasElement; key: string } | null>(null);
  const [textureBusy, setTextureBusy] = useState<"" | "preview" | "apply">("");
  const [textureError, setTextureError] = useState("");
  const [title, setTitle] = useState(article.title);
  const [titleCopied, setTitleCopied] = useState(false);
  const [titleSize, setTitleSize] = useState(78);
  const [titleY, setTitleY] = useState(defaultTitleY);
  const fittedTitleSize = titleSize;
  const [fontRevision, setFontRevision] = useState(0);
  const [badge, setBadge] = useState(badgeDefault);
  const [badgeVisible, setBadgeVisible] = useState(true);
  const [badgeFontSize, setBadgeFontSize] = useState(DEFAULT_BADGE_FONT_SIZE);
  const [badgeGap, setBadgeGap] = useState(BADGE_TITLE_GAP);
  const [gradientCoverage, setGradientCoverage] = useState(isBallina ? 56 : 25);
  const [logoVisible, setLogoVisible] = useState(true);
  const [logoPosition, setLogoPosition] = useState(() => isBallina ? { x: 93, y: 72 } : { x: WIDTH - LOGO_WIDTH - 54, y: 54 });
  const [overlays, setOverlays] = useState<ImageOverlay[]>([]);
  const [preparedPhoto, setPreparedPhoto] = useState<{ file: File; renderKey: string } | null>(null);
  const [exportingPhoto, setExportingPhoto] = useState(false);
  const [photoPreparationError, setPhotoPreparationError] = useState<{ renderKey: string; message: string } | null>(null);
  const [photoPreparationRetry, setPhotoPreparationRetry] = useState(0);
  const [notice, setNotice] = useState("");
  const [activeDraftId, setActiveDraftId] = useState(draftId ?? "");
  const [noticeKind, setNoticeKind] = useState<"error" | "success">("error");
  const { image: mainImage, error: mainImageError, corsIssue: mainCorsIssue, loaded: mainImageLoaded } = useBrowserImage(mainSource);
  const adjustActive = !isNeutralAdjust(adjust);
  const adjustKey = mainImage && adjustActive ? `${canvasImageKey(mainImage)}:${JSON.stringify(adjust)}` : "";
  const adjustReady = !adjustActive || Boolean(adjustError) || adjusted?.key === adjustKey;
  const adjustedMainImage = adjustActive && !adjustError && adjusted ? adjusted.canvas : null;
  const textureKey = textureOpen && texturePreset !== "none" && textureIntensity > 0 ? `${mainSource}|${texturePreset}|${textureIntensity}|${textureSeed}` : "";
  // The Texture preview is shown (with any A adjustments on top) until Apply or Reset; downloads keep using the real photo.
  const texturePreviewDisplay = useMemo(() => {
    if (!texturePreview || !textureKey || !texturePreview.key.startsWith(`${mainSource}|`)) return null;
    if (!adjustActive || !mainImage) return texturePreview.canvas;
    try {
      textureAdjustRenderer.current ??= new AdjustRenderer();
      const auto = autoParamsCache.current.get(mainImage) ?? analyzePhoto(mainImage);
      autoParamsCache.current.set(mainImage, auto);
      return textureAdjustRenderer.current.render(texturePreview.canvas, adjust, auto);
    } catch {
      return texturePreview.canvas;
    }
  }, [adjust, adjustActive, mainImage, mainSource, texturePreview, textureKey]);
  const previewMainImage = texturePreviewDisplay ?? (adjustedMainImage && !adjustCompare ? adjustedMainImage : mainImage);
  const { images: overlayImages, corsIds: overlayCorsIds, loaded: overlayImagesLoaded } = useBrowserImages(overlays);
  const { image: logoImage } = useBrowserImage(isBallina ? "/gazeta-b-logo.png" : "/logo.png");

  // A replaced photo, history restore, or unmount must not receive an old result.
  useEffect(() => () => { prunaAbortController.current?.abort(); }, [mainSource]);

  const loadFilters = useCallback(async () => {
    if (filterAssetsPromise.current) return filterAssetsPromise.current;
    const task = (async () => {
      setFiltersLoading(true);
      setFilterError("");
      try {
        const manifestResponse = await fetch("/assets/luts/manifest.json?v=5", { cache: "no-cache" });
        if (!manifestResponse.ok) throw new Error("Konfigurimi i Filters nuk u ngarkua.");
        const manifest = await manifestResponse.json() as { presets?: LutPreset[] };
        if (!Array.isArray(manifest.presets) || !manifest.presets.length) throw new Error("Konfigurimi i Filters nuk ka filtra.");
        const presets = manifest.presets.filter((preset) => typeof preset.id === "string" && typeof preset.name === "string" && typeof preset.file === "string" && preset.file.startsWith("/assets/luts/") && Number.isFinite(preset.defaultIntensity));
        if (!presets.length) throw new Error("Konfigurimi i Filters nuk ka hyrje të vlefshme.");
        if (selectedFilterId !== "original" && !presets.some((preset) => preset.id === selectedFilterId)) {
          setSelectedFilterId("original");
          setFilterIntensity(70);
        }
        const entries = await Promise.all(presets.map(async (preset) => [preset.id, lutCubes[preset.id] ?? await loadCube(preset)] as const));
        lutRenderer.current ??= new LutRenderer();
        setFilterPresets(presets);
        setLutCubes((current) => ({ ...current, ...Object.fromEntries(entries) }));
      } catch (error) {
        setFilterError(error instanceof Error ? error.message : "Filters nuk mundi të ngarkohej.");
      } finally {
        setFiltersLoading(false);
        filterAssetsPromise.current = null;
      }
    })();
    filterAssetsPromise.current = task;
    return task;
  }, [lutCubes, selectedFilterId]);

  async function toggleFilters() {
    if (filtersOpen) {
      setFiltersOpen(false);
      return;
    }
    setAdjustOpen(false);
    closeTexture();
    setFiltersOpen(true);
    await loadFilters();
  }

  function selectFilter(preset: LutPreset) {
    if (!lutRenderer.current) {
      try { lutRenderer.current = new LutRenderer(); }
      catch (error) {
        setFilterError(error instanceof Error ? error.message : "Filters nuk mbështetet nga ky shfletues.");
        return;
      }
    }
    setFilterError("");
    setSelectedFilterId(preset.id);
    setFilterIntensity(filterIntensities[preset.id] ?? preset.defaultIntensity);
  }

  function changeFilterIntensity(value: number) {
    setFilterIntensity(value);
    if (selectedFilterId !== "original") setFilterIntensities((current) => ({ ...current, [selectedFilterId]: value }));
  }

  function toggleAdjust() {
    if (!adjustOpen) { setFiltersOpen(false); closeTexture(); }
    setAdjustOpen(!adjustOpen);
  }

  function closeTexture() {
    textureAbort.current?.abort();
    setTextureOpen(false);
    setTexturePreset("none");
    setTexturePreview(null);
    setTextureError("");
  }

  function toggleTexture() {
    if (textureOpen) { closeTexture(); return; }
    setFiltersOpen(false);
    setAdjustOpen(false);
    setTextureOpen(true);
  }

  function selectTexturePreset(id: TexturePresetId) {
    setTextureError("");
    setTexturePreset(id);
    const info = TEXTURE_PRESET_INFO.find((preset) => preset.id === id);
    setTextureIntensity(id === "none" ? DEFAULT_TEXTURE_INTENSITY : info?.defaultIntensity ?? DEFAULT_TEXTURE_INTENSITY);
    if (id === "none") setTexturePreview(null);
  }

  function resetTexture() {
    textureAbort.current?.abort();
    setTexturePreset("none");
    setTextureIntensity(DEFAULT_TEXTURE_INTENSITY);
    setTexturePreview(null);
    setTextureError("");
  }

  // Photo bytes for Texture: JPG/PNG/WebP as-is; anything else (e.g. AVIF) converted to JPEG first.
  async function textureSourceBlob(maxSide?: number, sourceUrl: string = mainSource) {
    const original = await imageSourceToBlob(sourceUrl);
    const allowed = ["image/jpeg", "image/png", "image/webp"].includes(original.type);
    if (allowed && !maxSide) return original;
    const bitmap = await createImageBitmap(original).catch(() => {
      throw new Error("Formati i kësaj fotoje nuk lexohet. Ruaje si JPG ose PNG dhe ngarkoje përsëri.");
    });
    const scale = maxSide ? Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height)) : 1;
    if (allowed && scale === 1) { bitmap.close(); return original; }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas nuk është i disponueshëm.");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const type = original.type === "image/png" ? "image/png" : "image/jpeg";
    return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Fotoja nuk u përgatit për Texture.")), type, 0.94));
  }

  async function blobToCanvas(blob: Blob) {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  }

  async function requestTexture(body: Blob, mode: "preview" | "apply", signal: AbortSignal) {
    const query = new URLSearchParams({ preset: texturePreset, intensity: String(textureIntensity), seed: String(textureSeed), mode });
    const response = await fetch(`/kycu/api/texture?${query}`, { method: "POST", headers: { "Content-Type": body.type }, body, credentials: "same-origin", signal });
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(detail?.error || "Texture nuk u aplikua.");
    }
    return response;
  }

  // Debounced low-res preview (max 1200 px) for every preset / intensity change.
  useEffect(() => {
    if (!textureKey || textureBusy === "apply") return;
    const timer = window.setTimeout(() => {
      textureAbort.current?.abort();
      const controller = new AbortController();
      textureAbort.current = controller;
      setTextureBusy("preview");
      setTextureError("");
      void (async () => {
        try {
          if (textureSmallSource.current?.source !== mainSource) {
            textureSmallSource.current = { source: mainSource, blob: await textureSourceBlob(1200) };
          }
          const response = await requestTexture(textureSmallSource.current.blob, "preview", controller.signal);
          const canvas = await blobToCanvas(await response.blob());
          if (!controller.signal.aborted) setTexturePreview({ canvas, key: textureKey });
        } catch (error) {
          if (!controller.signal.aborted) setTextureError(error instanceof Error ? error.message : "Preview e Texture dështoi.");
        } finally {
          if (textureAbort.current === controller) { textureAbort.current = null; setTextureBusy(""); }
        }
      })();
    }, 200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textureKey]);

  // Apply: full resolution on the server; the result becomes the main photo (Undo brings the previous one back).
  async function applyTextureToPhoto() {
    if (texturePreset === "none" || textureIntensity <= 0 || textureBusy === "apply" || prunaProcessing) return;
    textureAbort.current?.abort();
    const controller = new AbortController();
    textureAbort.current = controller;
    setTextureBusy("apply");
    setTextureError("");
    try {
      const source = await textureSourceBlob();
      if (source.size > 20 * 1024 * 1024) throw new Error("Texture pranon foto deri në 20 MB.");
      const response = await requestTexture(source, "apply", controller.signal);
      const resultUrl = URL.createObjectURL(await response.blob());
      objectUrls.current.add(resultUrl);
      const name = TEXTURE_PRESET_INFO.find((preset) => preset.id === texturePreset)?.name ?? texturePreset;
      setMainSource(resultUrl);
      setPreparedPhoto(null);
      setTexturePreview(null);
      setTexturePreset("none");
      setTextureSeed(Math.floor(Math.random() * 0xffffffff));
      setNoticeKind("success");
      setNotice(`Texture "${name}" ${textureIntensity}% u aplikua · ${response.headers.get("X-Texture-Width")}×${response.headers.get("X-Texture-Height")} · ${(Number(response.headers.get("X-Texture-Ms")) / 1000).toFixed(1)}s`);
    } catch (error) {
      if (!controller.signal.aborted) setTextureError(error instanceof Error ? error.message : "Texture nuk u aplikua.");
    } finally {
      if (textureAbort.current === controller) textureAbort.current = null;
      setTextureBusy("");
    }
  }

  function applyAdjustPreset(settings: AdjustSettings) {
    setAdjustCompare(false);
    setAdjust(settings);
  }

  function changeAdjust(key: Exclude<keyof AdjustSettings, "auto">, value: number) {
    setAdjustCompare(false);
    setAdjust((current) => ({ ...current, [key]: value }));
  }

  // Render the adjusted photo off-screen; coalesce slider drags into one frame.
  useEffect(() => {
    if (!mainImage || !adjustActive) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        adjustRenderer.current ??= new AdjustRenderer();
        let auto = autoParamsCache.current.get(mainImage);
        if (!auto) {
          auto = analyzePhoto(mainImage);
          autoParamsCache.current.set(mainImage, auto);
        }
        setAdjusted({ canvas: adjustRenderer.current.render(mainImage, adjust, auto), key: adjustKey });
        setAdjustError("");
      } catch (error) {
        setAdjustError(mainCorsIssue
          ? "Kjo foto nuk lejon përpunim në shfletues. Ngarkoje nga pajisja që të përdorësh Rregullimet."
          : error instanceof Error ? error.message : "Rregullimet nuk u aplikuan.");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [adjust, adjustActive, adjustKey, mainCorsIssue, mainImage]);

  function resetFilter() {
    setSelectedFilterId("original");
    setFilterIntensity(70);
  }

  useEffect(() => {
    if (selectedFilterId !== "original" && !lutCubes[selectedFilterId]) void loadFilters();
  }, [loadFilters, lutCubes, selectedFilterId]);

  useEffect(() => {
    if (!filtersOpen || !previewMainImage || !filterPresets.length || !Object.keys(lutCubes).length) return;
    const sourceKey = canvasImageKey(previewMainImage);
    if (filterThumbnailSourceKey.current === sourceKey && filterThumbnails.original && filterPresets.every((preset) => filterThumbnails[preset.id])) return;
    let active = true;
    void (async () => {
      setFiltersLoading(true);
      try {
        const width = 128;
        const height = 160;
        const base = document.createElement("canvas");
        base.width = width;
        base.height = height;
        const context = base.getContext("2d");
        if (!context) throw new Error("Nuk u krijua thumbnail për Filters.");
        const dimensions = imageDimensions(previewMainImage);
        const scale = Math.max(width / dimensions.width, height / dimensions.height);
        const drawnWidth = dimensions.width * scale;
        const drawnHeight = dimensions.height * scale;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(previewMainImage, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
        const thumbnails: Record<string, string> = { original: base.toDataURL("image/jpeg", 0.76) };
        const renderer = lutRenderer.current ?? new LutRenderer();
        lutRenderer.current = renderer;
        for (const preset of filterPresets) {
          if (!active) return;
          const cube = lutCubes[preset.id];
          if (!cube) continue;
          const result = renderer.render(base, cube, preset.defaultIntensity, width, height);
          thumbnails[preset.id] = result.toDataURL("image/jpeg", 0.76);
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        }
        if (active) {
          filterThumbnailSourceKey.current = sourceKey;
          setFilterThumbnails(thumbnails);
        }
      } catch (error) {
        if (active) setFilterError(error instanceof Error ? error.message : "Thumbnail-et e Filters nuk u krijuan.");
      } finally {
        if (active) setFiltersLoading(false);
      }
    })();
    return () => { active = false; };
  }, [filterPresets, filterThumbnails, filtersOpen, lutCubes, previewMainImage]);

  useEffect(() => {
    if (!draftId || restoredDraftId.current === draftId) return;
    let active = true;
    void getKflDraft(draftId).then(async (draft) => {
      if (!active || !draft) return;
      restoredDraftId.current = draftId;
      currentDraftId.current = draftId;
      setActiveDraftId(draftId);
      const mainBlobResponse = await fetch(draft.mainImageUrl, { credentials: "same-origin" });
      if (!mainBlobResponse.ok) throw new Error("Fotografia kryesore e Draft-it nuk u gjet.");
      const mainBlob = await mainBlobResponse.blob();
      const overlayBlobs = await Promise.all(draft.overlays.map(async (overlay) => {
        const response = await fetch(overlay.imageUrl, { credentials: "same-origin" });
        if (!response.ok) throw new Error("Një foto shtesë e Draft-it nuk u gjet.");
        return response.blob();
      }));
      const mainUrl = URL.createObjectURL(mainBlob);
      objectUrls.current.add(mainUrl);
      let restoredPruna: { original: string; enhanced: string } | null = null;
      if (draft.prunaOriginalImageUrl && draft.prunaEnhancedImageUrl) {
        try {
          const [originalResponse, enhancedResponse] = await Promise.all([
            fetch(draft.prunaOriginalImageUrl, { credentials: "same-origin" }),
            fetch(draft.prunaEnhancedImageUrl, { credentials: "same-origin" }),
          ]);
          if (originalResponse.ok && enhancedResponse.ok) {
            const original = URL.createObjectURL(await originalResponse.blob());
            const enhanced = URL.createObjectURL(await enhancedResponse.blob());
            objectUrls.current.add(original);
            objectUrls.current.add(enhanced);
            restoredPruna = { original, enhanced };
          }
        } catch {
          restoredPruna = null;
        }
      }
      const restoredOverlays = draft.overlays.map(({ imageUrl, ...overlay }, index) => {
        void imageUrl;
        const source = URL.createObjectURL(overlayBlobs[index]);
        objectUrls.current.add(source);
        return { ...overlay, source };
      });
      // Drafts saved with the removed Enhance / Enhance AI tools reopen with the
      // version that was showing, used as the main photo.
      let legacyEnhancedUrl: string | null = null;
      const legacyEnhancedSource = draft.enhanceAiEnabled && draft.aiEnhancedImageUrl
        ? draft.aiEnhancedImageUrl
        : draft.enhanceEnabled && draft.enhancedImageUrl ? draft.enhancedImageUrl : null;
      if (!restoredPruna && legacyEnhancedSource) {
        const legacyResponse = await fetch(legacyEnhancedSource, { credentials: "same-origin" }).catch(() => null);
        if (legacyResponse?.ok) {
          legacyEnhancedUrl = URL.createObjectURL(await legacyResponse.blob());
          objectUrls.current.add(legacyEnhancedUrl);
        }
      }
      if (!active) return;
      setPreparedPhoto(null);
      setPrunaComparison(restoredPruna);
      setMainSource(restoredPruna ? (draft.prunaShowing === "original" ? restoredPruna.original : restoredPruna.enhanced) : legacyEnhancedUrl ?? mainUrl);
      setMainTransform(draft.mainTransform);
      setTitle(draft.title);
      setTitleSize(draft.titleSize);
      setTitleY(draft.titleY);
      setBadge(draft.badge);
      setBadgeVisible(draft.badgeVisible);
      setBadgeFontSize(draft.badgeFontSize);
      setBadgeGap(draft.badgeGap);
      setGradientCoverage(draft.gradientCoverage);
      setLogoPosition(draft.logoPosition);
      setLogoVisible(draft.logoVisible ?? true);
      if (draft.filterId && draft.filterId !== "original") {
        const legacyFilterIds: Record<string, string> = {
          portrait: "natural",
          vivid: "news",
          warm: "natural",
          cool: "clean",
          cinematic: "natural",
          matte: "natural",
          "bw-punch": "news",
        };
        const restoredFilterId = legacyFilterIds[draft.filterId] ?? draft.filterId;
        const restoredFilterIntensity = legacyFilterIds[draft.filterId]
          ? Math.min(draft.filterIntensity ?? 30, 35)
          : draft.filterIntensity ?? 30;
        setSelectedFilterId(restoredFilterId);
        setFilterIntensity(restoredFilterIntensity);
        setFilterIntensities({ [restoredFilterId]: restoredFilterIntensity });
        setFiltersOpen(true);
      }
      setOverlays(restoredOverlays);
      setAdjust(normalizeAdjust(draft.adjust));
      if (active) setNotice("");
    }).catch(() => {
      if (active) setNotice("Draft-i nuk mundi të hapet në këtë shfletues.");
    });
    return () => { active = false; };
  }, [draftId]);
  const fontFamily = '"Lato", Arial, sans-serif';
  const editorSnapshot = useMemo<EditorSnapshot>(() => ({
    mainSource,
    mainTransform,
    selectedFilterId,
    filterIntensity,
    filterIntensities,
    adjust,
    title,
    titleSize,
    titleY,
    badge,
    badgeVisible,
    badgeFontSize,
    badgeGap,
    gradientCoverage,
    logoPosition,
    logoVisible,
    overlays,
  }), [adjust, badge, badgeFontSize, badgeGap, badgeVisible, filterIntensities, filterIntensity, gradientCoverage, logoPosition, logoVisible, mainSource, mainTransform, overlays, selectedFilterId, title, titleSize, titleY]);

  useEffect(() => {
    const history = editorHistory.current;
    if (!history.previous) {
      history.previous = editorSnapshot;
      return;
    }
    if (history.previous === editorSnapshot) return;
    if (history.restoring) {
      history.previous = editorSnapshot;
      history.restoring = false;
      return;
    }
    if (!history.grouping) {
      history.undo = [...history.undo, history.previous].slice(-HISTORY_LIMIT);
      history.redo = [];
      history.grouping = true;
      setHistoryAvailable({ undo: true, redo: false });
    }
    history.previous = editorSnapshot;
    if (history.timer) clearTimeout(history.timer);
    history.timer = setTimeout(() => {
      history.grouping = false;
      history.timer = null;
    }, 350);
  }, [editorSnapshot]);

  const shareRenderKey = useMemo(() => JSON.stringify({
    mainSource,
    mainImageKey: mainImage ? canvasImageKey(mainImage) : null,
    adjustKey,
    adjustedImageKey: adjustedMainImage ? canvasImageKey(adjustedMainImage) : null,
    logoImageKey: logoVisible && logoImage ? canvasImageKey(logoImage) : null,
    mainTransform,
    title,
    titleSize,
    titleY,
    badge,
    badgeVisible,
    badgeFontSize,
    badgeGap,
    desktopBadgeLift,
    gradientCoverage,
    logoPosition,
    logoVisible,
    selectedFilterId,
    filterIntensity,
    overlays,
    filterReady: selectedFilterId === "original" || Boolean(lutCubes[selectedFilterId]),
    loadedOverlayKeys: Object.entries(overlayImages).map(([id, image]) => [id, canvasImageKey(image)]),
  }), [adjustKey, adjustedMainImage, badge, badgeFontSize, badgeGap, badgeVisible, desktopBadgeLift, filterIntensity, gradientCoverage, logoImage, logoPosition, logoVisible, lutCubes, mainImage, mainSource, mainTransform, overlayImages, overlays, selectedFilterId, title, titleSize, titleY]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      document.fonts.load(`900 ${titleSize}px "Lato"`),
      document.fonts.load(`${badgeWeight} ${badgeFontSize}px "Lato"`),
    ]).then(() => {
      // Font loading may fail or finish after a drag. Never gate the size
      // update on it; just repaint with the loaded font when available.
      if (active) setFontRevision((revision) => revision + 1);
    }).catch(() => { /* The canvas keeps drawing with its fallback font. */ });
    return () => { active = false; };
  }, [badgeFontSize, badgeWeight, title, titleSize]);

  useLayoutEffect(() => {
    const field = titleFieldRef.current;
    if (!field || desktopEditor) return;
    const fitTitle = () => {
      field.style.height = "0px";
      field.style.height = `${field.scrollHeight}px`;
    };
    fitTitle();
    let previousWidth = 0;
    const observer = new ResizeObserver(([entry]) => {
      if (Math.abs(entry.contentRect.width - previousWidth) < 0.5) return;
      previousWidth = entry.contentRect.width;
      fitTitle();
    });
    observer.observe(field);
    return () => {
      observer.disconnect();
      field.style.removeProperty("height");
    };
  }, [title, desktopEditor]);

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
    if (editorHistory.current.timer) clearTimeout(editorHistory.current.timer);
  }, []);

  const mainLayout = useMemo(() => previewMainImage ? coverLayout(previewMainImage, mainTransform) : null, [previewMainImage, mainTransform]);

  function restoreEditorSnapshot(snapshot: EditorSnapshot) {
    prunaAbortController.current?.abort();
    setMainSource(snapshot.mainSource);
    setMainTransform(snapshot.mainTransform);
    setSelectedFilterId(snapshot.selectedFilterId);
    setFilterIntensity(snapshot.filterIntensity);
    setFilterIntensities(snapshot.filterIntensities);
    setTitle(snapshot.title);
    setTitleSize(snapshot.titleSize);
    setTitleY(snapshot.titleY);
    setBadge(snapshot.badge);
    setBadgeVisible(snapshot.badgeVisible);
    setBadgeFontSize(snapshot.badgeFontSize);
    setBadgeGap(snapshot.badgeGap);
    setGradientCoverage(snapshot.gradientCoverage);
    setLogoPosition(snapshot.logoPosition);
    setLogoVisible(snapshot.logoVisible);
    setOverlays(snapshot.overlays);
    setAdjust(snapshot.adjust);
    setPreparedPhoto(null);
  }

  function navigateEditorHistory(action: "undo" | "redo") {
    const history = editorHistory.current;
    const target = history[action].pop();
    if (!target) return;
    if (history.timer) clearTimeout(history.timer);
    history.timer = null;
    history.grouping = false;
    const reverse = action === "undo" ? "redo" : "undo";
    history[reverse] = [...history[reverse], editorSnapshot].slice(-HISTORY_LIMIT);
    history.restoring = true;
    restoreEditorSnapshot(target);
    setHistoryAvailable({ undo: history.undo.length > 0, redo: history.redo.length > 0 });
  }

  const draw = useCallback((renderTitleSize = fittedTitleSize, exportMode = false, targetCanvas?: HTMLCanvasElement) => {
    const canvas = targetCanvas ?? canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = isBallina ? BALLINA_NAVY : "#17191c";
    context.fillRect(0, 0, WIDTH, HEIGHT);

    const drawMainImage = exportMode ? adjustedMainImage ?? mainImage : previewMainImage;
    const drawMainLayout = drawMainImage ? coverLayout(drawMainImage, mainTransform) : null;
    const selectedCube = selectedFilterId === "original" ? null : lutCubes[selectedFilterId];
    const lutIsActive = Boolean(selectedCube && filterIntensity > 0);
    if (drawMainImage && drawMainLayout) {
      if (lutIsActive) {
        try {
          const layer = photoLayerCanvas.current ?? document.createElement("canvas");
          photoLayerCanvas.current = layer;
          if (layer.width !== WIDTH || layer.height !== HEIGHT) { layer.width = WIDTH; layer.height = HEIGHT; }
          const layerContext = layer.getContext("2d");
          if (!layerContext) throw new Error("Nuk u krijua shtresa e fotografisë për Filters.");
          const key = JSON.stringify([canvasImageKey(drawMainImage), mainTransform.x, mainTransform.y, mainTransform.zoom, selectedFilterId, filterIntensity]);
          if (filteredMainCacheKey.current !== key) {
            layerContext.clearRect(0, 0, WIDTH, HEIGHT);
            layerContext.imageSmoothingEnabled = true;
            layerContext.imageSmoothingQuality = "high";
            layerContext.drawImage(drawMainImage, drawMainLayout.x, drawMainLayout.y, drawMainLayout.width, drawMainLayout.height);
            const renderer = lutRenderer.current ?? new LutRenderer();
            lutRenderer.current = renderer;
            const output = renderer.render(layer, selectedCube!, filterIntensity, WIDTH, HEIGHT);
            const cache = filteredMainCanvas.current ?? document.createElement("canvas");
            filteredMainCanvas.current = cache;
            if (cache.width !== WIDTH || cache.height !== HEIGHT) { cache.width = WIDTH; cache.height = HEIGHT; }
            const cacheContext = cache.getContext("2d");
            if (!cacheContext) throw new Error("Nuk u ruajt preview i filtruar.");
            cacheContext.clearRect(0, 0, WIDTH, HEIGHT);
            cacheContext.drawImage(output, 0, 0, WIDTH, HEIGHT);
            filteredMainCacheKey.current = key;
          }
          if (filteredMainCanvas.current) context.drawImage(filteredMainCanvas.current, 0, 0);
          else context.drawImage(drawMainImage, drawMainLayout.x, drawMainLayout.y, drawMainLayout.width, drawMainLayout.height);
        } catch (error) {
          window.setTimeout(() => setFilterError(error instanceof Error ? error.message : "Filters nuk mundi të përpunohej."), 0);
          context.drawImage(drawMainImage, drawMainLayout.x, drawMainLayout.y, drawMainLayout.width, drawMainLayout.height);
        }
      } else {
        context.drawImage(drawMainImage, drawMainLayout.x, drawMainLayout.y, drawMainLayout.width, drawMainLayout.height);
      }
    }

    const titleLayout = getTitleLayout(context, title, renderTitleSize, fontFamily, titleY - defaultTitleY);
    const badgeMetrics = badgeLayout(context, badge, badgeFontSize, badgeWeight, isBallina ? 1 : 1.07);
    const renderedBadgeY = Math.max(0, titleLayout.titleTop - badgeMetrics.height - Math.max(0, badgeGap - 4) - desktopBadgeLift);
    const configuredGradientTop = Math.round(HEIGHT * (1 - gradientCoverage / 100));
    const gradientTop = titleLayout.titleTop < defaultTitleY
      ? Math.min(configuredGradientTop, Math.max(0, titleLayout.titleTop - 100))
      : configuredGradientTop;
    const solidBlackTop = Math.round(HEIGHT * 0.9);
    const gradient = context.createLinearGradient(0, gradientTop, 0, isBallina ? HEIGHT : solidBlackTop);
    if (isBallina) {
      gradient.addColorStop(0, "rgba(12,39,66,0)");
      gradient.addColorStop(0.34, "rgba(12,39,66,0.59)");
      gradient.addColorStop(0.72, "rgba(12,39,66,1)");
      gradient.addColorStop(1, "rgba(12,39,66,1)");
    } else {
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(0.25, "rgba(0,0,0,0.48)");
      gradient.addColorStop(0.65, "rgba(0,0,0,0.88)");
      gradient.addColorStop(1, "rgba(0,0,0,1)");
    }
    context.fillStyle = gradient;
    context.fillRect(0, gradientTop, WIDTH, (isBallina ? HEIGHT : solidBlackTop) - gradientTop);
    if (!isBallina) {
      context.fillStyle = "#000000";
      context.fillRect(0, solidBlackTop, WIDTH, HEIGHT - solidBlackTop);
    }

    for (const overlay of overlays) {
      const image = overlayImages[overlay.id];
      if (!image) continue;
      const { x, y, width, height, zoom, offsetX, offsetY } = overlay;
      const aspect = width / height;
      const cropWidth = image.naturalWidth / image.naturalHeight > aspect
        ? image.naturalHeight * aspect
        : image.naturalWidth;
      const cropHeight = cropWidth / aspect;
      const cropX = (image.naturalWidth - cropWidth) / 2;
      const cropY = (image.naturalHeight - cropHeight) / 2;
      const drawnWidth = width * zoom;
      const drawnHeight = height * zoom;
      context.save();
      context.beginPath();
      if (overlay.kind === "circle") context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      else context.rect(x, y, width, height);
      context.clip();
      if (lutIsActive) {
        try {
          const key = JSON.stringify([canvasImageKey(image), x, y, width, height, zoom, offsetX, offsetY, overlay.flipX, selectedFilterId, filterIntensity]);
          let cached = filteredOverlayCache.current.get(overlay.id);
          if (!cached || cached.key !== key) {
            const layer = document.createElement("canvas");
            layer.width = Math.max(1, Math.ceil(width));
            layer.height = Math.max(1, Math.ceil(height));
            const layerContext = layer.getContext("2d");
            if (!layerContext) throw new Error("Nuk u krijua shtresa e fotos shtesë për Filters.");
            layerContext.scale(layer.width / width, layer.height / height);
            layerContext.save();
            layerContext.beginPath();
            if (overlay.kind === "circle") layerContext.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
            else layerContext.rect(0, 0, width, height);
            layerContext.clip();
            if (overlay.flipX) { layerContext.translate(width, 0); layerContext.scale(-1, 1); }
            layerContext.drawImage(image, cropX, cropY, cropWidth, cropHeight, (width - drawnWidth) / 2 + offsetX, (height - drawnHeight) / 2 + offsetY, drawnWidth, drawnHeight);
            layerContext.restore();
            const renderer = lutRenderer.current ?? new LutRenderer();
            lutRenderer.current = renderer;
            const output = renderer.render(layer, selectedCube!, filterIntensity, layer.width, layer.height);
            const filtered = document.createElement("canvas");
            filtered.width = layer.width;
            filtered.height = layer.height;
            const filteredContext = filtered.getContext("2d");
            if (!filteredContext) throw new Error("Nuk u ruajt fotoja shtesë e filtruar.");
            filteredContext.drawImage(output, 0, 0, filtered.width, filtered.height);
            cached = { key, canvas: filtered };
            filteredOverlayCache.current.set(overlay.id, cached);
          }
          context.drawImage(cached.canvas, x, y, width, height);
        } catch (error) {
          window.setTimeout(() => setFilterError(error instanceof Error ? error.message : "Filters nuk mundi të përpunohej."), 0);
          if (overlay.flipX) { context.translate(x * 2 + width, 0); context.scale(-1, 1); }
          context.drawImage(image, cropX, cropY, cropWidth, cropHeight, x + (width - drawnWidth) / 2 + offsetX, y + (height - drawnHeight) / 2 + offsetY, drawnWidth, drawnHeight);
        }
      } else {
        if (overlay.flipX) { context.translate(x * 2 + width, 0); context.scale(-1, 1); }
        context.drawImage(image, cropX, cropY, cropWidth, cropHeight, x + (width - drawnWidth) / 2 + offsetX, y + (height - drawnHeight) / 2 + offsetY, drawnWidth, drawnHeight);
      }
      context.restore();
      context.beginPath();
      if (overlay.kind === "circle") context.ellipse(x + width / 2, y + height / 2, width / 2 + 5, height / 2 + 5, 0, 0, Math.PI * 2);
      else context.rect(x - 5, y - 5, width + 10, height + 10);
      context.strokeStyle = isBallina ? "#f4f7fb" : "#ead8ad";
      context.lineWidth = 10;
      context.stroke();
    }

    if (logoVisible && logoImage) {
      const logoHeight = logoWidth * logoImage.naturalHeight / logoImage.naturalWidth;
      context.save();
      context.globalAlpha = isBallina ? 1 : 0.7;
      context.drawImage(logoImage, logoPosition.x, logoPosition.y, logoWidth, logoHeight);
      context.restore();
    }

    if (badgeVisible && badge) {
      const layout = badgeMetrics;
      context.fillStyle = isBallina ? "#ffffff" : "rgba(155, 24, 23, 0.70)";
      context.beginPath();
      context.rect(72, renderedBadgeY, layout.width, layout.height);
      context.fill();
      context.fillStyle = isBallina ? BALLINA_NAVY : GOLD;
      context.font = `${badgeWeight} ${layout.fontSize}px "Lato", Arial, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "alphabetic";
      context.fillText(
        layout.badgeText,
        72 + layout.width / 2,
        renderedBadgeY + layout.padding + layout.ascent,
      );
    }

    context.font = `900 ${renderTitleSize}px ${fontFamily}`;
    context.textAlign = "left";
    context.fillStyle = isBallina ? "#ffffff" : GOLD;
    context.textBaseline = "top";
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    titleLayout.lines.forEach((line, index) => {
      const lineY = titleLayout.titleTop + index * titleLayout.lineHeight;
      const spaceWidth = context.measureText(" ").width;
      let x = TITLE_X;
      let wordIndex = 0;
      while (wordIndex < line.length) {
        const firstWord = line[wordIndex];
        if (wordIndex > 0 && firstWord.spaceBefore) x += spaceWidth;
        const highlighted = firstWord.highlighted;
        const groupStart = x;
        let groupText = firstWord.text;
        wordIndex += 1;
        while (wordIndex < line.length && line[wordIndex].highlighted === highlighted) {
          if (line[wordIndex].spaceBefore) groupText += " ";
          groupText += line[wordIndex].text;
          wordIndex += 1;
        }
        const groupWidth = context.measureText(groupText).width;
        if (highlighted) {
          context.fillStyle = isBallina ? "#ffffff" : "rgba(155, 24, 23, 0.70)";
          context.fillRect(groupStart - 6, lineY + 2, groupWidth + 12, titleLayout.lineHeight - 4);
        }
        if (highlighted) context.fillStyle = isBallina ? BALLINA_NAVY : GOLD;
        else context.fillStyle = isBallina ? "#ffffff" : GOLD;
        context.fillText(groupText, groupStart, lineY, Math.max(1, TITLE_X + TITLE_WIDTH - groupStart));
        x = groupStart + groupWidth;
      }
    });
  }, [adjustedMainImage, badge, badgeFontSize, badgeWeight, badgeGap, badgeVisible, defaultTitleY, desktopBadgeLift, filterIntensity, fittedTitleSize, fontFamily, gradientCoverage, isBallina, logoImage, logoPosition, logoVisible, logoWidth, lutCubes, mainImage, mainTransform, overlayImages, overlays, previewMainImage, selectedFilterId, title, titleY]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      document.fonts.load(`${badgeWeight} ${badgeFontSize}px "Lato"`),
      document.fonts.ready,
    ]).then(() => { if (active) draw(); }).catch(() => { /* Immediate drawing remains available. */ });
    return () => { active = false; };
  }, [badgeFontSize, badgeWeight, draw]);

  // Apply image edits immediately. The font-ready redraw above is asynchronous;
  // filters must not wait for it before updating the visible canvas.
  useEffect(() => {
    draw();
  }, [selectedFilterId, filterIntensity, lutCubes, fontRevision, draw]);

  const setZoom = useCallback((factor: number) => {
    if (!previewMainImage || !mainLayout) return;
    const nextZoom = Math.max(0.1, Math.min(3.2, Number((mainTransform.zoom * factor).toFixed(2))));
    const ratio = nextZoom / mainTransform.zoom;
    const { width: imageWidth } = imageDimensions(previewMainImage);
    const nextWidth = imageWidth * mainLayout.baseScale * nextZoom;
    const proposedX = WIDTH / 2 - (WIDTH / 2 - mainLayout.x) * ratio;
    const proposedY = HEIGHT / 2 - (HEIGHT / 2 - mainLayout.y) * ratio;
    setMainTransform({
      zoom: nextZoom,
      x: clampImageAxis(proposedX, nextWidth, WIDTH),
      y: proposedY,
    });
  }, [mainLayout, mainTransform.zoom, previewMainImage]);

  function showPrunaSource(source: string) {
    setMainSource(source);
    setPreparedPhoto(null);
    // Extra photos follow the same ON/OFF state as the main photo.
    const pairs = prunaComparison?.overlays;
    if (!pairs || !prunaComparison) return;
    const which = source === prunaComparison.enhanced ? "enhanced" : source === prunaComparison.original ? "original" : null;
    if (!which) return;
    setOverlays((current) => current.map((overlay) => {
      const pair = pairs[overlay.id];
      return pair && (overlay.source === pair.original || overlay.source === pair.enhanced) && overlay.source !== pair[which]
        ? { ...overlay, source: pair[which] } : overlay;
    }));
  }

  // Main photo + extra photos are packed side by side into ONE image, so Pruna enhances
  // them all in a single request (same cost), then the result is cut back into pieces.
  const PRUNA_GAP = 24;
  async function blobToBitmap(blob: Blob) {
    return createImageBitmap(blob).catch(() => {
      throw new Error("Formati i një fotoje nuk lexohet. Ruaje si JPG ose PNG dhe ngarkoje përsëri.");
    });
  }

  function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.95) {
    return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Fotoja nuk u përgatit për Pruna.")), "image/jpeg", quality));
  }

  async function buildPrunaComposite(mainBlob: Blob, extras: ImageOverlay[]) {
    const mainBitmap = await blobToBitmap(mainBlob);
    const mainScale = Math.min(1, 2400 / Math.max(mainBitmap.width, mainBitmap.height));
    const main = { width: Math.round(mainBitmap.width * mainScale), height: Math.round(mainBitmap.height * mainScale) };
    const pieces: Array<{ id: number; bitmap: ImageBitmap; x: number; y: number; width: number; height: number }> = [];
    let columnWidth = 0;
    let y = 0;
    for (const overlay of extras) {
      const bitmap = await blobToBitmap(await imageSourceToBlob(overlay.source));
      const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      pieces.push({ id: overlay.id, bitmap, x: main.width + PRUNA_GAP, y, width, height });
      columnWidth = Math.max(columnWidth, width);
      y += height + PRUNA_GAP;
    }
    const canvas = document.createElement("canvas");
    canvas.width = main.width + PRUNA_GAP + columnWidth;
    canvas.height = Math.max(main.height, y - PRUNA_GAP);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas nuk është i disponueshëm.");
    context.fillStyle = "#7f7f7f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(mainBitmap, 0, 0, main.width, main.height);
    mainBitmap.close();
    for (const piece of pieces) {
      context.drawImage(piece.bitmap, piece.x, piece.y, piece.width, piece.height);
      piece.bitmap.close();
    }
    return {
      blob: await canvasToJpeg(canvas),
      width: canvas.width,
      height: canvas.height,
      regions: [{ id: null as number | null, x: 0, y: 0, width: main.width, height: main.height }, ...pieces.map(({ id, x, y: top, width, height }) => ({ id: id as number | null, x, y: top, width, height }))],
    };
  }

  async function splitPrunaResult(result: HTMLImageElement, composite: { width: number; height: number; regions: Array<{ id: number | null; x: number; y: number; width: number; height: number }> }) {
    const scaleX = result.naturalWidth / composite.width;
    const scaleY = result.naturalHeight / composite.height;
    const parts: Array<{ id: number | null; url: string }> = [];
    for (const region of composite.regions) {
      const sx = Math.round(region.x * scaleX), sy = Math.round(region.y * scaleY);
      const width = Math.max(1, Math.min(result.naturalWidth - sx, Math.round(region.width * scaleX)));
      const height = Math.max(1, Math.min(result.naturalHeight - sy, Math.round(region.height * scaleY)));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas nuk është i disponueshëm.");
      context.drawImage(result, sx, sy, width, height, 0, 0, width, height);
      const url = URL.createObjectURL(await canvasToJpeg(canvas));
      objectUrls.current.add(url);
      parts.push({ id: region.id, url });
    }
    return parts;
  }

  // The photo the Enhance results were made from. While the 4MP or 8MP result is shown this is
  // its original, so both sizes always start from the same photo (fair A/B comparison).
  const prunaBase = [prunaComparison, prunaComparison8].find((pair) => pair && pair.enhanced === mainSource)?.original ?? mainSource;
  function prunaPairFor(target: PrunaTarget) {
    const pair = target === 8 ? prunaComparison8 : prunaComparison;
    return pair && pair.original === prunaBase ? pair : null;
  }

  async function enhancePruna(target: PrunaTarget = 4) {
    // Set the ref synchronously: two clicks before a React render still submit once.
    if (prunaAbortController.current || !mainImageLoaded) return;
    const existing = prunaPairFor(target);
    if (existing) {
      showPrunaSource(existing.enhanced);
      return;
    }
    const base = prunaBase;
    const controller = new AbortController();
    prunaAbortController.current = controller;
    setPrunaProcessing(true);
    setPrunaTarget(target);
    setNotice("");
    let resultUrl: string | null = null;
    try {
      const mainBlob = await textureSourceBlob(undefined, base); // converts AVIF/BMP/GIF/untyped files to JPEG
      // Only the main photo goes to Pruna, alone and at full resolution: sharing Pruna's ~4 MP
      // output with the round/4:5 photos made the main photo noticeably less sharp.
      const extras: ImageOverlay[] = [];
      const composite = extras.length ? await buildPrunaComposite(mainBlob, extras) : null;
      const source = composite ? composite.blob : mainBlob; // full resolution: a bigger input gives Pruna more detail
      if (controller.signal.aborted) return;
      if (source.size > 20 * 1024 * 1024) throw new Error("Pruna pranon fotografi deri në 20 MB.");
      // Same request as always; only the target megapixels differ (4 = default, 8 = A/B test).
      const response = await fetch(target === 8 ? "/kycu/api/enhance-pruna?target=8" : "/kycu/api/enhance-pruna", {
        method: "POST", headers: { "Content-Type": source.type }, body: source,
        credentials: "same-origin", signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(detail?.error || "Pruna nuk mundi ta përpunojë fotografinë. Origjinalja është ruajtur.");
      }
      resultUrl = URL.createObjectURL(await response.blob());
      const resultImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Rezultati Pruna nuk u hap. Origjinalja është ruajtur."));
        image.src = resultUrl!;
      });
      if (controller.signal.aborted) return;
      let enhancedMain = resultUrl;
      const overlayPairs: Record<number, { original: string; enhanced: string }> = {};
      if (composite) {
        const parts = await splitPrunaResult(resultImage, composite);
        if (controller.signal.aborted) return;
        URL.revokeObjectURL(resultUrl);
        enhancedMain = parts.find((part) => part.id === null)!.url;
        for (const part of parts) {
          const overlay = extras.find((item) => item.id === part.id);
          if (overlay) overlayPairs[overlay.id] = { original: overlay.source, enhanced: part.url };
        }
      } else {
        objectUrls.current.add(resultUrl);
      }
      resultUrl = null;
      if (target === 8) setPrunaComparison8({ original: base, enhanced: enhancedMain });
      else setPrunaComparison({ original: base, enhanced: enhancedMain, ...(composite ? { overlays: overlayPairs } : {}) });
      setMainSource(enhancedMain);
      setPreparedPhoto(null);
      setOverlays((current) => current.map((overlay) => {
        const pair = overlayPairs[overlay.id];
        return pair && overlay.source === pair.original ? { ...overlay, source: pair.enhanced } : overlay;
      }));
      setNoticeKind("success");
      const seconds = (Number(response.headers.get("X-Pruna-Processing-Ms")) / 1000).toFixed(1);
      const cost = response.headers.get("X-Pruna-Reported-Cost");
      const together = extras.length ? ` · ${extras.length === 1 ? "1 foto shtesë" : `${extras.length} foto shtesë`} në të njëjtën kërkesë` : "";
      setNotice(`Pruna ${target}MP: ${response.headers.get("X-Pruna-Input-Resolution")} → ${response.headers.get("X-Pruna-Output-Resolution")} · ${seconds}s${together}${cost ? ` · kosto e raportuar: ${cost}` : ""}`);
    } catch (error) {
      if (!controller.signal.aborted) {
        setNoticeKind("error");
        setNotice(error instanceof Error ? error.message : "Pruna dështoi. Origjinalja është ruajtur.");
      }
    } finally {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      if (prunaAbortController.current === controller) {
        prunaAbortController.current = null;
        setPrunaProcessing(false);
        setPrunaTarget(null);
      }
    }
  }

  function prunaButtons(mobile = false, target: PrunaTarget = 4) {
    const pair = prunaPairFor(target);
    const hasResult = Boolean(pair);
    const showingEnhanced = hasResult && mainSource === pair?.enhanced;
    const busy = prunaProcessing;
    const working = prunaProcessing && prunaTarget === target;
    const name = `Enhance ${target}MP`;
    // First press sends one paid request. Once a result exists, the same button only
    // switches between the two saved versions locally — no new request, no credits.
    const label = working ? `${name} po përpunohet…`
      : hasResult ? (showingEnhanced ? `${name}: ON · shfaq origjinalen` : `${name}: OFF · shfaq Enhance`)
      : name;
    return (
      <button
        className={`${mobile ? "kfl-overlay-add-button kfl-enhance-mobile" : "kfl-enhance-toggle"}${showingEnhanced ? " is-active" : ""}`}
        type="button"
        onClick={() => {
          if (pair) showPrunaSource(showingEnhanced ? pair.original : pair.enhanced);
          else void enhancePruna(target);
        }}
        disabled={!mainImageLoaded || busy}
        aria-busy={working}
        aria-pressed={hasResult ? showingEnhanced : undefined}
        aria-label={label}
        title={hasResult ? `${label} (pa kosto)` : `${name} (përdor kredi${target === 8 ? " · 0.01 $" : ""})`}
      >
        {working ? (mobile ? "…" : `${name}…`)
          : mobile ? <>{<ToolIcon name="pruna" />}<span className="kfl-enhance-mp-badge">{target}</span></>
          : <><ToolIcon name="pruna" />{hasResult ? (showingEnhanced ? `${target}MP: ON` : `${target}MP: OFF`) : name}</>}
      </button>
    );
  }

  function handleImageFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setNotice("Zgjidh një skedar fotografie."); return; }
    const url = URL.createObjectURL(file);
    objectUrls.current.add(url);
    setMainSource(url);
    setMainTransform({ x: null, y: null, zoom: 1 });
    setNotice("");
  }

  function handleOverlayFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const pending = pendingOverlay.current;
    pendingOverlay.current = null;
    if (!file || !pending) return;
    if (!file.type.startsWith("image/")) { setNotice("Zgjidh një skedar fotografie."); return; }
    const source = URL.createObjectURL(file);
    objectUrls.current.add(source);
    if (pending.id) {
      setOverlays((current) => current.map((overlay) => overlay.id === pending.id ? { ...overlay, source, zoom: 1, offsetX: 0, offsetY: 0, flipX: false } : overlay));
    } else {
      const id = nextOverlayId.current++;
      const width = pending.kind === "circle" ? 260 : 240;
      const height = pending.kind === "circle" ? 260 : 300;
      setOverlays((current) => [...current, { id, kind: pending.kind, source, x: WIDTH - width - 70, y: 700 + current.length * 28, width, height, zoom: 1, offsetX: 0, offsetY: 0, flipX: false }]);
    }
    setNotice("");
  }

  function updateOverlay(id: number, update: (overlay: ImageOverlay) => ImageOverlay) {
    setOverlays((current) => current.map((overlay) => overlay.id === id ? update(overlay) : overlay));
  }

  function addOverlay(kind: OverlayKind, id?: number) {
    pendingOverlay.current = { kind, id };
    overlayFileInput.current?.click();
  }

  async function enhanceOverlay(overlay: ImageOverlay) {
    const pair = overlayPruna[overlay.id];
    if (pair && (overlay.source === pair.original || overlay.source === pair.enhanced)) {
      // Already enhanced: switch between the two saved versions, no new request.
      updateOverlay(overlay.id, (current) => ({ ...current, source: current.source === pair.enhanced ? pair.original : pair.enhanced }));
      return;
    }
    if (overlayEnhancing !== null || prunaAbortController.current) return;
    setOverlayEnhancing(overlay.id);
    setNotice("");
    try {
      let source = await imageSourceToBlob(overlay.source);
      if (!["image/jpeg", "image/png", "image/webp"].includes(source.type)) {
        const bitmap = await createImageBitmap(source).catch(() => { throw new Error("Formati i kësaj fotoje nuk lexohet. Ruaje si JPG ose PNG."); });
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        bitmap.close();
        source = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Fotoja nuk u përgatit për Enhance.")), "image/jpeg", 0.95));
      }
      if (source.size > 20 * 1024 * 1024) throw new Error("Enhance pranon fotografi deri në 20 MB.");
      const response = await fetch("/kycu/api/enhance-pruna?target=2", { method: "POST", headers: { "Content-Type": source.type }, body: source, credentials: "same-origin" });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(detail?.error || "Enhance nuk mundi ta përpunojë foton. Origjinalja është ruajtur.");
      }
      const url = URL.createObjectURL(await response.blob());
      objectUrls.current.add(url);
      setOverlayPruna((current) => ({ ...current, [overlay.id]: { original: overlay.source, enhanced: url } }));
      updateOverlay(overlay.id, (current) => current.source === overlay.source ? { ...current, source: url } : current);
      setNoticeKind("success");
      setNotice(`Enhance i fotos ${overlay.kind === "circle" ? "rrethore" : "4:5"}: ${response.headers.get("X-Pruna-Input-Resolution")} → ${response.headers.get("X-Pruna-Output-Resolution")} · ${(Number(response.headers.get("X-Pruna-Processing-Ms")) / 1000).toFixed(1)}s`);
    } catch (error) {
      setNoticeKind("error");
      setNotice(error instanceof Error ? error.message : "Enhance dështoi. Origjinalja është ruajtur.");
    } finally {
      setOverlayEnhancing(null);
    }
  }

  function removeOverlay(id: number) {
    setOverlays((current) => current.filter((overlay) => overlay.id !== id));
  }

  function resizeOverlay(id: number, delta: number) {
    updateOverlay(id, (current) => {
      const width = Math.max(150, Math.min(OVERLAY_MAX_WIDTH, current.width + delta));
      const height = current.kind === "circle" ? width : Math.round(width * 1.25);
      return {
        ...current,
        width,
        height,
        x: clampOverlayAxis(current.x - (width - current.width) / 2, width, WIDTH),
        y: clampOverlayAxis(current.y - (height - current.height) / 2, height, HEIGHT),
        offsetX: clampOverlayOffset(current.offsetX, width, current.zoom),
        offsetY: clampOverlayOffset(current.offsetY, height, current.zoom),
      };
    });
  }

  function toggleOverlayFlip(id: number) {
    updateOverlay(id, (current) => ({ ...current, flipX: !current.flipX }));
  }

  function startOverlayHandleDrag(event: PointerEvent<HTMLButtonElement>, overlay: ImageOverlay) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = canvas.getBoundingClientRect();
    overlayHandleDrags.current.set(event.pointerId, {
      id: overlay.id,
      pointerX: (event.clientX - bounds.left) * WIDTH / bounds.width,
      pointerY: (event.clientY - bounds.top) * HEIGHT / bounds.height,
      startX: overlay.x,
      startY: overlay.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveOverlayHandleDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = overlayHandleDrags.current.get(event.pointerId);
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const x = drag.startX + (event.clientX - bounds.left) * WIDTH / bounds.width - drag.pointerX;
    const y = drag.startY + (event.clientY - bounds.top) * HEIGHT / bounds.height - drag.pointerY;
    updateOverlay(drag.id, (current) => ({
      ...current,
      x: clampOverlayAxis(x, current.width, WIDTH),
      y: clampOverlayAxis(y, current.height, HEIGHT),
    }));
  }

  function endOverlayHandleDrag(event: PointerEvent<HTMLButtonElement>) {
    overlayHandleDrags.current.delete(event.pointerId);
  }

  function canvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * WIDTH / bounds.width, y: (event.clientY - bounds.top) * HEIGHT / bounds.height };
  }

  function resizeTitleWithWheel(event: WheelEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * WIDTH / bounds.width, y: (event.clientY - bounds.top) * HEIGHT / bounds.height };
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const layout = getTitleLayout(context, title, fittedTitleSize, fontFamily, titleY - defaultTitleY);
    if (point.x < TITLE_X || point.x > WIDTH - TITLE_X || point.y < layout.titleTop || point.y > layout.titleTop + layout.textHeight) return;
    event.preventDefault();
    if (event.deltaY !== 0) {
      const step = event.deltaY < 0 ? 2 : -2;
      setTitleSize((current) => Math.max(24, Math.min(120, current + step)));
    }
  }

  // React delegates wheel events passively, so preventDefault cannot stop
  // page scrolling there. Bind directly to keep resizing under the pointer.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", resizeTitleWithWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", resizeTitleWithWheel);
  });

  function startDrag(event: PointerEvent<HTMLCanvasElement>) {
    const point = canvasPoint(event);
    activePointers.current.set(event.pointerId, point);
    const pointerList = [...activePointers.current.values()];
    if (pointerList.length >= 2) {
      const dragTarget = dragState.current;
      const target = dragTarget?.kind;
      if (target) {
        const [first, second] = pointerList;
        const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
        if (target === "main" && previewMainImage && mainLayout) {
          pinchState.current = {
            kind: "main",
            distance,
            zoom: mainTransform.zoom,
            x: mainLayout.x,
            y: mainLayout.y,
            anchorX: (first.x + second.x) / 2,
            anchorY: (first.y + second.y) / 2,
            baseScale: mainLayout.baseScale,
            imageWidth: imageDimensions(previewMainImage).width,
            imageHeight: imageDimensions(previewMainImage).height,
          };
        } else if ((target === "overlay" || target === "overlayImage") && dragTarget?.overlayId) {
          const overlay = overlays.find((item) => item.id === dragTarget.overlayId);
          if (overlay) pinchState.current = { kind: "overlay", id: overlay.id, distance, zoom: overlay.zoom, offsetX: overlay.offsetX, offsetY: overlay.offsetY, midpointX: (first.x + second.x) / 2, midpointY: (first.y + second.y) / 2 };
        } else if (target === "badge") {
          pinchState.current = { kind: "badge", distance, size: badgeFontSize };
        } else if (target === "titleResize") {
          pinchState.current = { kind: "title", distance, size: titleSize };
        }
      }
      dragState.current = null;
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const logoHeight = logoImage ? logoWidth * logoImage.naturalHeight / logoImage.naturalWidth : 0;
    const logo = logoVisible && logoImage && point.x >= logoPosition.x && point.x <= logoPosition.x + logoWidth && point.y >= logoPosition.y && point.y <= logoPosition.y + logoHeight;
    const overlay = [...overlays].reverse().find((item) => overlayImages[item.id] && point.x >= item.x && point.x <= item.x + item.width && point.y >= item.y && point.y <= item.y + item.height);
    const overlayInterior = overlay && (overlay.kind === "circle"
      ? Math.hypot(point.x - (overlay.x + overlay.width / 2), point.y - (overlay.y + overlay.height / 2)) < overlay.width / 2 - 18
      : point.x > overlay.x + 18 && point.x < overlay.x + overlay.width - 18 && point.y > overlay.y + 18 && point.y < overlay.y + overlay.height - 18);
    const panOverlayImage = Boolean(overlay && overlay.zoom > 1 && overlayInterior);
    const measureContext = canvasRef.current?.getContext("2d");
    const badgeDimensions = measureContext ? badgeLayout(measureContext, badge, badgeFontSize, badgeWeight, isBallina ? 1 : 1.07) : { width: 0, height: 0 };
    const titleLayout = measureContext ? getTitleLayout(measureContext, title, fittedTitleSize, fontFamily, titleY - defaultTitleY) : null;
    const renderedBadgeY = titleLayout
      ? Math.max(0, titleLayout.titleTop - badgeDimensions.height - Math.max(0, badgeGap - 4) - desktopBadgeLift)
      : 0;
    const onBadge = badgeVisible && Boolean(badge) && point.x >= 72 && point.x <= 72 + badgeDimensions.width && point.y >= renderedBadgeY && point.y <= renderedBadgeY + badgeDimensions.height;
    const onTitle = titleLayout !== null && point.x >= TITLE_X && point.x <= WIDTH - TITLE_X
      && point.y >= titleLayout.titleTop && point.y <= titleLayout.titleTop + titleLayout.textHeight;

    let kind: DragKind | null = null;
    let startX = 0;
    let startY = 0;
    // The title is painted above photos and the logo, so it must also win
    // hit testing when those elements overlap it.
    if (onTitle) { kind = "titleResize"; startY = titleSize; }
    else if (logo) { kind = "logo"; startX = logoPosition.x; startY = logoPosition.y; }
    else if (panOverlayImage && overlay) { kind = "overlayImage"; startX = overlay.offsetX; startY = overlay.offsetY; }
    else if (overlay) { kind = "overlay"; startX = overlay.x; startY = overlay.y; }
    else if (onBadge) { kind = "badge"; startX = 72; startY = badgeGap; }
    else if (previewMainImage && mainLayout) { kind = "main"; startX = mainLayout.x; startY = mainLayout.y; }
    if (kind) {
      dragState.current = { kind, pointerX: point.x, pointerY: point.y, startX, startY, overlayId: overlay?.id };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function moveDrag(event: PointerEvent<HTMLCanvasElement>) {
    const point = canvasPoint(event);
    if (activePointers.current.has(event.pointerId)) activePointers.current.set(event.pointerId, point);
    if (event.pointerType === "mouse" && !dragState.current && !pinchState.current) {
      const context = canvasRef.current?.getContext("2d");
      if (context && title) {
        const layout = getTitleLayout(context, title, fittedTitleSize, fontFamily, titleY - defaultTitleY);
        const overTitle = point.x >= TITLE_X && point.x <= WIDTH - TITLE_X
          && point.y >= layout.titleTop && point.y <= layout.titleTop + layout.textHeight;
        event.currentTarget.style.cursor = overTitle ? "ns-resize" : "";
      } else event.currentTarget.style.cursor = "";
    }
    const pinch = pinchState.current;
    if (pinch && activePointers.current.size >= 2) {
      const pointerList = [...activePointers.current.values()];
      const [first, second] = pointerList;
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const ratio = distance / pinch.distance;
      if (pinch.kind === "main") {
        const zoom = Math.max(0.1, Math.min(3.2, pinch.zoom * ratio));
        const width = pinch.imageWidth * pinch.baseScale * zoom;
        setMainTransform({
          zoom,
          x: clampImageAxis(pinch.anchorX - (pinch.anchorX - pinch.x) * (zoom / pinch.zoom), width, WIDTH),
          y: pinch.anchorY - (pinch.anchorY - pinch.y) * (zoom / pinch.zoom),
        });
      } else if (pinch.kind === "overlay") {
        const zoom = Math.max(1, Math.min(2.5, pinch.zoom * ratio));
        const midpointX = (first.x + second.x) / 2;
        const midpointY = (first.y + second.y) / 2;
        updateOverlay(pinch.id, (current) => ({ ...current, zoom, offsetX: clampOverlayOffset(pinch.offsetX + midpointX - pinch.midpointX, current.width, zoom), offsetY: clampOverlayOffset(pinch.offsetY + midpointY - pinch.midpointY, current.height, zoom) }));
      } else if (pinch.kind === "title") {
        setTitleSize(Math.max(24, Math.min(120, Math.round(pinch.size * ratio / 2) * 2)));
      } else {
        setBadgeFontSize(Math.max(20, Math.min(78, Math.round(pinch.size * ratio))));
      }
      return;
    }

    const drag = dragState.current;
    if (!drag) return;
    const x = drag.startX + point.x - drag.pointerX;
    const y = drag.startY + point.y - drag.pointerY;
    if (drag.kind === "logo") {
      const logoHeight = logoImage ? logoWidth * logoImage.naturalHeight / logoImage.naturalWidth : 0;
      setLogoPosition({
        x: Math.max(0, Math.min(WIDTH - logoWidth, x)),
        y: Math.max(0, Math.min(HEIGHT - logoHeight, y)),
      });
    } else if ((drag.kind === "overlay" || drag.kind === "overlayImage") && drag.overlayId) {
      updateOverlay(drag.overlayId, (current) => drag.kind === "overlay"
        ? { ...current, x: clampOverlayAxis(x, current.width, WIDTH), y: clampOverlayAxis(y, current.height, HEIGHT) }
        : { ...current, offsetX: clampOverlayOffset(x, current.width, current.zoom), offsetY: clampOverlayOffset(y, current.height, current.zoom) });
    } else if (drag.kind === "badge") {
      const nextGap = drag.startY - (point.y - drag.pointerY);
      setBadgeGap(Math.max(BADGE_TITLE_GAP, Math.min(240, nextGap)));
    } else if (drag.kind === "titleResize") {
      const nextSize = Math.round((drag.startY - (point.y - drag.pointerY) * 0.5) / 2) * 2;
      setTitleSize(Math.max(24, Math.min(120, nextSize)));
    } else if (mainLayout) {
      setMainTransform((current) => ({
        ...current,
        x: clampImageAxis(x, mainLayout.width, WIDTH),
        y,
      }));
    }
  }

  function endDrag(event: PointerEvent<HTMLCanvasElement>) {
    activePointers.current.delete(event.pointerId);
    if (activePointers.current.size < 2) pinchState.current = null;
    if (activePointers.current.size === 0) {
      dragState.current = null;
      if (event.pointerType === "mouse") event.currentTarget.style.cursor = "";
    }
  }

  async function copyTitle() {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(title);
        copied = true;
      }
    } catch {
      // Fall back to the selection-based clipboard method below.
    }
    if (!copied) {
      const fallback = document.createElement("textarea");
      fallback.value = title;
      fallback.style.position = "fixed";
      fallback.style.left = "-9999px";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.focus();
      fallback.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
      fallback.remove();
    }
    if (copied) {
      setTitleCopied(true);
      window.setTimeout(() => setTitleCopied(false), 1200);
    }
  }

  async function imageSourceToBlob(source: string) {
    let fetchSource = source;
    if (!source.startsWith("blob:") && !source.startsWith("data:")) {
      try {
        const remote = new URL(source, window.location.href);
        if (remote.origin !== window.location.origin) fetchSource = `/kycu/api/image?url=${encodeURIComponent(remote.toString())}`;
      } catch {
        throw new Error("Burimi i fotos nuk është i vlefshëm për Draft.");
      }
    }
    const response = await fetch(fetchSource, { credentials: "same-origin" });
    if (!response.ok) throw new Error("Fotografia nuk mundi të ruhet në Draft.");
    return response.blob();
  }

  async function draftPreviewToBlob() {
    const source = canvasRef.current;
    if (!source) throw new Error("Preview-ja e Draft-it nuk mundi të krijohet.");
    const preview = document.createElement("canvas");
    preview.width = 432;
    preview.height = 540;
    const context = preview.getContext("2d");
    if (!context) throw new Error("Preview-ja e Draft-it nuk mundi të krijohet.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, preview.width, preview.height);
    return new Promise<Blob>((resolve, reject) => {
      preview.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Preview-ja e Draft-it nuk mundi të ruhet.")), "image/jpeg", 0.84);
    });
  }

  async function saveCurrentDraft() {
    if (!mainSource) throw new Error("Nuk ka fotografi kryesore për t’u ruajtur.");
    draw(titleSize, true);
    const [mainImage, previewImage] = await Promise.all([
      imageSourceToBlob(mainSource),
      draftPreviewToBlob(),
    ]);
    const savedArticle = {
      id: article.id,
      title: article.title,
      slug: article.slug,
      category: article.category,
      date: article.date,
      time: article.time,
      publishedAt: article.publishedAt,
      image: article.image,
      excerpt: article.excerpt,
      author: article.author,
    };
    const prunaPair = prunaComparison && [prunaComparison.original, prunaComparison.enhanced].includes(mainSource) ? prunaComparison : null;
    const [prunaOriginalImage, prunaEnhancedImage] = prunaPair
      ? await Promise.all([imageSourceToBlob(prunaPair.original), imageSourceToBlob(prunaPair.enhanced)])
      : [null, null];
    const id = currentDraftId.current ?? (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const draft: KflDraft = {
      id,
      savedAt: Date.now(),
      brand,
      article: savedArticle,
      title,
      titleSize,
      titleY,
      badge,
      badgeVisible,
      badgeFontSize,
      badgeGap,
      gradientCoverage,
      logoPosition,
      logoVisible,
      mainTransform,
      enhanceEnabled: false,
      enhanceAiEnabled: false,
      filterId: selectedFilterId,
      filterIntensity,
      adjust,
      mainImage,
      previewImage,
      enhancedImage: null,
      aiEnhancedImage: null,
      prunaOriginalImage,
      prunaEnhancedImage,
      prunaShowing: prunaPair && mainSource === prunaPair.original ? "original" : "enhanced",
      overlays: await Promise.all(overlays.map(async ({ source, ...overlay }) => ({ ...overlay, image: await imageSourceToBlob(source) }))),
    };
    await saveKflDraft(draft);
    currentDraftId.current = id;
    setActiveDraftId(id);
    restoredDraftId.current = id;
    const query = new URLSearchParams({ brand });
    query.set("draft", id);
    router.replace(`/kycu/kfl/${encodeURIComponent(article.slug)}?${query.toString()}`, { scroll: false });
  }

  const exportPhoto = useCallback(async (signal?: AbortSignal) => {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    await Promise.allSettled([
      document.fonts.load(`900 ${titleSize}px "Lato"`),
      document.fonts.load(`${badgeWeight} ${badgeFontSize}px "Lato"`),
      document.fonts.ready,
    ]);
    if (signal?.aborted) throw new DOMException("Export aborted", "AbortError");
    draw(titleSize, true, canvas);
    const sourceBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Canvas export failed")), "image/png"));
    if (signal?.aborted) throw new DOMException("Export aborted", "AbortError");
    const response = await fetch("/kycu/api/export", {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
      },
      credentials: "same-origin",
      body: sourceBlob,
      signal,
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(detail?.error || "Eksporti JPG nuk u përfundua.");
    }
    const blob = await response.blob();
    if (signal?.aborted) throw new DOMException("Export aborted", "AbortError");
    const jpegQuality = response.headers.get("X-JPEG-Quality") || "90";
    return { blob, jpegQuality };
  }, [badgeFontSize, badgeWeight, draw, titleSize]);

  useEffect(() => {
    if (!photosSharingEnabled || !mainImageLoaded || !overlayImagesLoaded || (logoVisible && !logoImage)
      || filtersLoading || !adjustReady) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void exportPhoto(controller.signal).then(({ blob }) => {
        if (controller.signal.aborted) return;
        const filename = `${isBallina ? "gazeta-b-kfl" : "momenti-kfl"}-${safeFilename(fileSlug)}.jpg`;
        const file = new File([blob], filename, { type: "image/jpeg", lastModified: Date.now() });
        if (!navigator.canShare({ files: [file] })) throw new Error("Ky shfletues nuk e mbështet ruajtjen përmes Photos.");
        setPreparedPhoto({ file, renderKey: shareRenderKey });
        setPhotoPreparationError(null);
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPhotoPreparationError({ renderKey: shareRenderKey, message: photoExportError(error) });
      });
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [adjustReady, article.slug, exportPhoto, filtersLoading, isBallina, logoImage, logoVisible, mainImageLoaded, overlayImagesLoaded, photoPreparationRetry, photosSharingEnabled, shareRenderKey]);

  const photoPreparationFailed = photosSharingEnabled && photoPreparationError?.renderKey === shareRenderKey;
  const preparingPhotos = photosSharingEnabled && (!mainImageLoaded || !overlayImagesLoaded
    || filtersLoading || !adjustReady || (preparedPhoto?.renderKey !== shareRenderKey && !photoPreparationFailed));
  const downloadDisabled = !mainImage || (logoVisible && !logoImage) || exportingPhoto || preparingPhotos;
  const downloadLabel = exportingPhoto || preparingPhotos ? "Po përgatitet…" : photoPreparationFailed
    ? "Provo përsëri" : photosSharingEnabled ? "Ruaj në Photos" : `Shkarko ${isBallina ? "KFL Ballina" : "FOTOLAJMIN"}`;

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas || !mainImage || (logoVisible && !logoImage) || exportingPhoto) return;

    if (photosSharingEnabled) {
      if (preparedPhoto?.renderKey !== shareRenderKey || photoPreparationFailed) {
        setPhotoPreparationError(null);
        setPhotoPreparationRetry((retry) => retry + 1);
        return;
      }
      setExportingPhoto(true);
      setNoticeKind("success");
      setNotice("Në menynë e iPhone-it zgjidh “Save Image” për ta ruajtur te Photos.");
      try {
        // Invoke share directly from the tap, before any asynchronous work.
        await navigator.share({ files: [preparedPhoto.file] });
        try {
          await saveCurrentDraft();
          setNoticeKind("success");
          setNotice("Fotolajmi u ruajt te Draft-et.");
        } catch {
          setNoticeKind("error");
          setNotice("Draft-i nuk u ruajt. Provo përsëri.");
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") setNotice("");
        else {
          setNoticeKind("error");
          setNotice("Menuja e ruajtjes nuk u hap. Provo “Ruaj në Photos” përsëri, ose hape faqen në Safari.");
        }
      } finally {
        setExportingPhoto(false);
      }
      return;
    }

    setExportingPhoto(true);
    setNoticeKind("success");
    setNotice("Po përgatitet fotolajmi…");
    try {
      const { blob, jpegQuality } = await exportPhoto();
      const filename = `${isBallina ? "gazeta-b-kfl" : "momenti-kfl"}-${safeFilename(fileSlug)}.jpg`;
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        // Give browsers time to consume the file before releasing its URL.
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
      }
      try {
        await saveCurrentDraft();
        setNoticeKind("success");
        setNotice(jpegQuality !== "90"
          ? `Fotolajmi u ruajt te Draft-et. JPG u përshtat me ${(blob.size / 1024).toFixed(0)} KB dhe cilësi ${jpegQuality}%.`
          : "Fotolajmi u ruajt te Draft-et.");
      } catch {
        setNoticeKind("error");
        setNotice("Fotolajmi u shkarkua, por Draft-i nuk u ruajt. Kontrollo hapësirën e shfletuesit.");
      }
      if (jpegQuality !== "90") {
        if (!currentDraftId.current) setNotice(`JPG u eksportua me ${(blob.size / 1024).toFixed(0)} KB. Cilësia JPEG u përshtat në ${jpegQuality}% që skedari të qëndrojë nën 900 KB.`);
      }
    } catch (error) {
      setNoticeKind("error");
      setNotice(photoExportError(error));
    } finally {
      setExportingPhoto(false);
    }
  }

  const historyButtons = (mobile: boolean) => (["undo", "redo"] as const).map((action) => (
    <button
      key={action}
      className={`kfl-history-action ${mobile ? "kfl-overlay-add-button" : "kfl-enhance-toggle"}`}
      type="button"
      disabled={!historyAvailable[action]}
      aria-label={action === "undo" ? "Undo" : "Redo"}
      title={action === "undo" ? "Undo" : "Redo"}
      onClick={() => navigateEditorHistory(action)}
    >
      <svg className="kfl-history-icon" viewBox="0 0 24 24" aria-hidden="true">
        {action === "undo"
          ? <path d="M9 14 4 9l5-5M4 9h9a7 7 0 1 1 -7 7" />
          : <path d="m15 14 5-5-5-5m5 5h-9a7 7 0 1 0 7 7" />}
      </svg>
      {!mobile && (action === "undo" ? "Undo" : "Redo")}
    </button>
  ));

  const filterPanel = (className: string) => (
    <div className={className}>
      <div className="kfl-filter-presets" role="group" aria-label="Filtrat e fotografisë">
        <button className={`kfl-filter-preset${selectedFilterId === "original" ? " is-selected" : ""}`} type="button" aria-pressed={selectedFilterId === "original"} onClick={resetFilter}>
          {filterThumbnails.original ? <span className="kfl-filter-thumb" style={{ backgroundImage: `url(${filterThumbnails.original})` }} aria-hidden="true" /> : <span className="kfl-filter-thumb-placeholder">Origjinal</span>}
          <span>Original</span>
        </button>
        {filterPresets.map((preset) => <button className={`kfl-filter-preset${selectedFilterId === preset.id ? " is-selected" : ""}`} key={preset.id} type="button" aria-pressed={selectedFilterId === preset.id} onClick={() => selectFilter(preset)}>
          {filterThumbnails[preset.id] ? <span className="kfl-filter-thumb" style={{ backgroundImage: `url(${filterThumbnails[preset.id]})` }} aria-hidden="true" /> : <span className="kfl-filter-thumb-placeholder">{preset.name}</span>}
          <span>{preset.name}</span>
        </button>)}
      </div>
      {selectedFilterId !== "original" && <div className="kfl-filter-intensity">
        <label htmlFor={`kfl-filter-intensity-${className}`}>Intensity <strong>{filterIntensity}%</strong></label>
        <input id={`kfl-filter-intensity-${className}`} type="range" min={0} max={100} step={1} value={filterIntensity} onChange={(event) => changeFilterIntensity(Number(event.target.value))} aria-label="Intensity i filtrit" />
        <button type="button" className="kfl-filter-reset" onClick={resetFilter}>Reset Filter</button>
      </div>}
      {filtersLoading && <p className="kfl-filter-status" role="status">Po përgatiten filtrat…</p>}
      {filterError && <p className="kfl-filter-error" role="status">{filterError}</p>}
    </div>
  );

  const texturePanel = (className: string) => (
    <div className={className}>
      <div className="kfl-filter-presets" role="group" aria-label="Texture">
        {TEXTURE_PRESET_INFO.map((preset) => <button className={`kfl-filter-preset kfl-adjust-preset${texturePreset === preset.id ? " is-selected" : ""}`} key={preset.id} type="button"
          aria-pressed={texturePreset === preset.id} disabled={textureBusy === "apply"} onClick={() => selectTexturePreset(preset.id)}>
          <span className="kfl-filter-thumb-placeholder">{preset.id === "none" ? "Pa efekt" : `${preset.defaultIntensity}%`}</span><span>{preset.name}</span>
        </button>)}
      </div>
      <div className="kfl-filter-intensity">
        <label htmlFor={`kfl-texture-intensity-${className}`}>Intensity <strong>{textureIntensity}</strong></label>
        <input id={`kfl-texture-intensity-${className}`} type="range" min={0} max={100} step={1} value={textureIntensity}
          disabled={texturePreset === "none" || textureBusy === "apply"} onChange={(event) => setTextureIntensity(Number(event.target.value))} aria-label="Intensity i Texture" />
      </div>
      <div className="kfl-adjust-actions">
        <button type="button" className="kfl-filter-reset" onClick={resetTexture} disabled={textureBusy === "apply" || texturePreset === "none"}>Reset</button>
        <button type="button" className="kfl-filter-reset kfl-texture-apply" onClick={() => void applyTextureToPhoto()}
          disabled={texturePreset === "none" || textureIntensity === 0 || Boolean(textureBusy) || prunaProcessing || !mainImageLoaded}>
          {textureBusy === "apply" ? "Po aplikohet…" : "Apply"}
        </button>
      </div>
      <p className="kfl-filter-status" role="status">
        {textureBusy === "preview" ? "Po përgatitet preview…" : texturePreset === "none" ? "Zgjidh një texture." : "Preview (rezolucion i ulët). Apply e vendos në foto në rezolucion të plotë."}
      </p>
      {textureError && <p className="kfl-filter-error" role="status">{textureError}</p>}
    </div>
  );

  const adjustPresetId = ADJUST_PRESETS.find((preset) => JSON.stringify(preset.settings) === JSON.stringify(adjust))?.id ?? null;
  const adjustPanel = (className: string) => (
    <div className={className}>
      <div className="kfl-filter-presets" role="group" aria-label="Rregullimet e gatshme">
        <button className={`kfl-filter-preset kfl-adjust-preset${!adjustActive ? " is-selected" : ""}`} type="button" aria-pressed={!adjustActive} onClick={() => applyAdjustPreset(NEUTRAL_ADJUST)}>
          <span className="kfl-filter-thumb-placeholder">Pa rregullime</span><span>Original</span>
        </button>
        {ADJUST_PRESETS.map((preset) => <button className={`kfl-filter-preset kfl-adjust-preset${adjustPresetId === preset.id ? " is-selected" : ""}`} key={preset.id} type="button" aria-pressed={adjustPresetId === preset.id} onClick={() => applyAdjustPreset(preset.settings)}>
          <span className="kfl-filter-thumb-placeholder">{preset.id === "auto" ? "Analizon foton" : "Auto +"}</span><span>{preset.name}</span>
        </button>)}
      </div>
      <label className="kfl-adjust-auto">
        <input type="checkbox" checked={adjust.auto} onChange={(event) => applyAdjustPreset({ ...adjust, auto: event.target.checked })} />
        <span>Auto: ndriçim, ngjyrë dhe kontrast sipas fotos</span>
      </label>
      {ADJUST_SLIDERS.map((slider) => <div className="kfl-filter-intensity" key={slider.key}>
        <label htmlFor={`kfl-adjust-${slider.key}-${className}`}>{slider.label} <strong>{adjust[slider.key] > 0 && slider.min < 0 ? "+" : ""}{adjust[slider.key]}</strong></label>
        <input id={`kfl-adjust-${slider.key}-${className}`} type="range" min={slider.min} max={slider.max} step={1} value={adjust[slider.key]}
          onChange={(event) => changeAdjust(slider.key, Number(event.target.value))}
          onDoubleClick={() => changeAdjust(slider.key, 0)} aria-label={slider.label} />
      </div>)}
      <div className="kfl-adjust-actions">
        <button type="button" className="kfl-filter-reset" disabled={!adjustActive} aria-pressed={adjustCompare}
          onClick={() => setAdjustCompare((current) => !current)}>{adjustCompare ? "Shfaq PAS" : "Krahaso: shfaq PARA"}</button>
        <button type="button" className="kfl-filter-reset" disabled={!adjustActive} onClick={() => applyAdjustPreset(NEUTRAL_ADJUST)}>Reset</button>
      </div>
      {adjustError && <p className="kfl-filter-error" role="status">{adjustError}</p>}
    </div>
  );

  return (
    <div className="kfl-workspace kfl-editor-workspace" data-kfl-brand={brand}>
      <KflWorkspaceHeader
        brand={brand}
        switchHref={`/kycu/kfl/${encodeURIComponent(article.slug)}?brand=${isBallina ? "momenti" : "ballina"}${activeDraftId ? `&draft=${encodeURIComponent(activeDraftId)}` : ""}`}
      />
      <main className="kfl-editor-main">
        <div className="kfl-editor-heading">
          <div>{isBlankEditor
            ? <Link className="kfl-back-link" href="/kycu/artikuj">← Kthehu te artikujt</Link>
            : <Link className="kfl-back-link" href={`/kycu/artikuj/${encodeURIComponent(article.slug)}`}>← Kthehu te artikulli</Link>}
            <h1>{isBallina ? "Krijo KFL Ballina" : "Krijo FOTOLAJM"}</h1>
            <p>{isBlankEditor ? "Fotolajm nga zero: ngarko një foto dhe shkruaj titullin." : article.title}</p></div>
          <span className="kfl-format-chip">1080 × 1350 <b>·</b> 4:5</span>
        </div>

        <div className="kfl-editor-layout">
          <section className="kfl-preview-column" aria-label="Parapamja e fotolajmit">
            <div className="kfl-preview-with-actions">
            <div className="kfl-canvas-frame">
              <canvas
                ref={canvasRef}
                className="kfl-stage"
                width={WIDTH}
                height={HEIGHT}
                aria-label="Canvas i fotolajmit 1080 me 1350 pikselë"
                title="Kliko titullin dhe tërhiqe mausin lart/poshtë për të ndryshuar madhësinë."
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                onContextMenu={(event) => event.preventDefault()}
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
              <button
                className="kfl-logo-visibility"
                type="button"
                aria-label={logoVisible ? "Fshih logon" : "Shfaq logon"}
                aria-pressed={!logoVisible}
                style={{
                  left: `clamp(2px, calc(${((logoPosition.x + logoWidth * (isBallina ? 606 / 618 : 1030 / 1080)) / WIDTH) * 100}% + 1px), calc(100% - 22px))`,
                  top: `clamp(10px, ${((logoPosition.y + (logoImage ? logoWidth * logoImage.naturalHeight / logoImage.naturalWidth / 2 : 0)) / HEIGHT) * 100}%, calc(100% - 10px))`,
                }}
                onClick={() => setLogoVisible((visible) => !visible)}
              >{logoVisible ? "−" : "+"}</button>
              <input
                className="kfl-shading-slider"
                type="range"
                min={15}
                max={65}
                step={1}
                value={gradientCoverage}
                onChange={(event) => setGradientCoverage(Number(event.target.value))}
                aria-label="Hijezimi i poshtëm"
              />
              {overlays.map((overlay) => <div key={`preview-tools-${overlay.id}`}>
                <button
                  className="kfl-overlay-preview-remove"
                  type="button"
                  style={{ left: `clamp(14px, ${((overlay.x + overlay.width) / WIDTH) * 100}%, calc(100% - 14px))`, top: `clamp(14px, ${(overlay.y / HEIGHT) * 100}%, calc(100% - 14px))` }}
                  onClick={() => removeOverlay(overlay.id)}
                  aria-label={`Hiqe foton ${overlay.kind === "circle" ? "rrethore" : "4 me 5"}`}
                  title="Hiqe foton"
                ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg></button>
                {(() => {
                  const pair = overlayPruna[overlay.id];
                  const hasResult = Boolean(pair && (overlay.source === pair.original || overlay.source === pair.enhanced));
                  const isOn = hasResult && overlay.source === pair?.enhanced;
                  const busy = overlayEnhancing === overlay.id;
                  const label = busy ? "Enhance po përpunohet…" : hasResult ? (isOn ? "Enhance: ON · shfaq origjinalen" : "Enhance: OFF · shfaq Enhance") : "Enhance për këtë foto (përdor kredi)";
                  return (
                    <button
                      className={`kfl-overlay-preview-enhance${isOn ? " is-active" : ""}${busy ? " is-busy" : ""}`}
                      type="button"
                      style={{ left: `clamp(14px, ${((overlay.x + overlay.width) / WIDTH) * 100}%, calc(100% - 14px))`, top: `clamp(46px, calc(${(overlay.y / HEIGHT) * 100}% + 32px), calc(100% - 14px))` }}
                      onClick={() => void enhanceOverlay(overlay)}
                      disabled={busy || (overlayEnhancing !== null && !hasResult) || (prunaProcessing && !hasResult)}
                      aria-busy={busy}
                      aria-pressed={hasResult ? isOn : undefined}
                      aria-label={label}
                      title={label}
                    >{busy ? <span className="kfl-overlay-enhance-spinner" aria-hidden="true" /> : <ToolIcon name="pruna" />}</button>
                  );
                })()}
                <div
                  className={`kfl-overlay-mobile-tools${overlay.y + overlay.height + 34 > HEIGHT ? " is-above" : ""}`}
                  style={{
                    left: `clamp(66px, ${((overlay.x + overlay.width / 2) / WIDTH) * 100}%, calc(100% - 66px))`,
                    top: `clamp(34px, ${((overlay.y + (overlay.y + overlay.height + 34 > HEIGHT ? 0 : overlay.height)) / HEIGHT) * 100}%, calc(100% - 34px))`,
                  }}
                >
                  <button type="button" aria-label="Zvogëlo foton" title="Zvogëlo foton" onClick={() => resizeOverlay(overlay.id, -20)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg></button>
                  <button type="button" aria-label="Rrit foton" title="Rrit foton" onClick={() => resizeOverlay(overlay.id, 20)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg></button>
                  <button type="button" className={`kfl-overlay-mobile-flip${overlay.flipX ? " is-flipped" : ""}`} aria-label="Pasqyro foton horizontalisht" aria-pressed={overlay.flipX} title="Pasqyro foton" onClick={() => toggleOverlayFlip(overlay.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16" strokeDasharray="2 2.4" /><path d="M9 7 4 17h5z" /><path d="m15 7 5 10h-5z" /></svg></button>
                  <button
                    type="button"
                    className="kfl-overlay-mobile-drag"
                    aria-label="Lëviz foton"
                    title="Mbaje dhe lëvize foton"
                    onPointerDown={(event) => startOverlayHandleDrag(event, overlay)}
                    onPointerMove={moveOverlayHandleDrag}
                    onPointerUp={endOverlayHandleDrag}
                    onPointerCancel={endOverlayHandleDrag}
                  ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18" /><path d="m9.5 5.5 2.5-2.5 2.5 2.5M9.5 18.5l2.5 2.5 2.5-2.5M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5" /></svg></button>
                </div>
              </div>)}
              {!mainImage && (mainSource
                ? <div className="kfl-canvas-loading" role="status">{mainImageError ? "Fotoja nuk u ngarkua" : "Po ngarkohet fotografia…"}</div>
                : <div className="kfl-canvas-loading kfl-canvas-empty">
                    <button type="button" className="kfl-canvas-upload" onClick={() => mainFileInput.current?.click()}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.7" /><path d="m5 18 5-5 3.2 3 2.4-2.4L19 18" /></svg>
                      <span>Ngarko foton kryesore</span>
                    </button>
                  </div>)}
            </div>
              <div className="kfl-mobile-photo-actions" aria-label="Veprimet e fotografive">
                {prunaButtons(true)}
                {prunaButtons(true, 8)}
                <button className={`kfl-overlay-add-button kfl-filter-mobile${selectedFilterId !== "original" ? " is-active" : ""}`} type="button" onClick={() => void toggleFilters()} aria-expanded={filtersOpen} aria-label="Hap Filters" title="Filters"><ToolIcon name="filters" /></button>
                <button className={`kfl-overlay-add-button kfl-filter-mobile${adjustActive ? " is-active" : ""}`} type="button" onClick={toggleAdjust} aria-expanded={adjustOpen} aria-label="Hap Rregullimet" title="Rregullime (Auto, Qartësia, Hijet…)"><ToolIcon name="adjust" /></button>
                <button className={`kfl-overlay-add-button kfl-filter-mobile${textureOpen ? " is-active" : ""}`} type="button" onClick={toggleTexture} aria-expanded={textureOpen} aria-label="Hap Texture" title="Texture (Grain, Dust, Film…)"><ToolIcon name="texture" /></button>
                <button className="kfl-overlay-add-button kfl-mobile-image-button" type="button" onClick={() => mainFileInput.current?.click()} aria-label="Zëvendëso fotografinë kryesore">
                  <span className="kfl-mobile-image-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.7" /><path d="m5 18 5-5 3.2 3 2.4-2.4L19 18" /></svg><span className="kfl-overlay-plus-badge">+</span></span>
                </button>
                <button className="kfl-overlay-add-button" type="button" onClick={() => addOverlay("circle")} aria-label="Shto foto rrethore">
                  <span className="kfl-overlay-add-icon" aria-hidden="true"><i className="kfl-overlay-circle-shape" /><span className="kfl-overlay-plus-badge">+</span></span>
                </button>
                <button className="kfl-overlay-add-button" type="button" onClick={() => addOverlay("portrait")} aria-label="Shto foto vertikale 4 me 5">
                  <span className="kfl-overlay-add-icon" aria-hidden="true"><i className="kfl-overlay-portrait-shape" /><span className="kfl-overlay-plus-badge">+</span></span>
                </button>
                {historyButtons(true)}
                <button className="kfl-overlay-add-button kfl-download-mobile" type="button" onClick={download} disabled={downloadDisabled} aria-label={downloadLabel} title={downloadLabel} aria-busy={exportingPhoto || preparingPhotos}>
                  {exportingPhoto || preparingPhotos ? <span aria-hidden="true">…</span> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4" /></svg>}
                </button>
              </div>
            </div>
            {filtersOpen && <section className="kfl-mobile-filter-panel" aria-label="Filters">{filterPanel("kfl-filter-panel-content")}</section>}
            {adjustOpen && <section className="kfl-mobile-filter-panel" aria-label="Rregullime">{adjustPanel("kfl-filter-panel-content")}</section>}
            {textureOpen && <section className="kfl-mobile-filter-panel" aria-label="Texture">{texturePanel("kfl-filter-panel-content")}</section>}
            {(mainCorsIssue || overlayCorsIds.length > 0) && <p className="kfl-canvas-cors-warning" role="status">{mainCorsIssue ? "Fotoja kryesore" : "Një foto shtesë"} shfaqet në preview, por burimi nuk lejon eksportin Canvas. Ngarko foton përkatëse nga pajisja që ta shkarkosh fotolajmin.</p>}
          </section>

          <aside className="kfl-controls" aria-label="Kontrollet e editorit">
            <section className="kfl-control-card kfl-main-image-card">
              <div className="kfl-main-photo-toolbar">
                <div className="kfl-control-title"><span>01</span><h2>Fotografia kryesore</h2></div>
                <button className="kfl-main-upload" type="button" onClick={() => mainFileInput.current?.click()} aria-label="Zëvendëso fotografinë kryesore">＋</button>
                <input ref={mainFileInput} className="kfl-visually-hidden" type="file" accept="image/*" onChange={handleImageFile} aria-label="Ngarko fotografi kryesore" />
                <div className="kfl-zoom-controls" aria-label="Zmadhimi i fotos kryesore">
                  <button type="button" onClick={() => setZoom(1 / 1.15)} aria-label="Zvogëlo fotografinë">−</button>
                  <span>{Math.round(mainTransform.zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom(1.15)} aria-label="Zmadho fotografinë">+</button>
                </div>
              </div>
              {/* Desktop: the four photo tools as equal tiles, then filter status + Undo/Redo. */}
              <div className="kfl-tool-grid">
                {prunaButtons()}
                {prunaButtons(false, 8)}
                <button className={`kfl-enhance-toggle${selectedFilterId !== "original" ? " is-active" : ""}${filtersOpen ? " is-open" : ""}`} type="button" onClick={() => void toggleFilters()} aria-expanded={filtersOpen}><ToolIcon name="filters" />Filters</button>
                <button className={`kfl-enhance-toggle${adjustActive ? " is-active" : ""}${adjustOpen ? " is-open" : ""}`} type="button" onClick={toggleAdjust} aria-expanded={adjustOpen}><ToolIcon name="adjust" />Rregullime</button>
                <button className={`kfl-enhance-toggle${textureOpen ? " is-active is-open" : ""}`} type="button" onClick={toggleTexture} aria-expanded={textureOpen}><ToolIcon name="texture" />Texture</button>
              </div>
              <div className="kfl-tool-footer">
                {selectedFilterId !== "original"
                  ? <span className="kfl-filter-current">{filterPresets.find((preset) => preset.id === selectedFilterId)?.name} · {filterIntensity}%</span>
                  : <span />}
                <div className="kfl-desktop-history">{historyButtons(false)}</div>
              </div>
              {filtersOpen && filterPanel("kfl-filter-panel-content")}
              {adjustOpen && adjustPanel("kfl-filter-panel-content")}
              {textureOpen && texturePanel("kfl-filter-panel-content")}
            </section>

            <section className="kfl-control-card kfl-text-card kfl-badge-card">
              <div className="kfl-control-title">
                <span>02</span><h2>{isBallina ? "Etiketa" : "Badge"}</h2>
                <button className="kfl-badge-visibility" type="button" aria-label={badgeVisible ? "Fshih etiketën" : "Shfaq etiketën"} aria-pressed={!badgeVisible} onClick={() => setBadgeVisible((visible) => !visible)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {badgeVisible
                      ? <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>
                      : <><path d="m3 3 18 18M10.5 6.1A13 13 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3.2 3.8M6.2 6.2A19 19 0 0 0 2 12s3.5 6 10 6a13 13 0 0 0 5.8-1.4" /><path d="M10 10a3 3 0 0 0 4 4" /></>}
                  </svg>
                  <span className="kfl-badge-visibility-label">{badgeVisible ? "Hide" : "Show"}</span>
                </button>
              </div>
              <label className="kfl-visually-hidden" htmlFor="kfl-badge">Teksti i badge-it</label>
              <div className="kfl-clearable-field">
                <input id="kfl-badge" aria-label="Teksti i badge-it" type="text" value={badge} maxLength={36} onChange={(event) => setBadge(event.target.value.toUpperCase())} />
                <button type="button" className="kfl-clear-field-button" aria-label="Pastro etiketën" title="Pastro etiketën" onClick={() => setBadge("")}>×</button>
              </div>
            </section>

            <section className="kfl-control-card kfl-text-card kfl-title-card">
              <div className="kfl-control-title"><span>03</span><h2>Titulli</h2></div>
              <label className="kfl-visually-hidden" htmlFor="kfl-title">Teksti i titullit</label>
              <div className="kfl-clearable-field kfl-clearable-title">
                <textarea ref={titleFieldRef} id="kfl-title" aria-label="Teksti i titullit" rows={3} value={title} maxLength={500} onChange={(event) => setTitle(event.target.value)} />
                <button type="button" className="kfl-clear-field-button kfl-copy-field-button" aria-label={titleCopied ? "Titulli u kopjua" : "Kopjo titullin"} title={titleCopied ? "U kopjua" : "Kopjo titullin"} disabled={!title} onClick={copyTitle}>
                  {titleCopied
                    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                    : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>}
                </button>
                <button type="button" className="kfl-clear-field-button" aria-label="Pastro titullin" title="Pastro titullin" onClick={() => setTitle("")}>×</button>
              </div>
            </section>

            <section className="kfl-control-card kfl-overlays-card" data-has-overlays={overlays.length > 0}>
              <div className="kfl-overlays-toolbar">
                <div className="kfl-control-title"><span>04</span><h2>Foto shtesë me stroke</h2></div>
                <div className="kfl-overlay-add-actions">
                  <button className="kfl-overlay-add-button" type="button" onClick={() => addOverlay("circle")} aria-label="Shto foto rrethore">
                    <span className="kfl-overlay-add-icon" aria-hidden="true"><i className="kfl-overlay-circle-shape" /><span className="kfl-overlay-plus-badge">+</span></span>
                  </button>
                  <button className="kfl-overlay-add-button" type="button" onClick={() => addOverlay("portrait")} aria-label="Shto foto vertikale 4 me 5">
                    <span className="kfl-overlay-add-icon" aria-hidden="true"><i className="kfl-overlay-portrait-shape" /><span className="kfl-overlay-plus-badge">+</span></span>
                  </button>
                </div>
              </div>
              <input ref={overlayFileInput} className="kfl-visually-hidden" type="file" accept="image/*" onChange={handleOverlayFile} aria-label="Ngarko foto shtesë" />
              {overlays.map((overlay, index) => <div className="kfl-overlay-controls" key={overlay.id}>
                <div className="kfl-control-row">
                  <strong>{overlay.kind === "circle" ? `Foto rrethore ${index + 1}` : `Foto 4:5 ${index + 1}`}</strong>
                  <button className="kfl-button kfl-button-quiet" type="button" onClick={() => addOverlay(overlay.kind, overlay.id)}>Zëvendëso</button>
                  <button className="kfl-button kfl-button-quiet kfl-overlay-flip-button" type="button" aria-pressed={overlay.flipX} onClick={() => toggleOverlayFlip(overlay.id)}>{overlay.flipX ? "Rikthe pasqyrimin" : "Pasqyro"}</button>
                </div>
                <label htmlFor={`kfl-overlay-size-${overlay.id}`}>{overlay.kind === "circle" ? "Diametri" : "Gjerësia"} <strong>{overlay.width}px</strong></label>
                <input id={`kfl-overlay-size-${overlay.id}`} type="range" min={150} max={OVERLAY_MAX_WIDTH} step={10} value={overlay.width} onChange={(event) => { const width = Number(event.target.value); const height = overlay.kind === "circle" ? width : Math.round(width * 1.25); updateOverlay(overlay.id, (current) => ({ ...current, width, height, x: clampOverlayAxis(current.x, width, WIDTH), y: clampOverlayAxis(current.y, height, HEIGHT), offsetX: clampOverlayOffset(current.offsetX, width, current.zoom), offsetY: clampOverlayOffset(current.offsetY, height, current.zoom) })); }} />
                <label htmlFor={`kfl-overlay-zoom-${overlay.id}`}>Crop / zmadhimi <strong>{overlay.zoom.toFixed(1)}×</strong></label>
                <input id={`kfl-overlay-zoom-${overlay.id}`} type="range" min={1} max={2.5} step={0.1} value={overlay.zoom} onChange={(event) => { const zoom = Number(event.target.value); updateOverlay(overlay.id, (current) => ({ ...current, zoom, offsetX: clampOverlayOffset(current.offsetX, current.width, zoom), offsetY: clampOverlayOffset(current.offsetY, current.height, zoom) })); }} />
                <button className="kfl-button kfl-button-quiet kfl-full-button" type="button" onClick={() => updateOverlay(overlay.id, (current) => ({ ...current, zoom: 1, offsetX: 0, offsetY: 0 }))}>Rivendos crop-in</button>
              </div>)}
            </section>

            <section className={`kfl-control-card kfl-export-card${photoPreparationFailed ? " has-error" : ""}`} aria-label="Shkarko fotolajmin">
              <button className="kfl-button kfl-button-primary kfl-download-button" type="button" onClick={download} disabled={downloadDisabled}>{downloadLabel}</button>
              {photoPreparationFailed && <p className="kfl-form-error" role="alert">{photoPreparationError.message}</p>}
            </section>
            {notice && <div className={`kfl-notice ${noticeKind === "success" ? "kfl-notice-success" : "kfl-notice-error"}`} role={noticeKind === "success" ? "status" : "alert"}>{notice}</div>}
          </aside>
        </div>
      </main>
    </div>
  );
}

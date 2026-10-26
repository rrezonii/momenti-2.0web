// Texture presets shared by the editor (names, defaults) and the server engine (params live in textureEngine.ts).
// To add a preset: add it here (id, name, default intensity), then its params in TEXTURE_PARAMS in textureEngine.ts.

export const TEXTURE_PRESET_INFO = [
  { id: "none", name: "None", defaultIntensity: 0 },
  { id: "editorial", name: "Editorial", defaultIntensity: 20 },
  { id: "film-grain", name: "Film Grain", defaultIntensity: 25 },
  { id: "gritty", name: "Gritty", defaultIntensity: 30 },
  { id: "cinematic", name: "Cinematic", defaultIntensity: 25 },
  { id: "dust", name: "Dust", defaultIntensity: 20 },
  { id: "dust-scratches", name: "Dust & Scratches", defaultIntensity: 25 },
  { id: "old-film", name: "Old Film", defaultIntensity: 30 },
  { id: "paper", name: "Paper", defaultIntensity: 20 },
  { id: "concrete", name: "Concrete", defaultIntensity: 20 },
] as const;

export type TexturePresetId = (typeof TEXTURE_PRESET_INFO)[number]["id"];

export const isTexturePreset = (value: unknown): value is TexturePresetId =>
  TEXTURE_PRESET_INFO.some((preset) => preset.id === value);

export const DEFAULT_TEXTURE_INTENSITY = 25;

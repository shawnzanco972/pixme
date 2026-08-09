/**
 * Brick-engine "starting point" settings for a ready-made design.
 *
 * The admin tunes these in the studio and saves them on the design; when a
 * customer opens the design they seed the studio's controls. Kept as a plain
 * serializable shape so it round-trips through the `ready_designs.settings`
 * JSONB column. Dimensions live in their own columns (default_plates_x/y) and
 * are carried alongside, not inside this object.
 *
 * Defaults mirror the studio's own initial state (Studio.tsx).
 */
export interface EngineSettings {
  contrast: number;
  saturation: number;
  autoLevels: boolean;
  dither: number;
  smoothGradients: boolean;
  faceAware: boolean;
  lineArt: boolean;
  /** Detail preservation (0..1): keeps text/strokes legible at stud resolution. */
  detail: number;
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * FIDELITY defaults: reproduce the photo as faithfully as possible.
 *
 * These used to be a "vivid" preset (contrast 1.2 / saturation 1.1 / autoLevels
 * on). Because contrast is applied per-channel around mid-gray, warm subjects
 * (skin is R>G>B) gained chroma on every pass — inflating skin toward Red and
 * producing the classic "red face" failure. Neutral tone ops keep the OKLab
 * match honest; users can still reach for a vivid look via the presets.
 */
export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  contrast: 1,
  saturation: 1,
  autoLevels: false,
  dither: 0,
  /**
   * Floyd–Steinberg error diffusion OFF by default.
   *
   * This was briefly ON, justified by a ~73% "perceived error" reduction — but
   * that was measured on a SYNTHETIC SMOOTH GRADIENT, the single best case for
   * dithering. On real photographs at stud resolution it is salt-and-pepper
   * noise: measured on a portrait at 72×72, isolated single studs went from
   * 11.2% to 40.5% and neighbour agreement collapsed from 68.6% to 27.7%.
   * Faces came out blotchy.
   *
   * It compounds: `fsDither` also auto-disables despeckle and swap-optimize
   * (they would erase the diffusion texture), so turning it on simultaneously
   * removes the two passes that clean speckle up.
   *
   * Judge dithering on a real photo by isolated-stud rate, never on a gradient
   * by local-average error. It stays available for large, genuinely smooth
   * images where the mosaic is big enough to carry the texture.
   */
  smoothGradients: false,
  faceAware: false,
  lineArt: false,
  detail: 0.35,
  zoom: 1,
  panX: 0.5,
  panY: 0.5,
};

/** A named look the customer can apply in one tap (studio "presets"). */
export interface EnginePreset {
  id: string;
  label: string;
  settings: Pick<
    EngineSettings,
    | "contrast"
    | "saturation"
    | "autoLevels"
    | "faceAware"
    | "smoothGradients"
    | "lineArt"
    | "dither"
  >;
}

/**
 * Curated looks. "original" is the default (pure fidelity); the rest are
 * coherent combinations so users don't have to reason about five sliders.
 */
export const ENGINE_PRESETS: EnginePreset[] = [
  {
    id: "original",
    label: "מקורי",
    settings: {
      contrast: 1,
      saturation: 1,
      autoLevels: false,
      faceAware: false,
      smoothGradients: false,
      lineArt: false,
      dither: 0,
    },
  },
  {
    id: "portrait",
    label: "דיוקן",
    settings: {
      contrast: 1.05,
      saturation: 0.95,
      autoLevels: false,
      faceAware: true,
      smoothGradients: false,
      lineArt: false,
      dither: 0,
    },
  },
  {
    id: "vivid",
    label: "חי",
    settings: {
      contrast: 1.18,
      saturation: 1.15,
      autoLevels: true,
      faceAware: false,
      smoothGradients: false,
      lineArt: false,
      dither: 0,
    },
  },
  {
    id: "lineart",
    label: "לוגו / טקסט",
    settings: {
      contrast: 1.3,
      saturation: 1,
      autoLevels: true,
      faceAware: false,
      smoothGradients: false,
      lineArt: true,
      dither: 0,
    },
  },
];

/** Full snapshot saved on a design: engine settings + baseplate dimensions. */
export interface DesignSettings extends EngineSettings {
  platesX: number;
  platesY: number;
}

/**
 * Coerce an unknown JSON value (from the DB) into a safe EngineSettings,
 * falling back to defaults for any missing/invalid field.
 */
export function parseEngineSettings(raw: unknown): EngineSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ENGINE_SETTINGS };
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : d;
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    contrast: num(r.contrast, DEFAULT_ENGINE_SETTINGS.contrast),
    saturation: num(r.saturation, DEFAULT_ENGINE_SETTINGS.saturation),
    autoLevels: bool(r.autoLevels, DEFAULT_ENGINE_SETTINGS.autoLevels),
    dither: num(r.dither, DEFAULT_ENGINE_SETTINGS.dither),
    smoothGradients: bool(
      r.smoothGradients,
      DEFAULT_ENGINE_SETTINGS.smoothGradients,
    ),
    faceAware: bool(r.faceAware, DEFAULT_ENGINE_SETTINGS.faceAware),
    lineArt: bool(r.lineArt, DEFAULT_ENGINE_SETTINGS.lineArt),
    detail: num(r.detail, DEFAULT_ENGINE_SETTINGS.detail),
    zoom: num(r.zoom, DEFAULT_ENGINE_SETTINGS.zoom),
    panX: num(r.panX, DEFAULT_ENGINE_SETTINGS.panX),
    panY: num(r.panY, DEFAULT_ENGINE_SETTINGS.panY),
  };
}

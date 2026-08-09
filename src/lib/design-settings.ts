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
  /**
   * Local contrast at STUD scale (0..~1.2). The cure for a flat, grey mosaic:
   * downsampling averages away the light/shadow modelling that gives a face
   * depth, and this amplifies exactly the band the board reproduces. Does NOT
   * inflate chroma, so unlike a global contrast boost it never drags skin red.
   */
  localContrast: number;
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
  /**
   * Slight saturation lift. Quantizing to ~20 bricks is itself desaturating —
   * every pixel snaps to the nearest available colour, which on average pulls
   * chroma DOWN — so a neutral 1.0 renders visibly greyer than the source.
   * Measured on a portrait: 1.0 → mean output chroma 0.0694, 1.2 → 0.0736,
   * with isolated studs unchanged (8.5% → 8.9%).
   *
   * This is only safe because match.ts now penalises chroma OVERSHOOT: the
   * original red-face bug came from boosting saturation with no such guard.
   * Do not raise this without re-running skin.test.ts.
   */
  saturation: 1.15,
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
  /**
   * Local contrast defaults OFF. Measured on a real photo it raised tonal
   * spread slightly (lumaSD 0.1452 → 0.1525) but cost noise AND colour
   * (isolated studs 8.5% → 12.7%, chroma 0.0694 → 0.0609) — the wrong trade,
   * since greyness was the complaint. Kept as a control for users who want a
   * harder, more graphic look.
   */
  localContrast: 0,
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
    | "localContrast"
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
      saturation: 1.15,
      autoLevels: false,
      faceAware: false,
      smoothGradients: false,
      lineArt: false,
      dither: 0,
      /**
   * Local contrast defaults OFF. Measured on a real photo it raised tonal
   * spread slightly (lumaSD 0.1452 → 0.1525) but cost noise AND colour
   * (isolated studs 8.5% → 12.7%, chroma 0.0694 → 0.0609) — the wrong trade,
   * since greyness was the complaint. Kept as a control for users who want a
   * harder, more graphic look.
   */
  localContrast: 0,
    },
  },
  {
    id: "portrait",
    label: "דיוקן",
    settings: {
      contrast: 1.05,
      saturation: 1.08,
      autoLevels: false,
      faceAware: true,
      smoothGradients: false,
      lineArt: false,
      dither: 0,
      localContrast: 0.2,
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
      localContrast: 0.3,
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
      localContrast: 0.5,
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
    localContrast: num(r.localContrast, DEFAULT_ENGINE_SETTINGS.localContrast),
    zoom: num(r.zoom, DEFAULT_ENGINE_SETTINGS.zoom),
    panX: num(r.panX, DEFAULT_ENGINE_SETTINGS.panX),
    panY: num(r.panY, DEFAULT_ENGINE_SETTINGS.panY),
  };
}

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

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  contrast: 1.2,
  saturation: 1.1,
  autoLevels: true,
  dither: 0,
  smoothGradients: false,
  faceAware: false,
  lineArt: false,
  detail: 0.35,
  zoom: 1,
  panX: 0.5,
  panY: 0.5,
};

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

/**
 * Pixipic logo.
 *
 * Two parts, both drawn on ONE 12-unit grid module — the same grid the product
 * itself is built on:
 *
 *   MARK      a 3x3 tile of flat, top-down 1x1 plates in nine real palette
 *             colours. Top-down and flat on purpose: we sell a flat mosaic on a
 *             wall, not a 3D toy brick. (The previous logo drew isometric 2.5D
 *             bricks with top/side faces, which depicted a product we do not
 *             make, and whose detail vanished below ~26px.)
 *   WORDMARK  set so cap-height is EXACTLY two grid modules, so the letters and
 *             the plates are measured by the same ruler. The dot on the middle
 *             `i` is a real plate, tilted -18deg, lifted out of the mark.
 *
 * GEOMETRY IS FONT-INDEPENDENT BY CONSTRUCTION. The wordmark is two text runs
 * ("Pix" / "pic") pinned to explicit `textLength`, with the middle `i` drawn by
 * us as vector (stem + tilted plate). So the plate always lands exactly on the
 * i's stem even if Rubik is slow to load or falls back — the layout cannot
 * drift. The proper end-state is outlined paths from a type licence; until
 * then, do NOT change the textLength values without re-checking the lockup.
 *
 * COLOUR SYSTEM
 *   default  ink word, BRAND RED plate. Red (not the accent yellow used in the
 *            exploration) because the plate is a letter part — it has to stay
 *            legible, and yellow on white nearly disappears at header size.
 *   invert   white word, accent YELLOW plate — for the red footer / dark bands.
 *   mono     everything `currentColor`, for one-colour print, foil and emboss.
 *
 * Sizing: no intrinsic width/height. Drive it with a class (`h-8 w-auto`).
 */

/** Nine real brick colours from the palette (see brick-engine/palette.ts). */
const TILE = [
  "#cd2928", "#f0962f", "#ffd300",
  "#00a64d", "#00b5cc", "#0065b2",
  "#ae78c2", "#de9064", "#a3a9aa",
];

const M = 12; // grid module (one 1x1 plate)

/** Lighten toward white — the stud circle sits above the plate face. */
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(v + (255 - v) * amt),
  );
  return `#${((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1)}`;
}

/** One flat, top-down 1x1 plate: rounded square + concentric stud circle. */
function Plate({
  x,
  y,
  s = M,
  fill,
  studFill,
}: {
  x: number;
  y: number;
  s?: number;
  fill: string;
  /** Explicit stud colour; defaults to a lightened `fill`. */
  studFill?: string;
}) {
  const g = s * 0.055;
  return (
    <>
      <rect
        x={x + g}
        y={y + g}
        width={s - 2 * g}
        height={s - 2 * g}
        rx={s * 0.16}
        fill={fill}
      />
      <circle
        cx={x + s / 2}
        cy={y + s / 2}
        r={s * 0.26}
        fill={studFill ?? lighten(fill, 0.3)}
      />
    </>
  );
}

/** The 3x3 mark. `mono` collapses all nine plates to one colour. */
function Mark({ x, y, mono }: { x: number; y: number; mono?: boolean }) {
  return (
    <g>
      {TILE.map((c, i) => (
        <Plate
          key={i}
          x={x + (i % 3) * M}
          y={y + Math.floor(i / 3) * M}
          fill={mono ? "currentColor" : c}
          studFill={mono ? "rgba(255,255,255,0.85)" : undefined}
        />
      ))}
    </g>
  );
}

export type BrandLogoVariant = "full" | "wordmark" | "mark";

// --- Lockup geometry. Baseline 34; cap-height 24 (= 2 modules); word from 48.
const BASE = 34;
const FS = 33.3; // 24 / 0.72 cap-height ratio
const X_WORD = 48;
const STEM_W = 5.2;
const DOT = 8.6; // the tilted plate (tittle) — see note in BrandLogo below
const DOT_Y = BASE - 27.5; // sits ~2 units clear above the stem's x-height top

/**
 * The three plates, in reading order.
 *
 * `classic` is the MARK'S LEFT COLUMN (TILE indices 0/3/6) lifted straight out,
 * so the word is literally built from the mark. It is also the only trio that
 * survives BOTH grounds. Measured WCAG contrast (SC 1.4.11 wants 3:1 for
 * graphical objects):
 *   #cd2928  white 5.33 : dark 3.22
 *   #00a64d  white 3.20 : dark 5.35
 *   #ae78c2  white 3.35 : dark 5.11
 * Only 5 of the palette's 17 accents clear 3:1 on both. Note what this
 * replaced: the old single plate was brand red #b7102a, which scores 2.55 on
 * dark — it FAILED on the footer it was built for. Do not "restore brand red"
 * without re-running the contrast check.
 *
 * `warm` (teal / orange / yellow) is DARK-GROUND ONLY, and that is physics, not
 * preference. To clear 3:1 against white a colour needs relative luminance
 * <= 0.183; these sit at 0.42, 0.40 and 0.70:
 *   #00b5cc  white 2.48 : dark 6.92
 *   #f0962f  white 2.31 : dark 7.43
 *   #ffd300  white 1.44 : dark 11.88
 * Teal and orange COULD be darkened into range, but a yellow dark enough to
 * pass on white stops being yellow (it reads as olive/bronze). So this colourway
 * is gated to dark backgrounds — the proof sheet at /playbook/logo shows it only
 * there. Never ship `warm` on a light or transparent ground.
 */
export type BrandLogoColorway = "classic" | "warm";

const COLORWAYS: Record<BrandLogoColorway, string[]> = {
  classic: ["#cd2928", "#00a64d", "#ae78c2"],
  warm: ["#00b5cc", "#f0962f", "#ffd300"],
};

/**
 * Glyph advances for Rubik 800 at FS with -0.03em tracking, MEASURED in-browser
 * (getComputedTextLength), not estimated. Runs are pinned to their own natural
 * width, so `lengthAdjust` never squashes a letter — the previous lockup pinned
 * "Pix" to 50 against a natural 48.59 and was stretching it by 2.9%.
 */
const ADV = { P: 21.52, i: 8.49, x: 18.59, p: 20.02, c: 18.65 };

/** The lockup, left to right: letter runs interleaved with the three i's. */
const RUNS: ({ t: string; w: number } | { dot: number })[] = [
  { t: "P", w: ADV.P },
  { dot: 0 },
  { t: "x", w: ADV.x },
  { dot: 1 },
  { t: "p", w: ADV.p },
  { dot: 2 },
  { t: "c", w: ADV.c },
];

/** Resolve each run to an absolute x once, so nothing can drift. */
const LAYOUT = (() => {
  let x = X_WORD;
  const out = RUNS.map((r) => {
    const w = "t" in r ? r.w : ADV.i;
    const item = { ...r, x, cx: x + w / 2 };
    x += w;
    return item;
  });
  return { items: out, end: x };
})();

export function BrandLogo({
  variant = "full",
  invert = false,
  mono = false,
  colorway = "classic",
  className = "",
  title = "Pixipic",
}: {
  variant?: BrandLogoVariant;
  invert?: boolean;
  mono?: boolean;
  colorway?: BrandLogoColorway;
  className?: string;
  title?: string;
}) {
  const ink = mono ? "currentColor" : invert ? "#ffffff" : "#191c1e";
  const plates = COLORWAYS[colorway];

  if (variant === "mark") {
    return (
      <svg viewBox="0 0 36 36" className={className} role="img" aria-label={title}>
        <Mark x={0} y={0} mono={mono} />
      </svg>
    );
  }

  const wordOnly = variant === "wordmark";
  const x0 = wordOnly ? X_WORD : 0;
  // +2 pad: a run's final glyph ink can sit a fraction past its advance, and
  // the tilted plate's rotated corner overhangs its own box. Without the pad
  // the "c" and the last plate get clipped by the viewBox.
  const w = LAYOUT.end + 2 - x0;

  return (
    <svg viewBox={`${x0} 0 ${w} 46`} className={className} role="img" aria-label={title}>
      {!wordOnly && <Mark x={0} y={5} mono={mono} />}

      {/* `direction="ltr"` is LOAD-BEARING. The document is dir="rtl" (Hebrew),
          and SVG <text> inherits it — without this, `x` is treated as the RIGHT
          edge of each run, so "P" rendered left of the mark and the whole
          lockup collapsed in on itself. */}
      <g
        direction="ltr"
        fontFamily="var(--font-rubik), system-ui, sans-serif"
        fontWeight={800}
        fontSize={FS}
        fill={ink}
        letterSpacing="-0.03em"
      >
        {LAYOUT.items.map((r, k) =>
          "t" in r ? (
            <text key={k} x={r.x} y={BASE} textLength={r.w} lengthAdjust="spacing">
              {r.t}
            </text>
          ) : null,
        )}
      </g>

      {/* The three i's, drawn by us: stem to x-height + a tilted plate as the
          tittle. The plate is deliberately NARROWER than the letter's advance
          (8.6 vs 8.49 rotated) so the stem still leads and the glyph reads as
          an "i" first, a brick second. */}
      {LAYOUT.items.map((r, k) =>
        "dot" in r ? (
          <g key={k}>
            <rect
              x={r.cx - STEM_W / 2}
              y={BASE - 17}
              width={STEM_W}
              height={17}
              rx={1.1}
              fill={ink}
            />
            <g transform={`rotate(-18 ${r.cx} ${DOT_Y + DOT / 2})`}>
              <Plate
                x={r.cx - DOT / 2}
                y={DOT_Y}
                s={DOT}
                fill={mono ? "currentColor" : plates[r.dot]}
                studFill={
                  mono
                    ? "rgba(255,255,255,0.85)"
                    : lighten(plates[r.dot], 0.4)
                }
              />
            </g>
          </g>
        ) : null,
      )}
    </svg>
  );
}

/**
 * Hebrew lockup — פיקסיפיק.
 *
 * The word contains EXACTLY THREE yuds, mirroring the three i's in "Pixipic",
 * and each one follows פ, ס, פ respectively. A yud is already a small mark
 * riding at the top of the line — the closest thing Hebrew has to a tittle — so
 * each yud is replaced by a plate. Its advance is 8.40 against the Latin i's
 * 8.49, so the same plate size drops straight into the slot.
 *
 * Every glyph is placed INDIVIDUALLY at an explicit x with direction="ltr".
 * Laying the word out as one RTL text run and overlaying plates cannot work:
 * bidi reorders the glyphs, so there is no stable coordinate for any letter.
 * Placing single glyphs sidesteps bidi entirely — but it means the visual order
 * below is REVERSED from the logical spelling. Visual left-to-right is
 * ק(8) י(7) פ(6) י(5) ס(4) ק(3) י(2) פ(1); read it right-to-left to get
 * פ-י-ק-ס-י-פ-י-ק. Do not "fix" the order.
 *
 * Colours run in READING order (right to left), so the rightmost plate is the
 * first colour — matching the Latin lockup's left-to-right run.
 */
const HE_ADV = { פ: 18.45, י: 8.4, ק: 21.12, ס: 20.55 };
const HE_DOT_Y = 10; // a yud rides at the top of the letter, not the baseline

/** Visual left-to-right. `dot` indexes the colourway in READING order. */
const HE_RUNS: ({ t: keyof typeof HE_ADV } | { dot: number })[] = [
  { t: "ק" }, { dot: 2 }, { t: "פ" }, { dot: 1 },
  { t: "ס" }, { t: "ק" }, { dot: 0 }, { t: "פ" },
];

const HE_LAYOUT = (() => {
  let x = 2; // left pad for the rotated plate's overhang
  const items = HE_RUNS.map((r) => {
    const w = "t" in r ? HE_ADV[r.t] : HE_ADV["י"];
    const item = { ...r, x, cx: x + w / 2, w };
    x += w;
    return item;
  });
  return { items, end: x };
})();

export function BrandLogoHe({
  invert = false,
  mono = false,
  colorway = "classic",
  className = "",
}: {
  invert?: boolean;
  mono?: boolean;
  colorway?: BrandLogoColorway;
  className?: string;
}) {
  const ink = mono ? "currentColor" : invert ? "#ffffff" : "#191c1e";
  const plates = COLORWAYS[colorway];
  const MARK_X = HE_LAYOUT.end + 12; // mark LEADS in RTL, so it sits at the right
  const TOTAL = MARK_X + 3 * M;

  return (
    <svg viewBox={`0 0 ${TOTAL} 46`} className={className} role="img" aria-label="פיקסיפיק">
      <g
        direction="ltr"
        fontFamily="var(--font-rubik), system-ui, sans-serif"
        fontWeight={800}
        fontSize={FS}
        fill={ink}
        letterSpacing="-0.03em"
      >
        {HE_LAYOUT.items.map((r, k) =>
          "t" in r ? (
            <text key={k} x={r.x} y={BASE} textLength={r.w} lengthAdjust="spacingAndGlyphs">
              {r.t}
            </text>
          ) : null,
        )}
      </g>

      {HE_LAYOUT.items.map((r, k) =>
        "dot" in r ? (
          <g key={k} transform={`rotate(-18 ${r.cx} ${HE_DOT_Y + DOT / 2})`}>
            <Plate
              x={r.cx - DOT / 2}
              y={HE_DOT_Y}
              s={DOT}
              fill={mono ? "currentColor" : plates[r.dot]}
              studFill={mono ? "rgba(255,255,255,0.85)" : lighten(plates[r.dot], 0.4)}
            />
          </g>
        ) : null,
      )}

      <Mark x={MARK_X} y={5} mono={mono} />
    </svg>
  );
}

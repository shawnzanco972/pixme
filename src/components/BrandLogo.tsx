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
const X_PIX = 48;
const W_PIX = 50; // pinned advance for "Pix"
const W_I = 10; // advance reserved for the middle i
const W_PIC = 48; // pinned advance for "pic"
const X_I = X_PIX + W_PIX;
const X_PIC = X_I + W_I;
const I_CX = X_I + W_I / 2;
const STEM_W = 5.2;
const DOT = 11; // the tilted plate

export function BrandLogo({
  variant = "full",
  invert = false,
  mono = false,
  className = "",
  title = "Pixipic",
}: {
  variant?: BrandLogoVariant;
  invert?: boolean;
  mono?: boolean;
  className?: string;
  title?: string;
}) {
  const ink = mono ? "currentColor" : invert ? "#ffffff" : "#191c1e";
  const dot = mono ? "currentColor" : invert ? "#f3bf2f" : "#b7102a";

  if (variant === "mark") {
    return (
      <svg
        viewBox="0 0 36 36"
        className={className}
        role="img"
        aria-label={title}
      >
        <Mark x={0} y={0} mono={mono} />
      </svg>
    );
  }

  const wordOnly = variant === "wordmark";
  const x0 = wordOnly ? X_PIX : 0;
  // +2: `textLength` pins the ADVANCE width, but the final glyph's ink can sit
  // a fraction past it (measured: "pic" ends at 156.4, not 156). Without the
  // pad the right side of the "c" is clipped by the viewBox.
  const w = X_PIC + W_PIC + 2 - x0;

  return (
    <svg
      viewBox={`${x0} 0 ${w} 46`}
      className={className}
      role="img"
      aria-label={title}
    >
      {!wordOnly && <Mark x={0} y={5} mono={mono} />}

      {/* `direction="ltr"` is LOAD-BEARING. The document is dir="rtl" (Hebrew),
          and SVG <text> inherits it — without this, `x` is treated as the RIGHT
          edge of each run, so "Pix" rendered from x=-2 instead of x=48 and the
          whole lockup collapsed leftwards on top of the mark. */}
      <g
        direction="ltr"
        fontFamily="var(--font-rubik), system-ui, sans-serif"
        fontWeight={800}
        fontSize={FS}
        fill={ink}
        letterSpacing="-0.03em"
      >
        <text x={X_PIX} y={BASE} textLength={W_PIX} lengthAdjust="spacingAndGlyphs">
          Pix
        </text>
        <text x={X_PIC} y={BASE} textLength={W_PIC} lengthAdjust="spacingAndGlyphs">
          pic
        </text>
      </g>

      {/* Middle `i`, drawn by us: stem to x-height, then the tilted plate. */}
      <rect
        x={I_CX - STEM_W / 2}
        y={BASE - 17}
        width={STEM_W}
        height={17}
        rx={1.1}
        fill={ink}
      />
      <g transform={`rotate(-18 ${I_CX} ${BASE - 22.5})`}>
        <Plate
          x={I_CX - DOT / 2}
          y={BASE - 28}
          s={DOT}
          fill={dot}
          studFill={mono ? "rgba(255,255,255,0.85)" : lighten(dot, invert ? 0.35 : 0.42)}
        />
      </g>
    </svg>
  );
}

/**
 * Hebrew lockup — פיקסיפיק. Hebrew has no tittle to replace, so the tilted
 * plate becomes a floating accent above the word (leading edge in RTL) rather
 * than a letter part, which keeps the same gesture without mangling a glyph.
 */
export function BrandLogoHe({
  invert = false,
  mono = false,
  className = "",
}: {
  invert?: boolean;
  mono?: boolean;
  className?: string;
}) {
  const ink = mono ? "currentColor" : invert ? "#ffffff" : "#191c1e";
  const dot = mono ? "currentColor" : invert ? "#f3bf2f" : "#b7102a";

  // RTL layout: the mark leads, so it sits at the RIGHT. The word runs
  // right-to-left from `WORD_START` back toward x=0.
  const W = 118; // pinned word advance
  const MARK_X = W + 12; // mark begins after the word + gutter
  const TOTAL = MARK_X + 3 * M;
  const WORD_START = W; // inline START in RTL = the right edge of the run

  return (
    <svg viewBox={`0 0 ${TOTAL} 46`} className={className} role="img" aria-label="פיקסיפיק">
      {/* `direction="rtl"` + default text-anchor "start": in RTL the inline
          start is the RIGHT edge, so the run grows leftwards from WORD_START.
          Using textAnchor="end" here anchors the LEFT edge instead and throws
          the whole word off the canvas (measured: x=160..278 in a 166 box). */}
      <text
        x={WORD_START}
        y={BASE}
        direction="rtl"
        textLength={W}
        lengthAdjust="spacingAndGlyphs"
        fontFamily="var(--font-rubik), system-ui, sans-serif"
        fontWeight={800}
        fontSize={FS}
        fill={ink}
      >
        פיקסיפיק
      </text>
      <g transform={`rotate(-18 ${W - 8} 6)`}>
        <Plate
          x={W - 8 - DOT / 2}
          y={0.5}
          s={DOT}
          fill={dot}
          studFill={mono ? "rgba(255,255,255,0.85)" : lighten(dot, invert ? 0.35 : 0.42)}
        />
      </g>
      <Mark x={MARK_X} y={5} mono={mono} />
    </svg>
  );
}

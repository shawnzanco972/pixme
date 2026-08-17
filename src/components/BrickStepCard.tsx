/**
 * A numbered "step" card shaped like the brick we actually sell.
 *
 * The product is a 1×1 plate: ONE stud, centred. This card used to wear two
 * small offset studs, which reads as a 2×1 brick we don't stock — and the studs
 * were far too small relative to the body, so the silhouette didn't say "brick"
 * at a glance. A real plate's stud is roughly half the tile's width, so the one
 * here is sized as a fraction of the card rather than a fixed pixel nub.
 *
 * Shared by the home page and /b2b on purpose: these two ladders are the same
 * component in the user's mind, and when they were duplicated inline they had
 * already drifted (different stud offsets, different ink colours).
 */

/** One card's colourway. `ink` is deliberately absent — see BRICK_COLORWAYS. */
export interface BrickColorway {
  /** Card body gradient. */
  grad: string;
  /** Solid bevel beneath the card (the "thickness" of the brick). */
  bevel: string;
  /** Stud gradient — a touch lighter than the body so it catches light. */
  stud: string;
}

/**
 * The colourways, all carrying WHITE text.
 *
 * The gold used to be #f3bf2f with near-black ink, which made one card in the
 * row shout while its neighbours whispered. Keeping a single ink colour means
 * the gold has to darken to hold white legibly (it now sits at ~5.2:1 against
 * white, vs 1.8:1 before), and the teal likewise — at #36aebf white text was
 * only ~2.4:1, below AA for body copy.
 */
export const BRICK_COLORWAYS: Record<string, BrickColorway> = {
  red: {
    grad: "linear-gradient(180deg, #cf2440 0%, #b7102a 60%, #ad0f27 100%)",
    bevel: "#7d0018",
    stud: "linear-gradient(180deg, #d93a52 0%, #bd1730 100%)",
  },
  blue: {
    grad: "linear-gradient(180deg, #3766e6 0%, #1d4ed8 60%, #1a45c2 100%)",
    bevel: "#002f96",
    stud: "linear-gradient(180deg, #4b78ef 0%, #2453dc 100%)",
  },
  teal: {
    grad: "linear-gradient(180deg, #1d8a99 0%, #157a86 60%, #126e79 100%)",
    bevel: "#0a4a52",
    stud: "linear-gradient(180deg, #2ba0b0 0%, #17828f 100%)",
  },
  gold: {
    grad: "linear-gradient(180deg, #a37c00 0%, #8a6800 60%, #7d5e00 100%)",
    bevel: "#513c00",
    stud: "linear-gradient(180deg, #b98d00 0%, #8f6c00 100%)",
  },
};

export function BrickStepCard({
  n,
  title,
  body,
  colorway,
}: {
  n: string;
  title: string;
  body: string;
  colorway: BrickColorway;
}) {
  return (
    <div
      className="relative mt-8 flex flex-col gap-2.5 rounded-[20px] p-7 pt-8 text-white"
      style={{
        background: colorway.grad,
        boxShadow: `0 10px 0 0 ${colorway.bevel}, 0 30px 40px -24px rgba(25,28,30,0.5), inset 0 2px 0 rgba(255,255,255,0.28)`,
      }}
    >
      {/* The stud. Full-width flex container centres it without a translate,
          so it stays put under RTL instead of mirroring off to one side. */}
      <span
        className="absolute inset-x-0 -top-[24px] flex justify-center"
        aria-hidden
      >
        <span
          className="block h-[28px] w-[54%] rounded-t-[16px] rounded-b-[5px]"
          style={{
            background: colorway.stud,
            boxShadow:
              "inset 0 4px 4px rgba(255,255,255,0.42), inset 0 -8px 9px rgba(0,0,0,0.24)",
          }}
        />
      </span>

      <span
        className="flex h-10 w-10 items-center justify-center rounded-[10px] font-heading text-xl font-black"
        style={{ background: "rgba(0,0,0,0.22)" }}
      >
        {n}
      </span>
      <h3 className="mt-1.5 font-heading text-xl font-black tracking-[-0.02em]">
        {title}
      </h3>
      <p className="text-[15px] leading-relaxed text-white/90">{body}</p>
    </div>
  );
}

"use client";
/**
 * Three-step progress for the /create wizard, styled as filling brick segments
 * (per the design system's "progress = a row of bricks" motif). RTL: step 1 is
 * on the right.
 */
const STEPS = [
  { n: 1, label: "עיצוב" },
  { n: 2, label: "למי" },
  { n: 3, label: "פרטים" },
] as const;

export function StepProgress({
  current,
  onJump,
}: {
  current: number;
  /** Allow going back to an earlier, already-completed step. */
  onJump?: (step: number) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <ol className="flex items-center justify-between gap-2">
        {STEPS.map((s) => {
          const done = s.n < current;
          const active = s.n === current;
          const clickable = done && onJump;
          return (
            <li key={s.n} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onJump(s.n)}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                  active || done
                    ? "bg-primary text-on-primary"
                    : "bg-surface-muted text-zinc-500"
                } ${clickable ? "cursor-pointer" : ""}`}
              >
                {s.n}
              </button>
              <span
                className={`font-heading text-sm font-medium ${
                  active ? "text-primary" : "text-zinc-500"
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      {/* Segmented brick bar */}
      <div className="mt-3 flex gap-1.5">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className={`h-2 flex-1 rounded-full ${
              s.n <= current ? "bg-primary" : "bg-surface-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

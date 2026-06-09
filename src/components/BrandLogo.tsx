/**
 * Pixipic wordmark — "Pixipic" where the middle "i" is built from 1×1 studs: a
 * tower of three stacked brand-red studs (the stem) with a blue stud floating
 * above as the dot. The full word is preserved, so it always reads "Pixipic".
 *
 * `invert` → white tower + yellow floating stud, for dark/photo backgrounds.
 */
export function BrandLogo({
  invert = false,
  className = "",
  style,
}: {
  invert?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`brand-logo ${invert ? "brand-logo--invert" : ""} ${className}`}
      style={style}
      aria-label="Pixipic"
      dir="ltr"
    >
      Pix
      <span className="brand-logo__i" aria-hidden>
        <span className="brand-logo__dot" />
        <span className="brand-logo__tower">
          <span className="brand-logo__brick" />
          <span className="brand-logo__brick" />
          <span className="brand-logo__brick" />
        </span>
      </span>
      pic
    </span>
  );
}

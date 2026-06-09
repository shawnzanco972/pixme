"use client";
/**
 * A color swatch styled like an actual 1×1 brick (beveled tile + centered stud).
 * Used by the user-facing color pickers (studio + B2B preview) — NOT admin/PDFs.
 *
 * States:
 *  - active   → a thin stroke around the brick.
 *  - inactive → a diagonal cross-line through it (deactivated / out of stock).
 */
export function BrickSwatch({
  hex,
  name,
  on,
  disabled = false,
  onClick,
}: {
  hex: string;
  name: string;
  on: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const struck = !on || disabled;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={on}
      title={
        disabled ? `${name} — אזל מהמלאי` : name + (on ? " (פעיל)" : "")
      }
      onClick={onClick}
      className={`brick-swatch ${on && !disabled ? "brick-swatch--on" : ""} ${
        struck ? "brick-swatch--off" : ""
      }`}
      style={{ background: hex }}
    >
      <span className="brick-swatch__stud" aria-hidden />
      {struck && <span className="brick-swatch__strike" aria-hidden />}
    </button>
  );
}

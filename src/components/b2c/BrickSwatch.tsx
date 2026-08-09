"use client";
/**
 * A color swatch styled like an actual 1×1 brick (beveled tile + centered stud).
 * Used by the user-facing color pickers (studio + B2B preview) — NOT admin/PDFs.
 *
 * States:
 *  - active   → a thin stroke around the brick.
 *  - inactive → a diagonal cross-line through it (deactivated / out of stock).
 *
 * `disabled` means OUT OF STOCK (never selectable). `readOnly` means "you can't
 * click it right now, but the on/off state is still meaningful" — used by the
 * automatic palette mode, where the swatches are a read-out of what the engine
 * chose rather than a set of controls.
 */
export function BrickSwatch({
  hex,
  name,
  on,
  disabled = false,
  readOnly = false,
  onClick,
}: {
  hex: string;
  name: string;
  on: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  onClick?: () => void;
}) {
  const struck = !on || disabled;
  return (
    <button
      type="button"
      disabled={disabled || readOnly}
      aria-pressed={on}
      title={
        disabled
          ? `${name} — אזל מהמלאי`
          : name + (on ? (readOnly ? " (נבחר אוטומטית)" : " (פעיל)") : "")
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

"use client";
/**
 * Step 2 — "who is it for?". Sets the order intent (self vs gift), which decides
 * the fields the details step asks for. Two big tappable cards per the mockup.
 */
export type Intent = "self" | "gift";

export function RecipientStep({
  intent,
  onChange,
  onNext,
  onBack,
}: {
  intent: Intent;
  onChange: (i: Intent) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <header className="text-center">
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">
          עבור מי ההזמנה?
        </h1>
        <p className="mt-2 text-zinc-600">
          בחרו למי מיועדת הערכה שאתם בונים.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Choice
          selected={intent === "gift"}
          onSelect={() => onChange("gift")}
          icon="🎁"
          title="מתנה"
          desc="הערכה תישלח ישירות למקבל המתנה, או אליכם לעטיפה"
        />
        <Choice
          selected={intent === "self"}
          onSelect={() => onChange("self")}
          icon="🙂"
          title="לעצמי"
          desc="הערכה תישלח אליכם הביתה"
        />
      </div>

      <div className="flex items-center justify-between border-t border-outline pt-5">
        <button type="button" onClick={onBack} className="text-sm text-zinc-500 underline">
          חזרה
        </button>
        <button type="button" onClick={onNext} className="btn btn-primary">
          המשך ←
        </button>
      </div>
    </div>
  );
}

function Choice({
  selected,
  onSelect,
  icon,
  title,
  desc,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`card flex flex-col items-center gap-3 p-8 text-center transition ${
        selected ? "ring-2 ring-primary" : "hover:border-zinc-300"
      }`}
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-3xl">
        {icon}
      </span>
      <span className="font-heading text-xl font-bold">{title}</span>
      <span className="text-sm text-zinc-600">{desc}</span>
    </button>
  );
}

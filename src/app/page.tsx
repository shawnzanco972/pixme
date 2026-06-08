import Link from "next/link";

import { HeroMosaic } from "@/components/HeroMosaic";
import { StarterShowcase } from "@/components/StarterShowcase";
import {
  computePrice,
  formatILS,
  presetStuds,
  SIZE_PRESETS,
} from "@/lib/pricing";

const TIERS = [
  { id: "2x2", tag: "הנמכר ביותר" },
  { id: "3x3", tag: "" },
  { id: "4x4", tag: "" },
].map((t) => {
  const p = SIZE_PRESETS.find((s) => s.id === t.id)!;
  const { cols, rows } = presetStuds(p);
  return {
    ...t,
    label: p.labelHe,
    cm: `${Math.round(p.platesX * 19.2)}×${Math.round(p.platesY * 19.2)} ס״מ`,
    studs: cols * rows,
    price: computePrice(cols, rows, "physical").total,
  };
});

const OCCASIONS = [
  ["🎖️", "מתנות שחרור", "מתנה אישית וזכירה לחייל המשוחרר."],
  ["🎂", "ימי הולדת", "פסיפס של רגע אהוב — מתנה שלא שוכחים."],
  ["💍", "אהבה וזוגיות", "תמונה מהחתונה או מהטיול הראשון, מהקירות."],
  ["🏢", "מתנות לעובדים", "מיתוג ופעילות גיבוש לחברות — בקנה מידה."],
];

const FAQ = [
  [
    "איך זה עובד?",
    "מעלים תמונה, המערכת ממירה אותה לפסיפס לבנים בזמן אמת, בוחרים גודל וצבעים ומזמינים. הערכה מגיעה עם כל הלבנים וחוברת הוראות.",
  ],
  [
    "האם צריך ניסיון?",
    "ממש לא. ההרכבה היא כמו ציור לפי מספרים — מניחים את הלבנים לפי המפה. כיף לבד או במשפחה.",
  ],
  [
    "כמה זמן לוקח המשלוח?",
    "אנחנו אורזים ושולחים בתוך 1–3 ימי עסקים, עם איסוף מנקודות חלוקה ברחבי הארץ.",
  ],
  [
    "אפשר לקבל רק את הקובץ הדיגיטלי?",
    "כל הזמנה כוללת ערכה פיזית, וקובץ ההוראות (PDF) זמין להורדה חינם בעמוד ההזמנה.",
  ],
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
        <div className="flex flex-col items-center gap-6 text-center md:items-start md:text-start">
          <span className="rounded-full bg-accent/20 px-4 py-1 font-heading text-sm font-medium text-foreground/80">
            🧱 פסיפס לבנים בעבודת יד — מהתמונה שלכם
          </span>
          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            הפכו רגע אהוב
            <br />
            <span className="text-primary">לאומנות קיר מלבנים</span>
          </h1>
          <p className="max-w-xl text-lg leading-8 text-foreground/70">
            העלו תמונה, צפו בתצוגה מקדימה חיה של הפסיפס, והזמינו ערכה מלאה עם
            חוברת הוראות. מתנה מושלמת — לעצמכם או למישהו אהוב.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/create" className="btn btn-primary">
              התחילו ליצור
            </Link>
            <Link href="/b2b" className="btn btn-ghost">
              לעסקים ומתנות
            </Link>
          </div>
        </div>
        <HeroMosaic starter="smiley" />
      </section>

      {/* Showcase */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <h2 className="mb-6 text-center font-heading text-2xl font-bold">
          דוגמאות — כך זה ייראה מלבנים
        </h2>
        <StarterShowcase />
      </section>

      {/* How it works */}
      <section
        id="how"
        className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-16 sm:grid-cols-3"
      >
        {(
          [
            ["1", "מעלים תמונה", "כל תמונה — פורטרט, חיית מחמד, לוגו או טקסט."],
            [
              "2",
              "מעצבים פסיפס",
              "מנוע OKLab ממיר לצבעי לבנים אמיתיים, עם שליטה בגודל, ניגודיות וצבעים.",
            ],
            [
              "3",
              "מקבלים ערכה",
              "ערכה פיזית עם כל הלבנים וחוברת הוראות 1:1 להרכבה קלה.",
            ],
          ] as const
        ).map(([n, title, body]) => (
          <div key={n} className="card flex flex-col gap-2 p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-heading font-bold text-on-primary">
              {n}
            </span>
            <h3 className="font-heading text-xl font-semibold">{title}</h3>
            <p className="text-foreground/70">{body}</p>
          </div>
        ))}
      </section>

      {/* Sizes & pricing */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <h2 className="mb-6 text-center font-heading text-2xl font-bold">
          גדלים ומחירים
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.id}
              className={`card relative flex flex-col items-center gap-2 p-6 text-center ${
                t.tag ? "ring-2 ring-primary" : ""
              }`}
            >
              {t.tag && (
                <span className="absolute -top-3 rounded-full bg-primary px-3 py-1 text-xs text-on-primary">
                  {t.tag}
                </span>
              )}
              <h3 className="font-heading text-xl font-bold">{t.label}</h3>
              <p className="text-sm text-foreground/60">{t.cm}</p>
              <p className="text-3xl font-bold text-primary">
                {formatILS(t.price)}
              </p>
              <p className="text-xs text-foreground/60">
                {t.studs.toLocaleString("he-IL")} לבנים · כולל ערכה והוראות
              </p>
              <Link href="/create" className="btn btn-primary mt-2">
                בחירה
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Occasions */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <h2 className="mb-6 text-center font-heading text-2xl font-bold">
          מושלם לכל אירוע
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {OCCASIONS.map(([emoji, title, body]) => (
            <div key={title} className="card flex flex-col gap-2 p-5">
              <span className="text-3xl">{emoji}</span>
              <h3 className="font-heading font-semibold">{title}</h3>
              <p className="text-sm text-foreground/70">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-20">
        <h2 className="mb-6 text-center font-heading text-2xl font-bold">
          שאלות נפוצות
        </h2>
        <div className="flex flex-col gap-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card p-4">
              <summary className="cursor-pointer font-heading font-medium">
                {q}
              </summary>
              <p className="mt-2 text-foreground/70">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary/5 py-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 text-center">
          <h2 className="font-heading text-3xl font-bold">מוכנים להתחיל?</h2>
          <p className="text-foreground/70">
            צרו את הפסיפס הראשון שלכם תוך דקות.
          </p>
          <Link href="/create" className="btn btn-primary">
            התחילו ליצור
          </Link>
        </div>
      </section>
    </main>
  );
}

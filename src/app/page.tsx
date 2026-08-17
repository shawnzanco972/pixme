import Link from "next/link";

import { BrickStepCard, BRICK_COLORWAYS } from "@/components/BrickStepCard";
import { HeroMosaic, type HeroDesign } from "@/components/HeroMosaic";
import { ReadyDesignsGallery } from "@/components/ReadyDesignsGallery";
import { parseEngineSettings } from "@/lib/design-settings";
import { computePrice, formatILS, PLATE_STUDS } from "@/lib/pricing";
import { designPublicUrl } from "@/lib/supabase/storage";
import { createPublicClient } from "@/lib/supabase/server";

// ISR: public page, no per-visitor data — render once and re-use for 60s
// instead of hitting Supabase on every visit (gallery edits show within 1min).
export const revalidate = 60;

const CM_PER_PLATE = 19.2;

async function getHeroDesign(): Promise<HeroDesign | undefined> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("ready_designs")
    .select("image_path, default_plates_x, default_plates_y, settings")
    .eq("is_hero", true)
    .eq("active", true)
    .maybeSingle();
  if (!data) return undefined;
  return {
    imageUrl: designPublicUrl(supabase, data.image_path),
    platesX: data.default_plates_x,
    platesY: data.default_plates_y,
    settings: parseEngineSettings(data.settings),
  };
}

/** Bidi-isolate a "58×38" pair so it doesn't reorder inside an RTL run. */
const pair = (a: number | string, b: number | string) => `⁦${a}×${b}⁩`;

// Three promoted sizes for the pricing section, with an A4 scale comparison.
const SIZES = [
  { platesX: 3, platesY: 2, name: "רחב", accent: "#1d4ed8", note: "לתמונות רחבות (או אנכי — 2×3)" },
  { platesX: 3, platesY: 3, name: "רגיל", accent: "#b7102a", popular: true, note: "מספיק פיקסלים לתוצאה חדה" },
  { platesX: 5, platesY: 5, name: "ענק", accent: "#f3bf2f", note: "הגודל המקסימלי שאפשר להזמין" },
].map((s) => {
  const cols = s.platesX * PLATE_STUDS;
  const rows = s.platesY * PLATE_STUDS;
  return {
    ...s,
    cmX: Math.round(s.platesX * CM_PER_PLATE),
    cmY: Math.round(s.platesY * CM_PER_PLATE),
    studs: cols * rows,
    price: computePrice(cols, rows, "physical").total,
  };
});

const OCCASIONS: [string, string, string, string, string][] = [
  ["military_tech", "מתנות שחרור", "מתנה אישית וזכירה לחייל המשוחרר.", "#eaf0ff", "#1d4ed8"],
  ["cake", "ימי הולדת", "פסיפס של רגע אהוב — מתנה שלא שוכחים.", "#fdeef1", "#b7102a"],
  ["favorite", "אהבה וזוגיות", "התמונה מהחתונה או מהטיול הראשון, על הקיר.", "#fdf3e0", "#9a7400"],
  ["apartment", "מתנות לעובדים", "מיתוג ופעילות גיבוש לחברות — בקנה מידה.", "#eaf3ee", "#2e7d32"],
];

const HOW = [
  {
    n: "1",
    title: "מעלים תמונה",
    body: "פורטרט, חיית מחמד, לוגו או משפט אהוב. גם תמונה מהטלפון עובדת מעולה.",
    colorway: BRICK_COLORWAYS.red,
  },
  {
    n: "2",
    title: "מעצבים על המסך",
    body: "בוחרים גודל, מזיזים את המסגרת ומכבים צבעים שלא מתאימים. התצוגה מתעדכנת מיד.",
    colorway: BRICK_COLORWAYS.blue,
  },
  {
    n: "3",
    title: "מרכיבים ותולים",
    body: "ערכה עם כל הלבנים, לוחות בסיס וחוברת הוראות בגודל 1:1 — מניחים לבנה לפי המפה.",
    colorway: BRICK_COLORWAYS.gold,
  },
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

/** A floating decorative brick (hero background). */
function FloatBrick({
  className,
  color,
  size,
  style,
}: {
  className: string;
  color: string;
  size: [number, number];
  style: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute blur-[3px] ${className}`}
      style={{ width: size[0], height: size[1], ...style }}
    >
      <span
        className="block h-full w-full rounded-[22%]"
        style={{
          background: color,
          boxShadow:
            "inset 0 5px 4px rgba(255,255,255,0.45), inset 0 -7px 9px rgba(0,0,0,0.26), 0 16px 26px -12px rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
}

export default async function Home() {
  const heroDesign = await getHeroDesign();
  return (
    <main className="flex flex-1 flex-col overflow-x-hidden">
      {/* ------------------------------------------------------------- Hero */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-14 md:pt-16">
        <FloatBrick
          className="drift-a"
          color="#f3bf2f"
          size={[88, 88]}
          style={{ top: 30, insetInlineStart: "3%", opacity: 0.5 }}
        />
        <FloatBrick
          className="drift-c"
          color="#1d4ed8"
          size={[56, 56]}
          style={{ top: 360, insetInlineEnd: "6%", opacity: 0.42 }}
        />
        <FloatBrick
          className="drift-b"
          color="#36aebf"
          size={[118, 60]}
          style={{ top: 96, insetInlineEnd: "42%", opacity: 0.3 }}
        />

        <div className="relative grid items-center gap-12 md:grid-cols-2">
          <div className="flex flex-col items-center gap-6 text-center md:items-start md:text-start">
            <span
              className="inline-flex items-center gap-2.5 rounded-full border-2 bg-surface px-4 py-2 font-heading text-sm font-bold"
              style={{
                borderColor: "#f0d78b",
                color: "#6b5300",
                boxShadow: "0 3px 0 0 #e8d59a",
              }}
            >
              פסיפס לבנים בעבודת יד — מהתמונה שלכם
              <span
                className="inline-block h-4 w-4 rounded-full"
                style={{
                  background: "#f3bf2f",
                  boxShadow:
                    "inset 0 2px 2px rgba(255,255,255,0.7), inset 0 -3px 3px rgba(0,0,0,0.28)",
                }}
              />
            </span>

            <h1 className="font-heading font-black leading-[1.06] tracking-[-0.035em] text-[clamp(34px,7vw,64px)]">
              הפכו רגע אהוב
              <br />
              <span className="text-primary">לאומנות קיר מלבנים</span>
            </h1>

            <p className="max-w-[30em] text-lg leading-8 text-foreground/70">
              מעלים תמונה, רואים אותה נבנית מלבנים על המסך, ובוחרים גודל. הערכה
              מגיעה עם כל הלבנים וחוברת הוראות — הרכבה של ערב אחד, יצירה שנשארת על
              הקיר.
            </p>

            <div className="flex flex-wrap gap-3.5">
              <Link
                href="/create"
                className="btn btn-primary min-h-[60px] px-8 text-lg"
              >
                התחילו ליצור
              </Link>
              <Link
                href="/#gallery"
                className="btn btn-ghost min-h-[60px] px-7 text-lg"
              >
                לגלריית העיצובים
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-foreground/60">
              {[
                ["#2e7d32", "משלוח חינם"],
                ["#1d4ed8", "פלטת צבעים מדויקת"],
                ["#f3bf2f", "אריזה תוך 1–3 ימי עסקים"],
              ].map(([c, label]) => (
                <span key={label} className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: c }}
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Framed hero mosaic — tilted "hung frame" with a size caption. */}
          <div className="relative flex justify-center">
            <div
              className="pointer-events-none absolute -inset-x-6 -inset-y-8"
              style={{
                background:
                  "radial-gradient(60% 50% at 50% 42%, rgba(243,191,47,0.28), rgba(243,191,47,0) 70%)",
              }}
            />
            <div
              className="relative w-full max-w-[430px] rounded-[10px] p-4 transition-transform duration-200 hover:rotate-0"
              style={{
                background:
                  "linear-gradient(150deg, #3c424a 0%, #23272d 48%, #14171b 100%)",
                boxShadow:
                  "inset 0 2px 0 rgba(255,255,255,0.14), 0 40px 60px -28px rgba(20,23,27,0.75)",
                rotate: "-2.2deg",
              }}
            >
              <div
                className="rounded-[4px] p-3.5"
                style={{
                  background: "#f4f5f6",
                  boxShadow: "inset 0 2px 10px rgba(0,0,0,0.16)",
                }}
              >
                <HeroMosaic starter="smiley" design={heroDesign} />
              </div>
              <div
                className="absolute -bottom-5 inline-flex items-center gap-2.5 rounded-xl bg-surface px-4 py-2.5 font-heading text-sm font-bold end-4"
                style={{ boxShadow: "0 4px 0 0 #d3dae1, 0 18px 26px -16px rgba(25,28,30,0.55)" }}
              >
                <span
                  className="inline-block h-3.5 w-3.5 rounded-[3px]"
                  style={{
                    background: "#b7102a",
                    boxShadow:
                      "inset 0 2px 2px rgba(255,255,255,0.4), inset 0 -2px 3px rgba(0,0,0,0.3)",
                  }}
                />
                {pair(58, 58)} ס״מ · 5,184 לבנים
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- How it works */}
      <section id="how" className="mx-auto w-full max-w-6xl px-6 pb-24 pt-6">
        <div className="mb-14 flex flex-col items-center gap-2.5 text-center">
          <h2 className="font-heading font-black tracking-[-0.03em] text-[clamp(28px,4vw,42px)]">
            שלוש לבנים, יצירה אחת
          </h2>
          <p className="max-w-[34em] text-lg leading-7 text-foreground/60">
            מהתמונה במצלמה ועד הפסיפס על הקיר — שלושה שלבים, בלי ניסיון קודם.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {HOW.map((s) => (
            <BrickStepCard
              key={s.n}
              n={s.n}
              title={s.title}
              body={s.body}
              colorway={s.colorway}
            />
          ))}
        </div>
      </section>

      {/* Ready-made designs gallery (admin-managed; hidden when empty) */}
      <div id="gallery">
        <ReadyDesignsGallery />
      </div>

      {/* --------------------------------------------------- Sizes & pricing */}
      <section id="sizes" className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="mb-12 flex flex-col items-center gap-2.5 text-center">
          <h2 className="font-heading font-black tracking-[-0.03em] text-[clamp(28px,4vw,42px)]">
            איזה גודל לתלות?
          </h2>
          <p className="max-w-[34em] text-lg leading-7 text-foreground/60">
            כל פסיפס בנוי מלוחות בסיס של 19.2 ס״מ. הריבוע האפור בכל כרטיס הוא דף
            A4 — כדי שתדעו בדיוק על מה מדובר.
          </p>
        </div>

        <div className="grid gap-7 sm:grid-cols-3">
          {SIZES.map((s) => {
            const scale = 1.6; // px per cm inside the A4-compare box
            const sq = Math.min(154, Math.round(s.cmX * scale));
            const sqH = Math.min(154, Math.round(s.cmY * scale));
            return (
              <div
                key={s.name}
                className={`relative flex flex-col items-center gap-3.5 rounded-[22px] bg-surface p-8 pt-9 ${s.popular ? "pt-10" : ""}`}
                style={{
                  border: `3px solid ${s.accent}`,
                  boxShadow: `0 ${s.popular ? 10 : 8}px 0 0 ${s.accent}22, 0 28px 38px -26px ${s.accent}88`,
                }}
              >
                {s.popular && (
                  <span
                    className="absolute -top-5 inline-flex items-center gap-2 rounded-[9px] px-4 py-2.5 font-heading text-[13px] font-black end-6"
                    style={{
                      background: "linear-gradient(180deg, #ffd968 0%, #f3bf2f 100%)",
                      color: "#4a3700",
                      rotate: "-2.5deg",
                      boxShadow: "0 5px 0 0 #b98600",
                    }}
                  >
                    הנמכר ביותר
                  </span>
                )}
                <h3 className="font-heading text-[22px] font-black">{s.name}</h3>
                <span
                  className="font-heading text-sm font-semibold"
                  style={{ color: s.accent }}
                >
                  {pair(s.cmX, s.cmY)} ס״מ · {pair(s.platesX, s.platesY)} לוחות
                </span>
                {/* A4 scale compare */}
                <div
                  className="relative flex h-44 w-full items-end justify-center gap-2.5 rounded-xl p-3"
                  style={{
                    background: "#f2f4f6",
                    boxShadow: "inset 0 3px 12px rgba(25,28,30,0.08)",
                    backgroundImage:
                      "radial-gradient(circle, rgba(25,28,30,0.07) 0 20%, rgba(25,28,30,0) 21%)",
                    backgroundSize: "12px 12px",
                  }}
                >
                  <span className="flex h-[47px] w-[34px] items-end justify-center rounded-[2px] border border-dashed border-[#aeb7bf] pb-0.5 text-[10px] text-foreground/50">
                    A4
                  </span>
                  <span
                    className="block rounded-[6px]"
                    style={{
                      width: sq,
                      height: sqH,
                      background: s.accent,
                      boxShadow:
                        "inset 0 3px 3px rgba(255,255,255,0.3), inset 0 -5px 8px rgba(0,0,0,0.26)",
                    }}
                  />
                </div>
                <p
                  className="font-heading font-black"
                  style={{ color: s.popular ? s.accent : "#191c1e", fontSize: s.popular ? 46 : 40 }}
                >
                  {formatILS(s.price)}
                </p>
                <p className="text-[13px] text-foreground/60">
                  {s.studs.toLocaleString("he-IL")} לבנים · {s.note}
                </p>
                <Link
                  href="/create"
                  className={`mt-1.5 w-full ${s.popular ? "btn btn-primary min-h-[56px] text-lg" : "btn btn-ghost min-h-[54px]"}`}
                >
                  בחירה
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-7 text-center text-sm text-foreground/60">
          כל גודל — מלוח אחד ועד 5×5 לוחות, כולל יחסים רחבים ואנכיים — נבחר בעמוד
          היצירה. כל מחיר כולל ערכה מלאה, לוחות בסיס וחוברת הוראות.
        </p>
      </section>

      {/* ------------------------------------------------------- Occasions */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <h2 className="mb-10 text-center font-heading font-black tracking-[-0.03em] text-[clamp(26px,3.4vw,36px)]">
          מושלם לכל אירוע
        </h2>
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {OCCASIONS.map(([icon, title, body, bg, fg]) => (
            <div
              key={title}
              className="flex flex-col gap-2.5 rounded-[18px] bg-surface p-6 transition-transform duration-200 hover:-translate-y-1"
              style={{
                border: "1px solid var(--color-outline)",
                boxShadow: "0 6px 0 0 #eceff2, 0 20px 28px -22px rgba(25,28,30,0.5)",
              }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: bg, color: fg }}
              >
                <span className="mi text-[26px]">{icon}</span>
              </span>
              <h3 className="mt-1 font-heading text-lg font-bold">{title}</h3>
              <p className="text-sm leading-relaxed text-foreground/60">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- FAQ */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-24">
        <h2 className="mb-6 text-center font-heading font-black tracking-[-0.03em] text-[clamp(26px,3.4vw,36px)]">
          שאלות נפוצות
        </h2>
        <div className="flex flex-col gap-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card p-4">
              <summary className="cursor-pointer font-heading font-semibold">
                {q}
              </summary>
              <p className="mt-2 leading-relaxed text-foreground/70">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- Final CTA */}
      <section
        className="relative overflow-hidden py-20"
        style={{
          background:
            "linear-gradient(180deg, #1b2130 0%, #12161e 55%, #0d1116 100%)",
        }}
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-6 text-center">
          <h2 className="font-heading font-black tracking-[-0.03em] text-white text-[clamp(28px,3.6vw,44px)]">
            התמונה הראשונה שלכם, עוד מעט על הקיר
          </h2>
          <p className="max-w-[32em] text-lg leading-7 text-white/65">
            מעלים תמונה, מעצבים תוך דקות, ומזמינים ערכה מלאה עם משלוח חינם עד
            הבית.
          </p>
          <Link
            href="/create"
            className="btn btn-primary min-h-[60px] px-9 text-lg"
          >
            התחילו ליצור
          </Link>
        </div>
      </section>
    </main>
  );
}

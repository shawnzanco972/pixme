import Link from "next/link";

import {
  BrickStepCard,
  BRICK_COLORWAYS,
  type BrickColorway,
} from "@/components/BrickStepCard";
import { B2bExperience } from "@/components/b2b/B2bExperience";
import type { PreviewSample } from "@/components/b2b/B2bEnginePreview";
import { designPublicUrl } from "@/lib/supabase/storage";
import { createPublicClient } from "@/lib/supabase/server";
import {
  MANAGED_FEE_MIN,
  MAX_SELF_SERVE_SEATS,
  PLATE_CM,
  VOLUME_TIERS,
} from "@/lib/b2b-pricing";
import { computePrice, formatILS, PLATE_STUDS } from "@/lib/pricing";

export const metadata = {
  title: "מתנות לעובדים שנשארות על הקיר — Pixipic לעסקים",
  description:
    "כל עובד מקבל ערכת פסיפס לבנים מתמונה שלו — מתנה אישית שמרכיבים ותולים. מחשבון מחיר שקוף לפי כמות וגודל, קישור אישי לכל עובד ולוח בקרה אחד לניהול הפרויקט.",
};

// ISR: public page, no per-visitor data — render once and re-use for 60s
// instead of hitting Supabase for the sample designs on every visit.
export const revalidate = 60;

/** Bidi-isolate a "58×38" pair so it doesn't reorder inside an RTL run. */
const pair = (a: number | string, b: number | string) => `⁦${a}×${b}⁩`;

// --------------------------------------------------------------- Content

const PROBLEM: { icon: string; bad: string; good: string }[] = [
  {
    icon: "inventory_2",
    bad: "עוד כוס, עוד תיק, עוד סט סכינים",
    good: "מתנה שאין לאף אחד אחר — כי היא עשויה מהתמונה שלו",
  },
  {
    icon: "table_restaurant",
    bad: "נפתחת, מונחת על השולחן, נשכחת",
    good: "ערב של הרכבה, ואז שנים על הקיר בבית",
  },
  {
    icon: "checklist",
    bad: "מישהו במשרד רודף אחרי 40 איש בוואטסאפ",
    good: "כל עובד מקבל קישור אישי, אתם רואים הכול בלוח אחד",
  },
];

const STEPS: {
  n: string;
  title: string;
  body: string;
  colorway: BrickColorway;
}[] = [
  {
    n: "1",
    title: "בוחרים גודל וכמות",
    body: "המחשבון למטה מראה מיד את המחיר הסופי — כולל הנחת כמות. בלי לחכות להצעת מחיר.",
    colorway: BRICK_COLORWAYS.red,
  },
  {
    n: "2",
    title: "פותחים פרויקט",
    body: "מיד אחרי התשלום מקבלים לוח בקרה פרטי. מדביקים רשימת שמות — וזהו.",
    colorway: BRICK_COLORWAYS.blue,
  },
  {
    n: "3",
    title: "התמונות נאספות",
    body: "כל עובד מקבל קישור אישי, בוחר תמונה ורואה מיד איך היא תיראה בלבנים. אתם מאשרים בלחיצה.",
    colorway: BRICK_COLORWAYS.teal,
  },
  {
    n: "4",
    title: "אתם משחררים, אנחנו שולחים",
    body: "בוחרים אילו ערכות יוצאות עכשיו — הכול או חלק. מגיע למשרד בקרטון אחד, ממוין לפי שמות.",
    colorway: BRICK_COLORWAYS.gold,
  },
];

const EMPLOYEE_GETS: string[] = [
  "ערכה פיזית משלו — כל הלבנים ממוינות לפי צבע",
  "לוחות בסיס שמתחברים למסגרת אחת",
  "חוברת הוראות אישית בגודל 1:1 — מניחים לבנה לפי המפה",
  "התמונה שהוא בחר, או הפתעה שאתם מעלים בשבילו",
];

const MANAGER_GETS: string[] = [
  "קישור אישי לכל עובד — שולחים בוואטסאפ, במייל או בסלאק",
  "לוח בקרה אחד: מי העלה, מי עוד לא, מי מחכה לאישור",
  "אישור תמונות בלחיצה — לפני שמשהו נכנס לייצור",
  "שליטה על מה יוצא ומתי — הכול יחד, או ערכה אחת דחופה עכשיו",
  "אפשרות להגדיל פסיפס לעובד מסוים (ותק, מצוינות) בלי לפתוח הזמנה חדשה",
];

const OCCASIONS: [string, string, string, string, string][] = [
  ["celebration", "חגים וסוף שנה", "ראש השנה, פסח או סיכום שנה — במקום עוד מארז יין.", "#fdeef1", "#b7102a"],
  ["workspace_premium", "ותק ומיילסטונים", "5 שנים בחברה. פסיפס גדול יותר, בלי הזמנה נפרדת.", "#eaf0ff", "#1d4ed8"],
  ["waving_hand", "אונבורדינג", "עובד חדש מקבל משהו אישי בשבוע הראשון, לא עוד חולצה.", "#eaf3ee", "#2e7d32"],
  ["handshake", "לקוחות ושותפים", "מתנה ממותגת ללקוחות VIP — או הלוגו שלכם כפסיפס קיר למשרד.", "#fdf3e0", "#9a7400"],
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "מה בדיוק מקבלים? זו מתנה דיגיטלית?",
    a: "לא, וגם לא מוצר מוגמר. כל עובד מקבל ערכה פיזית להרכבה עצמית: כל הלבנים ממוינות לפי צבע, לוחות בסיס וחוברת הוראות שנוצרה במיוחד לתמונה שהוא בחר. אין שתי ערכות זהות בהזמנה — וההרכבה עצמה היא חצי מהמתנה.",
  },
  {
    q: "מה קורה עם עובד שלא מעלה תמונה?",
    a: `אתם רואים אותו בלוח הבקרה כ"ממתין", ויכולים לשלוח לו את הקישור שוב בקליק או פשוט להעלות תמונה בשבילו. הפרויקט לא נתקע בגלל אדם אחד — ואפשר גם לתכנן את כל ההזמנה כהפתעה ולהעלות את כל התמונות בעצמכם.`,
  },
  {
    q: "אנחנו רוצים שזו תהיה הפתעה מוחלטת",
    a: "אז לא מפעילים את הניהול האישי: אתם מעלים את התמונות בעצמכם מלוח הבקרה (מתמונות צוות, מאירועי חברה, מלינקדאין). העובד מגלה רק כשהקופסה נפתחת.",
  },
  {
    q: "האם התמונות של העובדים נשמרות אצלכם?",
    a: "התמונה משמשת ליצירת הפסיפס ולהפקת חוברת ההוראות בלבד. היא לא מוצגת בפומבי, לא משמשת לשיווק ולא מועברת לצד שלישי, ואפשר לבקש מחיקה בכל שלב. מעבר לתמונה אנחנו לא שומרים על העובד שום פרט חוץ מהשם והאימייל שאתם הזנתם.",
  },
  {
    q: "מה הגודל, ואיזה גודל כדאי לבחור?",
    a: `אתם בוחרים לכל עובד — מ-${pair(PLATE_CM, PLATE_CM)} ס״מ (לוח אחד, מושלם לדיוקן קלוז-אפ או לחיית מחמד) ועד ${pair(PLATE_CM * 5, PLATE_CM * 5)} ס״מ לקיר. הבחירה הפופולרית למתנת עובדים היא ${pair(PLATE_CM * 2, PLATE_CM * 2)} ס״מ: מספיק פיקסלים לפרצוף מזוהה, וערב אחד של הרכבה. לתמונות עם כמה אנשים כדאי לעלות לשלושה לוחות.`,
  },
  {
    q: "כמה זמן לוקח להרכיב?",
    a: "לוח אחד הוא בערך שלושת רבעי שעה. ארבעה לוחות הם פרויקט של ערב, כזה שמושך גם את הילדים לשולחן. זה חלק מהמתנה — לא רק החפץ, גם השעה שהוא לוקח.",
  },
  {
    q: "כמה זה עולה, ולמה יש הנחת כמות?",
    a: `המחיר לערכה מתחיל במחיר הקמעונאי ויורד ככל שמזמינים יותר — עד ${Math.round(VOLUME_TIERS[0][1] * 100)}% הנחה. הניהול האישי לכל עובד נוסף בנפרד, החל מ-${formatILS(MANAGED_FEE_MIN)} לעובד. הכול מחושב במחשבון למטה, בלי כוכביות.`,
  },
  {
    q: "אפשר לתת לעובד מסוים פסיפס גדול יותר?",
    a: "כן. בלוח הבקרה אפשר להגדיל פסיפס של עובד מסוים — למשל לציון ותק — והמערכת מאזנת את זה מול שאר ההזמנה. אפשר גם להוסיף תקציב לפרויקט בכל שלב, בלי לפתוח הזמנה חדשה.",
  },
  {
    q: "אפשר לוגו של החברה או צבעי מותג?",
    a: "כן. יש מצב עיצוב נפרד ללוגו וטקסט, ששומר על קצוות חדים וכיתוב קריא. אפשר להזמין פסיפס לוגו גדול לקיר המשרד, ולצדו ערכות אישיות לעובדים.",
  },
  {
    q: "איך ומתי שולחים?",
    a: "הכול מגיע אליכם למשרד בקרטון אחד, ממוין לפי שמות — אתם מחלקים. אתם גם קובעים מתי: אפשר לשחרר לייצור את כל הערכות יחד לקראת התאריך, או רק חלק מהן (למשל מתנה אחת דחופה עכשיו, והשאר בחג). זה נעשה בלחיצה מלוח הבקרה.",
  },
  {
    q: "אילו פרטים אתם שומרים על העובדים?",
    a: "רק שם ואימייל — אלה שאתם הזנתם. אין כתובות, אין טלפונים ואין חשבון משתמש. הלקוח שלנו הוא החברה, לא העובד, ולכן גם המשלוח והחשבונית הם מולכם בלבד.",
  },
  {
    q: "יש חשבונית ותנאי תשלום לעסק?",
    a: "כן — חשבונית מס כדין לכל הזמנה. תשלום בכרטיס אשראי דרך דף סליקה מאובטח, ולהזמנות גדולות אפשר להסדיר העברה בנקאית מול הצעת מחיר.",
  },
  {
    q: `יש לנו יותר מ-${MAX_SELF_SERVE_SEATS} עובדים`,
    a: `עד ${MAX_SELF_SERVE_SEATS} עובדים מזמינים ישירות מהמחשבון. מעל זה — משאירים פרטים ואנחנו חוזרים עם הצעה אישית תוך יום עסקים, כולל תיאום תאריך יעד לייצור.`,
  },
];

const PLANNING = [
  ["event_available", "קובעים תאריך יעד", "אומרים לנו מתי המתנה צריכה להיות ביד. משם עובדים אחורה."],
  ["link", "אוספים תמונות", "שולחים לכל אחד את הקישור שלו, ותזכורת אחת למי שטרם. זה החלק שלוקח הכי הרבה זמן."],
  ["local_shipping", "משחררים לייצור", "מאשרים את העיצובים ובוחרים מה יוצא עכשיו. אתם רואים בלוח מתי כל משלוח יצא."],
];

// A small "manager dashboard" mock for the hero — it sells the operation,
// not the product photo.
const HERO_ROWS: [string, string, string, string][] = [
  ["דניאל כהן", "אושר", "#2e7d32", "#eaf3ee"],
  ["מיכל אברהמי", "ממתין לאישור", "#9a7400", "#fdf3e0"],
  ["יונתן לוי", "טרם העלה", "#6b7280", "#f2f4f6"],
];

/**
 * A handful of active ready-made designs to seed the live preview. Same catalog
 * the studio and home gallery use, so whatever the admin publishes shows up
 * here too — no separate asset list to maintain.
 */
async function getSamples(): Promise<PreviewSample[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("ready_designs")
    .select("id, title, image_path")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(6);
  return (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    imageUrl: designPublicUrl(supabase, d.image_path),
  }));
}

export default async function B2bPage() {
  const samples = await getSamples();
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="flex flex-1 flex-col overflow-x-hidden">
      <script
        type="application/ld+json"
        // Static, build-time content — no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ------------------------------------------------------------- Hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-14">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div className="flex flex-col items-center gap-6 text-center md:items-start md:text-start">
            <span
              className="inline-flex items-center gap-2.5 rounded-full border-2 bg-surface px-4 py-2 font-heading text-sm font-bold"
              style={{
                borderColor: "#c3d0f5",
                color: "#1d3a99",
                boxShadow: "0 3px 0 0 #cfd9f3",
              }}
            >
              Pixipic לעסקים
              <span
                className="inline-block h-4 w-4 rounded-full"
                style={{
                  background: "#1d4ed8",
                  boxShadow:
                    "inset 0 2px 2px rgba(255,255,255,0.55), inset 0 -3px 3px rgba(0,0,0,0.28)",
                }}
              />
            </span>

            <h1 className="font-heading font-black leading-[1.06] tracking-[-0.035em] text-[clamp(32px,6.4vw,58px)]">
              מתנה לעובדים
              <br />
              <span className="text-primary">שלא נדחקת למגירה</span>
            </h1>

            <p className="max-w-[32em] text-lg leading-8 text-foreground/70">
              כל עובד בוחר תמונה — של הילדים, של הכלב, של הטיול — ומקבל ערכת
              לבנים להרכיב אותה בעצמו. ערב אחד סביב השולחן, ואז על הקיר בבית.
              <br className="hidden sm:block" />
              אתם מנהלים הכול מלוח בקרה אחד, בלי לרדוף אחרי אף אחד בוואטסאפ.
            </p>

            <div className="flex flex-wrap justify-center gap-3.5 md:justify-start">
              <a href="#calculator" className="btn btn-primary min-h-[60px] px-8 text-lg">
                למחשבון המחיר
              </a>
              <a href="#preview" className="btn btn-ghost min-h-[60px] px-7 text-lg">
                נסו על תמונה שלכם
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-foreground/60 md:justify-start">
              {[
                ["#2e7d32", "מחיר סופי במחשבון"],
                ["#1d4ed8", "קישור אישי לכל עובד"],
                ["#f3bf2f", "חשבונית מס כדין"],
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

          {/* Manager dashboard mock */}
          <div className="relative flex justify-center">
            <div
              className="w-full max-w-[420px] rounded-[20px] bg-surface p-5"
              style={{
                border: "1px solid var(--color-outline)",
                boxShadow:
                  "0 8px 0 0 #e7ebee, 0 34px 46px -28px rgba(25,28,30,0.5)",
                rotate: "1.4deg",
              }}
            >
              <div className="flex items-center justify-between border-b border-outline pb-3">
                <span className="font-heading font-bold">מתנת ראש השנה 2026</span>
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-foreground/60">
                  24 עובדים
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                {HERO_ROWS.map(([name, status, fg, bg]) => (
                  <div
                    key={name}
                    className="flex items-center gap-3 rounded-xl bg-surface-muted p-2.5"
                  >
                    <span
                      className="h-9 w-9 shrink-0 rounded-[6px]"
                      style={{
                        background:
                          "linear-gradient(135deg, #b7102a 0 25%, #f3bf2f 25% 50%, #1d4ed8 50% 75%, #36aebf 75%)",
                        boxShadow:
                          "inset 0 2px 2px rgba(255,255,255,0.4), inset 0 -3px 4px rgba(0,0,0,0.25)",
                      }}
                    />
                    <span className="flex-1 text-sm font-medium">{name}</span>
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ background: bg, color: fg }}
                    >
                      {status}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3.5 flex items-center justify-between rounded-xl border border-dashed border-outline p-3 text-xs text-foreground/60">
                <span>18 מתוך 24 העלו תמונה</span>
                <span className="font-heading font-bold text-secondary">
                  שליחת הזמנה חוזרת
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- The problem */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="mb-10 flex flex-col items-center gap-2.5 text-center">
          <h2 className="font-heading font-black tracking-[-0.03em] text-[clamp(26px,3.6vw,38px)]">
            תקציב מתנות זה קל. מתנה שזוכרים — פחות
          </h2>
          <p className="max-w-[36em] text-lg leading-7 text-foreground/60">
            עובד שוכח מה קיבל בשנה שעברה. הוא לא שוכח מתנה שהוא בנה בעצמו, מתמונה
            שהוא בחר.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {PROBLEM.map((p) => (
            <div
              key={p.bad}
              className="flex flex-col gap-3 rounded-[18px] bg-surface p-6"
              style={{
                border: "1px solid var(--color-outline)",
                boxShadow: "0 6px 0 0 #eceff2, 0 20px 28px -22px rgba(25,28,30,0.5)",
              }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: "#eaf0ff", color: "#1d4ed8" }}
              >
                <span className="mi text-[26px]">{p.icon}</span>
              </span>
              <p className="text-sm leading-relaxed text-foreground/50 line-through decoration-primary/40">
                {p.bad}
              </p>
              <p className="font-heading text-[17px] font-bold leading-snug">
                {p.good}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- How it works */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="mb-14 flex flex-col items-center gap-2.5 text-center">
          <h2 className="font-heading font-black tracking-[-0.03em] text-[clamp(28px,4vw,42px)]">
            ארבעה שלבים, שעה של עבודה
          </h2>
          <p className="max-w-[34em] text-lg leading-7 text-foreground/60">
            מרגע שסגרתם את המחשבון ועד שהקופסאות מגיעות — כמעט הכול קורה מעצמו.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
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

      {/* --------------------------------------------------- What you get */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="mb-10 flex flex-col items-center gap-2.5 text-center">
          <h2 className="font-heading font-black tracking-[-0.03em] text-[clamp(26px,3.6vw,38px)]">
            מה יש בקופסה, ומה יש לכם במסך
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              title: "מה העובד מקבל",
              items: EMPLOYEE_GETS,
              accent: "#b7102a",
              bg: "#fdeef1",
              icon: "redeem",
            },
            {
              title: "מה אתם מקבלים",
              items: MANAGER_GETS,
              accent: "#1d4ed8",
              bg: "#eaf0ff",
              icon: "dashboard",
            },
          ].map((col) => (
            <div
              key={col.title}
              className="flex flex-col gap-4 rounded-[22px] bg-surface p-8"
              style={{
                border: `3px solid ${col.accent}`,
                boxShadow: `0 8px 0 0 ${col.accent}22, 0 28px 38px -26px ${col.accent}88`,
              }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: col.bg, color: col.accent }}
              >
                <span className="mi text-[26px]">{col.icon}</span>
              </span>
              <h3 className="font-heading text-[22px] font-black">{col.title}</h3>
              <ul className="flex flex-col gap-3">
                {col.items.map((it) => (
                  <li key={it} className="flex items-start gap-2.5">
                    <span
                      className="mt-1 inline-block h-3.5 w-3.5 shrink-0 rounded-[3px]"
                      style={{
                        background: col.accent,
                        boxShadow:
                          "inset 0 2px 2px rgba(255,255,255,0.4), inset 0 -2px 3px rgba(0,0,0,0.3)",
                      }}
                    />
                    <span className="text-[15px] leading-relaxed text-foreground/75">
                      {it}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Calculator + live engine preview (shared size state) */}
      <B2bExperience samples={samples} />

      {/* ------------------------------------------------------ Volume tiers */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <div className="mb-10 flex flex-col items-center gap-2.5 text-center">
          <h2 className="font-heading font-black tracking-[-0.03em] text-[clamp(26px,3.6vw,38px)]">
            ההנחה לא סוד
          </h2>
          <p className="max-w-[36em] text-lg leading-7 text-foreground/60">
            אותה ערכה שנמכרת ללקוח פרטי, במחיר שיורד ככל שהצוות גדול. אין דמי
            פתיחה, אין דמי הקמה, ואין מינימום הזמנה.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...VOLUME_TIERS]
            .slice()
            .reverse()
            .map(([min, disc], i, arr) => {
              const next = arr[i + 1];
              const label = next ? `${min}–${next[0] - 1}` : `${min}+`;
              const example = computePrice(
                2 * PLATE_STUDS,
                2 * PLATE_STUDS,
                "physical",
              ).total;
              const per = Math.round((example * (1 - disc)) / 5) * 5;
              return (
                <div
                  key={min}
                  className="flex flex-col items-center gap-1.5 rounded-[18px] bg-surface p-6 text-center"
                  style={{
                    border: disc > 0 ? "1px solid var(--color-outline)" : "1px solid var(--color-outline)",
                    boxShadow: "0 6px 0 0 #eceff2, 0 20px 28px -22px rgba(25,28,30,0.5)",
                  }}
                >
                  <span className="font-heading text-sm font-bold text-foreground/60">
                    ⁦{label}⁩ עובדים
                  </span>
                  <span
                    className="font-heading text-3xl font-black"
                    style={{ color: disc > 0 ? "#2e7d32" : "#191c1e" }}
                  >
                    {disc > 0 ? `${Math.round(disc * 100)}%-` : "מחיר בסיס"}
                  </span>
                  <span className="text-xs text-foreground/60">
                    {formatILS(per)} לערכה של {pair(2, 2)} לוחות
                  </span>
                </div>
              );
            })}
        </div>
        <p className="mt-6 text-center text-sm text-foreground/60">
          המחירים לדוגמה הם לגודל {pair(PLATE_CM * 2, PLATE_CM * 2)} ס״מ. גדלים
          אחרים מתומחרים באותה שיטה — בדקו במחשבון.
        </p>
      </section>

      {/* -------------------------------------------------------- Occasions */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <h2 className="mb-10 text-center font-heading font-black tracking-[-0.03em] text-[clamp(26px,3.4vw,36px)]">
          לא רק לחגים
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

      {/* --------------------------------------------------------- Planning */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <div
          className="rounded-[24px] bg-surface p-8 sm:p-10"
          style={{
            border: "1px solid var(--color-outline)",
            boxShadow: "0 8px 0 0 #eceff2, 0 24px 34px -26px rgba(25,28,30,0.5)",
          }}
        >
          <h2 className="text-center font-heading font-black tracking-[-0.03em] text-[clamp(24px,3.2vw,32px)]">
            מתכננים אחורה מהתאריך
          </h2>
          <p className="mx-auto mt-2.5 max-w-[36em] text-center leading-7 text-foreground/60">
            החלק שלוקח הכי הרבה זמן הוא איסוף התמונות — לא הייצור. כדאי להתחיל
            מוקדם, ולא לפתוח את הפרויקט בשבוע של האירוע.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {PLANNING.map(([icon, title, body]) => (
              <div key={title} className="flex flex-col items-center gap-2 text-center">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: "#f2f4f6", color: "#191c1e" }}
                >
                  <span className="mi text-[26px]">{icon}</span>
                </span>
                <h3 className="font-heading font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-foreground/60">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- FAQ */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-24">
        <h2 className="mb-6 text-center font-heading font-black tracking-[-0.03em] text-[clamp(26px,3.4vw,36px)]">
          שאלות ששואלים אותנו
        </h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((f) => (
            <details key={f.q} className="card p-5">
              <summary className="cursor-pointer font-heading font-bold">
                {f.q}
              </summary>
              <p className="mt-2 leading-relaxed text-foreground/70">{f.a}</p>
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
          <h2 className="font-heading font-black tracking-[-0.03em] text-white text-[clamp(26px,3.6vw,42px)]">
            תנו להם משהו שהם יבנו בעצמם
          </h2>
          <p className="max-w-[34em] text-lg leading-7 text-white/65">
            מחשבון שקוף, בלי שיחת מכירה. תוך שתי דקות תדעו כמה זה עולה לצוות
            שלכם — ואם צריך משהו מותאם, נחזור אליכם תוך יום עסקים.
          </p>
          <div className="flex flex-wrap justify-center gap-3.5">
            <a href="#calculator" className="btn btn-primary min-h-[60px] px-9 text-lg">
              לחישוב המחיר
            </a>
            <Link href="/create" className="btn btn-ghost min-h-[60px] px-7 text-lg">
              לנסות על תמונה אחת
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

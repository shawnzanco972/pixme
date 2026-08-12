"use client";

/**
 * Packaging sourcing guide for Galit (Shawn's mum + business partner), who does
 * the physical sourcing in Israel. Lives at /playbook/galit, noindex.
 *
 * Design intent, do not "simplify" away:
 *  - ONE item open at a time (accordion). She is comparing quotes on a phone,
 *    standing in a supplier's yard. A long scrolling wall of specs is useless.
 *  - Every section ends with Hebrew copy she can paste into WhatsApp/email.
 *  - Numbers split into MEASURED (ours, trustworthy) vs ESTIMATE (labelled
 *    `הערכה` everywhere). Never blur the two — she quotes these to suppliers.
 */

import { useState } from "react";

/* ------------------------------------------------------------------ data */

/** Per-size kit contents. Weights in grams, MEASURED/derived — not guesses.
 *  bricks = cells x 0.1701 g (supplier pack tiers: 500 g = 2,940 pcs).
 *  board  = 2 mm wrapped greyboard at 1.5 kg/m^2. */
const SIZES = [
  { id: "2x2", label: "2×2", cm: "38×38", cells: 2304, plates: 4, bricks: 392, bpG: 220, board: 221, total: 1.13, box: "A" },
  { id: "2x3", label: "2×3", cm: "38×58", cells: 3456, plates: 6, bricks: 588, bpG: 330, board: 332, total: 1.55, box: "A" },
  { id: "3x3", label: "3×3", cm: "58×58", cells: 5184, plates: 9, bricks: 882, bpG: 495, board: 498, total: 2.17, box: "A" },
  { id: "3x4", label: "3×4", cm: "58×77", cells: 6912, plates: 12, bricks: 1176, bpG: 660, board: 664, total: 2.92, box: "B" },
  { id: "4x5", label: "4×5", cm: "77×96", cells: 11520, plates: 20, bricks: 1959, bpG: 1100, board: 1106, total: 4.59, box: "B" },
  { id: "5x5", label: "5×5", cm: "96×96", cells: 14400, plates: 25, bricks: 2449, bpG: 1375, board: 1382, total: 5.63, box: "B" },
] as const;

type Item = {
  id: string;
  n: number;
  title: string;
  urgency: "now" | "soon" | "later";
  oneLiner: string;
  spec: [string, string][];
  terms: string[];
  search: string[];
  estimate: string;
  ask: string[];
  message: string;
};

const ITEMS: Item[] = [
  {
    id: "box-a",
    n: 1,
    title: "קופסה A — הקופסה הראשית",
    urgency: "now",
    oneLiner:
      "זו הקופסה היחידה שאנחנו באמת צריכים כרגע. היא מתאימה לשלושת הגדלים שאיתם נצא לשוק.",
    spec: [
      ["מידות פנים", "310 × 310 × 70 מ״מ"],
      ["סוג קרטון", "קרטון גלי חד-גלי (גל B או גל E)"],
      ["סוג קופסה", "קופסת מיילר / קופסה נפתחת עם מכסה מתקפל (FEFCO 0427)"],
      ["הדפסה", "לא חובה בהתחלה — קרטון חום נקי + מדבקה זה מספיק"],
      ["משקל תכולה", "1.1 עד 2.2 ק״ג"],
      ["כמות ראשונה", "100–250 יחידות"],
    ],
    terms: ["קרטון גלי", "חד-גלי", "גל B", "קופסת מיילר", "FEFCO 0427", "סכין חיתוך"],
    search: [
      "יצרן קופסאות קרטון גלי",
      "אריזות קרטון לפי מידה",
      "קופסת מיילר קרטון הזמנה",
      "בית דפוס אריזות קרטון",
    ],
    estimate: "₪3.5–7 לקופסה בכמות של 250. בנוסף ייתכן תשלום חד-פעמי על סכין חיתוך.",
    ask: [
      "מה המחיר ל-100 / 250 / 500 יחידות?",
      "יש עלות חד-פעמית לסכין חיתוך? כמה, והאם היא נשארת אצלכם לפעם הבאה?",
      "כמה זמן אספקה מרגע הזמנה?",
      "אפשר לקבל דוגמה אחת לפני שמזמינים? כמה זה עולה?",
      "יש לכם קופסה במלאי במידה קרובה? זה יחסוך לנו את הסכין.",
    ],
    message:
      "שלום, אני מחפשת ספק לקופסאות קרטון למוצר שאנחנו משווקים.\n\n" +
      "מה שאני צריכה:\n" +
      "• קופסת קרטון גלי חד-גלי (גל B או E)\n" +
      "• מידות פנים: 310 × 310 × 70 מ״מ\n" +
      "• קופסה נפתחת עם מכסה מתקפל (סגנון מיילר, FEFCO 0427)\n" +
      "• ללא הדפסה בשלב זה — קרטון חום, נסגור מיתוג בהמשך\n" +
      "• התכולה שוקלת בין 1.1 ל-2.2 ק״ג\n\n" +
      "אשמח להצעת מחיר ל-100, 250 ו-500 יחידות, וכן:\n" +
      "1. האם יש עלות חד-פעמית לסכין חיתוך, וכמה\n" +
      "2. זמן אספקה\n" +
      "3. עלות דוגמה אחת לפני הזמנה\n" +
      "4. האם יש לכם קופסה קיימת במלאי במידה דומה\n\n" +
      "תודה רבה!",
  },
  {
    id: "bags",
    n: 2,
    title: "שקיות לחלקים",
    urgency: "now",
    oneLiner:
      "כל צבע נשקל ונארז בשקית נפרדת. יש 30 צבעים, אז בכל ערכה יש עד 30 שקיות קטנות.",
    spec: [
      ["סוג", "שקית זיפ־לוק שקופה (שקית סגירה חוזרת)"],
      ["מידה", "8 × 12 ס״מ, ו-10 × 15 ס״מ לצבעים הגדולים"],
      ["עובי", "50–70 מיקרון — דק מדי נקרע בשקילה"],
      ["כמות", "3,000–5,000 יחידות מכל מידה"],
      ["חשוב", "שקוף לגמרי, כדי שרואים את הצבע בלי לפתוח"],
    ],
    terms: ["שקית זיפ", "שקית סגירה חוזרת", "זיפלוק", "מיקרון", "פוליאתילן"],
    search: ["שקיות זיפ לוק סיטונאי", "שקיות אריזה שקופות סיטונאות", "ספק שקיות ניילון זיפ"],
    estimate: "₪0.10–0.30 לשקית. סביב ₪400–1,200 לכל המלאי הראשוני.",
    ask: [
      "מה המחיר לאלף יחידות בכל מידה?",
      "מה העובי במיקרון?",
      "יש מינימום הזמנה?",
    ],
    message:
      "שלום, אני מחפשת שקיות זיפ־לוק שקופות לאריזת חלקים קטנים.\n\n" +
      "• מידה 8 × 12 ס״מ — כ-3,000 יחידות\n" +
      "• מידה 10 × 15 ס״מ — כ-2,000 יחידות\n" +
      "• עובי 50–70 מיקרון, שקוף לחלוטין\n\n" +
      "אשמח למחיר לאלף יחידות בכל מידה, ומה המינימום להזמנה. תודה!",
  },
  {
    id: "padding",
    n: 3,
    title: "ריפוד ומילוי",
    urgency: "now",
    oneLiner:
      "התכולה כבדה יחסית ולא ממלאת את הקופסה עד הסוף, אז צריך משהו שימנע ממנה לזוז במשלוח.",
    spec: [
      ["אפשרות א׳", "ניילון בועות (״פצפצים״) בגליל, רוחב 50 ס״מ"],
      ["אפשרות ב׳", "נייר קראפט מקומט — יותר ידידותי לסביבה ונראה יקר יותר"],
      ["אפשרות ג׳", "יריעת פוליאתילן מוקצף דקה 1–2 מ״מ"],
      ["המלצה", "נייר קראפט — מתאים למראה של המותג ונוח יותר לאחסון בבית"],
    ],
    terms: ["ניילון בועות", "נייר קראפט", "פוליאתילן מוקצף", "חומרי מילוי לאריזה"],
    search: ["גליל ניילון בועות", "נייר קראפט לאריזה גליל", "חומרי אריזה סיטונאי"],
    estimate: "₪50–150 לגליל. גליל אחד מספיק להרבה עשרות ערכות.",
    ask: ["מה רוחב ואורך הגליל?", "כמה גלילים כדאי להזמין ביחד כדי לחסוך במשלוח?"],
    message:
      "שלום, אני צריכה חומרי ריפוד לאריזת מוצר בקופסאות קרטון.\n\n" +
      "מתעניינת בגליל נייר קראפט לאריזה, וגם בגליל ניילון בועות, ברוחב של כ-50 ס״מ.\n\n" +
      "אשמח למחיר לגליל, לאורך הגליל, ולמינימום הזמנה. תודה!",
  },
  {
    id: "labels",
    n: 4,
    title: "מדבקות ומיתוג",
    urgency: "soon",
    oneLiner:
      "במקום להדפיס על הקרטון (יקר ודורש כמות גדולה), מדביקים מדבקה על קופסה חומה נקייה. נראה טוב ועולה הרבה פחות.",
    spec: [
      ["מדבקת מותג", "עגולה 6–8 ס״מ, מבריק או מט"],
      ["מדבקת כתובת", "10 × 7 ס״מ, לבנה, שאפשר להדפיס עליה במדפסת ביתית"],
      ["מדבקת סגירה", "אופציונלי — מדבקה צרה שסוגרת את המכסה"],
      ["כמות", "500–1,000 מכל סוג"],
    ],
    terms: ["מדבקות מודפסות", "גליל מדבקות", "מדבקות בהדפסה דיגיטלית", "למינציה מט"],
    search: ["הדפסת מדבקות בהזמנה", "מדבקות מותג לעסק", "דפוס דיגיטלי מדבקות"],
    estimate: "₪0.30–1.00 למדבקה בכמות של 1,000.",
    ask: ["מה המחיר ל-500 ול-1,000?", "מט או מבריק — מה ההבדל במחיר?", "אפשר בגליל ולא בגיליון?"],
    message:
      "שלום, אני מעוניינת בהדפסת מדבקות למיתוג אריזה.\n\n" +
      "• מדבקה עגולה בקוטר 7 ס״מ, בצבע מלא — כ-1,000 יחידות\n" +
      "• מדבקה לבנה 10 × 7 ס״מ להדפסת כתובת — כ-500 יחידות\n\n" +
      "אשמח למחיר, לאפשרות של גימור מט, ולזמן אספקה. תודה!",
  },
  {
    id: "box-b",
    n: 5,
    title: "קופסה B — לגדלים הגדולים",
    urgency: "later",
    oneLiner:
      "אל תחפשי את זה עכשיו. הגדלים הגדולים לא יוצאים לשוק בהתחלה. זה כאן רק כדי שתדעי שזה קיים.",
    spec: [
      ["מידות פנים", "340 × 340 × 110 מ״מ"],
      ["סוג קרטון", "קרטון גלי דו-גלי (גל כפול) — התכולה כבדה"],
      ["משקל תכולה", "2.9 עד 5.6 ק״ג"],
    ],
    terms: ["דו-גלי", "גל כפול", "קרטון מוגבר"],
    search: ["קופסאות קרטון דו גלי", "אריזות כבדות קרטון"],
    estimate: "₪7–14 לקופסה. יקר יותר, ולכן גם עוד סיבה להתחיל מהגדלים הקטנים.",
    ask: ["האם דו-גלי מחזיק 6 ק״ג בלי להתעוות?"],
    message:
      "שלום, אשמח להצעת מחיר לקופסת קרטון גלי דו-גלי,\n" +
      "מידות פנים 340 × 340 × 110 מ״מ, לתכולה של עד 6 ק״ג.\n" +
      "כמות: 100 יחידות. תודה!",
  },
];

const GLOSSARY: [string, string][] = [
  ["קרטון גלי", "הקרטון עם הגל הפנימי. זה מה שאנחנו צריכים — לא קרטון חלק."],
  ["חד-גלי", "שכבת גל אחת. מספיק לקופסה A."],
  ["דו-גלי / גל כפול", "שתי שכבות גל. חזק יותר, יקר יותר. רק לקופסה B."],
  ["גל B / גל E", "עובי הגל. E דק ויפה יותר, B חזק יותר. שניהם בסדר."],
  ["FEFCO", "תקן בינלאומי למספור סוגי קופסאות. 0201 = קופסה רגילה עם ארבעה כנפיים. 0427 = קופסת מיילר נפתחת."],
  ["סכין חיתוך", "התבנית שחותכת את הקרטון בצורה שלנו. תשלום חד-פעמי, ואז היא שלנו לפעמים הבאות. תמיד לשאול כמה."],
  ["מינימום הזמנה / MOQ", "הכמות הקטנה ביותר שהם מוכנים לייצר."],
  ["משקל נפחי", "חברות המשלוחים מחשבות אורך × רוחב × גובה ÷ 5000. אם זה יוצא יותר מהמשקל האמיתי, משלמים לפי זה."],
  ["פלקסו", "הדפסה זולה ישירות על הקרטון, אבל דורשת כמות גדולה. בהתחלה עדיף מדבקה."],
];

/* ------------------------------------------------------------- component */

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-primary w-full sm:w-auto"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
    >
      <span className="mi ms-1 text-[18px]">{done ? "check" : "content_copy"}</span>
      {done ? "הועתק!" : "העתקת ההודעה"}
    </button>
  );
}

const URGENCY: Record<Item["urgency"], { label: string; cls: string }> = {
  now: { label: "לחפש עכשיו", cls: "bg-primary text-on-primary" },
  soon: { label: "בקרוב", cls: "bg-secondary text-on-secondary" },
  later: { label: "לא דחוף", cls: "bg-surface-muted text-foreground/60" },
};

export function PackagingGuide() {
  const [open, setOpen] = useState<string | null>("box-a");
  const [size, setSize] = useState<(typeof SIZES)[number]["id"]>("3x3");
  const [glossary, setGlossary] = useState(false);

  const s = SIZES.find((x) => x.id === size)!;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-primary">Pixipic · מדריך פנימי</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">אריזה — מה אנחנו מחפשים</h1>
        <p className="mt-2 text-foreground/70">
          לגלית. כל מה שצריך כדי לקבל הצעות מחיר מספקים בארץ — מידות מדויקות, המילים
          המקצועיות, ומה להגיד להם.
        </p>
      </header>

      {/* ---------------------------------------------- the brief, up top */}
      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-xl font-bold">הדברים החשובים</h2>
        <ul className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="mi mt-0.5 text-primary">inventory_2</span>
            <span>
              <b>מה נכנס פנימה:</b> שקיות עם חלקים קטנים (עד 30 צבעים), משטחי בנייה
              שטוחים, לוח גב מתקפל, חוברת הוראות, וכלי קטן להפרדת חלקים.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mi mt-0.5 text-primary">scale</span>
            <span>
              <b>משקל:</b> בין 1.1 ל-2.2 ק״ג לערכה בגדלים שאיתם נצא לשוק. זה כבד יחסית
              לגודל — הקרטון צריך להיות אמיתי, לא דק.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mi mt-0.5 text-primary">payments</span>
            <span>
              <b>תקציב:</b> אנחנו רוצים להישאר מתחת ל-<b>₪12 לערכה</b> על כל האריזה יחד
              (קופסה + שקיות + ריפוד + מדבקות).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mi mt-0.5 text-primary">palette</span>
            <span>
              <b>מראה:</b> קרטון חום נקי עם מדבקה יפה. <b>לא</b> להזמין הדפסה על הקרטון
              בשלב הזה — זה מייקר מאוד ודורש כמויות גדולות.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mi mt-0.5 text-primary">local_shipping</span>
            <span>
              <b>מגבלת משלוח:</b> הקופסה שלנו קטנה מספיק כדי להיכנס לכל שירות משלוחים
              רגיל ולנקודות איסוף. <b>לא לגדול מעבר לזה</b> — ראי את ההסבר למטה.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mi mt-0.5 text-primary">shopping_cart</span>
            <span>
              <b>כמה להזמין:</b> 100–250 קופסאות בהזמנה הראשונה. לא יותר — עוד לא יודעים
              איזה גודל יימכר הכי הרבה.
            </span>
          </li>
        </ul>
      </section>

      {/* ------------------------------------------------- size ↔ contents */}
      <section className="card mb-6 p-5">
        <h2 className="text-xl font-bold">מה נכנס לקופסה, לפי גודל</h2>
        <p className="mt-1 mb-4 text-sm text-foreground/70">
          בחרי גודל כדי לראות בדיוק מה נכנס וכמה זה שוקל.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {SIZES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSize(x.id)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                size === x.id
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline bg-surface hover:bg-surface-muted"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-surface-muted p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <span className="text-lg font-bold">
              פסיפס {s.label} — {s.cm} ס״מ
            </span>
            <span
              className={`rounded-md px-2 py-1 text-xs font-bold ${
                s.box === "A"
                  ? "bg-primary text-on-primary"
                  : "bg-surface text-foreground/60"
              }`}
            >
              קופסה {s.box}
            </span>
          </div>
          <dl className="space-y-1.5 text-sm">
            {[
              ["חלקים קטנים", `${s.cells.toLocaleString("he-IL")} יח׳ · ${s.bricks} גרם`],
              ["משטחי בנייה", `${s.plates} יח׳ · ${s.bpG} גרם`],
              ["לוח גב מתקפל", `${s.board} גרם`],
              ["קופסה + חוברת + כלי", `${s.box === "A" ? 300 : 420} גרם`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-foreground/60">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-outline pt-2 text-base">
              <dt className="font-bold">משקל כולל למשלוח</dt>
              <dd className="font-bold text-primary">{s.total.toFixed(2)} ק״ג</dd>
            </div>
          </dl>
          {s.box === "B" && (
            <p className="mt-3 rounded-lg bg-surface p-3 text-xs text-foreground/70">
              הגודל הזה לא יוצא לשוק בהתחלה. הוא כאן רק כדי שנדע לאן זה הולך בהמשך.
            </p>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------- items list */}
      <h2 className="mb-3 px-1 text-xl font-bold">מה לחפש — פריט אחד בכל פעם</h2>
      <div className="space-y-3">
        {ITEMS.map((it) => {
          const isOpen = open === it.id;
          const u = URGENCY[it.urgency];
          return (
            <div key={it.id} className="card overflow-hidden p-0">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : it.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 p-4 text-start"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-sm font-bold">
                  {it.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{it.title}</span>
                  <span
                    className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-bold ${u.cls}`}
                  >
                    {u.label}
                  </span>
                </span>
                <span className={`mi shrink-0 transition ${isOpen ? "rotate-180" : ""}`}>
                  expand_more
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-outline p-4 pt-4">
                  <p className="mb-4 text-sm text-foreground/80">{it.oneLiner}</p>

                  <h3 className="mb-2 text-sm font-bold">המפרט המדויק</h3>
                  <dl className="mb-4 space-y-1.5 rounded-lg bg-surface-muted p-3 text-sm">
                    {it.spec.map(([k, v]) => (
                      <div key={k} className="flex flex-wrap justify-between gap-x-3">
                        <dt className="text-foreground/60">{k}</dt>
                        <dd className="font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <h3 className="mb-2 text-sm font-bold">מה לחפש בגוגל</h3>
                  <ul className="mb-4 space-y-1.5">
                    {it.search.map((q) => (
                      <li key={q}>
                        <a
                          className="flex items-center gap-2 rounded-lg border border-outline bg-surface px-3 py-2 text-sm hover:bg-surface-muted"
                          href={`https://www.google.com/search?q=${encodeURIComponent(q)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="mi text-[18px] text-foreground/50">search</span>
                          <span className="flex-1">{q}</span>
                        </a>
                      </li>
                    ))}
                  </ul>

                  <h3 className="mb-2 text-sm font-bold">מילים שכדאי להגיד</h3>
                  <p className="mb-4 flex flex-wrap gap-1.5">
                    {it.terms.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-secondary/10 px-2 py-1 text-xs font-medium text-secondary"
                      >
                        {t}
                      </span>
                    ))}
                  </p>

                  <h3 className="mb-2 text-sm font-bold">כמה זה אמור לעלות</h3>
                  <p className="mb-4 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
                    <b>הערכה בלבד</b> — לא מחיר אמיתי, רק כדי לדעת אם הצעה נשמעת הגיונית.
                    <br />
                    {it.estimate}
                  </p>

                  <h3 className="mb-2 text-sm font-bold">מה לשאול אותם</h3>
                  <ul className="mb-4 space-y-1.5 text-sm">
                    {it.ask.map((q) => (
                      <li key={q} className="flex gap-2">
                        <span className="mi mt-0.5 text-[18px] text-primary">help</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>

                  <h3 className="mb-2 text-sm font-bold">ההודעה לשלוח</h3>
                  <pre className="mb-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface-muted p-3 text-start text-sm leading-relaxed">
                    {it.message}
                  </pre>
                  <CopyButton text={it.message} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---------------------------------------------------- shipping box */}
      <section className="card mt-6 border-primary/30 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          <span className="mi text-primary">local_shipping</span>
          למה אסור לקופסה לגדול
        </h2>
        <div className="space-y-3 text-sm">
          <p>
            חברות המשלוחים לא מחייבות רק לפי משקל. הן מחשבות גם{" "}
            <b>משקל נפחי</b>: אורך × רוחב × גובה ÷ 5000. מי שגבוה מבין השניים — הוא זה
            שמשלמים עליו.
          </p>
          <div className="rounded-lg bg-surface-muted p-3">
            <p className="font-bold">קופסה A · 31 × 31 × 7 ס״מ</p>
            <p className="mt-1 text-foreground/70">
              משקל נפחי 1.35 ק״ג · משקל אמיתי עד 2.2 ק״ג → משלמים על המשקל האמיתי. טוב.
            </p>
          </div>
          <div className="rounded-lg bg-surface-muted p-3">
            <p className="font-bold">קופסה B · 34 × 34 × 11 ס״מ</p>
            <p className="mt-1 text-foreground/70">
              משקל אמיתי עד 5.6 ק״ג — קופצים שתי מדרגות מחיר במחירון של כל שליח.
            </p>
          </div>
          <p>
            <b>המסקנה:</b> המוצר שלנו כבד ביחס לנפח, אז אנחנו משלמים לפי משקל אמיתי ולא
            לפי גודל. זה אומר שאין טעם ״לדחוס״ את הקופסה כדי לחסוך — עדיף קופסה שמגינה
            טוב. אבל <b>כן</b> חשוב לא לעבור את הגודל של נקודת איסוף או לוקר, כי זה
            שירות זול משמעותית.
          </p>
          <p className="rounded-lg border border-accent/40 bg-accent/10 p-3">
            <b>לבדוק מול חברת השליחויות לפני שסוגרים קופסה:</b> מה המידות המקסימליות
            לנקודת איסוף וללוקר, ומה מדרגות המחיר לפי משקל. לא הצלחתי למצוא את הנתונים
            האלה באופן אמין באינטרנט — צריך לשאול אותם ישירות.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- glossary */}
      <section className="card mt-6 p-0">
        <button
          type="button"
          onClick={() => setGlossary(!glossary)}
          aria-expanded={glossary}
          className="flex w-full items-center gap-3 p-5 text-start"
        >
          <span className="mi text-foreground/50">menu_book</span>
          <span className="flex-1 text-xl font-bold">מילון מונחים</span>
          <span className={`mi transition ${glossary ? "rotate-180" : ""}`}>expand_more</span>
        </button>
        {glossary && (
          <dl className="space-y-3 border-t border-outline p-5 text-sm">
            {GLOSSARY.map(([k, v]) => (
              <div key={k}>
                <dt className="font-bold">{k}</dt>
                <dd className="text-foreground/70">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-foreground/40">
        עמוד פנימי · לא מופיע בחיפוש · עודכן אוגוסט 2026
      </p>
    </main>
  );
}

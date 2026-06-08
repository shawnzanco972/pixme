import { B2bExperience } from "@/components/b2b/B2bExperience";
import {
  BRICKS_PER_PLATE,
  BUILD_MINUTES_PER_PLATE,
  PLATE_CM,
} from "@/lib/b2b-pricing";

export const metadata = {
  title: "מתנות לעובדים — Pixipic לעסקים",
  description:
    "מתנה אישית לכל עובד: ערכת פסיפס לבנים מתמונה שלו. מחשבון מחיר שקוף לפי כמות וגודל, וניהול פרויקט מלא עם קישור אישי לכל עובד.",
};

const STEPS: { title: string; body: string }[] = [
  {
    title: "בוחרים גודל וכמות",
    body: "המחשבון מציג מיד כמה זה עולה — כל עובד מקבל ערכה פיזית משלו.",
  },
  {
    title: "מוסיפים ניהול (אופציונלי)",
    body: "כל עובד מקבל קישור אישי להעלאת תמונה, ואתם עוקבים מלוח בקרה אחד.",
  },
  {
    title: "התמונות נכנסות לפרויקט",
    body: "עובדים מעלים תמונה אהובה, או שאתם מעלים בשבילם — גם כהפתעה.",
  },
  {
    title: "אנחנו מייצרים ושולחים",
    body: "כל ערכה מגיעה עם מדריך הרכבה ורשימת חלקים. אתם רואים מי כבר השלים.",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "האם כל עובד מקבל ערכה משלו?",
    a: "כן. זו לא מתנה דיגיטלית — כל עובד מקבל ערכת פסיפס לבנים פיזית משלו, עם מדריך הרכבה ורשימת חלקים. המחיר לכן מחושב לפי מספר העובדים והגודל שבחרתם.",
  },
  {
    q: `מה הגודל של פסיפס?`,
    a: `כל לוח בסיס הוא בערך ${PLATE_CM}×${PLATE_CM} ס״מ ומורכב מ-${BRICKS_PER_PLATE} לבנים. פסיפס בגודל 3×3 לוחות, למשל, הוא ~${PLATE_CM * 3}×${PLATE_CM * 3} ס״מ — תשעה לוחות, פעילות נחמדה למשפחה.`,
  },
  {
    q: "כמה זמן לוקח להרכיב?",
    a: `בערך ${BUILD_MINUTES_PER_PLATE} דקות ללוח. פסיפס של 9 לוחות הוא פרויקט של כמה שעות — מושלם לערב משפחתי.`,
  },
  {
    q: "האם זה זול יותר מהזמנה רגילה?",
    a: "המחיר לערכה זהה להזמנה רגילה — אנחנו לא מוזילים את המוצר הפיזי. הערך שאתם מקבלים ב-B2B הוא הניהול: קישור אישי לכל עובד ולוח בקרה שחוסך לכם שעות של מעקב.",
  },
  {
    q: "הפתעה או תמונה אישית?",
    a: "שתי האפשרויות פתוחות. אפשר לתת לכל עובד להעלות תמונה אהובה דרך הקישור האישי שלו, או שאתם מעלים את התמונות בעצמכם — גם כהפתעה.",
  },
  {
    q: "יש לי יותר מ-100 עובדים",
    a: "אין בעיה! עד 100 עובדים אפשר להזמין ישירות מהמחשבון. מעל זה — מלאו את הפרטים ונחזור אליכם עם הצעה אישית תוך יום עסקים.",
  },
];

export default function B2bPage() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-6 pt-14 pb-8 text-center">
        <span className="inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
          לעסקים וארגונים
        </span>
        <h1 className="mt-4 font-heading text-4xl font-bold sm:text-5xl">
          מתנה אישית שכל עובד יזכור
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
          כל עובד מקבל ערכת פסיפס לבנים משלו — מתמונה אישית או כהפתעה. אתם בוחרים
          כמות וגודל, רואים מחיר שקוף, ומנהלים הכול מלוח בקרה אחד עם קישור אישי
          לכל עובד.
        </p>
        <a href="#calculator" className="btn btn-primary mt-8 inline-flex">
          למחשבון המחיר
        </a>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-5xl px-6 py-10">
        <h2 className="text-center font-heading text-2xl font-bold">איך זה עובד</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card flex flex-col gap-2 p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/10 font-bold text-secondary">
                {i + 1}
              </span>
              <h3 className="font-heading font-bold">{s.title}</h3>
              <p className="text-sm text-zinc-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Calculator + live engine preview (shared size state) */}
      <B2bExperience />

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-6 py-12">
        <h2 className="text-center font-heading text-2xl font-bold">
          שאלות נפוצות
        </h2>
        <div className="mt-8 flex flex-col gap-3">
          {FAQS.map((f) => (
            <details key={f.q} className="card p-5">
              <summary className="cursor-pointer font-heading font-bold">
                {f.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

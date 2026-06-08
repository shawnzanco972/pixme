import Link from "next/link";

import { BundlePurchase } from "@/components/b2b/BundlePurchase";

export const metadata = {
  title: "פסיפסים לעסקים — Pixipic",
  description:
    "מתנה מיוחדת לעובדים: כל עובד הופך תמונה אישית לפסיפס לבנים. אתם רוכשים חבילה, מנהלים את הפרויקט וצופים בהתקדמות — אנחנו דואגים לכל השאר.",
};

const STEPS: { title: string; body: string }[] = [
  {
    title: "בוחרים חבילה",
    body: "בחרו את מספר העובדים וגודל הפסיפס. תשלום אחד, ללא הפתעות.",
  },
  {
    title: "מוסיפים את הצוות",
    body: "בלוח הניהול מוסיפים את שמות העובדים — כל אחד מקבל קישור אישי משלו.",
  },
  {
    title: "העובדים מעלים תמונה",
    body: "כל עובד מעלה תמונה אחת ורואה תצוגה מקדימה. הגודל כבר נקבע — בלי בלבול.",
  },
  {
    title: "עוקבים ומקבלים",
    body: "אתם רואים מי כבר שלח ומי עוד לא, ומקבלים את כל הערכות והמדריכים.",
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
          מתנה שכל עובד יזכור
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
          הפכו את התמונות של הצוות לפסיפסי לבנים אישיים. אתם רוכשים חבילה אחת,
          מנהלים את הפרויקט מלוח בקרה אחד, וצופים בזמן אמת מי כבר השלים ומי עוד
          לא — בלי גיליונות אקסל ובלי מעקב ידני.
        </p>
        <a href="#bundles" className="btn btn-primary mt-8 inline-flex">
          לחבילות והמחירים
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

      {/* Bundles + purchase */}
      <section id="bundles" className="mx-auto w-full max-w-5xl scroll-mt-6 px-6 py-12">
        <h2 className="text-center font-heading text-2xl font-bold">
          בחרו חבילה
        </h2>
        <p className="mt-2 text-center text-zinc-600">
          כל החבילות כוללות מדריך הרכבה, רשימת חלקים וניהול פרויקט מלא.
        </p>
        <div className="mt-8">
          <BundlePurchase />
        </div>
      </section>

      {/* Reassurance / contact */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-16 text-center text-sm text-zinc-500">
        צריכים יותר מ-50 עובדים או מידה מותאמת אישית?{" "}
        <Link href="/create" className="text-secondary underline">
          דברו איתנו
        </Link>{" "}
        ונתפור לכם הצעה.
      </section>
    </main>
  );
}

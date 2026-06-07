import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center">
        <span className="rounded-full bg-accent/20 px-4 py-1 font-heading text-sm font-medium text-foreground/80">
          🧱 פסיפס לבנים בעבודת יד — מהתמונה שלכם
        </span>
        <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          הפכו רגע אהוב
          <br />
          <span className="text-primary">לאומנות קיר מלבנים</span>
        </h1>
        <p className="max-w-xl text-lg leading-8 text-foreground/70">
          העלו תמונה, צפו בתצוגה מקדימה חיה של הפסיפס, והזמינו ערכה מלאה עם חוברת
          הוראות. הכול אוטומטי, מותאם אישית, ובעברית.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/create" className="btn btn-primary">
            התחילו ליצור
          </Link>
          <Link href="/b2b" className="btn btn-ghost">
            לעסקים ומתנות
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how"
        className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-20 sm:grid-cols-3"
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
    </main>
  );
}

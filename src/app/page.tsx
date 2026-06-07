export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
        Pixme — פסיפס מהתמונה שלך
      </h1>
      <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        העלו תמונה, צפו בתצוגה מקדימה של פסיפס הלבנים, והזמינו ערכה. הכול אוטומטי,
        מותאם אישית, ובעברית מלאה.
      </p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <a
          href="#"
          className="rounded-full bg-black px-8 py-3 text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          התחילו עכשיו
        </a>
        <a
          href="#"
          className="rounded-full border border-zinc-300 px-8 py-3 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          למידע נוסף
        </a>
      </div>
    </main>
  );
}

import { BrandLogo, BrandLogoHe } from "@/components/BrandLogo";
import { DownloadPng } from "@/components/playbook/DownloadPng";

/** Unlisted logo proof sheet — /playbook is disallowed in robots.ts. */
export const metadata = {
  title: "לוגו — גיליון בדיקה",
  robots: { index: false, follow: false, nocache: true },
};

function Row({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-outline py-6 last:border-b-0">
      <h2 className="font-bold">{label}</h2>
      {note && <p className="mb-3 mt-0.5 text-sm text-foreground/60">{note}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-6">{children}</div>
    </section>
  );
}

function Swatch({
  caption,
  bg = "bg-surface",
  ring = true,
  children,
}: {
  caption: string;
  bg?: string;
  ring?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-foreground/50">{caption}</span>
      <div
        className={`flex items-center justify-center rounded-lg p-4 ${bg} ${
          ring ? "border border-outline" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

const ASSETS: {
  name: string;
  label: string;
  use: string;
  dark?: boolean;
  el: React.ReactNode;
}[] = [
  {
    name: "pixipic-logo",
    label: "לוגו מלא",
    use: "ברירת מחדל — רקע בהיר או שקוף",
    el: <BrandLogo className="h-11 w-auto" />,
  },
  {
    name: "pixipic-logo-invert",
    label: "לוגו מלא — היפוך",
    use: "רקע כהה או אדום",
    dark: true,
    el: <BrandLogo className="h-11 w-auto" invert />,
  },
  {
    name: "pixipic-logo-warm-dark",
    label: "לוגו מלא — טורקיז/כתום/צהוב",
    use: "רקע כהה בלבד",
    dark: true,
    el: <BrandLogo className="h-11 w-auto" invert colorway="warm" />,
  },
  {
    name: "pixipic-logo-mono",
    label: "לוגו מלא — צבע אחד",
    use: "הטבעה, חותמת, פוילים, פקס",
    el: <BrandLogo className="h-11 w-auto text-foreground" mono />,
  },
  {
    name: "pixipic-logo-red",
    label: "לוגו מלא — אדום מלא",
    use: "גרסה חד-צבעית באדום המותג — רקע בהיר או שקוף",
    el: <BrandLogo className="h-11 w-auto text-primary" mono />,
  },
  {
    name: "pixipic-mark",
    label: "הסימן בלבד",
    use: "אייקון אפליקציה, אווטאר, פאביקון",
    el: <BrandLogo className="h-14 w-auto" variant="mark" />,
  },
  {
    name: "pixipic-logo-he",
    label: "לוגו עברית",
    use: "רקע בהיר או שקוף",
    el: <BrandLogoHe className="h-11 w-auto" />,
  },
  {
    name: "pixipic-logo-he-invert",
    label: "לוגו עברית — היפוך",
    use: "רקע כהה או אדום",
    dark: true,
    el: <BrandLogoHe className="h-11 w-auto" invert />,
  },
];

export default function LogoProofPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8" dir="rtl">
      <h1 className="text-3xl font-bold">לוגו — גיליון בדיקה</h1>
      <p className="mt-2 text-foreground/70">
        הלוגו החדש בכל הגדלים והרקעים שבהם הוא באמת מופיע. אם הוא עובד כאן, הוא
        יעבוד בכל מקום.
      </p>

      <Row label="הלוקאפ המלא" note="סימן + שם. לשימוש בכותרת, בפוטר ובדפוס.">
        <Swatch caption="גדול">
          <BrandLogo className="h-16 w-auto" />
        </Swatch>
        <Swatch caption="כותרת · 32px">
          <BrandLogo className="h-8 w-auto" />
        </Swatch>
        <Swatch caption="קטן · 20px">
          <BrandLogo className="h-5 w-auto" />
        </Swatch>
      </Row>

      <Row
        label="רקע שקוף, בהיר וכהה"
        note="שלוש הלבנים זהות בכל הרקעים — כולן עוברות ניגודיות 3:1 גם על לבן וגם על כהה. רק הכיתוב מתהפך."
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-foreground/50">שקוף</span>
          <div
            className="flex items-center justify-center rounded-lg border border-outline p-4"
            style={{
              backgroundImage:
                "linear-gradient(45deg,#e6e9ec 25%,transparent 25%),linear-gradient(-45deg,#e6e9ec 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e6e9ec 75%),linear-gradient(-45deg,transparent 75%,#e6e9ec 75%)",
              backgroundSize: "14px 14px",
              backgroundPosition: "0 0,0 7px,7px -7px,-7px 0",
            }}
          >
            <BrandLogo className="h-10 w-auto" />
          </div>
        </div>
        <Swatch caption="אדום מותג" bg="bg-primary" ring={false}>
          <BrandLogo className="h-10 w-auto" invert />
        </Swatch>
        <Swatch caption="כהה" bg="bg-foreground" ring={false}>
          <BrandLogo className="h-10 w-auto" invert />
        </Swatch>
        <Swatch caption="שחור מלא" bg="bg-black" ring={false}>
          <BrandLogo className="h-10 w-auto" invert />
        </Swatch>
      </Row>

      <Row
        label="צבע אחד"
        note="להטבעה על קופסה, חותמת, פוילים, ופקס מספק. הכול currentColor."
      >
        <Swatch caption="שחור">
          <BrandLogo className="h-10 w-auto text-foreground" mono />
        </Swatch>
        <Swatch caption="אדום">
          <BrandLogo className="h-10 w-auto text-primary" mono />
        </Swatch>
      </Row>

      <Row label="הסימן לבדו" note="אייקון אפליקציה, פאביקון, אווטאר ברשתות.">
        <Swatch caption="64px">
          <BrandLogo className="h-16 w-auto" variant="mark" />
        </Swatch>
        <Swatch caption="32px">
          <BrandLogo className="h-8 w-auto" variant="mark" />
        </Swatch>
        <Swatch caption="פאביקון · 16px">
          <BrandLogo className="h-4 w-auto" variant="mark" />
        </Swatch>
      </Row>

      <Row label="שם בלבד" note="כשהסימן כבר מופיע במקום אחר באותו מסך.">
        <Swatch caption="32px">
          <BrandLogo className="h-8 w-auto" variant="wordmark" />
        </Swatch>
      </Row>

      <Row
        label="עברית — פיקסיפיק"
        note="שלוש היו״דים הוחלפו בלבנים. בדיוק שלוש, בדיוק כמו שלוש ה-i באנגלית, וכל אחת באה אחרי פ / ס / פ."
      >
        <Swatch caption="גדול">
          <BrandLogoHe className="h-14 w-auto" />
        </Swatch>
        <Swatch caption="כותרת">
          <BrandLogoHe className="h-8 w-auto" />
        </Swatch>
        <Swatch caption="על אדום" bg="bg-primary" ring={false}>
          <BrandLogoHe className="h-10 w-auto" invert />
        </Swatch>
      </Row>

      <Row
        label="ערכת צבעים חלופית — טורקיז / כתום / צהוב"
        note="לרקע כהה בלבד. הצבעים האלה לא עוברים ניגודיות 3:1 על רקע בהיר — צהוב שכהה מספיק כדי לעבור כבר לא נראה צהוב."
      >
        <Swatch caption="כהה ✓" bg="bg-foreground" ring={false}>
          <BrandLogo className="h-10 w-auto" invert colorway="warm" />
        </Swatch>
        <Swatch caption="שחור ✓" bg="bg-black" ring={false}>
          <BrandLogo className="h-10 w-auto" invert colorway="warm" />
        </Swatch>
        <Swatch caption="עברית · כהה ✓" bg="bg-foreground" ring={false}>
          <BrandLogoHe className="h-10 w-auto" invert colorway="warm" />
        </Swatch>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-primary">
            על בהיר ✕ — לא לשימוש
          </span>
          <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-surface p-4 opacity-70">
            <BrandLogo className="h-10 w-auto" colorway="warm" />
          </div>
        </div>
      </Row>

      {/* Each entry carries `data-export`, which is how the SVG/PNG files in
          /public/brand are generated: a script reads the LIVE rendered markup
          from this page, so the exported files can never drift from the
          component. To add an asset, add it here and re-run the export. */}
      <section className="mt-10 border-t-2 border-outline pt-8">
        <h2 className="text-2xl font-bold">קבצים להורדה</h2>
        <p className="mt-1 text-sm text-foreground/60">
          קובצי ה-SVG נוצרים מהרינדור החי של האתר, כך שהם תמיד זהים ללוגו האמיתי.
          את קובצי ה-PNG הדפדפן מייצר בלחיצה, ברקע שקוף ובגודל שתבחרו.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {ASSETS.map((a) => (
            <div key={a.name} className="card p-4">
              <div
                data-export={a.name}
                className={`mb-3 flex min-h-[70px] items-center justify-center rounded-lg p-3 ${a.dark ? "bg-foreground" : "bg-surface-muted"}`}
              >
                {a.el}
              </div>
              <p className="text-sm font-bold">{a.label}</p>
              <p className="mb-2 text-xs text-foreground/55">{a.use}</p>
              <p className="flex flex-wrap items-center gap-3 text-sm">
                <a
                  className="rounded-md border border-outline px-2 py-1 text-xs font-medium hover:bg-surface-muted"
                  href={`/brand/${a.name}.svg`}
                  download
                >
                  SVG
                </a>
                <DownloadPng name={a.name} label={a.label} />
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs">
          <b>שימו לב:</b> ה-SVG מכיל את הטקסט כפונט חי (Rubik), ולכן במחשב שאין בו
          את הפונט הוא ייראה שונה. ל-PNG אין את הבעיה — הוא נוצר כאן בדפדפן, שבו
          הפונט כבר טעון. <b>לספק דפוס או לגורם חיצוני — שלחו PNG.</b>
        </p>
      </section>

      <p className="mt-8 text-center text-xs text-foreground/40">
        עמוד פנימי · לא מופיע בחיפוש
      </p>
    </main>
  );
}

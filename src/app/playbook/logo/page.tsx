import { BrandLogo, BrandLogoHe } from "@/components/BrandLogo";

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

      <Row label="עברית — פיקסיפיק" note="אותה רשת, אותה לבנה מוטה כאקצנט עליון.">
        <Swatch caption="גדול">
          <BrandLogoHe className="h-14 w-auto" />
        </Swatch>
        <Swatch caption="על אדום" bg="bg-primary" ring={false}>
          <BrandLogoHe className="h-10 w-auto" invert />
        </Swatch>
      </Row>

      <p className="mt-8 text-center text-xs text-foreground/40">
        עמוד פנימי · לא מופיע בחיפוש
      </p>
    </main>
  );
}

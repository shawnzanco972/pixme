/**
 * Transactional email (Resend REST API — no SDK dependency).
 *
 * Gracefully degrades: when RESEND_API_KEY / EMAIL_FROM aren't set, send*()
 * functions no-op and return `false` (mirroring the iCount "configured?" gate),
 * so the whole B2B flow keeps working in dev — links are still shown on-screen.
 *
 * All templates are Hebrew RTL. Keep them inline + minimal (no React Email) to
 * stay dependency-free and fast in serverless routes.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

/** Email is "configured" once an API key and a from-address are present. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send one email. Returns true if accepted by the provider, false if email
 * isn't configured or the send failed (never throws — callers treat email as
 * best-effort so it can't break provisioning/roster writes).
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Minimal RTL HTML shell shared by every template. */
function shell(bodyHtml: string): string {
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#f7f9fb;font-family:Arial,Helvetica,sans-serif;color:#191c1e">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px">
      <div style="font-size:22px;font-weight:bold;color:#b7102a;margin-bottom:16px">Pixipic</div>
      <div style="background:#fff;border:1px solid #e0e3e5;border-radius:16px;padding:24px;line-height:1.7">
        ${bodyHtml}
      </div>
      <p style="color:#8a9099;font-size:12px;margin-top:16px">פיקסיפיק — פסיפס הלבנים שלכם</p>
    </div>
  </body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#b7102a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:bold;margin-top:8px">${label}</a>`;
}

/** Send the project owner their private dashboard link after purchase. */
export async function sendOwnerWelcome(opts: {
  to: string;
  companyName: string;
  projectName: string | null;
  ownerToken: string;
}): Promise<boolean> {
  const url = `${siteUrl()}/b2b/project/${opts.ownerToken}`;
  const title = opts.projectName
    ? `הפרויקט "${opts.projectName}" מוכן`
    : "הפרויקט שלכם מוכן";
  return sendEmail({
    to: opts.to,
    subject: `${title} — לוח הבקרה שלכם ב-Pixipic`,
    html: shell(
      `<h1 style="font-size:20px;margin:0 0 8px">${title} 🎉</h1>
       <p>תודה על הרכישה! זהו לוח הבקרה הפרטי שלכם לניהול הפרויקט: הוסיפו את העובדים, שלחו להם קישורים אישיים ועקבו אחרי מי כבר השלים.</p>
       <p style="font-weight:bold">שמרו את הקישור — זו הכניסה היחידה לפרויקט.</p>
       <p>${button(url, "פתחו את לוח הבקרה")}</p>
       <p style="color:#8a9099;font-size:12px;direction:ltr;text-align:left">${url}</p>`,
    ),
  });
}

/** Confirm a B2C order to the customer once payment is verified. */
export async function sendOrderConfirmation(opts: {
  to: string;
  customerName: string;
  orderId: string;
}): Promise<boolean> {
  const url = `${siteUrl()}/order/${opts.orderId}`;
  return sendEmail({
    to: opts.to,
    subject: "ההזמנה שלכם ב-Pixipic התקבלה",
    html: shell(
      `<h1 style="font-size:20px;margin:0 0 8px">תודה ${opts.customerName}! 🎉</h1>
       <p>קיבלנו את ההזמנה והתשלום אושר. אפשר לעקוב אחרי הסטטוס ולהוריד את מדריך ההרכבה בעמוד ההזמנה:</p>
       <p>${button(url, "לעמוד ההזמנה")}</p>
       <p style="color:#8a9099;font-size:12px;direction:ltr;text-align:left">${url}</p>`,
    ),
  });
}

/**
 * Notify the Pixipic team of a large-order quote request. Sent to
 * B2B_QUOTE_EMAIL (falling back to EMAIL_FROM). Returns false if email isn't
 * configured — callers should still acknowledge the user but surface that we
 * may need a manual follow-up.
 */
export async function sendQuoteRequest(opts: {
  companyName: string;
  contactEmail: string;
  employees: number;
  size: string;
  managed: boolean;
  message?: string;
}): Promise<boolean> {
  const to = process.env.B2B_QUOTE_EMAIL || process.env.EMAIL_FROM;
  if (!to) return false;
  return sendEmail({
    to,
    subject: `בקשת הצעת מחיר B2B — ${opts.companyName} (${opts.employees} עובדים)`,
    html: shell(
      `<h1 style="font-size:20px;margin:0 0 8px">בקשת הצעת מחיר</h1>
       <p><b>חברה:</b> ${opts.companyName}<br/>
       <b>אימייל:</b> <span style="direction:ltr">${opts.contactEmail}</span><br/>
       <b>עובדים:</b> ${opts.employees}<br/>
       <b>גודל:</b> ${opts.size}<br/>
       <b>ניהול מלא:</b> ${opts.managed ? "כן" : "לא"}</p>
       ${opts.message ? `<p><b>הערות:</b><br/>${opts.message}</p>` : ""}`,
    ),
  });
}

/**
 * Daily low-stock digest to the operator. Sent to LOW_STOCK_EMAIL (falling back
 * to EMAIL_FROM). No-ops when email isn't configured or there are no alerts.
 */
export async function sendLowStockDigest(opts: {
  alerts: Array<{
    name: string;
    category: string;
    unit: string;
    available: number;
    threshold: number;
    shortfall: number;
  }>;
}): Promise<boolean> {
  const to = process.env.LOW_STOCK_EMAIL || process.env.EMAIL_FROM;
  if (!to || opts.alerts.length === 0) return false;

  const fmt = (n: number, unit: string) =>
    unit === "g" ? `${Math.round(n)} ג׳` : `${n} ${unit}`;
  const rows = opts.alerts
    .map(
      (a) =>
        `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${a.name}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${fmt(a.available, a.unit)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${fmt(a.threshold, a.unit)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#b7102a;font-weight:bold">${fmt(a.shortfall, a.unit)}</td>
        </tr>`,
    )
    .join("");

  return sendEmail({
    to,
    subject: `🔔 התראת מלאי — ${opts.alerts.length} פריטים מתחת לסף`,
    html: shell(
      `<h1 style="font-size:20px;margin:0 0 8px">התראת מלאי נמוך</h1>
       <p>${opts.alerts.length} פריטים ירדו מתחת לסף ההזמנה מחדש (כולל ביקוש מהזמנות ששולמו):</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px">
         <tr style="text-align:right;color:#51585d">
           <th style="padding:6px 8px;border-bottom:2px solid #e0e3e5">פריט</th>
           <th style="padding:6px 8px;border-bottom:2px solid #e0e3e5">זמין</th>
           <th style="padding:6px 8px;border-bottom:2px solid #e0e3e5">סף</th>
           <th style="padding:6px 8px;border-bottom:2px solid #e0e3e5">חוסר</th>
         </tr>
         ${rows}
       </table>
       <p>${button(`${siteUrl()}/admin/inventory`, "לניהול המלאי")}</p>`,
    ),
  });
}

/** Send an employee their personalized seat link to upload a photo. */
export async function sendSeatInvite(opts: {
  to: string;
  employeeName: string;
  projectLabel: string;
  inviteToken: string;
}): Promise<boolean> {
  const url = `${siteUrl()}/seat/${opts.inviteToken}`;
  return sendEmail({
    to: opts.to,
    subject: `${opts.projectLabel}: הפסיפס האישי שלכם מחכה`,
    html: shell(
      `<h1 style="font-size:20px;margin:0 0 8px">שלום ${opts.employeeName}!</h1>
       <p>במסגרת ${opts.projectLabel} מגיע לכם פסיפס לבנים אישי. כל מה שצריך זה להעלות תמונה אחת — אנחנו נדאג לשאר.</p>
       <p>${button(url, "להעלאת התמונה")}</p>
       <p style="color:#8a9099;font-size:12px;direction:ltr;text-align:left">${url}</p>`,
    ),
  });
}

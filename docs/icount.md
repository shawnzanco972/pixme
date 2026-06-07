# iCount Integration — Research & Architecture (Phase 1.3)

> Status: **research captured; exact field names to be confirmed in the iCount
> dashboard / authenticated developer portal.** The architecture below is
> designed to be correct *regardless* of whether iCount supports signed
> webhooks, so implementation is not blocked.

## What we could confirm publicly

- iCount exposes an **open HTTP API**; integrations authenticate with an
  **API key/token** generated per user. The token must be sent on every
  request or the call is rejected. (Source: iCount developer reference.)
- Detailed endpoint docs (payment page creation, callbacks, transaction
  lookup) live behind the **authenticated developer portal**
  (`sl.icount.co.il/developers`) and are partly in Hebrew. The public
  marketing pages do not document webhook signing or custom fields.

### Open questions to confirm in the dashboard
1. **Webhook payload signing** — does iCount sign callbacks (HMAC/shared
   secret / signature header)? → drives `ICOUNT_WEBHOOK_SECRET` usage.
2. **Custom pass-through fields** — can we attach our Supabase `order_id`
   (UUID) to a hosted-checkout session and get it back on the callback?
   (Common iCount field candidates: `custom`, `custom_client_data`, or the
   `cc`/`sale` doc's client/notes fields.)
3. **Transaction lookup endpoint** — exact endpoint + params to fetch a
   document/transaction status by id/invoice for server-side verification.

## Decision: trust-minimizing webhook (Option 2 fallback as the baseline)

We do **not** trust the webhook payload to provision anything. The webhook is
treated as a mere **event trigger**:

1. Webhook hits `POST /api/webhooks/icount`.
2. (If signing IS available) verify the HMAC signature with
   `ICOUNT_WEBHOOK_SECRET`; reject on mismatch.
3. Extract our `order_id` (pass-through field) and/or the iCount
   `invoice_id`/`doc_id` from the payload.
4. **Independently call the iCount API** (with `ICOUNT_API_TOKEN`) to fetch the
   authoritative transaction/document status.
5. Only if the API confirms the payment is **paid/closed** do we provision:
   - B2C → mark `b2c_orders.status = 'paid'`, attach `icount_invoice_id`,
     enable PDF generation.
   - B2B → mark `b2b_orders.status = 'paid'`, create a `b2b_workspaces` row
     with a secure UUID link, email it to the buyer.
6. Provisioning is **idempotent** (keyed on order id + invoice id) so duplicate
   webhooks never double-provision.

If iCount *does* support signed webhooks, step 2 becomes a hard gate and step 4
remains as defense-in-depth (cheap, authoritative).

## Money is server-authoritative

Clients create orders with `status = 'pending'` and a *client-proposed* price,
but the **amount actually paid** is taken from the iCount transaction during
provisioning — never trusted from the browser. RLS already blocks anon reads of
orders; the service-role key is used only inside the webhook/route handlers.

## Env vars (see `.env.example`)

- `ICOUNT_API_TOKEN` — secret API token for server-side calls (charge + lookup).
- `ICOUNT_WEBHOOK_SECRET` — optional; used to verify signed callbacks if
  supported.
- `ICOUNT_COMPANY_ID` / `ICOUNT_USER` / `ICOUNT_PASS` — **TBD**: iCount auth
  sometimes uses cid/user/pass to mint a session token instead of a static
  token. Confirm in the dashboard and add if required.

## Implementation map

- `src/lib/icount.ts` — typed client: `createCheckout()`, `getTransaction()` /
  `verifyTransaction()`, signature helper. Field names centralized as constants
  marked `TODO(icount)` until confirmed.
- `src/app/api/checkout/route.ts` — create pending order + return hosted
  checkout URL (passes `order_id`, success/IPN URLs).
- `src/app/api/webhooks/icount/route.ts` — verify → lookup → provision
  (idempotent), per the flow above.

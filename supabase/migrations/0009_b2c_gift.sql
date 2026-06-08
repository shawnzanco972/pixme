-- =====================================================================
-- Pixipic — B2C gift intent
--
-- The /create flow now asks "who is it for?". A gift order captures a message,
-- optional gift-wrap, and may ship straight to the recipient (different address,
-- and the parcel must not expose the price).
-- =====================================================================

alter table public.b2c_orders
  add column if not exists intent       text    not null default 'self'
    check (intent in ('self', 'gift')),
  add column if not exists gift_message text,
  add column if not exists gift_wrap    boolean not null default false,
  add column if not exists recipient_name    text,
  add column if not exists recipient_address jsonb,
  add column if not exists deliver_to   text    not null default 'buyer'
    check (deliver_to in ('buyer', 'recipient'));

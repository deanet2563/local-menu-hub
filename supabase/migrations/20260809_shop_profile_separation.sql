-- MyTree: dedicated Shop Profile / Settings fields.
-- Additive only; existing data is preserved.

alter table public.shops
  add column if not exists description text,
  add column if not exists cover_url text,
  add column if not exists google_maps_url text,
  add column if not exists website_url text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text,
  add column if not exists line_url text,
  add column if not exists email text,
  add column if not exists village text,
  add column if not exists zone text,
  add column if not exists soi text,
  add column if not exists pickup_enabled boolean not null default true,
  add column if not exists delivery_enabled boolean not null default true,
  add column if not exists service_area_note text,
  add column if not exists payment_cash_enabled boolean not null default true,
  add column if not exists payment_qr_enabled boolean not null default false,
  add column if not exists business_hours jsonb not null default '{}'::jsonb;

comment on column public.shops.business_hours is
'JSON object keyed by mon..sun, e.g. {"mon":{"open":"06:00","close":"18:00","closed":false}}';

-- Reviews intentionally remain a separate future table so customer ratings are
-- customer-owned and shop owners cannot alter ratings or review text.

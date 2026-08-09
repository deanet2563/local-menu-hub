-- MyTree menu item archiving
-- Preserve historical order_items references instead of hard deleting menu items.

alter table public.menu_items
add column if not exists archived_at timestamptz;

create index if not exists idx_menu_items_shop_active
on public.menu_items (shop_id)
where archived_at is null;

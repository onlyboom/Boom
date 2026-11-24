-- ============================================================
-- AG STORE — FULL POSTGRESQL / SUPABASE SCHEMA (tool_zalo)
-- An toàn chạy lại nhiều lần (IF NOT EXISTS / DROP POLICY IF EXISTS)
-- KHÔNG xóa hay làm mất dữ liệu sản phẩm / đơn hàng hiện có!
-- ============================================================

-- 1. Bảng Sản Phẩm (0% giá - chỉ ảnh, mã, kho, tồn kho)
create table if not exists public.zaloshop_products (
  id text primary key,
  warehouse_name text not null default 'A_long',
  item_id integer not null default 0,
  code text not null default '',
  category text not null default 'Hàng nhập',
  name text not null,
  so_luong integer not null default 0,
  is_out_of_stock boolean not null default false,
  ghi_chu text not null default '',
  rel_path text not null default '',
  image_url text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists idx_zaloshop_products_warehouse
  on public.zaloshop_products (warehouse_name, item_id);

alter table public.zaloshop_products enable row level security;

drop policy if exists "Public read products" on public.zaloshop_products;
create policy "Public read products"
  on public.zaloshop_products for select
  using (true);

drop policy if exists "Authenticated manage products" on public.zaloshop_products;
create policy "Authenticated manage products"
  on public.zaloshop_products for all
  to authenticated
  using (true)
  with check (true);

-- 2. Bảng Đơn Hàng (khách chỉ được INSERT, tuyệt đối không đọc được đơn người khác)
create table if not exists public.zaloshop_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null,
  customer_name text not null default 'Khách Cửa Hàng',
  phone text not null,
  address text not null default '',
  note text not null default '',
  handler_account_id text not null default '',
  customer_uid text not null default '',
  items jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_zaloshop_orders_status_created
  on public.zaloshop_orders (status, created_at desc);

alter table public.zaloshop_orders enable row level security;

drop policy if exists "Public insert orders" on public.zaloshop_orders;
create policy "Public insert orders"
  on public.zaloshop_orders for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Authenticated read and update orders" on public.zaloshop_orders;
create policy "Authenticated read and update orders"
  on public.zaloshop_orders for select
  to authenticated
  using (true);

drop policy if exists "Authenticated update orders" on public.zaloshop_orders;
create policy "Authenticated update orders"
  on public.zaloshop_orders for update
  to authenticated
  using (true)
  with check (true);

-- 3. Bảng Bài Viết / Tin Tức Kho Hàng (zaloshop_posts)
create table if not exists public.zaloshop_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null default 'Tin kho hàng',
  excerpt text not null default '',
  content text not null default '',
  cover_url text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_zaloshop_posts_published_created
  on public.zaloshop_posts (published, created_at desc);

alter table public.zaloshop_posts enable row level security;

drop policy if exists "Public read published posts" on public.zaloshop_posts;
create policy "Public read published posts"
  on public.zaloshop_posts for select
  using (published = true);

drop policy if exists "Authenticated manage posts" on public.zaloshop_posts;
create policy "Authenticated manage posts"
  on public.zaloshop_posts for all
  to authenticated
  using (true)
  with check (true);

-- 4. Storage Bucket cho ảnh sản phẩm & ảnh bìa bài viết (zaloshop-images)
insert into storage.buckets (id, name, public)
values ('zaloshop-images', 'zaloshop-images', true)
on conflict (id) do nothing;

drop policy if exists "Public view images" on storage.objects;
create policy "Public view images"
  on storage.objects for select
  using (bucket_id = 'zaloshop-images');

drop policy if exists "Authenticated upload images" on storage.objects;
create policy "Authenticated upload images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'zaloshop-images');

drop policy if exists "Authenticated update images" on storage.objects;
create policy "Authenticated update images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'zaloshop-images');

drop policy if exists "Authenticated delete images" on storage.objects;
create policy "Authenticated delete images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'zaloshop-images');

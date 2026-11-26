-- ============================================================
-- AG STORE — FULL POSTGRESQL / SUPABASE SCHEMA (SERVER-ONLY API)
-- An toàn chạy lại nhiều lần (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- KHÔNG xóa hay làm mất dữ liệu hiện có!
-- Mọi truy vấn ghi/đọc quản trị đều chạy từ Server (SUPABASE_SERVICE_ROLE_KEY)
-- ============================================================

-- 1. Bảng Sản Phẩm & Trưng Bày / Tồn Kho (0% giá)
create table if not exists public.zaloshop_products (
  id text primary key,
  warehouse_name text not null default 'A_long',
  item_id integer not null default 0,
  code text not null default '',
  category text not null default 'Hàng nhập',
  name text not null,
  so_luong integer not null default 0,
  is_out_of_stock boolean not null default false,
  is_visible boolean not null default true,
  is_featured boolean not null default false,
  ghi_chu text not null default '',
  rel_path text not null default '',
  image_url text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.zaloshop_products
  add column if not exists is_visible boolean not null default true;
alter table public.zaloshop_products
  add column if not exists is_featured boolean not null default false;
alter table public.zaloshop_products
  add column if not exists gia_le integer not null default 0;
alter table public.zaloshop_products
  add column if not exists gia_si integer not null default 0;
alter table public.zaloshop_products
  add column if not exists gia_pdq integer not null default 0;
alter table public.zaloshop_products
  add column if not exists don_vi text not null default 'Hộp';
alter table public.zaloshop_products
  add column if not exists quy_cach text not null default '';

create index if not exists idx_zaloshop_products_warehouse
  on public.zaloshop_products (warehouse_name, item_id);
create index if not exists idx_zaloshop_products_visible
  on public.zaloshop_products (is_visible, is_featured);

alter table public.zaloshop_products enable row level security;

-- Chặn mọi quyền ghi trực tiếp từ client/anon (chỉ Server dùng service_role mới được ghi)
drop policy if exists "Public read products" on public.zaloshop_products;
drop policy if exists "Authenticated manage products" on public.zaloshop_products;
create policy "Public read visible products"
  on public.zaloshop_products for select
  using (is_visible = true);

-- 2. Bảng Đơn Hàng (100% quản lý qua Server API)
create table if not exists public.zaloshop_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null,
  customer_name text not null default 'Khách Cửa Hàng',
  phone text not null,
  zalo_name text not null default '',
  address text not null default '',
  note text not null default '',
  handler_account_id text not null default '',
  customer_uid text not null default '',
  items jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.zaloshop_orders
  add column if not exists zalo_name text not null default '';
alter table public.zaloshop_orders
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_zaloshop_orders_status_created
  on public.zaloshop_orders (status, created_at desc);
create index if not exists idx_zaloshop_orders_phone
  on public.zaloshop_orders (phone);

alter table public.zaloshop_orders enable row level security;

-- Khóa chặt: client không được đọc/sửa/xóa đơn trực tiếp; chỉ Server (service_role) xử lý
drop policy if exists "Public insert orders" on public.zaloshop_orders;
drop policy if exists "Authenticated read and update orders" on public.zaloshop_orders;
drop policy if exists "Authenticated update orders" on public.zaloshop_orders;
create policy "Server insert orders fallback"
  on public.zaloshop_orders for insert
  to anon, authenticated
  with check (true);

-- 3. Bảng Thông Tin Khách Đặt Hàng (zaloshop_customers)
create table if not exists public.zaloshop_customers (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  customer_name text not null default 'Khách Cửa Hàng',
  zalo_name text not null default '',
  customer_uid text not null default '',
  address text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_zaloshop_customers_phone
  on public.zaloshop_customers (phone);

alter table public.zaloshop_customers enable row level security;
-- Không tạo policy cho anon/authenticated => 100% chỉ Server (service_role) truy cập được!

-- 4. Bảng Bài Viết / Tin Tức Kho Hàng (zaloshop_posts)
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
drop policy if exists "Authenticated manage posts" on public.zaloshop_posts;
create policy "Public read published posts"
  on public.zaloshop_posts for select
  using (published = true);

-- 5. Storage Bucket cho ảnh sản phẩm & ảnh bìa bài viết (zaloshop-images)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'zaloshop-images',
  'zaloshop-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "Public view images" on storage.objects;
drop policy if exists "Authenticated upload images" on storage.objects;
drop policy if exists "Authenticated update images" on storage.objects;
drop policy if exists "Authenticated delete images" on storage.objects;
create policy "Public view images"
  on storage.objects for select
  using (bucket_id = 'zaloshop-images');

-- 6. Bảng Tài Khoản Quản Trị (zaloshop_admins) & Hàm xác thực bcrypt (Server-Only)
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.zaloshop_admins (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.zaloshop_admins enable row level security;
-- Không mở policy cho anon/authenticated => 100% chỉ Server (service_role) truy cập được!

create or replace function public.verify_zaloshop_admin(p_username text, p_password text)
returns table (id uuid, username text)
language sql
security definer
set search_path = public, extensions
as $$
  select a.id, a.username
  from public.zaloshop_admins a
  where lower(a.username) = lower(trim(p_username))
    and a.is_active = true
    and a.password_hash = extensions.crypt(p_password, a.password_hash)
  limit 1;
$$;

revoke all on function public.verify_zaloshop_admin(text, text) from public, anon, authenticated;
grant execute on function public.verify_zaloshop_admin(text, text) to service_role;

insert into public.zaloshop_admins (username, password_hash, is_active)
values ('giahuy123', extensions.crypt('123456', extensions.gen_salt('bf')), true)
on conflict (username) do update set
  password_hash = excluded.password_hash,
  is_active = true,
  updated_at = now();

-- 7. Bảng Hội Thoại Chatbox Bán Hàng AI (zaloshop_chat_sessions & zaloshop_chat_messages)
-- 100% Server-Only (không mở policy cho anon/authenticated => tuyệt đối không lộ hội thoại khách)
create table if not exists public.zaloshop_chat_sessions (
  session_id text primary key,
  customer_name text not null default 'Khách Web',
  phone text not null default '',
  page_path text not null default '/',
  last_message text not null default '',
  last_sender text not null default 'customer',
  ai_provider text not null default '',
  ai_model text not null default '',
  ai_paused boolean not null default false,
  needs_human boolean not null default false,
  unread_admin integer not null default 0,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_zaloshop_chat_sessions_updated
  on public.zaloshop_chat_sessions (updated_at desc);

alter table public.zaloshop_chat_sessions enable row level security;

create table if not exists public.zaloshop_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.zaloshop_chat_sessions(session_id) on delete cascade,
  sender text not null check (sender in ('customer', 'ai', 'admin')),
  content text not null,
  ai_provider text not null default '',
  ai_model text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_zaloshop_chat_messages_session_created
  on public.zaloshop_chat_messages (session_id, created_at asc);

alter table public.zaloshop_chat_messages enable row level security;

-- 8. Bảng Tài Khoản Khách Hàng Đăng Ký (zaloshop_customer_accounts) + Hàm bcrypt (100% Server-Only)
create table if not exists public.zaloshop_customer_accounts (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  phone text unique not null,
  full_name text not null default '',
  address text not null default '',
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_zaloshop_customer_accounts_created
  on public.zaloshop_customer_accounts (created_at desc);

alter table public.zaloshop_customer_accounts enable row level security;
-- Không tạo policy cho anon/authenticated => 100% chỉ Server (service_role) & Localhost tool truy cập được!

create or replace function public.register_zaloshop_customer(
  p_username text,
  p_phone text,
  p_address text,
  p_password text,
  p_full_name text default ''
)
returns table (id uuid, username text, phone text, full_name text, address text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.zaloshop_customer_accounts%rowtype;
begin
  insert into public.zaloshop_customer_accounts (username, phone, full_name, address, password_hash)
  values (
    lower(trim(p_username)),
    trim(p_phone),
    coalesce(nullif(trim(p_full_name), ''), trim(p_username)),
    trim(p_address),
    extensions.crypt(p_password, extensions.gen_salt('bf'))
  )
  returning * into v_row;

  return query
  select v_row.id, v_row.username, v_row.phone, v_row.full_name, v_row.address, v_row.created_at;
end;
$$;

create or replace function public.verify_zaloshop_customer(p_identifier text, p_password text)
returns table (id uuid, username text, phone text, full_name text, address text)
language sql
security definer
set search_path = public, extensions
as $$
  select a.id, a.username, a.phone, a.full_name, a.address
  from public.zaloshop_customer_accounts a
  where (lower(a.username) = lower(trim(p_identifier)) or a.phone = trim(p_identifier))
    and a.is_active = true
    and a.password_hash = extensions.crypt(p_password, a.password_hash)
  limit 1;
$$;

revoke all on function public.register_zaloshop_customer(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_zaloshop_customer(text, text, text, text, text) to service_role;

revoke all on function public.verify_zaloshop_customer(text, text) from public, anon, authenticated;
grant execute on function public.verify_zaloshop_customer(text, text) to service_role;

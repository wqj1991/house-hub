-- 新房楼盘：抓数产物（房天下 大兴 / 通州），只读事实表，服务端是唯一写者。
-- 与二手房 community 分开存：新房是期房+备案均价+开盘时间，口径不同，别混表。
create table if not exists new_project (
  id integer primary key autoincrement,
  uid text not null unique,
  name text not null,
  district text not null,
  bizcircle text,
  address text,
  ring text,
  price_avg integer,
  price_text text,
  total_price_from integer,
  sale_status text,
  property_type text,
  tags text,
  layouts text,
  area_text text,
  phone text,
  image text,
  open_date text,
  delivery_date text,
  developer text,
  decoration text,
  building_type text,
  ownership text,
  sales_address text,
  source text not null default 'fang',
  source_url text,
  fetched_at text,
  rev integer not null default 0,
  deleted_at text
);

create index if not exists idx_new_project_district on new_project (district, sale_status, price_avg);

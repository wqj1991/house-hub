-- 建表语句。全部 `if not exists`，所以每次启动都能安全执行。
-- 字段与 house/docs/DESIGN.md §3 一一对应；同步列（uid/rev/updated_at/deleted_at）
-- 不写在这里，走 migrations/0001_sync_columns.sql（alter table 不幂等）。
-- 本文件被 include_str! 喂给 execute_batch，必须是纯 SQL：不要写 // 或 //!。

pragma journal_mode = WAL;
pragma synchronous = NORMAL;
pragma foreign_keys = ON;
pragma busy_timeout = 5000;

-- 人：一切人的属性都是行，不是列。
create table if not exists person (
  id          integer primary key autoincrement,
  name        text not null,
  role        text not null default 'member',
  created_at  text not null default (datetime('now'))
);

-- 锚点：一个人可挂多个；be_in 是到岗/到厂时刻，不是上班时间。
create table if not exists anchor (
  id            integer primary key autoincrement,
  person_id     integer not null references person(id) on delete cascade,
  label         text not null,
  lng           real not null,
  lat           real not null,
  be_in         text,
  days_per_week integer not null default 5,
  kind          text not null default 'work'
);

-- 通勤方式：每人可多种，互为备选，不是互斥单选。
create table if not exists mode (
  id        integer primary key autoincrement,
  person_id integer not null references person(id) on delete cascade,
  kind      text not null check (kind in ('shuttle','bike','drive','transit'))
);

-- 班车线路：arrive_factory 是 per-line 到厂时刻，不是全局 08:00。
create table if not exists line (
  id             integer primary key autoincrement,
  name           text not null,
  plate          text,
  driver         text,
  arrive_factory text,
  direction      text not null default 'am' check (direction in ('am','pm')),
  active         integer not null default 1
);

-- 站点：coord_source 区分 listed（时刻表给的）与 inferred（推定点，误差 200–500m）。
create table if not exists stop (
  id           integer primary key autoincrement,
  line_id      integer not null references line(id) on delete cascade,
  seq          integer not null,
  name         text not null,
  lng          real not null,
  lat          real not null,
  depart       text,
  coord_source text not null default 'listed'
);

-- 小区：只存单价，总价 = 单价 × 面积档（70/90/120）。
create table if not exists community (
  id            integer primary key autoincrement,
  name          text not null,
  district      text not null,
  bizcircle     text,
  lng           real not null,
  lat           real not null,
  build_year    integer,
  build_type    text,
  property_type text,
  price         real,
  price_tx      real,
  price_src_n   integer,
  bargain       real,
  cycle_days    integer,
  tx_n          integer,
  online        integer,
  address       text,
  tags          text,
  source        text,
  fetched_at    text
);
create index if not exists idx_community_district on community(district);
create index if not exists idx_community_name on community(name);
create index if not exists idx_community_tx on community(tx_n desc);

-- 品质分项：每行必须能回答「这个分是哪个字段、哪个站、哪天抓的」。
create table if not exists community_quality (
  community_id integer not null references community(id) on delete cascade,
  item_key     text not null,
  value_num    real,
  value_text   text,
  source       text,
  fetched_at   text,
  primary key (community_id, item_key)
);

-- 打分规则由用户提供，系统只执行。scope: quality | commute | gating
create table if not exists score_rule (
  id         integer primary key autoincrement,
  scope      text not null,
  item_key   text not null,
  weight     real not null,
  formula    text,
  note       text,
  updated_at text not null default (datetime('now'))
);

-- 一行 = 一个人 × 一个小区 × 一种模式的一条腿。
create table if not exists route (
  person_id    integer not null references person(id) on delete cascade,
  community_id integer not null references community(id) on delete cascade,
  mode_kind    text not null,
  minutes      real not null,
  leave_home   text,
  transfer_min real,
  ride_min     real,
  walk_m       real,
  line_text    text,
  fetched_at   text,
  source       text,
  primary key (person_id, community_id, mode_kind)
);

-- 待选：人的判断，不是算法输出。
create table if not exists shortlist (
  community_id integer primary key references community(id) on delete cascade,
  added_at     text not null default (datetime('now')),
  note         text,
  verdict      text
);

-- 积分九项，按人按年存（要对比「A 申报 vs B 申报」）。
create table if not exists jifen (
  person_id integer not null references person(id) on delete cascade,
  year      integer not null,
  item_key  text not null,
  value     real,
  note      text,
  primary key (person_id, year, item_key)
);

-- 攻略里的清单：存「勾没勾」，文案在 packages/core/content/checks.ts。
create table if not exists check_state (
  kind       text not null,
  item_key   text not null,
  checked    integer not null default 0,
  note       text,
  updated_at text not null default (datetime('now')),
  primary key (kind, item_key)
);

-- 算钱页的输入（收入、首付、利率、面积档…）。key-value 存，免得每次加字段都要迁表。
create table if not exists app_setting (
  key        text primary key,
  value      text not null,
  updated_at text not null default (datetime('now'))
);

-- 房屋打分卡：同一小区里的具体房源。存原始输入与 1–5 分，不存加权分。
create table if not exists house (
  id           integer primary key autoincrement,
  community_id integer not null,
  label        text    not null,
  listed       real    not null default 0,   -- 挂牌总价（万元）
  deal         real    not null default 0,   -- 成交 / 预计成交价（万元）
  area         real    not null default 0,   -- 建筑面积（㎡）
  down_ratio   real    not null default 0.35,
  rate         real    not null default 0.031,
  years        real    not null default 25,
  income       real    not null default 0,   -- 家庭税后月收入（元）
  renovation   real    not null default 0,   -- 装修与家电预算（万元）
  rent         real    not null default 0,   -- 预计月租金（元）
  fee_per_sqm  real    not null default 0,   -- 物业费（元/㎡·月）
  parking      real    not null default 0,   -- 车位月成本（元）
  floor_adj    real    not null default 0,   -- 楼层朝向修正（0.02 = +2%）
  decor_adj    real    not null default 0,   -- 装修修正
  comp_unit    real,                          -- 近 3 月成交均价（元/㎡），空则用本套单价
  created_at   text    not null default (datetime('now')),
  updated_at   text    not null default (datetime('now'))
);
create index if not exists house_by_community on house (community_id);

-- A1–A25 的 1–5 分（item_key 见 packages/core/scoring/house.ts）
create table if not exists house_score (
  house_id integer not null,
  item_key text    not null,
  score    integer not null,
  primary key (house_id, item_key)
);

-- 17 条红线：命中即一票否决（只存命中的，没勾=没核/未命中）
create table if not exists house_redline (
  house_id integer not null,
  item_key text    not null,
  hit      integer not null default 1,
  primary key (house_id, item_key)
);

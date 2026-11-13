-- 服务端库：列与 apps/shell/src-tauri/src/schema.sql + migrations/0001_sync_columns.sql 对齐。
-- 客户端用什么名字，这里就用什么名字；两边靠 uid 认同一行，不靠自增 id。
-- 连接级 pragma（WAL / synchronous）在 db.ts 里设；迁移跑在事务里，改不了这些。

pragma journal_mode = WAL;

create table if not exists person (
  id         integer primary key autoincrement,
  name       text not null,
  role       text not null default 'member',
  created_at text not null default (datetime('now')),
  uid        text, rev integer not null default 0, updated_at text, deleted_at text
);

create table if not exists anchor (
  id            integer primary key autoincrement,
  person_id     integer not null references person(id) on delete cascade,
  label         text not null,
  lng           real not null,
  lat           real not null,
  be_in         text,
  days_per_week integer not null default 5,
  kind          text not null default 'work',
  uid           text, rev integer not null default 0, updated_at text, deleted_at text
);

create table if not exists mode (
  id        integer primary key autoincrement,
  person_id integer not null references person(id) on delete cascade,
  kind      text not null check (kind in ('shuttle','bike','drive','transit')),
  uid       text, rev integer not null default 0, updated_at text, deleted_at text
);

create table if not exists line (
  id             integer primary key autoincrement,
  name           text not null,
  plate          text,
  driver         text,
  arrive_factory text,
  direction      text not null default 'am' check (direction in ('am','pm')),
  active         integer not null default 1,
  uid            text, rev integer not null default 0, updated_at text, deleted_at text
);

create table if not exists stop (
  id           integer primary key autoincrement,
  line_id      integer not null references line(id) on delete cascade,
  seq          integer not null,
  name         text not null,
  lng          real not null,
  lat          real not null,
  depart       text,
  coord_source text not null default 'listed',
  uid          text, rev integer not null default 0, updated_at text, deleted_at text
);

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
  fetched_at    text,
  uid           text, rev integer not null default 0, updated_at text, deleted_at text
);
create index if not exists idx_community_district on community(district);
create index if not exists idx_community_name on community(name);
create index if not exists idx_community_tx on community(tx_n desc);

create table if not exists community_quality (
  community_id integer not null references community(id) on delete cascade,
  item_key     text not null,
  value_num    real,
  value_text   text,
  source       text,
  fetched_at   text,
  uid          text, rev integer not null default 0, updated_at text, deleted_at text,
  primary key (community_id, item_key)
);

create table if not exists score_rule (
  id         integer primary key autoincrement,
  scope      text not null,
  item_key   text not null,
  weight     real not null,
  formula    text,
  note       text,
  updated_at text not null default (datetime('now')),
  uid        text, rev integer not null default 0, deleted_at text
);

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
  uid          text, rev integer not null default 0, updated_at text, deleted_at text,
  primary key (person_id, community_id, mode_kind)
);

create table if not exists shortlist (
  community_id integer primary key references community(id) on delete cascade,
  added_at     text not null default (datetime('now')),
  note         text,
  verdict      text,
  uid          text, rev integer not null default 0, updated_at text, deleted_at text
);

create table if not exists jifen (
  person_id integer not null references person(id) on delete cascade,
  year      integer not null,
  item_key  text not null,
  value     real,
  note      text,
  uid       text, rev integer not null default 0, updated_at text, deleted_at text,
  primary key (person_id, year, item_key)
);

create table if not exists check_state (
  kind       text not null,
  item_key   text not null,
  checked    integer not null default 0,
  note       text,
  updated_at text not null default (datetime('now')),
  uid        text, rev integer not null default 0, deleted_at text,
  primary key (kind, item_key)
);

create table if not exists app_setting (
  key        text primary key,
  value      text not null,
  updated_at text not null default (datetime('now')),
  uid        text, rev integer not null default 0, deleted_at text
);

create table if not exists house (
  id           integer primary key autoincrement,
  community_id integer not null,
  label        text    not null,
  listed       real    not null default 0,
  deal         real    not null default 0,
  area         real    not null default 0,
  down_ratio   real    not null default 0.35,
  rate         real    not null default 0.031,
  years        real    not null default 25,
  income       real    not null default 0,
  renovation   real    not null default 0,
  rent         real    not null default 0,
  fee_per_sqm  real    not null default 0,
  parking      real    not null default 0,
  floor_adj    real    not null default 0,
  decor_adj    real    not null default 0,
  comp_unit    real,
  created_at   text    not null default (datetime('now')),
  updated_at   text    not null default (datetime('now')),
  uid          text, rev integer not null default 0, deleted_at text
);
create index if not exists house_by_community on house (community_id);

create table if not exists house_score (
  house_id integer not null,
  item_key text    not null,
  score    integer not null,
  uid      text, rev integer not null default 0, updated_at text, deleted_at text,
  primary key (house_id, item_key)
);

create table if not exists house_redline (
  house_id integer not null,
  item_key text    not null,
  hit      integer not null default 1,
  uid      text, rev integer not null default 0, updated_at text, deleted_at text,
  primary key (house_id, item_key)
);

create table if not exists sync_counter (
  id  integer primary key check (id = 1),
  rev integer not null default 0
);
insert or ignore into sync_counter (id, rev) values (1, 0);

create table if not exists pairing_code (
  code       text primary key,
  created_at text not null default (datetime('now')),
  expires_at text not null,
  used_at    text
);

create table if not exists device (
  id         text primary key,
  name       text,
  platform   text not null default 'web',
  token_hash text not null,
  created_at text not null default (datetime('now')),
  last_seen  text,
  revoked    integer not null default 0
);
create unique index if not exists ux_device_token on device(token_hash);

create table if not exists job (
  id          text primary key,
  kind        text not null,
  payload     text not null default '{}',
  status      text not null default 'queued',
  attempts    integer not null default 0,
  worker      text,
  result      text,
  error       text,
  created_at  text not null default (datetime('now')),
  started_at  text,
  finished_at text
);
create index if not exists ix_job_status on job (status, created_at);

create table if not exists rule_set (
  version            integer primary key,
  hash               text not null,
  note               text,
  min_client_version integer,
  created_at         text not null default (datetime('now'))
);

create table if not exists geo_cache (
  key        text primary key,
  value      text not null,
  fetched_at text not null default (datetime('now'))
);

create unique index if not exists ux_person_uid            on person(uid);
create unique index if not exists ux_anchor_uid            on anchor(uid);
create unique index if not exists ux_mode_uid              on mode(uid);
create unique index if not exists ux_line_uid              on line(uid);
create unique index if not exists ux_stop_uid              on stop(uid);
create unique index if not exists ux_community_uid         on community(uid);
create unique index if not exists ux_community_quality_uid on community_quality(uid);
create unique index if not exists ux_score_rule_uid        on score_rule(uid);
create unique index if not exists ux_route_uid             on route(uid);
create unique index if not exists ux_shortlist_uid         on shortlist(uid);
create unique index if not exists ux_jifen_uid             on jifen(uid);
create unique index if not exists ux_check_state_uid       on check_state(uid);
create unique index if not exists ux_app_setting_uid       on app_setting(uid);
create unique index if not exists ux_house_uid             on house(uid);
create unique index if not exists ux_house_score_uid       on house_score(uid);
create unique index if not exists ux_house_redline_uid     on house_redline(uid);

create index if not exists ix_community_rev   on community(rev);
create index if not exists ix_shortlist_rev   on shortlist(rev);
create index if not exists ix_check_state_rev on check_state(rev);

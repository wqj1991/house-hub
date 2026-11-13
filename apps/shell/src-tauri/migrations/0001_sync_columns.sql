-- 同步所需的四列（ARCHITECTURE §6.3）。只加列，不改名、不删列。
-- 老数据一次补齐 uid；uid 由客户端生成（UUIDv7），跨端只认它。
-- 注意：alter table ... add column 不幂等，lib.rs 里对「列已存在」的报错做了忽略。

alter table community          add column uid text;
alter table community          add column rev integer not null default 0;
alter table community          add column updated_at text;
alter table community          add column deleted_at text;

alter table community_quality  add column uid text;
alter table community_quality  add column rev integer not null default 0;
alter table community_quality  add column updated_at text;
alter table community_quality  add column deleted_at text;

alter table shortlist          add column uid text;
alter table shortlist          add column rev integer not null default 0;
alter table shortlist          add column updated_at text;
alter table shortlist          add column deleted_at text;

alter table check_state        add column uid text;
alter table check_state        add column rev integer not null default 0;
alter table check_state        add column updated_at text;
alter table check_state        add column deleted_at text;

alter table app_setting        add column uid text;
alter table app_setting        add column rev integer not null default 0;
alter table app_setting        add column updated_at text;
alter table app_setting        add column deleted_at text;

alter table house              add column uid text;
alter table house              add column rev integer not null default 0;
alter table house              add column deleted_at text;

alter table house_score        add column uid text;
alter table house_score        add column rev integer not null default 0;
alter table house_score        add column updated_at text;
alter table house_score        add column deleted_at text;

alter table house_redline      add column uid text;
alter table house_redline      add column rev integer not null default 0;
alter table house_redline      add column updated_at text;
alter table house_redline      add column deleted_at text;

alter table person             add column uid text;
alter table person             add column rev integer not null default 0;
alter table person             add column updated_at text;
alter table person             add column deleted_at text;

alter table anchor             add column uid text;
alter table anchor             add column rev integer not null default 0;
alter table anchor             add column updated_at text;
alter table anchor             add column deleted_at text;

alter table mode               add column uid text;
alter table mode               add column rev integer not null default 0;
alter table mode               add column updated_at text;
alter table mode               add column deleted_at text;

alter table jifen              add column uid text;
alter table jifen              add column rev integer not null default 0;
alter table jifen              add column updated_at text;
alter table jifen              add column deleted_at text;

alter table line               add column uid text;
alter table line               add column rev integer not null default 0;
alter table line               add column updated_at text;
alter table line               add column deleted_at text;

alter table stop               add column uid text;
alter table stop               add column rev integer not null default 0;
alter table stop               add column updated_at text;
alter table stop               add column deleted_at text;

alter table route              add column uid text;
alter table route              add column rev integer not null default 0;
alter table route              add column updated_at text;
alter table route              add column deleted_at text;

alter table score_rule         add column uid text;
alter table score_rule         add column rev integer not null default 0;
alter table score_rule         add column updated_at text;
alter table score_rule         add column deleted_at text;

-- 老数据补 uid（一次性，可重复执行：只补 null）
update community         set uid = lower(hex(randomblob(16))) where uid is null;
update community_quality set uid = lower(hex(randomblob(16))) where uid is null;
update shortlist         set uid = lower(hex(randomblob(16))) where uid is null;
update check_state       set uid = lower(hex(randomblob(16))) where uid is null;
update app_setting       set uid = lower(hex(randomblob(16))) where uid is null;
update house             set uid = lower(hex(randomblob(16))) where uid is null;
update house_score       set uid = lower(hex(randomblob(16))) where uid is null;
update house_redline     set uid = lower(hex(randomblob(16))) where uid is null;
update person            set uid = lower(hex(randomblob(16))) where uid is null;
update anchor            set uid = lower(hex(randomblob(16))) where uid is null;
update mode              set uid = lower(hex(randomblob(16))) where uid is null;
update jifen             set uid = lower(hex(randomblob(16))) where uid is null;
update line              set uid = lower(hex(randomblob(16))) where uid is null;
update stop              set uid = lower(hex(randomblob(16))) where uid is null;
update route             set uid = lower(hex(randomblob(16))) where uid is null;
update score_rule        set uid = lower(hex(randomblob(16))) where uid is null;

create unique index if not exists ux_community_uid on community(uid);
create index if not exists ix_community_rev on community(rev);

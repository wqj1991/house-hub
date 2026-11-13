-- 同步落地所需的本地元数据与本文件新增的索引（ARCHITECTURE §6.3 / §6.4）。
-- 与 0001_sync_columns.sql 分开：0001 只加列，这里只建表与索引，两条都幂等。

-- 本地 rev 与设备身份不参与同步，绝不写进 app_setting（那张表会推给服务器）。
create table if not exists sync_meta (
  key   text primary key,
  value text not null
);

-- uid 是跨端唯一句柄，pull 落库按它命中；每张同步表都要有索引。
create index if not exists ix_person_uid            on person(uid);
create index if not exists ix_anchor_uid            on anchor(uid);
create index if not exists ix_mode_uid              on mode(uid);
create index if not exists ix_line_uid              on line(uid);
create index if not exists ix_stop_uid              on stop(uid);
create index if not exists ix_community_uid_col     on community(uid);
create index if not exists ix_community_quality_uid on community_quality(uid);
create index if not exists ix_score_rule_uid        on score_rule(uid);
create index if not exists ix_route_uid             on route(uid);
create index if not exists ix_shortlist_uid         on shortlist(uid);
create index if not exists ix_jifen_uid             on jifen(uid);
create index if not exists ix_check_state_uid       on check_state(uid);
create index if not exists ix_app_setting_uid       on app_setting(uid);
create index if not exists ix_house_uid             on house(uid);
create index if not exists ix_house_score_uid       on house_score(uid);
create index if not exists ix_house_redline_uid     on house_redline(uid);

-- pull 的 where rev > ? 需要按 rev 排序；只给非主键表补齐，避免重复建索引。
create index if not exists ix_person_rev            on person(rev);
create index if not exists ix_community_quality_rev on community_quality(rev);
create index if not exists ix_shortlist_rev         on shortlist(rev);
create index if not exists ix_check_state_rev       on check_state(rev);
create index if not exists ix_app_setting_rev       on app_setting(rev);
create index if not exists ix_house_rev             on house(rev);
create index if not exists ix_house_score_rev       on house_score(rev);
create index if not exists ix_house_redline_rev     on house_redline(rev);

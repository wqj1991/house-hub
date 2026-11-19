-- 账号登录：进应用先验账号密码，通过后再按 device 表签发设备令牌。
-- 密码只存 scrypt 派生值（scrypt$salt$hash），明文不落库、不进日志。

create table if not exists account (
  id         text primary key,
  username   text not null,
  pass_hash  text not null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create unique index if not exists ux_account_username on account(username);

-- 设备令牌归属到哪个账号：同一账号可以挂多台设备，吊销一台不影响其他
alter table device add column account_id text;

-- 收入与公积金：服务端就是唯一真相。
-- 整个家庭文档存一行（成员数组 + 组合贷测算参数），客户端每次操作直接读写这里。
create table if not exists income_doc (
  id integer primary key check (id = 1),
  doc text not null,
  updated_at text not null default (datetime('now'))
);

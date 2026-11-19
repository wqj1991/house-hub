-- 通勤画像：公司地点 + 多条通勤习惯（含班车），与收入同构——服务端是唯一真相。
-- 整个家庭通勤档案存一行，客户端每次增删改都是一次请求，返回值就是最新整份文档。
create table if not exists commute_doc (
  id integer primary key check (id = 1),
  doc text not null,
  updated_at text not null default (datetime('now'))
);

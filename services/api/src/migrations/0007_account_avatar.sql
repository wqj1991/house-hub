-- 头像：客户端缩到 256×256 的 jpeg data URL，一条账号一张，两台设备共用
alter table account add column avatar text;

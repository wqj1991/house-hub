-- 楼盘详情补两块：地图落点（GCJ-02，高德坐标系）与户型清单（JSON 数组）。
-- 数据同样来自抓数快照（packages/core/src/content/newhouseDetail.ts），服务端仍是唯一写者。
alter table new_project add column lng real;
alter table new_project add column lat real;
alter table new_project add column floor_plans text;

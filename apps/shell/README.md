# @house/shell — Tauri 2 壳

产物复用 `apps/web/dist`，不单独维护一份前端。

## 待办（P0）

- `src-tauri/icons/`：把 `D:\repos\house\src-tauri\icons` 整个拷过来，再把 `tauri.conf.json` 的
  `bundle.icon` 填回（现在是空数组，dev 能跑，打包需要真图标）。
- `src-tauri/src/lib.rs`：把 house 仓库里 19 个 `#[tauri::command]` 逐个搬入；
  数据库打开逻辑已就位（app_data_dir/house.db + schema.sql + 0001 迁移）。
- Android：`pnpm --filter @house/shell android:init` 之后才会生成 `gen/android`。

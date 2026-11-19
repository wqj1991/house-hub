/**
 * 列表行右侧的「进入」尖角。全站统一尺寸与颜色：
 * 卡片头（公司地点 / 通勤习惯 / 班车线路 / 家庭成员）和列表行都用它，
 * 避免各处自写 fontSize 造成大小、字重不一致。
 */
export function RowChevron() {
  return (
    <span className="row-chevron" aria-hidden="true">
      ›
    </span>
  );
}

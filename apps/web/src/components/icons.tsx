/** 内联图标：避免 emoji 在无彩色 emoji 字体环境下渲染成空白。 */
type IconProps = { size?: number; className?: string };

export function SearchIcon({ size = 15, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <circle cx="6.9" cy="6.9" r="4.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.3 10.3 13.6 13.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ size = 12, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

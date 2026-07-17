import { Icon, type IconProps } from './Icon';

export function Strikethrough({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M6 16c0 2 1.5 4 4 4h4c2 0 4-1 4-3 0-2-1-3-4-3H8" />
      <path d="M6 8c0-2 1.5-4 4-4h4c2 0 4 1 4 3" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </Icon>
  );
}

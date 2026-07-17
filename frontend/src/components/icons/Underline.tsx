import { Icon, type IconProps } from './Icon';

export function Underline({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M6 3v7a6 6 0 0 0 12 0V3" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </Icon>
  );
}

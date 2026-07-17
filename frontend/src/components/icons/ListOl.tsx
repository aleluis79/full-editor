import { Icon, type IconProps } from './Icon';

export function ListOl({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1-2-1" />
    </Icon>
  );
}

import { Icon, type IconProps } from './Icon';

export function AlignRight({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="9" y1="10" x2="21" y2="10" />
      <line x1="5" y1="14" x2="21" y2="14" />
      <line x1="11" y1="18" x2="21" y2="18" />
    </Icon>
  );
}

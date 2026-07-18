import { Icon, type IconProps } from './Icon';

export function LineHeight({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      {/* Horizontal lines representing text rows */}
      <line x1="3" y1="5" x2="15" y2="5" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="19" x2="15" y2="19" />
      {/* Vertical arrows indicating adjustable spacing */}
      <polyline points="19,7 21,9 23,7" />
      <polyline points="19,17 21,15 23,17" />
    </Icon>
  );
}

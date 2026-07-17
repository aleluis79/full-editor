import { Icon, type IconProps } from './Icon';

export function Back({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </Icon>
  );
}

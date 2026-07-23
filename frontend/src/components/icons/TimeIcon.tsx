import { Icon, type IconProps } from './Icon';

export function TimeIcon({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  );
}

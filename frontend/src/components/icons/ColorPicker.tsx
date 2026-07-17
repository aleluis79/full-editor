import { Icon, type IconProps } from './Icon';

export function ColorPicker({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9z" />
      <circle cx="12" cy="12" r="4" />
    </Icon>
  );
}

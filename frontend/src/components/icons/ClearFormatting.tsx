import { Icon, type IconProps } from './Icon';

export function ClearFormatting({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M19 17l-8-8" />
      <path d="M11 17l8-8" />
      <path d="M4 7h4l4 10H8L4 7z" />
    </Icon>
  );
}

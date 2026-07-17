import { Icon, type IconProps } from './Icon';

export function Subscript({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M4 19l8-8" />
      <path d="M12 19l-8-8" />
      <path d="M18 19V16h2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-2" />
      <path d="M18 19h3" />
    </Icon>
  );
}

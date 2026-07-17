import { Icon, type IconProps } from './Icon';

export function HighlightPicker({ className, size }: IconProps) {
  return (
    <Icon className={className} size={size}>
      <path d="M9 11l4 4L4 22l-2-2z" />
      <path d="M14.5 5.5L18 2l4 4-3.5 3.5" />
      <path d="M5 15l7-7" />
    </Icon>
  );
}

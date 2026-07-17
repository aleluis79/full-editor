import type { ReactNode } from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

interface IconComponentProps extends IconProps {
  children: ReactNode;
}

export function Icon({ className, size = 24, children }: IconComponentProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

export type { IconProps };

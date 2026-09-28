import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** Native select styled to match. Swap for shadcn's Radix Select if needed. */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

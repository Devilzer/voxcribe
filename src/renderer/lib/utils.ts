import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** "CommandOrControl+Shift+Space" → "Ctrl + Shift + Space" (or ⌘ on macOS). */
export function formatShortcut(accelerator: string): string {
  const isMac = navigator.userAgent.includes('Mac');
  return accelerator
    .split('+')
    .map((part) => {
      if (/^(CommandOrControl|CmdOrCtrl)$/i.test(part)) return isMac ? '⌘' : 'Ctrl';
      if (/^(Command|Cmd)$/i.test(part)) return '⌘';
      if (/^(Alt|Option)$/i.test(part)) return isMac ? '⌥' : 'Alt';
      return part;
    })
    .join(' + ');
}

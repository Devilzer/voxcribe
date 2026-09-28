import { History, Home, Mic, Settings, type LucideIcon } from 'lucide-react';
import type { AppPage } from '@shared/types';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/appStore';

const NAV_ITEMS: ReadonlyArray<{ page: AppPage; label: string; icon: LucideIcon }> = [
  { page: 'home', label: 'Home', icon: Home },
  { page: 'history', label: 'History', icon: History },
  { page: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const page = useAppStore((state) => state.page);
  const setPage = useAppStore((state) => state.setPage);

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r bg-card/50 p-3">
      <div className="mb-6 flex items-center gap-2 px-2 pt-2">
        <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Mic className="size-4" />
        </div>
        <span className="text-sm font-semibold">Voxcribe</span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ page: target, label, icon: Icon }) => (
          <button
            key={target}
            type="button"
            onClick={() => setPage(target)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              page === target ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>
      <p className="mt-auto px-2 text-[11px] text-muted-foreground">All processing stays on this device.</p>
    </aside>
  );
}

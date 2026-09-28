import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

import { AppShell } from './components/layout/AppShell';
import { useBootstrap } from './hooks/useBootstrap';
import { useRecordingTimer } from './hooks/useRecordingTimer';
import { History } from './pages/History';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { useAppStore } from './store/appStore';

const PAGES = { home: Home, history: History, settings: Settings } as const;

export function App() {
  useBootstrap();
  useRecordingTimer();
  const page = useAppStore((state) => state.page);
  const Page = PAGES[page];

  return (
    <AppShell>
      <Page />
    </AppShell>
  );
}

type Level = 'debug' | 'info' | 'warn' | 'error';

/** Renderer-side logger. DevTools console only; main-process logs are the source of truth. */
function log(level: Level, scope: string, message: string, data?: unknown): void {
  if (level === 'debug' && !import.meta.env.DEV) return;
  const line = `[renderer:${scope}] ${message}`;
  /* eslint-disable no-console */
  if (data === undefined) console[level](line);
  else console[level](line, data);
  /* eslint-enable no-console */
}

export function createRendererLogger(scope: string) {
  return {
    debug: (message: string, data?: unknown) => log('debug', scope, message, data),
    info: (message: string, data?: unknown) => log('info', scope, message, data),
    warn: (message: string, data?: unknown) => log('warn', scope, message, data),
    error: (message: string, data?: unknown) => log('error', scope, message, data),
  };
}

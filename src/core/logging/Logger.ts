export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogEntry {
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
  timestamp: Date;
}

/** Destination for log entries (console now, `app.getPath("logs")` file later). */
export interface LogSink {
  write(entry: LogEntry): void;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  child(scope: string): Logger;
}

export class ConsoleSink implements LogSink {
  write(entry: LogEntry): void {
    const line = `${entry.timestamp.toISOString()} ${entry.level.toUpperCase().padEnd(5)} [${entry.scope}] ${entry.message}`;
    const args = entry.data === undefined ? [line] : [line, entry.data];
    /* eslint-disable no-console */
    switch (entry.level) {
      case 'debug':
        console.debug(...args);
        break;
      case 'info':
        console.info(...args);
        break;
      case 'warn':
        console.warn(...args);
        break;
      case 'error':
        console.error(...args);
        break;
    }
    /* eslint-enable no-console */
  }
}

// TODO(logging): add a FileSink writing rotated files under app.getPath("logs").

export interface LoggerOptions {
  level?: LogLevel;
  sinks?: LogSink[];
}

class ScopedLogger implements Logger {
  constructor(
    private readonly scope: string,
    private readonly minLevel: LogLevel,
    private readonly sinks: readonly LogSink[],
  ) {}

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }
  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }
  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }
  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  child(scope: string): Logger {
    return new ScopedLogger(`${this.scope}:${scope}`, this.minLevel, this.sinks);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const entry: LogEntry = { level, scope: this.scope, message, data, timestamp: new Date() };
    for (const sink of this.sinks) sink.write(entry);
  }
}

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && value in LEVEL_ORDER;
}

export function createLogger(scope: string, options: LoggerOptions = {}): Logger {
  return new ScopedLogger(scope, options.level ?? 'info', options.sinks ?? [new ConsoleSink()]);
}

/** Logger that drops everything. Useful in tests. */
export const silentLogger: Logger = createLogger('silent', { sinks: [] });

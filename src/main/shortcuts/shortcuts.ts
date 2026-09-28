import { globalShortcut } from 'electron';
import { VoxcribeError } from '@core/errors';
import type { Logger } from '@core/logging/Logger';
import { DEFAULT_SHORTCUT } from '@shared/constants';

export interface ShortcutManager {
  register(): Promise<void>;
  unregister(): Promise<void>;
  setShortcut(shortcut: string): Promise<void>;
  getShortcut(): string;
}

export interface ElectronShortcutManagerOptions {
  logger: Logger;
  onTrigger: () => void;
  shortcut?: string;
}

/**
 * Global dictation hotkey via Electron's `globalShortcut`.
 *
 * Note: `globalShortcut` only reports key-down, so this is toggle-to-talk.
 * TODO(shortcuts): true hold-to-talk needs a native key hook (e.g. uiohook-napi).
 * TODO(shortcuts): Wayland sessions may refuse global shortcuts; fall back to the
 * XDG GlobalShortcuts portal.
 */
export class ElectronShortcutManager implements ShortcutManager {
  private shortcut: string;
  private registered = false;

  constructor(private readonly options: ElectronShortcutManagerOptions) {
    this.shortcut = options.shortcut ?? DEFAULT_SHORTCUT;
  }

  getShortcut(): string {
    return this.shortcut;
  }

  async register(): Promise<void> {
    if (this.registered) return;
    const ok = globalShortcut.register(this.shortcut, () => {
      this.options.logger.debug(`Shortcut ${this.shortcut} pressed`);
      this.options.onTrigger();
    });
    if (!ok) {
      throw new VoxcribeError('shortcut', 'SHORTCUT_REGISTRATION_FAILED', `Could not register ${this.shortcut}`, {
        details: { shortcut: this.shortcut },
      });
    }
    this.registered = true;
    this.options.logger.info(`Registered global shortcut ${this.shortcut}`);
  }

  async unregister(): Promise<void> {
    if (!this.registered) return;
    globalShortcut.unregister(this.shortcut);
    this.registered = false;
  }

  async setShortcut(shortcut: string): Promise<void> {
    if (shortcut === this.shortcut && this.registered) return;
    const previous = this.shortcut;
    await this.unregister();
    this.shortcut = shortcut;
    try {
      await this.register();
    } catch (error) {
      this.shortcut = previous;
      await this.register().catch(() => undefined);
      throw error;
    }
  }
}

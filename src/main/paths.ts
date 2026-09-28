import { join } from 'node:path';
import { app } from 'electron';
import { BINARIES_DIR_NAME, MODELS_DIR_NAME } from '@shared/constants';

export interface AppPaths {
  /** Bundled read-only resources (icons, native binaries). */
  resourcesDir: string;
  binariesDir: string;
  iconsDir: string;
  /** User-downloaded models. Lives in userData, never in the app bundle or source tree. */
  modelsDir: string;
  logsDir: string;
  userDataDir: string;
  settingsFile: string;
  /** Scratch space for whisper.cpp output. */
  tempDir: string;
  /** Default folder for the audio file dialog (repo `test-audio/` in development). */
  audioDialogDir: string;
}

export function resolveAppPaths(): AppPaths {
  // Packaged: electron-builder `extraResources` copies into process.resourcesPath.
  const resourcesDir = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources');
  const userDataDir = app.getPath('userData');
  return {
    resourcesDir,
    binariesDir: join(resourcesDir, BINARIES_DIR_NAME),
    iconsDir: join(resourcesDir, 'icons'),
    modelsDir: join(userDataDir, MODELS_DIR_NAME),
    logsDir: app.getPath('logs'),
    userDataDir,
    settingsFile: join(userDataDir, 'settings.json'),
    tempDir: app.getPath('temp'),
    audioDialogDir: app.isPackaged ? app.getPath('music') : join(app.getAppPath(), 'test-audio'),
  };
}

import { join } from 'node:path';
import { Menu, Tray, nativeImage } from 'electron';
import { APP_NAME } from '@shared/constants';

export interface TrayActions {
  toggleRecording: () => void;
  openApp: () => void;
  openSettings: () => void;
  quit: () => void;
}

export interface AppTray {
  destroy(): void;
}

export function createTray(iconsDir: string, actions: TrayActions): AppTray {
  const iconFile = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png';
  const icon = nativeImage.createFromPath(join(iconsDir, iconFile));
  if (process.platform === 'darwin') icon.setTemplateImage(true);

  const tray = new Tray(icon);
  tray.setToolTip(APP_NAME);

  // TODO(tray): reflect recording state (label + icon) once main owns the pipeline state.
  const menu = Menu.buildFromTemplate([
    { label: APP_NAME, enabled: false },
    { type: 'separator' },
    { label: 'Start Recording', click: actions.toggleRecording },
    { label: `Open ${APP_NAME}`, click: actions.openApp },
    { label: 'Settings', click: actions.openSettings },
    { type: 'separator' },
    { label: 'Quit', click: actions.quit },
  ]);

  tray.setContextMenu(menu);
  tray.on('click', actions.openApp);

  return {
    destroy: () => tray.destroy(),
  };
}

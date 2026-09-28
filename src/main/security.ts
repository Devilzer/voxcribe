import { app, session } from 'electron';

/**
 * Process-wide hardening that applies to every webContents.
 * See https://www.electronjs.org/docs/latest/tutorial/security
 */
export function applySecurityPolicies(): void {
  // Deny all permission requests (camera, notifications, geolocation, ...).
  // TODO(audio): allow 'media' (audio only) for our own origin once capture uses getUserMedia.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });
}

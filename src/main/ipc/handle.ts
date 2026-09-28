import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { toErrorPayload } from '@core/errors';
import type { Logger } from '@core/logging/Logger';
import type { IpcArgs, IpcChannel, IpcResult, IpcReturn } from '@shared/ipc';
import type { ArgsValidator } from './validators';

export type SenderGuard = (event: IpcMainInvokeEvent) => boolean;

export interface HandlerContext {
  logger: Logger;
  isTrustedSender: SenderGuard;
}

/**
 * Registers a typed invoke handler. Every call is:
 *   1. checked against the trusted sender (our main window's main frame),
 *   2. validated with `validate`,
 *   3. wrapped in an `IpcResult` envelope so typed errors survive IPC.
 */
export function handle<C extends IpcChannel>(
  context: HandlerContext,
  channel: C,
  validate: ArgsValidator<IpcArgs<C>>,
  handler: (...args: IpcArgs<C>) => Promise<IpcReturn<C>> | IpcReturn<C>,
): void {
  ipcMain.handle(channel, async (event, ...rawArgs: unknown[]): Promise<IpcResult<IpcReturn<C>>> => {
    if (!context.isTrustedSender(event)) {
      context.logger.warn(`Rejected IPC ${channel} from untrusted sender`, { url: event.senderFrame?.url });
      return { ok: false, error: { code: 'IPC_INVALID_ARGUMENT', message: 'Untrusted sender' } };
    }
    try {
      const args = validate(rawArgs);
      const data = await handler(...args);
      return { ok: true, data };
    } catch (error) {
      const payload = toErrorPayload(error);
      const expected = payload.code === 'MODEL_DOWNLOAD_CANCELLED';
      context.logger[expected ? 'info' : 'error'](`IPC ${channel} failed: ${payload.code}`, payload);
      return { ok: false, error: payload };
    }
  });
}

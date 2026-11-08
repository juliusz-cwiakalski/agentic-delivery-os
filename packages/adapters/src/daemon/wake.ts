/**
 * The wake source (GH-238 F-3; EVT-2; DEC-6).
 *
 * A control-plane poke, a state event-log tail, then a bounded poll fallback.
 * Losing a wake changes nothing durable. The tail read and sleep are injected so
 * tests never sleep.
 */
import type { DaemonClockPort, DaemonWakeKind, DaemonWakePort } from "@delivery-os/core/contracts";

export type EventLogWakeOptions = {
  readonly readSize: () => number;
  readonly clock: DaemonClockPort;
  readonly pollIntervalMs: number;
};

export type EventLogWake = DaemonWakePort & { readonly poke: () => void };

export const createEventLogWake = (options: EventLogWakeOptions): EventLogWake => {
  let poked = false;
  let lastSize = options.readSize();
  return {
    poke: () => {
      poked = true;
    },
    next: async (timeoutMs): Promise<DaemonWakeKind> => {
      if (poked) {
        poked = false;
        return "poke";
      }
      const wait = Math.max(0, Math.min(options.pollIntervalMs, timeoutMs));
      await options.clock.sleep(wait, { cancelled: () => false });
      const size = options.readSize();
      if (size !== lastSize) {
        lastSize = size;
        return "tail";
      }
      return "timeout";
    },
  };
};

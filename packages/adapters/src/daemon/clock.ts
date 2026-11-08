/**
 * The injected clock edge (GH-238 F-1, F-9; DEC-6; NFR-12).
 *
 * Node timers live only at this adapter edge. Core reads every interval,
 * timeout, and backoff through the port.
 */
import type { DaemonClockPort } from "@delivery-os/core/contracts";

export const createNodeClock = (): DaemonClockPort => ({
  nowMs: () => Date.now(),
  nowIso: () => new Date(Date.now()).toISOString(),
  sleep: (ms, signal) =>
    new Promise<void>((resolve) => {
      if (ms <= 0 || signal?.cancelled() === true) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        clearInterval(poll);
        resolve();
      }, ms);
      const poll = setInterval(
        () => {
          if (signal?.cancelled() === true) {
            clearTimeout(timer);
            clearInterval(poll);
            resolve();
          }
        },
        Math.min(ms, 250),
      );
    }),
});

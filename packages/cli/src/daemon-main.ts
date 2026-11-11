/**
 * The resident process entry (GH-238 F-1).
 *
 * `daemon start` spawns this module through the injected supervisor for the
 * resident form; `--foreground` runs the same loop in the invoking process. The
 * entry is a library export, not a `bin`.
 */
import type { DaemonStartData } from "@delivery-os/core/contracts";
import { createDaemonCommandRuntime, type DaemonComposition } from "./daemon-compose.js";

export type DaemonMainSignals = {
  /** Resolves on SIGTERM/SIGINT; the injected edge owns process signals. */
  readonly waitForStop: () => Promise<"drain" | "immediate">;
};

export type DaemonMainResult =
  | { readonly ok: true; readonly data: DaemonStartData }
  | { readonly ok: false; readonly code: string };

export const createDaemonMainEntry =
  (composition: DaemonComposition, signals: DaemonMainSignals) =>
  async (): Promise<DaemonMainResult> => {
    const runtime = createDaemonCommandRuntime(composition);
    // The stop subscription is opened BEFORE `runtime.start` so the durable
    // readiness record is never observable while only the default signal
    // disposition exists: a stop delivered immediately after the start receipt
    // is buffered by the returned promise and applied after start returns,
    // instead of terminating the process with no release record (GH-286 NF3-3).
    // The seam exposes no cancel, so a failed start leaves that subscription to
    // the caller's process teardown, which exits immediately on this path.
    const stopRequested = signals.waitForStop();
    const started = await runtime.start({ foreground: true });
    if ("error" in started) {
      // The seam exposes no cancel; observe the pending stop so a later
      // rejection cannot surface as an unhandled rejection during teardown.
      void stopRequested.catch(() => {});
      return { ok: false, code: started.error.code };
    }
    const running = runtime.loop?.() ?? Promise.resolve();
    const stopMode = await stopRequested;
    await runtime.stop({ mode: stopMode });
    await running;
    return { ok: true, data: started.data };
  };

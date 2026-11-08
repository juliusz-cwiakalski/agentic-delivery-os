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
    const started = await runtime.start({ foreground: true });
    if ("error" in started) return { ok: false, code: started.error.code };
    const running = runtime.loop?.() ?? Promise.resolve();
    const stopMode = await signals.waitForStop();
    await runtime.stop({ mode: stopMode });
    await running;
    return { ok: true, data: started.data };
  };

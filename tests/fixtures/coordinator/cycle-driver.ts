/**
 * The injected cycle driver/clock seam for the coordinator foreground loop
 * (GH-241 AC-F1-5, TC-COORD-099).
 *
 * The driver advances N cycle boundaries deterministically. It never uses
 * `setTimeout`, `Date.now`, or a real timer; each bounded wait is recorded, and
 * stop, fatal, and signal events are delivered by data.
 */
export type CycleOutcome = "continue" | "stop";

export type CycleEvent =
  | { readonly kind: "stop"; readonly afterCycle: number }
  | { readonly kind: "signal"; readonly afterCycle: number }
  | { readonly kind: "throw"; readonly afterCycle: number; readonly error: unknown };

export type CycleDriverOptions = {
  /** The number of cycle boundaries the driver runs at most. */
  readonly cycles?: number;
  /** The terminating event; the default is a clean stop after the cycles. */
  readonly exit?: "stopped" | "signal";
  /** Events delivered at declared boundaries (index is 0-based, after the run). */
  readonly events?: readonly CycleEvent[];
  /** Runs before each cycle (used to append a stop request or change facts). */
  readonly beforeCycle?: (index: number) => void;
  /** The injected bounded wait value recorded per boundary. */
  readonly intervalMs?: number;
};

export type CycleDriver = {
  /** Recorded bounded waits (one per boundary). */
  readonly waits: number[];
  readonly boundaries: number;
  readonly run: (onCycle: () => Promise<CycleOutcome>) => Promise<"stopped" | "signal">;
};

export const createCycleDriver = (options: CycleDriverOptions = {}): CycleDriver => {
  const waits: number[] = [];
  let boundaries = 0;
  const cycles = options.cycles ?? 1;
  return {
    waits,
    get boundaries() {
      return boundaries;
    },
    run: async (onCycle) => {
      for (let index = 0; index < cycles; index += 1) {
        boundaries += 1;
        waits.push(options.intervalMs ?? 1);
        options.beforeCycle?.(index);
        const event = options.events?.find((candidate) => candidate.afterCycle === index);
        if (event !== undefined) {
          if (event.kind === "throw") throw event.error;
          return event.kind === "signal" ? "signal" : "stopped";
        }
        const outcome = await onCycle();
        if (outcome === "stop") return "stopped";
      }
      return options.exit ?? "stopped";
    },
  };
};

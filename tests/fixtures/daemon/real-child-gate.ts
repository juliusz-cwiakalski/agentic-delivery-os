/**
 * The cross-file real-child gate (GH-286 NF3-4).
 *
 * Two suites spawn a real `#!/usr/bin/env bun` child: the post-crash takeover
 * case and the real detached re-entry case. Under `bun test` with default
 * concurrency the two files run at the same time, and one child's readiness
 * window, heartbeat write, or release poll then has to compete with the other
 * child's interpreter start-up. The product readiness window is pinned by
 * AC-F2-2 and must not be widened for a test, so the real-child work is
 * serialized across files instead: a shared exclusive lock file in the
 * repository's temp root is acquired for the duration of each case, with a
 * bounded wait and a stale-holder takeover, and released in `finally`.
 *
 * The gate never asserts product behaviour; it only orders the two real-child
 * cases so neither timer can be starved by the other.
 */
import { closeSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The shared lock file; both real-child suites resolve it from `TMPDIR`. */
const GATE_PATH = join(tmpdir(), "gh286-real-child.gate");
/** The longest a waiter blocks before failing with the holder's own evidence. */
const WAIT_MS = 10_000;
/** A gate older than this belongs to a process that died without releasing it. */
const STALE_MS = 30_000;
/** Poll cadence while another file holds the gate. */
const POLL_MS = 50;

export type RealChildGate = {
  readonly release: () => void;
};

const holderOrUnknown = (): string => {
  try {
    return readFileSync(GATE_PATH, "utf8");
  } catch {
    return "unknown";
  }
};

/**
 * Acquire the shared real-child gate, waiting at most `WAIT_MS` for the other
 * suite. A gate whose holder died is taken over once it is older than
 * `STALE_MS`. The returned `release` removes the file and is safe to call once.
 */
export const acquireRealChildGate = async (label: string): Promise<RealChildGate> => {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    try {
      const handle = openSync(GATE_PATH, "wx", 0o600);
      writeSync(
        handle,
        JSON.stringify({ label, pid: process.pid, acquiredAt: new Date().toISOString() }),
      );
      closeSync(handle);
      let released = false;
      return {
        release: () => {
          if (released) return;
          released = true;
          try {
            unlinkSync(GATE_PATH);
          } catch {
            // A stale takeover already removed it; nothing is left to free.
          }
        },
      };
    } catch {
      try {
        if (Date.now() - statSync(GATE_PATH).mtimeMs > STALE_MS) unlinkSync(GATE_PATH);
      } catch {
        // Another waiter removed the stale gate first; retry the exclusive create.
      }
      if (Date.now() > deadline) {
        throw new Error(
          `the real-child gate ${GATE_PATH} was not released within ${WAIT_MS} ms; holder=${holderOrUnknown()}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }
};

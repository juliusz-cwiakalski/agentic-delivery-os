/**
 * The append-only loop-log file-system double (GH-348 F-7, DM-7; TC-LOG-003/004).
 *
 * It models exactly the declared retention rule: one active file, one retained
 * generation, whole-line appends, rotation only when an append would pass the
 * active bound, and the oldest generation discarded. A failure injector makes an
 * append or a rotation fail so the caller's error-swallowing property can be
 * asserted. No real file is touched.
 */
import {
  LOOP_MAX_LOG_ACTIVE_BYTES,
  LOOP_MAX_LOG_LINE_BYTES,
} from "../../../packages/core/src/contracts/index";
import { logByteLength, planLogAppend } from "../../../packages/core/src/domain/index";

export type LogAppendOutcome = {
  readonly ok: boolean;
  readonly rotated: boolean;
  readonly dropped: boolean;
  readonly bytes: number;
};

export type LogFs = {
  /** The active file's text (empty when nothing was appended). */
  active: () => string;
  /** The single retained generation's text, or `null` when none is retained. */
  generation: () => string | null;
  /** The newest data as lines, oldest first. */
  lines: () => readonly string[];
  append: (line: string) => LogAppendOutcome;
  /** The bounded tail read: `n` lines, the byte total, and the truncation flag. */
  readTail: (n: number) => {
    readonly lines: readonly string[];
    readonly totalBytes: number;
    readonly truncated: boolean;
    readonly unreadable: boolean;
  };
  /** Every rotation the double performed, in order. */
  readonly rotations: readonly number[];
  /** Every write the double refused because it was armed to fail. */
  readonly failures: readonly string[];
  setFailing: (value: boolean) => void;
  /** Seed the active file's bytes (the "near the bound" precondition). */
  seedActive: (text: string) => void;
  /** Mark the active file unreadable for the read projection. */
  setUnreadable: (value: boolean) => void;
  /** The active file's declared byte size. */
  activeBytes: () => number;
};

export const createLogFs = (): LogFs => {
  let active = "";
  let retired: string | null = null;
  let failing = false;
  let unreadable = false;
  const rotations: number[] = [];
  const failures: string[] = [];

  const bytes = (text: string): number => logByteLength(text);

  return {
    active: () => active,
    generation: () => retired,
    lines: () => active.split("\n").filter((line) => line.length > 0),
    activeBytes: () => bytes(active),
    rotations,
    failures,
    append: (line) => {
      if (failing) {
        failures.push(line);
        return { ok: false, rotated: false, dropped: false, bytes: bytes(active) };
      }
      const lineBytes = bytes(`${line}\n`);
      if (lineBytes > LOOP_MAX_LOG_LINE_BYTES) {
        return { ok: false, rotated: false, dropped: true, bytes: bytes(active) };
      }
      const plan = planLogAppend({
        activeBytes: bytes(active),
        lineBytes,
        maxActiveBytes: LOOP_MAX_LOG_ACTIVE_BYTES,
      });
      if (plan.drop) return { ok: false, rotated: false, dropped: true, bytes: bytes(active) };
      if (plan.rotate) {
        rotations.push(bytes(active));
        retired = active;
        active = "";
      }
      active = `${active}${line}\n`;
      return { ok: true, rotated: plan.rotate, dropped: false, bytes: bytes(active) };
    },
    readTail: (n) => {
      const bounded = Math.max(1, Math.min(100, Math.trunc(n)));
      if (unreadable) {
        return { lines: [], totalBytes: 0, truncated: false, unreadable: true };
      }
      const all = active.split("\n").filter((line) => line.length > 0);
      const tail = all.slice(Math.max(0, all.length - bounded));
      return {
        lines: tail,
        totalBytes: bytes(active),
        truncated: all.length > tail.length,
        unreadable: false,
      };
    },
    setFailing: (value) => {
      failing = value;
    },
    seedActive: (text) => {
      active = text;
    },
    setUnreadable: (value) => {
      unreadable = value;
    },
  };
};

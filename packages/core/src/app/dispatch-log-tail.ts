/**
 * `dispatch log` — the addressed-directory read over the artifact family
 * (GH-354 F-2; API-2, API-7; DM-2, DM-6; DEC-3; TDR-0058 DC-3).
 *
 * It lists ONLY the addressed reference's own directory (the only permitted
 * listing), reads only files inside it, stitches the retained files in NAME
 * order into one byte stream, drops an unterminated tail, splits on LF only
 * after the stitch, and returns the newest requested lines oldest-to-newest. A
 * read is a snapshot of what was durable: no lock, no flush, no deletion.
 */
import {
  DISPATCH_LOG_RETAINED_FILES,
  type DispatchLogData,
  type DispatchLogFileSystem,
} from "#contracts";
import { boundDispatchLogLines, stitchDispatchLogLines } from "../domain/dispatch-log.js";
import { dispatchLogsRefDirectory } from "./dispatch-log-sink.js";

export type DispatchLogReadInput = {
  readonly familyRoot: string;
  readonly ref: string;
  /** The already-validated requested tail (1..500). */
  readonly tail: number;
  readonly fs: DispatchLogFileSystem;
  /**
   * The candidate-level byte measure the caller's rendered shape needs. A
   * binding byte bound yields the single `bytes`-scope truncation fact.
   */
  readonly measureBytes?: (lines: readonly string[]) => number;
  readonly maxBytes?: number;
  readonly maxLines?: number;
};

/**
 * Read the reference's own directory and answer.
 *
 * `no-log` (exit 0) covers the absent directory — every one-shot lane and every
 * pre-change lane; `unreadable` (exit 1) covers a directory or file the edge
 * cannot read; a retained file with no complete line is an available, empty
 * answer, so "no capture" and "no output" stay distinct.
 */
export const readDispatchLog = (input: DispatchLogReadInput): DispatchLogData => {
  const directory = dispatchLogsRefDirectory(input.familyRoot, input.ref);
  const offline = (reason: "no-log" | "unreadable"): DispatchLogData => ({
    query: "log",
    ref: input.ref,
    available: false,
    reason,
    tail: input.tail,
    lines: [],
  });

  if (!input.fs.exists(directory)) return offline("no-log");
  const entries = input.fs.list(directory);
  if (entries === undefined) return offline("unreadable");
  const retained = [...entries]
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"))
    .slice(-DISPATCH_LOG_RETAINED_FILES);

  const files: { name: string; text: string }[] = [];
  for (const name of retained) {
    const text = input.fs.read(`${directory}/${name}`);
    // A file that exists but cannot be read is `unreadable`, never `no-log`.
    if (text === undefined) return offline("unreadable");
    files.push({ name, text });
  }

  const lines = stitchDispatchLogLines(files);
  const bounded = boundDispatchLogLines({
    lines,
    requested: input.tail,
    ...(input.maxLines === undefined ? {} : { maxLines: input.maxLines }),
    ...(input.maxBytes === undefined ? {} : { maxBytes: input.maxBytes }),
    ...(input.measureBytes === undefined ? {} : { measureBytes: input.measureBytes }),
  });
  return {
    query: "log",
    ref: input.ref,
    available: true,
    tail: input.tail,
    lines: bounded.lines,
    ...(bounded.truncation === undefined ? {} : { truncation: bounded.truncation }),
  };
};

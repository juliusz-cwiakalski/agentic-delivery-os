/**
 * The per-stream stdout artifact sink (GH-354 F-7; API-8; DM-2; TDR-0056 DR-4,
 * DR-5; PM ruling (c)).
 *
 * One sink per stream of a STREAMING adapter, bound when the stream starts and
 * before its first yielded value. It writes the declared transformation (every
 * yielded value followed by exactly one LF), starts the stream's next segment
 * instead of modifying bytes already written, and retains the newest two files
 * per reference after a new file exists.
 *
 * The sink is NON-GATING: every fault is swallowed, so a sink failure never
 * changes the delivery's token, exit, record, or evidence and adds no evidence
 * identifier. No lock, no trim, no rewrite, no shared write target.
 */
import {
  DISPATCH_LOG_DIRECTORY_PREFIX,
  DISPATCH_LOG_RETAINED_FILES,
  type DispatchLogFileSystem,
  type DispatchLogStreamKind,
  type HarnessStreamSink,
} from "#contracts";
import {
  dispatchLogFileName,
  planDispatchLogWrites,
  retainedDispatchLogNames,
} from "../domain/dispatch-log.js";

/** The family directory name for one workspace (outside the ledger family). */
export const dispatchLogsDirectoryName = (workspaceId: string): string =>
  `${DISPATCH_LOG_DIRECTORY_PREFIX}.${encodeURIComponent(workspaceId)}`;

/** The family root for one workspace inside the project state directory. */
export const dispatchLogsFamilyRoot = (stateDirectory: string, workspaceId: string): string =>
  `${stateDirectory}/${dispatchLogsDirectoryName(workspaceId)}`;

/** One reference's own directory: the only directory a query may list. */
export const dispatchLogsRefDirectory = (familyRoot: string, ref: string): string =>
  `${familyRoot}/${ref}`;

export type DispatchLogSinkInput = {
  readonly ref: string;
  /** The family root (`dispatch-logs.<workspace>`), never the ledger directory. */
  readonly familyRoot: string;
  readonly recordedAt: string;
  readonly streamKind: DispatchLogStreamKind;
  readonly attemptId?: string;
  readonly iterationOrdinal?: number;
};

/**
 * Build one stream's sink over the injected filesystem edge.
 *
 * Construction creates the reference directory and the stream's first segment,
 * so the file exists BEFORE the stream's first yielded value. A construction or
 * write fault is swallowed and turns the sink into a no-op.
 */
export const createDispatchLogSink = (input: {
  readonly context: DispatchLogSinkInput;
  readonly fs: DispatchLogFileSystem;
}): HarnessStreamSink => {
  const { fs, context } = input;
  const directory = dispatchLogsRefDirectory(context.familyRoot, context.ref);
  let segmentOrdinal = 1;
  let currentSize = 0;
  let currentPath: string | undefined;
  let disabled = false;

  const fileName = (segment: number): string =>
    dispatchLogFileName({
      recordedAt: context.recordedAt,
      streamKind: context.streamKind,
      segmentOrdinal: segment,
      ...(context.attemptId === undefined ? {} : { attemptId: context.attemptId }),
      ...(context.iterationOrdinal === undefined
        ? {}
        : { iterationOrdinal: context.iterationOrdinal }),
    });

  const openSegment = (segment: number): string | undefined => {
    const path = `${directory}/${fileName(segment)}`;
    if (fs.create(path)) return path;
    // A replay of the same inputs is not a failure: adopt the existing file and
    // append to it, so a re-run never truncates a written byte.
    const size = fs.size(path);
    if (size === undefined) return undefined;
    currentSize = size;
    return path;
  };

  const retain = (): void => {
    const entries = fs.list(directory);
    if (entries === undefined) return;
    const retained = retainedDispatchLogNames(
      entries.map((entry) => entry.name),
      DISPATCH_LOG_RETAINED_FILES,
    );
    for (const name of retained.remove) fs.remove(`${directory}/${name}`);
  };

  // Create the stream's first segment before the first value is observed.
  try {
    if (!fs.ensureDirectory(directory)) disabled = true;
    else {
      currentPath = openSegment(segmentOrdinal);
      if (currentPath === undefined) disabled = true;
    }
  } catch {
    disabled = true;
  }

  return {
    write: (value: string): void => {
      if (disabled) return;
      try {
        const writes = planDispatchLogWrites({ value, currentSizeBytes: currentSize });
        for (const write of writes) {
          if (write.startsSegment) {
            segmentOrdinal += 1;
            const next = openSegment(segmentOrdinal);
            if (next === undefined) {
              disabled = true;
              return;
            }
            currentPath = next;
            currentSize = fs.size(next) ?? 0;
            // The new file exists before the oldest is removed (best effort).
            try {
              retain();
            } catch {
              // A failed retention leaves the extra file until the next append.
            }
          }
          if (currentPath === undefined) {
            disabled = true;
            return;
          }
          if (!fs.append(currentPath, write.text)) {
            disabled = true;
            return;
          }
          currentSize = fs.size(currentPath) ?? currentSize;
        }
      } catch {
        disabled = true;
      }
    },
    close: (): void => {
      // Nothing to flush: every append is a single write, and the writer never
      // holds buffered bytes. The close is declared so the adapter can call it.
    },
  };
};

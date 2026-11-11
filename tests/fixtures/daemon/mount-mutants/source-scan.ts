/**
 * The source-scan boundary the absence claims are anchored on.
 *
 * The daemon composition's unresolvable outcome is a local, non-exported
 * refusing-runtime factory in `packages/cli/src/production.ts`. The scan reads
 * exactly that factory (from its declaration to its closing brace) and asserts
 * the boundary span composes no store, lock, settings, transport, socket path,
 * supervisor scope, entry path, or pid. It does not scan the rest of the file
 * and makes no claim about the full-runtime branch.
 */

const MARKER = "const unavailableDaemonRuntime = (): DaemonCommandRuntime =>";

/**
 * The refusal-factory span, or `undefined` when the anchor is not found. A
 * missing anchor is a scan failure, never an empty pass.
 */
export const refusingRuntimeSpan = (source: string): string | undefined => {
  const start = source.indexOf(MARKER);
  if (start < 0) return undefined;
  let depth = 0;
  let opened = false;
  for (let index = start; index < source.length; index += 1) {
    const token = source[index];
    if (token === "{") {
      depth += 1;
      opened = true;
    } else if (token === "}") {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, index + 1);
    }
  }
  return undefined;
};

/** The construction tokens the refusing span must not contain. */
export const FORBIDDEN_CONSTRUCTIONS = [
  "createStateStore",
  "createDaemonLockPort",
  "resolveDaemonSettings",
  "createUnixTransport",
  "socketPath",
  "supervisorConfigDirectory",
  "daemonEntry",
  "pid:",
  "spawnDetached",
  "createDaemonCommandRuntime",
] as const;

/** Every forbidden construction the span contains; empty means the claim holds. */
export const forbiddenConstructions = (span: string): readonly string[] => {
  // The factory's declared return type names `DaemonCommandRuntime`, which is a
  // type annotation rather than a construction; strip the signature line first.
  const body = span.includes("\n") ? span.slice(span.indexOf("\n")) : span;
  return FORBIDDEN_CONSTRUCTIONS.filter((token) => body.includes(token));
};

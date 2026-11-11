/**
 * Mutant: a hardcoded socket name (and heartbeat interval) is used in the
 * production composition instead of the resolved settings, so a configured
 * `daemon.socket-path` or `daemon.heartbeat-interval` never reaches the runtime.
 *
 * Consumed by `tests/checks/daemon-mutants.test.ts`; the named source scan
 * (`tests/behaviour/daemon-status.test.ts`) and the configured-branch assertion
 * both trip on the literal.
 */
export const name = "literal-socket";
export const target = "packages/cli/src/production.ts";
export const suite = "tests/behaviour/daemon-status.test.ts";
export const assertion = "no literal socket name or interval is re-derived in the composition";
export const description = "a hardcoded socket name and interval replace the resolved settings";

const ORIGINAL = "socketPath: configuration.settings.socketPath,";

// The placeholder is assembled so the file itself carries no template literal.
const MUTATED = [
  "socketPath: `",
  "$",
  "{directory}/daemon.sock`, /* literal interval 5_000 */",
].join("");

export const apply = (source: string): string => {
  if (!source.includes(ORIGINAL)) throw new Error("literal-socket: anchor not found");
  return source.replace(ORIGINAL, MUTATED);
};

/** The invariant the named scan asserts: no literal socket name or interval. */
export const violates = (source: string): boolean =>
  source.includes("daemon.sock") || source.includes("5_000");

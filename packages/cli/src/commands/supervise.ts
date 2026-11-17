/**
 * `supervise` command — the operator-facing supervisor battery (GH-295 F-1).
 *
 * One battery invocation with no positionals and the global `--json` switch:
 * the parser refuses any extra positional or unknown flag before this handler
 * runs, so containment precedes every read. The handler runs one battery pass
 * and returns the report; the human render reads the same object, and the
 * envelope's exit projection is the shared surface's.
 */

import type { SupervisionReadPort, SupervisionWritePort } from "@delivery-os/core";
import { renderSupervisionHuman, runSupervisionBattery } from "@delivery-os/core";
import type { CommandDefinition } from "../index.js";

/** Everything the supervise surface needs; every dynamic value is injected. */
export type SuperviseCommandRuntime = {
  /** The invoking checkout's single managed repository key. */
  readonly repository: string;
  readonly read: SupervisionReadPort;
  /** The delivered park append path; absent keeps the run read-only. */
  readonly write?: SupervisionWritePort;
  readonly nowMs: () => number;
  readonly nowIso: () => string;
};

/**
 * Build the one battery command. `positionals.max` is zero so any extra
 * positional is refused by the parser (`fallback.invocation`) before the
 * handler; there are no command-specific flags, and `--json` is global.
 */
export const createSuperviseCommandDefinition = (
  runtime: SuperviseCommandRuntime,
): CommandDefinition => ({
  flags: [],
  positionals: { max: 0 },
  humanText: (data, brand) => renderSupervisionHuman(data, brand),
  handler: () => {
    const result = runSupervisionBattery({
      repository: runtime.repository,
      nowMs: runtime.nowMs(),
      nowIso: runtime.nowIso(),
      read: runtime.read,
      ...(runtime.write === undefined ? {} : { write: runtime.write }),
    });
    if (!result.ok) {
      return { error: { kind: result.kind, code: result.code, summary: result.summary } };
    }
    return { data: result.report };
  },
});

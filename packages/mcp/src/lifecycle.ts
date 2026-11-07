/**
 * The single MCP exit owner (F-1, DEC-1, DEC-6).
 *
 * The lifecycle exit vocabulary is a transport contract, distinct from the CLI
 * error-table projection: `0` after a clean stop, `1` when the server cannot
 * start because of a configuration error, `2` on a transport/framing fault. No
 * tool outcome ever reaches an exit site: a failed tool call is answered
 * in-protocol and serving continues. Diagnostics go only to the diagnostics
 * channel; the transport channel carries JSON-RPC frames only.
 */

/** The lifecycle signal the composition root resolves. */
export type LifecycleOutcome =
  | { readonly kind: "clean" }
  | { readonly kind: "configuration"; readonly detail: string }
  | { readonly kind: "transport-fault"; readonly detail: string };

/** The diagnostics channel; never the transport channel. */
export type LifecycleDiagnostics = {
  readonly write: (line: string) => void;
};

/** The exit code for one lifecycle outcome. */
export const exitCodeFor = (outcome: LifecycleOutcome): 0 | 1 | 2 => {
  switch (outcome.kind) {
    case "clean":
      return 0;
    case "configuration":
      return 1;
    case "transport-fault":
      return 2;
  }
};

/** Write the diagnostic (when any) and exit with the pinned code. */
export const runLifecycle = (
  outcome: LifecycleOutcome,
  diagnostics: LifecycleDiagnostics,
): never => {
  if (outcome.kind === "configuration") {
    diagnostics.write(`mcp: configuration error: ${outcome.detail}\n`);
    process.exit(1);
  }
  if (outcome.kind === "transport-fault") {
    diagnostics.write(`mcp: transport fault: ${outcome.detail}\n`);
    process.exit(2);
  }
  process.exit(0);
};

/**
 * The `repos list` command (GH-309 F-7, DM-3, ODR-0004).
 *
 * The flat record set under its delivered name: `repos list [--json]` returns
 * the renamed `repos.v1` payload (`data.repos[]` with `repoKey`, `root`,
 * `stateLocation`, `daemonReachable`, `handoverState`, plus
 * `hostIndexRevision`). The handler owns no stream writes and chooses no exit
 * code: a classified failure carries the identity its table row projects. The
 * family has exactly one verb, so any other token is refused through the shared
 * invocation classification before the host index is read.
 */
import { REPOS_LIST_VERB, type ReposListData } from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";
import { renderReposText } from "../output/repos-text.js";

/** One bounded flat list read: the payload or a classified failure identity. */
export type ReposRuntimeRead =
  | {
      readonly ok: true;
      readonly data: ReposListData;
      readonly warnings?: readonly string[];
    }
  | { readonly ok: false; readonly code: string; readonly summary?: string };

/** Everything the handler reads, injected at the edge. */
export type ReposCommandRuntime = {
  readonly readRepos: () => ReposRuntimeRead | Promise<ReposRuntimeRead>;
};

const refusal = (verb: string | undefined): { readonly error: Record<string, string> } => ({
  error: {
    kind: "fallback",
    code: "fallback.invocation",
    summary:
      verb === undefined
        ? "result=refused; reason=missing-verb; expected `repos list`"
        : `result=refused; reason=unknown-verb; "${verb}" is not a repos verb`,
  },
});

/** Build the `repos` command definition over the injected host read. */
export const createReposCommandDefinition = (runtime: ReposCommandRuntime): CommandDefinition => ({
  positionals: { max: 2 },
  humanText: (data: unknown): string => renderReposText(data as ReposListData),
  handler: async (invocation) => {
    const [verb, ...extra] = invocation.positionals;
    if (verb !== REPOS_LIST_VERB || extra.length > 0) return refusal(verb);
    const read = await runtime.readRepos();
    if (!read.ok) {
      return {
        error: {
          kind: "repos",
          code: read.code,
          ...(read.summary === undefined ? {} : { summary: read.summary }),
        },
      };
    }
    return {
      data: read.data,
      ...(read.warnings === undefined || read.warnings.length === 0
        ? {}
        : { warnings: read.warnings }),
    };
  },
});

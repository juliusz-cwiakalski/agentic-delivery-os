/**
 * The `projects list` command (GH-288 F-3, DEC-5, DEC-16, DEC-17).
 *
 * The handler owns no stream writes and chooses no exit code: it returns the
 * `projects.v1` payload or a classified failure whose table row carries the
 * projection. The family has exactly one verb, so any other token is refused
 * through the shared invocation classification *before* the host index is read
 * — an unknown verb performs no state read and writes nothing.
 */
import { PROJECTS_LIST_VERB, type ProjectsListData } from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";
import { renderProjectsText } from "../output/projects-text.js";

/** One bounded list read: the payload or a classified failure identity. */
export type ProjectsRuntimeRead =
  | {
      readonly ok: true;
      readonly data: ProjectsListData;
      readonly warnings?: readonly string[];
    }
  | { readonly ok: false; readonly code: string; readonly summary?: string };

/** Everything the handler reads, injected at the edge. */
export type ProjectsCommandRuntime = {
  readonly readProjects: () => ProjectsRuntimeRead | Promise<ProjectsRuntimeRead>;
};

const refusal = (verb: string | undefined): { readonly error: Record<string, string> } => ({
  error: {
    kind: "fallback",
    code: "fallback.invocation",
    summary:
      verb === undefined
        ? "result=refused; reason=missing-verb; expected `projects list`"
        : `result=refused; reason=unknown-verb; "${verb}" is not a projects verb`,
  },
});

/** Build the `projects` command definition over an injected host-overview read. */
export const createProjectsCommandDefinition = (
  runtime: ProjectsCommandRuntime,
): CommandDefinition => ({
  positionals: { max: 2 },
  humanText: (data: unknown): string => renderProjectsText(data as ProjectsListData),
  handler: async (invocation) => {
    const [verb, ...extra] = invocation.positionals;
    if (verb !== PROJECTS_LIST_VERB || extra.length > 0) return refusal(verb);
    const read = await runtime.readProjects();
    if (!read.ok) {
      return {
        error: {
          kind: "projects",
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

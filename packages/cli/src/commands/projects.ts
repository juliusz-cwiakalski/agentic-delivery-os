/**
 * The `projects list` command (GH-288 F-3, DEC-5, DEC-16, DEC-17; GH-309 F-1).
 *
 * The handler owns no stream writes and chooses no exit code: it returns the
 * `projects.v1` payload (the delivered flat form, unchanged until the rename
 * phase) or the `project-groups.v1` scoped read selected by `--project
 * <groupKey>` — never both, and never an intermediate shape. A classified
 * failure carries the identity its table row projects. The family has exactly
 * one verb, so any other token is refused through the shared invocation
 * classification *before* the host index is read.
 */
import {
  PROJECTS_LIST_VERB,
  type ProjectGroupsListData,
  type ProjectsListData,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";
import {
  isProjectGroupsListData,
  renderProjectGroupsText,
  renderProjectsText,
} from "../output/projects-text.js";

/** One bounded flat list read: the payload or a classified failure identity. */
export type ProjectsRuntimeRead =
  | {
      readonly ok: true;
      readonly data: ProjectsListData;
      readonly warnings?: readonly string[];
    }
  | { readonly ok: false; readonly code: string; readonly summary?: string };

/**
 * One bounded group-scoped read (GH-309 F-1, F-2): the `project-groups.v1`
 * payload for the requested group, or one of the classified identities
 * `projects.config-invalid` (exit 1), `projects.unknown-group` (exit 1), or
 * `projects.scope-unavailable` (exit 2).
 */
export type ProjectGroupRuntimeRead =
  | {
      readonly ok: true;
      readonly data: ProjectGroupsListData;
      readonly warnings?: readonly string[];
    }
  | { readonly ok: false; readonly code: string; readonly summary?: string };

/** Everything the handler reads, injected at the edge. */
export type ProjectsCommandRuntime = {
  readonly readProjects: () => ProjectsRuntimeRead | Promise<ProjectsRuntimeRead>;
  readonly readProjectGroup: (
    groupKey: string,
  ) => ProjectGroupRuntimeRead | Promise<ProjectGroupRuntimeRead>;
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

/** Build the `projects` command definition over the injected host reads. */
export const createProjectsCommandDefinition = (
  runtime: ProjectsCommandRuntime,
): CommandDefinition => ({
  positionals: { max: 2 },
  requiresValue: ["--project"],
  humanText: (data: unknown): string =>
    isProjectGroupsListData(data)
      ? renderProjectGroupsText(data)
      : renderProjectsText(data as ProjectsListData),
  handler: async (invocation) => {
    const [verb, ...extra] = invocation.positionals;
    if (verb !== PROJECTS_LIST_VERB || extra.length > 0) return refusal(verb);
    const groupKey = invocation.flags["--project"];
    if (typeof groupKey === "string") {
      const read = await runtime.readProjectGroup(groupKey);
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
    }
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

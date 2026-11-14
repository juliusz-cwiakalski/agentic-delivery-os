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
  type ProjectScopedMemberWork,
  type ProjectScopedWorkData,
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

/**
 * One group-scoped work read (GH-309 F-5, F-6): the `queue list --project` and
 * `status --project` payload, or one of the classified identities
 * `projects.config-invalid` (exit 1), `projects.unknown-group` (exit 1), or
 * `projects.scope-unavailable` (exit 2).
 */
export type ProjectGroupWorkRead =
  | { readonly ok: true; readonly data: ProjectScopedWorkData }
  | { readonly ok: false; readonly code: string; readonly summary?: string };

/** Whether one command payload is the group-scoped work projection. */
export const isProjectScopedWorkData = (value: unknown): value is ProjectScopedWorkData => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.groupKey === "string" && Array.isArray(record.members);
};

/**
 * Render the group-scoped work projection deterministically (GH-309 F-6):
 * one row per contributed queue entry, grouped by member in declared order and
 * split by the scheduling read's own state. A member that contributes no
 * records still renders its classification, so a degraded member never
 * silently vanishes from the text form.
 */
export const renderProjectScopedWorkText = (data: ProjectScopedWorkData): string => {
  const columns = ["GROUP", "MEMBER", "TRACKER", "OUTCOME", "BUCKET", "REF", "STATE"];
  const rows: string[] = [columns.join("\t")];
  for (const member of data.members) {
    const buckets: readonly (readonly [string, ProjectScopedMemberWork["running"]])[] = [
      ["running", member.running],
      ["waiting", member.waiting],
      ["parked", member.parked],
    ];
    let rendered = 0;
    for (const [bucket, entries] of buckets) {
      for (const entry of entries) {
        rows.push(
          [
            data.groupKey,
            member.repoKey,
            member.trackerKind,
            member.outcome,
            bucket,
            entry.ref,
            entry.state,
          ].join("\t"),
        );
        rendered += 1;
      }
    }
    if (rendered === 0) {
      rows.push(
        [
          data.groupKey,
          member.repoKey,
          member.trackerKind,
          member.outcome,
          "none",
          "-",
          member.health,
        ].join("\t"),
      );
    }
  }
  return `${rows.join("\n")}\n`;
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

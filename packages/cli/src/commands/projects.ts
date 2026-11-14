/**
 * The `projects list` command (GH-288 F-3, DEC-5, DEC-16, DEC-17; GH-309 F-1,
 * F-7, DM-2, DM-4).
 *
 * After the rename, the default form returns the `project-groups.v1` group
 * enumeration (`--project <groupKey>` scopes it to one configured group), while
 * `--flat` is the deprecation alias that returns the delivered `projects.v1`
 * payload unchanged (C-2). The handler owns no stream writes and chooses no
 * exit code: it returns exactly one of the three synopsis forms, never an
 * intermediate shape. `--flat` and `--project` are mutually exclusive and are
 * refused through the shared user-validation identity `input.value.rejected`
 * (OQ-2), never silently coerced. A classified failure carries the identity its
 * table row projects. The family has exactly one verb, so any other token is
 * refused through the shared invocation classification *before* the host index
 * is read.
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
  /** The delivered flat payload behind the `--flat` alias (C-2). */
  readonly readProjects: () => ProjectsRuntimeRead | Promise<ProjectsRuntimeRead>;
  /** The group enumeration over every configured group (the default form). */
  readonly readProjectGroups: () => ProjectGroupRuntimeRead | Promise<ProjectGroupRuntimeRead>;
  /** The one-group scoped read behind `--project <groupKey>`. */
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
  flags: ["--flat"],
  requiresValue: ["--project"],
  humanText: (data: unknown): string =>
    isProjectGroupsListData(data)
      ? renderProjectGroupsText(data)
      : renderProjectsText(data as ProjectsListData),
  handler: async (invocation) => {
    const [verb, ...extra] = invocation.positionals;
    if (verb !== PROJECTS_LIST_VERB || extra.length > 0) return refusal(verb);
    const flat = invocation.flags["--flat"] === true;
    const groupKey = invocation.flags["--project"];
    // OQ-2: the alias takes no group scoping. The combination is refused at
    // exit 1 under the shared broken-invocation identity, never coerced.
    if (flat && typeof groupKey === "string") {
      return {
        error: {
          kind: "input",
          code: "input.value.rejected",
          summary:
            "--flat and --project are mutually exclusive; the flat alias takes no group scoping",
        },
      };
    }
    if (flat) {
      const read = await runtime.readProjects();
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
    }
    const read =
      typeof groupKey === "string"
        ? await runtime.readProjectGroup(groupKey)
        : await runtime.readProjectGroups();
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

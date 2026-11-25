/**
 * The `projects list` human table (GH-288 F-3, AC-F3-2, NFR-3).
 *
 * Pure and byte-deterministic: the columns are `key`, `root`, `state`,
 * `daemon`, `handover` in that order, rows are sorted by key, and an
 * unreachable daemon renders its declared reason token rather than a bare
 * negative. No clock, locale, width, or map-iteration order participates.
 */
import type {
  DaemonReachability,
  ProjectGroupsListData,
  ProjectsListData,
} from "@delivery-os/core/contracts";

const SEPARATOR = "  ";

const HEADER = ["KEY", "ROOT", "STATE", "DAEMON", "HANDOVER"] as const;

const GROUP_HEADER = ["PRODUCT", "REPOSITORY", "TRACKER", "STATE", "HEALTH", "DAEMON"] as const;

/** The daemon cell: the reason token when unreachable, never a bare negative. */
export const daemonCell = (value: DaemonReachability): string =>
  value.reachable ? "reachable" : value.reason;

/** Whether a payload is the `project-groups.v1` group listing (GH-309 DM-2). */
export const isProjectGroupsListData = (data: unknown): data is ProjectGroupsListData =>
  typeof data === "object" &&
  data !== null &&
  !Array.isArray(data) &&
  Array.isArray((data as { readonly groups?: unknown }).groups);

/** Render the deterministic project table (header always present). */
export const renderProjectsText = (data: ProjectsListData): string => {
  const rows = [...data.projects]
    .sort((left, right) =>
      left.projectKey < right.projectKey ? -1 : left.projectKey > right.projectKey ? 1 : 0,
    )
    .map((entry) =>
      [
        entry.projectKey,
        entry.root,
        entry.stateLocation,
        daemonCell(entry.daemonReachable),
        entry.handoverState,
      ].join(SEPARATOR),
    );
  return `${[HEADER.join(SEPARATOR), ...rows].join("\n")}\n`;
};

/**
 * Render the deterministic group table (GH-309 F-4; the owner amendment
 * 7138707234 names the headers PRODUCT and REPOSITORY): one row per declared
 * member, member order preserved exactly as configured, the product's own
 * key repeated on every row. No clock, locale, width, or
 * map-iteration order participates.
 */
export const renderProjectGroupsText = (data: ProjectGroupsListData): string => {
  const rows: string[] = [];
  for (const group of data.groups) {
    for (const member of group.members) {
      rows.push(
        [
          group.groupKey,
          member.repoKey,
          member.trackerKind,
          member.state,
          member.health,
          daemonCell(member.daemonReachable),
        ].join(SEPARATOR),
      );
    }
  }
  return `${[GROUP_HEADER.join(SEPARATOR), ...rows].join("\n")}\n`;
};

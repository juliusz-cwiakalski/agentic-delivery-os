/**
 * The `projects list` human table (GH-288 F-3, AC-F3-2, NFR-3).
 *
 * Pure and byte-deterministic: the columns are `key`, `root`, `state`,
 * `daemon`, `handover` in that order, rows are sorted by key, and an
 * unreachable daemon renders its declared reason token rather than a bare
 * negative. No clock, locale, width, or map-iteration order participates.
 */
import type { DaemonReachability, ProjectsListData } from "@delivery-os/core/contracts";

const SEPARATOR = "  ";

const HEADER = ["KEY", "ROOT", "STATE", "DAEMON", "HANDOVER"] as const;

/** The daemon cell: the reason token when unreachable, never a bare negative. */
export const daemonCell = (value: DaemonReachability): string =>
  value.reachable ? "reachable" : value.reason;

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

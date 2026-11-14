/**
 * The `repos list` human table (GH-309 F-7, AC-F7-2, NFR-3).
 *
 * Pure and byte-deterministic: the columns are `key`, `root`, `state`,
 * `daemon`, `handover` in that order, rows are sorted by repo key, and an
 * unreachable daemon renders its declared reason token rather than a bare
 * negative. The cells are the delivered flat table's cells with the key's
 * contract name moved from `projectKey` to `repoKey`; no clock, locale, width,
 * or map-iteration order participates.
 */
import type { ReposListData } from "@delivery-os/core/contracts";
import { daemonCell } from "./projects-text.js";

const SEPARATOR = "  ";

const HEADER = ["KEY", "ROOT", "STATE", "DAEMON", "HANDOVER"] as const;

/** Whether a payload is the `repos.v1` flat listing (GH-309 F-7, DM-3). */
export const isReposListData = (data: unknown): data is ReposListData =>
  typeof data === "object" &&
  data !== null &&
  !Array.isArray(data) &&
  Array.isArray((data as { readonly repos?: unknown }).repos);

/** Render the deterministic flat record set table (header always present). */
export const renderReposText = (data: ReposListData): string => {
  const rows = [...data.repos]
    .sort((left, right) =>
      left.repoKey < right.repoKey ? -1 : left.repoKey > right.repoKey ? 1 : 0,
    )
    .map((entry) =>
      [
        entry.repoKey,
        entry.root,
        entry.stateLocation,
        daemonCell(entry.daemonReachable),
        entry.handoverState,
      ].join(SEPARATOR),
    );
  return `${[HEADER.join(SEPARATOR), ...rows].join("\n")}\n`;
};

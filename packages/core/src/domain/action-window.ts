/**
 * The improvement-window projection (GH-287 F-5, DM-5; DEC-6).
 *
 * Pure functions over recorded action states: the open count of a window, the
 * declared limit, and the disclosure pair every surface renders. Counts are
 * always derived from the records, never from a stored counter that could
 * drift, and a window with zero open actions still discloses count 0.
 */
import { ACTION_WIP_LIMIT, type RetroActionWindowDisclosure } from "#contracts";

/** One action's window membership plus whether its artifact plane is open. */
export type ActionWindowEntry = {
  readonly window: string;
  readonly open: boolean;
};

/** The open action count of one improvement window, derived from records. */
export const openActionCount = (entries: readonly ActionWindowEntry[], window: string): number =>
  entries.filter((entry) => entry.window === window && entry.open).length;

/** Whether a filing into the window would exceed the declared limit. */
export const windowAtLimit = (entries: readonly ActionWindowEntry[], window: string): boolean =>
  openActionCount(entries, window) >= ACTION_WIP_LIMIT;

/** Every declared window's count/limit disclosure, sorted by window name. */
export const windowDisclosures = (
  entries: readonly ActionWindowEntry[],
): readonly RetroActionWindowDisclosure[] => {
  const windows = new Set<string>();
  for (const entry of entries) windows.add(entry.window);
  return [...windows]
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map((window) => ({
      window,
      openCount: openActionCount(entries, window),
      limit: ACTION_WIP_LIMIT,
    }));
};

/** The disclosure of one window even when it carries no recorded action. */
export const windowDisclosure = (
  entries: readonly ActionWindowEntry[],
  window: string,
): RetroActionWindowDisclosure => ({
  window,
  openCount: openActionCount(entries, window),
  limit: ACTION_WIP_LIMIT,
});

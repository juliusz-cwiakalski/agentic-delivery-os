/**
 * `@delivery-os/cli` output tier (`#output/*` alias target).
 * Types only at scaffold.
 */

export { CEREMONY_HUMAN_BOUNDS, renderCeremonyText } from "./ceremony-text.js";
export { renderCommitHuman } from "./commit-text.js";
export {
  renderDispatchAttemptsText,
  renderDispatchHandoverText,
  renderDispatchResolveText,
  renderDispatchSummaryText,
  renderDispatchText,
} from "./dispatch-text.js";

/** Placeholder marker for the CLI output tier. */
export type CliOutputPlaceholder = { readonly __tier: "output" };
export { renderDeployHuman } from "./deploy-text.js";
export { renderEventsDescribeText, renderEventsListText } from "./events-text.js";
export {
  renderInstallFailure,
  renderInstallOutcome,
  renderInstallPlan,
  renderInstallStatus,
} from "./install-text.js";
export { renderDryRunHuman, renderMergeHuman } from "./merge-text.js";
export {
  daemonCell,
  isProjectGroupsListData,
  renderProjectGroupsText,
  renderProjectsText,
} from "./projects-text.js";
export { isReposListData, renderReposText } from "./repos-text.js";

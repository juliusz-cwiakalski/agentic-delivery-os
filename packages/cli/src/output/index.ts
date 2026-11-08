/**
 * `@delivery-os/cli` output tier (`#output/*` alias target).
 * Types only at scaffold.
 */

export { renderCommitHuman } from "./commit-text.js";
export {
  renderDispatchHandoverText,
  renderDispatchSummaryText,
  renderDispatchText,
} from "./dispatch-text.js";

/** Placeholder marker for the CLI output tier. */
export type CliOutputPlaceholder = { readonly __tier: "output" };
export { renderDeployHuman } from "./deploy-text.js";
export { renderDryRunHuman, renderMergeHuman } from "./merge-text.js";

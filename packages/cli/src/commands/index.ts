/**
 * `@delivery-os/cli` commands tier (`#commands/*` alias target).
 * Exposes the config command definition for edge composition.
 */

export type { ConfigCommandRuntime } from "./config.js";
export { createConfigCommandDefinition } from "./config.js";

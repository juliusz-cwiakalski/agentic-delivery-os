/**
 * Committed coordinator-configuration fixtures (GH-241 TC-COORD-080/056,
 * DEC-10; Appendix D).
 *
 * The invalid matrix exercises the declared domains: `stuck-window`,
 * `kill-grace`, `resume-context-limit`, `collection-interval`, and
 * `progress-bound` accept integers > 0; `restart-budget` accepts integers >= 0;
 * an unknown key uses `config.key.unknown` and a wrong type or invalid value
 * uses `config.value.invalid`.
 */
import type { ConfigSourceFacts, ConfigValue } from "../../../packages/core/src/contracts/config";
import { fileFacts } from "./facts";

export const coordinatorSource = (
  coordinator: ConfigValue,
  layer: "project-committed" | "user-global" = "project-committed",
): ConfigSourceFacts => fileFacts(layer, { coordinator }, 21);

export type InvalidCoordinatorCase = {
  readonly id: string;
  readonly coordinator: ConfigValue;
  readonly code: "config.key.unknown" | "config.value.invalid";
  /** The key is named only when the domain validator (not the schema) rejects. */
  readonly key: string | undefined;
};

export const INVALID_COORDINATOR_CASES: readonly InvalidCoordinatorCase[] = [
  {
    id: "unknown-key",
    coordinator: { "stuck-window": 600000, "max-restarts": 2 },
    code: "config.key.unknown",
    key: undefined,
  },
  { id: "budget-negative", coordinator: { "restart-budget": -1 }, code: "config.value.invalid", key: "coordinator.restart-budget" },
  { id: "budget-float", coordinator: { "restart-budget": 2.5 }, code: "config.value.invalid", key: "coordinator.restart-budget" },
  { id: "stuck-window-zero", coordinator: { "stuck-window": 0 }, code: "config.value.invalid", key: "coordinator.stuck-window" },
  { id: "stuck-window-negative", coordinator: { "stuck-window": -1 }, code: "config.value.invalid", key: "coordinator.stuck-window" },
  { id: "stuck-window-float", coordinator: { "stuck-window": 1.5 }, code: "config.value.invalid", key: "coordinator.stuck-window" },
  { id: "kill-grace-zero", coordinator: { "kill-grace": 0 }, code: "config.value.invalid", key: "coordinator.kill-grace" },
  { id: "resume-limit-zero", coordinator: { "resume-context-limit": 0 }, code: "config.value.invalid", key: "coordinator.resume-context-limit" },
  { id: "collection-zero", coordinator: { "collection-interval": 0 }, code: "config.value.invalid", key: "coordinator.collection-interval" },
  { id: "progress-bound-zero", coordinator: { "progress-bound": 0 }, code: "config.value.invalid", key: "coordinator.progress-bound" },
  { id: "budget-string", coordinator: { "restart-budget": "3" }, code: "config.value.invalid", key: undefined },
  { id: "branch-scalar", coordinator: "coordinator", code: "config.value.invalid", key: undefined },
] as const;

/** The valid non-default control. */
export const VALID_COORDINATOR_SOURCE: ConfigSourceFacts = coordinatorSource({
  "stuck-window": 120000,
  "kill-grace": 5000,
  "restart-budget": 4,
  "resume-context-limit": 50000,
  "collection-interval": 15000,
  "progress-bound": 60000,
});

/** A zero-budget control proving `0` is a valid admit-no-restarts policy. */
export const ZERO_BUDGET_SOURCE: ConfigSourceFacts = coordinatorSource({ "restart-budget": 0 });

/** A boundary control: every positive key at its smallest legal value. */
export const BOUNDARY_SOURCE: ConfigSourceFacts = coordinatorSource({
  "stuck-window": 1,
  "kill-grace": 1,
  "restart-budget": 0,
  "resume-context-limit": 1,
  "collection-interval": 1,
  "progress-bound": 1,
});

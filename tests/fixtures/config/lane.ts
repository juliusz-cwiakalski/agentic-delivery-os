/**
 * Committed lane-configuration fixtures (GH-235 TC-ECON-070/071, D-12).
 *
 * The invalid matrix follows D-12: `lane.restart-budget` accepts integers >= 0
 * (zero is a valid admit-no-restarts policy), `lane.liveness-interval` accepts
 * integers > 0, unknown keys use `config.key.unknown`, and wrong types or
 * invalid values use `config.value.invalid`.
 */
import type { ConfigSourceFacts, ConfigValue } from "../../../packages/core/src/contracts/config";
import { fileFacts } from "./facts";

export const laneSource = (
  lane: ConfigValue,
  layer: "project-committed" | "user-global" = "project-committed",
): ConfigSourceFacts => fileFacts(layer, { lane }, 21);

export type InvalidLaneCase = {
  readonly id: string;
  readonly lane: ConfigValue;
  readonly code: "config.key.unknown" | "config.value.invalid";
  readonly key: string;
};

export const INVALID_LANE_CASES: readonly InvalidLaneCase[] = [
  {
    id: "unknown-key",
    lane: { "liveness-interval": 30000, "restart-budget": 3, "max-restarts": 2 },
    code: "config.key.unknown",
    key: "lane",
  },
  {
    id: "budget-string",
    lane: { "liveness-interval": 30000, "restart-budget": "3" },
    code: "config.value.invalid",
    key: "lane",
  },
  {
    id: "budget-float",
    lane: { "liveness-interval": 30000, "restart-budget": 2.5 },
    code: "config.value.invalid",
    key: "lane.restart-budget",
  },
  {
    id: "budget-boolean",
    lane: { "liveness-interval": 30000, "restart-budget": true },
    code: "config.value.invalid",
    key: "lane",
  },
  {
    id: "budget-negative",
    lane: { "liveness-interval": 30000, "restart-budget": -1 },
    code: "config.value.invalid",
    key: "lane.restart-budget",
  },
  {
    id: "budget-non-integer",
    lane: { "liveness-interval": 30000, "restart-budget": 1.5 },
    code: "config.value.invalid",
    key: "lane.restart-budget",
  },
  {
    id: "interval-string",
    lane: { "liveness-interval": "30000", "restart-budget": 3 },
    code: "config.value.invalid",
    key: "lane",
  },
  {
    id: "interval-float",
    lane: { "liveness-interval": 30000.5, "restart-budget": 3 },
    code: "config.value.invalid",
    key: "lane.liveness-interval",
  },
  {
    id: "interval-boolean",
    lane: { "liveness-interval": false, "restart-budget": 3 },
    code: "config.value.invalid",
    key: "lane",
  },
  {
    id: "interval-zero",
    lane: { "liveness-interval": 0, "restart-budget": 3 },
    code: "config.value.invalid",
    key: "lane.liveness-interval",
  },
  {
    id: "interval-negative",
    lane: { "liveness-interval": -1, "restart-budget": 3 },
    code: "config.value.invalid",
    key: "lane.liveness-interval",
  },
  {
    id: "interval-non-integer",
    lane: { "liveness-interval": 1000.25, "restart-budget": 3 },
    code: "config.value.invalid",
    key: "lane.liveness-interval",
  },
  {
    id: "lane-scalar",
    lane: "lane",
    code: "config.value.invalid",
    key: "lane",
  },
] as const;

/** A resolvable zero bound: the positive control proving budget 0 is valid (D-12). */
export const ZERO_BUDGET_SOURCE: ConfigSourceFacts = laneSource({
  "liveness-interval": 30000,
  "restart-budget": 0,
});

/** The valid non-zero control. */
export const VALID_LANE_SOURCE: ConfigSourceFacts = laneSource({
  "liveness-interval": 15000,
  "restart-budget": 5,
});

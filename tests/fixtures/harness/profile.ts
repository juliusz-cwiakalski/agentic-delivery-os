/**
 * The declared profile and propagation fixtures (test plan §4.1 rule 4,
 * TC-HARNESS-011..016).
 *
 * Synthetic only: declared seats and resolved models, the agent→seat mapping
 * that resolves each spawn's single-seat binding, the unassigned case, the
 * unrepresentable models, and the conflicting ambient canaries. No recognised
 * model catalogue exists (DEC-14).
 */
import type { ProviderProfileSeat } from "../../../packages/core/src/contracts/index";
import type {
  HarnessProfileView,
  HarnessSelectionView,
} from "../../../packages/core/src/domain/index";

const seat = (model: string, envName?: string): ProviderProfileSeat => ({
  model,
  pacingClass: "execution",
  capability: "text-only",
  ...(envName === undefined ? {} : { envName }),
});

/** A three-seat profile: two agents via overrides, one agent by seat name. */
export const THREE_SEAT_PROFILE: HarnessProfileView = {
  seats: {
    "seat-judgment": seat("zai/glm-5#judgment", "CANARY_SEAT_JUDGMENT_MODEL"),
    "seat-execution": seat("deepseek/deepseek-flash"),
    reviewer: seat("openrouter/qwen3-coder#thinking"),
  },
  agentOverrides: {
    coder: "seat-judgment",
    writer: "seat-execution",
  },
};

/** The selection that resolves the same profile's seats to their models. */
export const THREE_SEAT_SELECTION: HarnessSelectionView = {
  agentOverrides: THREE_SEAT_PROFILE.agentOverrides,
  seatModels: {
    "seat-judgment": "zai/glm-5#judgment",
    "seat-execution": "deepseek/deepseek-flash",
    reviewer: "openrouter/qwen3-coder#thinking",
  },
};

/** The agents that profile binds, in the order the three-spawn case uses them. */
export const THREE_SEAT_AGENTS = ["coder", "writer", "reviewer"] as const;

/**
 * A single-seat profile whose sole seat is assigned to one named agent by an
 * override, with a declared name distinct from that agent identity.
 */
export const SINGLE_SEAT_PROFILE: HarnessProfileView = {
  seats: { "sole-seat": seat("zai/glm-5#judgment") },
  agentOverrides: { coder: "sole-seat" },
};

export const SINGLE_SEAT_SELECTION: HarnessSelectionView = {
  agentOverrides: SINGLE_SEAT_PROFILE.agentOverrides,
  seatModels: { "sole-seat": "zai/glm-5#judgment" },
};

/** A multi-seat profile that assigns no seat to `writer`. */
export const MULTI_SEAT_UNASSIGNED_PROFILE: HarnessProfileView = {
  seats: {
    "seat-judgment": seat("zai/glm-5#judgment"),
    "seat-execution": seat("deepseek/deepseek-flash"),
  },
  agentOverrides: { coder: "seat-judgment" },
};

export const MULTI_SEAT_UNASSIGNED_SELECTION: HarnessSelectionView = {
  agentOverrides: MULTI_SEAT_UNASSIGNED_PROFILE.agentOverrides,
  seatModels: {
    "seat-judgment": "zai/glm-5#judgment",
    "seat-execution": "deepseek/deepseek-flash",
  },
};

/** One unrepresentable resolved model per expressibility variant. */
export const UNREPRESENTABLE_MODELS: readonly { readonly id: string; readonly model: string }[] = [
  { id: "empty-provider", model: "/glm-5" },
  { id: "empty-model", model: "zai/" },
  { id: "missing-separator", model: "zai-glm-5" },
  { id: "whitespace", model: "zai/glm 5" },
  { id: "control-character", model: "zai/glm\u0007-5" },
  { id: "two-variant-separators", model: "zai/glm-5#judgment#extra" },
  { id: "over-the-bound", model: `zai/${"m".repeat(240)}` },
];

/** A representable resolved model (the paired control). */
export const REPRESENTABLE_MODEL = "zai/glm-5#judgment";

/** Conflicting ambient values and undeclared record names, unique so absence is provable. */
export const AMBIENT_CANARIES = {
  conflictingModel: "canary-ambient-model-7d1",
  undeclaredModel: "canary-undeclared-record-91b",
  seatVariableName: "CANARY_SEAT_MODEL",
  undeclaredRecordName: "OC_CANARY_AGENT_SEAT_MODEL",
} as const;

/** The declared allowlist entry names the variable-consuming case declares. */
export const DECLARED_SEAT_VARIABLE = AMBIENT_CANARIES.seatVariableName;

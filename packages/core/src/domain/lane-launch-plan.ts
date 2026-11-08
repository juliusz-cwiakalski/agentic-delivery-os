/**
 * The production lane-launch planner seam (GH-239 F-10; AC-F10-1; NFR-7).
 *
 * A planned lane carries the lifecycle prompt and only the declared
 * execution-environment variable names. It resolves no secret value, reads no
 * parent environment, and carries no credential material; the descriptor stays
 * the only environment source.
 */
import type {
  LaneLaunchPlan,
  LaneLaunchPlanner,
  LaneLaunchRequest,
} from "#contracts";

/** The pure facts a production plan supplies. */
export type LaneLaunchPlanFacts = {
  /** The declared variable names the descriptor allowlists. */
  readonly declaredEnvironment: readonly string[];
  /** The lifecycle prompt for one request. */
  readonly lifecyclePrompt: (request: LaneLaunchRequest) => string;
};

/**
 * Plan one lane launch: prompt plus the declared variable-name allowlist.
 *
 * Environment values are empty placeholders; the spawn-environment builder
 * fills them from the descriptor's declared sources alone.
 */
export const planLaneLaunch = (
  request: LaneLaunchRequest,
  facts: LaneLaunchPlanFacts,
): LaneLaunchPlan => ({
  prompt: facts.lifecyclePrompt(request),
  environment: Object.fromEntries(
    facts.declaredEnvironment.map((name) => [name, ""] as const),
  ),
});

/** Build the injected planner the delivered lane executor consumes. */
export const createLaneLaunchPlanner = (facts: LaneLaunchPlanFacts): LaneLaunchPlanner => ({
  plan: (request) => planLaneLaunch(request, facts),
});

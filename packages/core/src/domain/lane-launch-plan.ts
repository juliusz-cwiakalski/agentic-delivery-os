/**
 * The production lane-launch planner seam (GH-239 F-10; AC-F10-1; NFR-7).
 *
 * A planned lane carries the lifecycle prompt and only the declared
 * execution-environment variable names. It resolves no secret value, reads no
 * parent environment, and carries no credential material; the descriptor stays
 * the only environment source.
 *
 * GH-404 F-3 adds the worktree-scoped consumption point: when the composition
 * supplies worktree facts, the plan's `PATH` leads with the worktree's
 * dependency binaries and `TMPDIR` anchors to the gate temporary directory
 * inside the worktree — both derived values injected as data (the inherited
 * `PATH` arrives as a parameter; nothing ambient is read here).
 */
import type { LaneLaunchPlan, LaneLaunchPlanner, LaneLaunchRequest } from "#contracts";
import type { LaneWorktreeEnvironment } from "./lane-worktree-plan.js";

/** The pure facts a production plan supplies. */
export type LaneLaunchPlanFacts = {
  /** The declared variable names the descriptor allowlists. */
  readonly declaredEnvironment: readonly string[];
  /** The lifecycle prompt for one request. */
  readonly lifecyclePrompt: (request: LaneLaunchRequest) => string;
  /**
   * The worktree-scoped lane environment (GH-404 F-3); absent keeps the
   * delivered in-checkout launch byte-for-byte.
   */
  readonly worktreeEnvironment?: LaneWorktreeEnvironment & {
    /** The inherited `PATH` the worktree binaries lead, supplied as data. */
    readonly inheritedPath: string;
  };
};

/**
 * Plan one lane launch: prompt plus the declared variable-name allowlist.
 *
 * Environment values are empty placeholders; the spawn-environment builder
 * fills them from the descriptor's declared sources alone. With worktree facts
 * present, `PATH` and `TMPDIR` become the derived worktree values (GH-404 F-3)
 * — the worktree bin leads `PATH` and the gate temporary directory lives
 * inside the worktree.
 */
export const planLaneLaunch = (
  request: LaneLaunchRequest,
  facts: LaneLaunchPlanFacts,
): LaneLaunchPlan => ({
  prompt: facts.lifecyclePrompt(request),
  environment: {
    ...Object.fromEntries(facts.declaredEnvironment.map((name) => [name, ""] as const)),
    ...(facts.worktreeEnvironment === undefined
      ? {}
      : {
          PATH: `${facts.worktreeEnvironment.pathLeadingBin}:${facts.worktreeEnvironment.inheritedPath}`,
          TMPDIR: facts.worktreeEnvironment.gateTemporaryDirectory,
        }),
  },
});

/** Build the injected planner the delivered lane executor consumes. */
export const createLaneLaunchPlanner = (facts: LaneLaunchPlanFacts): LaneLaunchPlanner => ({
  plan: (request) => planLaneLaunch(request, facts),
});

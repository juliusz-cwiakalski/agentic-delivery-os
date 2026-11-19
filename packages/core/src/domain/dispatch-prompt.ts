/**
 * The delivery-lifecycle prompt (GH-347 F-7, API-6, DM-6; DEC-8; TDR-0054).
 *
 * The fresh-spawn prompt is the lifecycle the shell lane carried, parameterized
 * by the work-item reference and the resolved base branch. It is data built by
 * one pure function; no constant sentence and no shell template lives here.
 */

/** The stable section markers the prompt carries (asserted, never prose-matched). */
export const DISPATCH_LIFECYCLE_SECTIONS = [
  "state-detection",
  "resume-sync",
  "actions-by-state",
  "eleven-phase-lifecycle",
  "merge-authority",
] as const;

export type DispatchLifecycleSection = (typeof DISPATCH_LIFECYCLE_SECTIONS)[number];

/** One section's stable marker plus its instruction text. */
export const DISPATCH_LIFECYCLE_SECTION_TITLES = {
  "state-detection": "State detection",
  "resume-sync": "Resume sync",
  "actions-by-state": "Actions by state",
  "eleven-phase-lifecycle": "Delivery lifecycle (eleven phases)",
  "merge-authority": "Merge authority",
} as const satisfies Readonly<Record<DispatchLifecycleSection, string>>;

export type DispatchLifecyclePromptInput = {
  readonly ref: string;
  readonly baseBranch: string;
};

/**
 * Build the lifecycle prompt for one dispatch.
 *
 * The five sections are present in the declared order, the ref and the base
 * branch appear literally, and the text is a single bounded document. A resume
 * with operator text uses that text instead (the caller decides).
 */
export const buildLifecyclePrompt = (input: DispatchLifecyclePromptInput): string => {
  const ref = input.ref;
  const base = input.baseBranch;
  return [
    `Deliver change ${ref} through the delivery lifecycle.`,
    "",
    "## State detection",
    `Determine the current state for ${ref} first: the recorded lane, the phase ledger, the branch, and the pull request. Never assume a state you did not observe.`,
    "",
    "## Resume sync",
    `Synchronize the working branch with ${base} before acting. Continue a recorded session when one exists; do not start a second session.`,
    "",
    "## Actions by state",
    "Act on the observed state: resume an interrupted lane, continue an open pull request, or start the lifecycle when nothing exists. Record every durable fact the rules require.",
    "",
    "## Delivery lifecycle (eleven phases)",
    "Run the eleven phases in order — clarify scope, specification, test planning, delivery planning, DoR, delivery, system spec update, review fix, quality gates, DoD, pull request — and never skip a gate.",
    "",
    "## Merge authority",
    `Merge authority stays with the human owner. Target ${base} and leave the pull request open for review unless the owner decides otherwise.`,
  ].join("\n");
};

/** The prompt's declared capability check: does it carry every section marker? */
export const lifecyclePromptSectionsPresent = (prompt: string): boolean =>
  DISPATCH_LIFECYCLE_SECTIONS.every((section) =>
    prompt.includes(`## ${DISPATCH_LIFECYCLE_SECTION_TITLES[section]}`),
  );

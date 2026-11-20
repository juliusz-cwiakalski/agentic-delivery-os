/**
 * The loop's declared spawn prompt, as data (GH-348 F-2, AC-F8-4, AC-F8-3).
 *
 * The prompt the CEO session receives is a composition fact, not an agent
 * definition (NG-2). It NAMES the jaiship primitives the CEO drives and carries
 * the durable-stop instruction, and it contains no script-path literal and no
 * shell-exec reference, so the static no-shell invariant stays clean over this
 * file (NFR-9).
 */
import { LOOP_V1_SUPERVISOR_IDENTITY } from "#contracts";

/** The primitives the prompt names; the content scan asserts exactly these. */
export const LOOP_PROMPT_PRIMITIVES = ["dispatch", "merge", "queue", "closeout"] as const;
export type LoopPromptPrimitive = (typeof LOOP_PROMPT_PRIMITIVES)[number];

/**
 * The durable-stop instruction the prompt carries. A function, not an exported
 * string constant: the branding seam forbids exported module-level strings, and
 * a product-name literal has no business in a const anyway.
 */
export const loopStopInstruction = (): string =>
  "To stop this loop durably, run `loop stop`; the request survives a restart until an explicit `loop reset`.";

/**
 * Build the declared prompt for one loop identity.
 *
 * The prompt is identifier-only: it names the supervisor identity and the four
 * primitives, and it never embeds a transcript, a credential, or a script path.
 */
export const loopPromptFor = (loopId: string = LOOP_V1_SUPERVISOR_IDENTITY): string =>
  [
    `You are the CEO delivery session supervised by the jaiship loop ${loopId}.`,
    "Drive the next actionable item through the jaiship primitives, in order:",
    `1. \`queue claim\` picks the next actionable work item.`,
    `2. \`dispatch\` delivers it (never a shell entry point).`,
    `3. \`merge\` lands the reviewed change.`,
    `4. \`closeout\` closes the change capsule.`,
    loopStopInstruction(),
    "Report progress through those primitives; do not idle silently while work is available.",
  ].join("\n");

/** Assert the declared prompt content without reading any environment fact. */
export const promptNamesPrimitives = (prompt: string): boolean =>
  LOOP_PROMPT_PRIMITIVES.every((primitive) => prompt.includes(primitive));

/** The deterministic fresh-spawn title `ceo-loop-<UTC yyyymmdd-hhmmss>` (F-2). */
export const loopSessionTitle = (nowMs: number): string => {
  const iso = new Date(nowMs).toISOString();
  const stamp = iso.slice(0, 19).replace(/[-:]/gu, "").replace("T", "-");
  return `ceo-loop-${stamp}`;
};

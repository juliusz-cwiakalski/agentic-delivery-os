/**
 * Synthetic action row builders (GH-287 test-plan §4.1 items 6 and 8). Every
 * value is synthetic; every record is produced through the production filing
 * validation, so a read validates what the production writer could have written.
 */
import {
  RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA,
  type RetroActionClosureRecord,
  type RetroActionDraft,
  type RetroActionRecord,
} from "../../../packages/core/src/contracts/index";
import { validateActionFiling } from "../../../packages/core/src/domain/action-filing";
import { DUE_ISO, FILING_MS } from "./clock";

/** A fully conforming filing draft: every contract member present. */
export const conformingDraft = (overrides: RetroActionDraft = {}): RetroActionDraft => ({
  owner: "agent-role:reviewer",
  ownerKind: "agent-role",
  verb: "add",
  measurableOutcome: "the guard rejects the malformed envelope",
  trackerEntry: "GH-287",
  dueDate: DUE_ISO,
  verificationArtifact: "artifact:tests/behaviour/action-filing.test.ts",
  outcomeVerifier: {
    evidence: "metric:guard-rejection-rate",
    windowStart: "2026-10-15T00:00:00Z",
    windowEnd: "2026-11-15T00:00:00Z",
  },
  rollbackCondition: "revert the guard when the rejection rate falls below the baseline",
  level: "change",
  window: "window-a",
  trackerCorroboration: "confirmed",
  dueDateLapses: [],
  ...overrides,
});

/** Build the validated record a conforming draft would land. */
export const actionRecord = (
  overrides: RetroActionDraft = {},
  context: { readonly actionId?: string; readonly filedAt?: number } = {},
): RetroActionRecord => {
  const validated = validateActionFiling(conformingDraft(overrides), {
    actionId: context.actionId ?? "action-001",
    filedAt: context.filedAt ?? FILING_MS,
  });
  if (!validated.ok) throw new Error(`fixture draft refused: ${validated.error.summary ?? ""}`);
  return validated.value;
};

/** The closure record for one explicit decision. */
export const closureRecord = (
  overrides: Partial<RetroActionClosureRecord> = {},
): RetroActionClosureRecord => ({
  schemaId: RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA,
  closureId: "closure-001",
  actionId: "action-001",
  route: "done",
  plane: "artifact",
  decision: "decision:retro-2026-11",
  justification: { artifact: "artifact:tests/behaviour/action-filing.test.ts" },
  artifactClosure: "closed",
  outcomeClosure: "open",
  windowState: "open",
  decidedAt: FILING_MS,
  ...overrides,
});

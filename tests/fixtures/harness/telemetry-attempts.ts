/**
 * The GH-335 telemetry capture helpers and the two-attempt fixture (test plan
 * §4.1 rule 5, TC-HARNESS-043; DM-8/DM-10 only).
 *
 * The extractor and the store builder are the production modules; only the
 * store file and the clock are fixtures. The two-attempt work item exercises the
 * union: attempt A holds S1 and its child with its own binding, attempt B holds
 * S2 with its own binding, and a third recorded attempt holds no identity.
 */
import { createBunSqliteStoreOpener } from "../../../packages/adapters/src/harness/index";
import { createOpencodeTelemetryExtractor } from "../../../packages/adapters/src/harness/telemetry-opencode";
import type { HarnessSeatBinding } from "../../../packages/core/src/contracts/index";
import type { BuiltStore } from "./opencode-store/build";
import {
  CHILD_MODEL_ID,
  CHILD_SESSION,
  OTHER_SESSION,
  ROOT_AGENT,
  ROOT_MODEL_ID,
  ROOT_SESSION,
  buildOpencodeStore,
} from "./opencode-store/build";

export const RUN_ID = "run-gh335";
export const CAPTURED_AT = "2026-11-18T00:00:00.000Z";
export const WORK_ITEM_REF = "GH-335";

export const ROOT_BINDING: HarnessSeatBinding = {
  agent: ROOT_AGENT,
  seat: "seat-judgment",
  resolvedModel: ROOT_MODEL_ID,
};

export const CHILD_BINDING: HarnessSeatBinding = {
  agent: "agent-b",
  seat: "seat-execution",
  resolvedModel: CHILD_MODEL_ID,
};

/** Extract one store through the production extractor. */
export const extractOpencode = (input: {
  readonly store: BuiltStore;
  readonly heldSessionIds?: readonly string[];
  readonly bindings?: Readonly<Record<string, HarnessSeatBinding>>;
  readonly pinnedVersion?: string;
  readonly unattributedAttempts?: number;
  readonly attemptTruncation?: {
    readonly truncated: true;
    readonly omitted: number;
    readonly cap: number;
  };
}) =>
  createOpencodeTelemetryExtractor({
    opener: createBunSqliteStoreOpener(),
    storePath: input.store.path,
    now: () => CAPTURED_AT,
    ...(input.pinnedVersion === undefined ? {} : { pinnedVersion: input.pinnedVersion }),
  }).extract({
    workItemRef: WORK_ITEM_REF,
    runId: RUN_ID,
    heldSessionIds: input.heldSessionIds ?? input.store.heldSessionIds,
    ...(input.bindings === undefined ? {} : { bindings: input.bindings }),
    ...(input.unattributedAttempts === undefined
      ? {}
      : { unattributedAttempts: input.unattributedAttempts }),
    ...(input.attemptTruncation === undefined
      ? {}
      : { attemptTruncation: input.attemptTruncation }),
  });

/** A store whose two roots and one unrelated root serve the union case. */
export const buildTwoAttemptStore = (): BuiltStore => buildOpencodeStore({ variant: "unrelated" });

/** The identity sets the union case asserts. */
export const TWO_ATTEMPT = {
  attemptA: [ROOT_SESSION, CHILD_SESSION] as const,
  attemptB: [OTHER_SESSION] as const,
  bindings: {
    [ROOT_SESSION]: ROOT_BINDING,
    [OTHER_SESSION]: {
      agent: "agent-other",
      seat: "seat-review",
      resolvedModel: "synthetic/other-model",
    } satisfies HarnessSeatBinding,
  } as Readonly<Record<string, HarnessSeatBinding>>,
  heldSessionIds: [ROOT_SESSION, CHILD_SESSION, OTHER_SESSION] as const,
  unattributedAttempts: 1,
} as const;

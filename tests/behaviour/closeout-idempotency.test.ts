/**
 * TC-CLOSE-018 (identity/SHA-256 half; ledger half is Phase 3) — the pure
 * SHA-256 implementation, the fixed canonical closeout tuple, known-answer
 * vectors, capability-context sensitivity, and first-terminal folding.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  type CloseoutOperationIdentityInputs,
  type CloseoutOperationRecord,
} from "../../packages/core/src/contracts/index";
import { STATE_SCHEMA_VERSION } from "../../packages/core/src/contracts/state";
import {
  canonicalCloseoutJson,
  deriveCloseoutOperationId,
  foldCloseoutOutcomes,
  buildCloseoutPlan,
  runCloseout,
} from "../../packages/core/src/domain/closeout";
import { sha256Hex } from "../../packages/core/src/domain/sha256";
import {
  CLOSEOUT_TIMESTAMP,
  makeFacts,
  makeGit,
  makeProvider,
  makeState,
} from "../fixtures/closeout/harness";
import { fakeInvalidPayload, fakeNotFound } from "../fixtures/closeout/read-observation";

/** The committed fixed canonical identity tuple (regeneration note in the plan). */
const FIXED_INPUTS: CloseoutOperationIdentityInputs = {
  workspaceId: "workspace-a",
  workItemRef: "GH-183",
  engine: "github",
  capabilityContext: "supported",
  operation: "write-work-item",
  arguments: { add: ["delivered"] },
  target: { systemName: "github", entityId: "183" },
};

const FIXED_CANONICAL_JSON =
  '{"arguments":{"add":["delivered"]},"capabilityContext":"supported","engine":"github","operation":"write-work-item","target":{"entityId":"183","systemName":"github"},"workItemRef":"GH-183","workspaceId":"workspace-a"}';

/** Independently reproduced with `node:crypto` over FIXED_CANONICAL_JSON. */
const FIXED_DIGEST = "cf914e3a077d61ae936467baaa5a59fa26b41d5370928d8c8ff2cedf80dc00b7";

const KAT_EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const KAT_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

const recordFor = (
  inputs: CloseoutOperationIdentityInputs,
  outcome: CloseoutOperationRecord["outcome"],
): CloseoutOperationRecord => ({
  schemaId: "delivery.closeout.operation.v1",
  operationId: deriveCloseoutOperationId(inputs),
  workItemRef: inputs.workItemRef,
  engine: inputs.engine,
  capabilityContext: inputs.capabilityContext,
  operation: inputs.operation,
  arguments: inputs.arguments,
  target: inputs.target,
  outcome,
  evidence: [],
  timestamp: "2026-11-01T00:00:00Z",
});

describe("TC-CLOSE-018 SHA-256 algorithm evidence", () => {
  test("known-answer vectors pass", () => {
    expect(sha256Hex("")).toBe(KAT_EMPTY);
    expect(sha256Hex("abc")).toBe(KAT_ABC);
  });

  test("the fixed canonical tuple matches the committed digest and node:crypto", () => {
    expect(canonicalCloseoutJson(FIXED_INPUTS)).toBe(FIXED_CANONICAL_JSON);
    expect(deriveCloseoutOperationId(FIXED_INPUTS)).toBe(FIXED_DIGEST);
    expect(
      createHash("sha256").update(FIXED_CANONICAL_JSON).digest("hex"),
    ).toBe(FIXED_DIGEST);
  });

  test("randomized inputs agree with node:crypto", () => {
    for (const input of ["", "a", "abc", "GH-183", "closeout", "x".repeat(1000), "żółć"]) {
      expect(sha256Hex(input)).toBe(createHash("sha256").update(input).digest("hex"));
    }
  });

  test("the identity is 64 lowercase hex and changes with every input", () => {
    const base = deriveCloseoutOperationId(FIXED_INPUTS);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    const variants: CloseoutOperationIdentityInputs[] = [
      { ...FIXED_INPUTS, workspaceId: "workspace-b" },
      { ...FIXED_INPUTS, workItemRef: "GH-184" },
      { ...FIXED_INPUTS, engine: "jira" },
      { ...FIXED_INPUTS, operation: "transition-work-item" },
      { ...FIXED_INPUTS, arguments: { add: ["change"] } },
      { ...FIXED_INPUTS, target: { systemName: "github", entityId: "184" } },
      { ...FIXED_INPUTS, capabilityContext: "adapter-not-implemented" },
    ];
    for (const variant of variants) {
      expect(deriveCloseoutOperationId(variant)).not.toBe(base);
    }
    expect(deriveCloseoutOperationId(FIXED_INPUTS)).toBe(base);
  });
});

describe("TC-CLOSE-018 first-terminal folding", () => {
  test("the first terminal outcome per operationId is authoritative", () => {
    const applied = recordFor(FIXED_INPUTS, "applied");
    const satisfied = recordFor(FIXED_INPUTS, "satisfied");
    const folded = foldCloseoutOutcomes([applied, satisfied]);
    expect(folded[applied.operationId]?.outcome).toBe("applied");
  });

  test("a failed outcome is retained as evidence only until a terminal outcome lands", () => {
    const failed = recordFor(FIXED_INPUTS, "failed");
    const foldedFailed = foldCloseoutOutcomes([failed]);
    expect(foldedFailed[failed.operationId]?.outcome).toBe("failed");
    const applied = recordFor(FIXED_INPUTS, "applied");
    const folded = foldCloseoutOutcomes([failed, applied]);
    expect(folded[failed.operationId]?.outcome).toBe("applied");
  });
});


const apply = (
  facts: ReturnType<typeof makeFacts>,
  provider: ReturnType<typeof makeProvider>,
  git: ReturnType<typeof makeGit>,
  state: ReturnType<typeof makeState>,
) =>
  runCloseout({
    plan: buildCloseoutPlan(facts),
    provider: provider.runtime,
    git: git.runtime,
    state: state.runtime,
    timestamp: CLOSEOUT_TIMESTAMP,
    fenceToken: "fence-1",
    apply: true,
  });

describe("TC-CLOSE-015 restart reuses every terminal outcome", () => {
  test("a fresh composition performs zero duplicate provider and git calls", async () => {
    const state = makeState();
    const firstProvider = makeProvider();
    const firstGit = makeGit();
    const first = await apply(makeFacts(), firstProvider, firstGit, state);
    expect(first.ok).toBe(true);
    const recorded = state.records.length;
    expect(recorded).toBeGreaterThan(0);
    expect(state.fence.acquired).toBe(1);
    expect(state.fence.released).toBe(1);
    expect(state.fence.appends).toBe(recorded);

    const secondProvider = makeProvider();
    const secondGit = makeGit();
    const second = await apply(makeFacts(), secondProvider, secondGit, state);
    expect(second.ok).toBe(true);
    expect(secondProvider.calls).toEqual([]);
    expect(secondGit.calls).toEqual([]);
    expect(state.records.length).toBe(recorded);
    if (second.ok) {
      expect(second.data.steps.every((step) => step.outcome !== "applied")).toBe(true);
    }
  });
});

describe("TC-CLOSE-016 crash between effect and record converges as satisfied", () => {
  test("an already-applied provider effect records satisfied with no duplicate effect", async () => {
    const state = makeState();
    const provider = makeProvider({
      writeWorkItem: { ok: true, alreadyApplied: true },
      transitionWorkItem: { ok: true, alreadyApplied: true },
      resolveDeliveryThread: { ok: true, alreadyApplied: true },
    });
    const result = await apply(makeFacts(), provider, makeGit(), state);
    expect(result.ok).toBe(true);
    const providerRecords = state.records.filter(
      (record) =>
        record.operation === "write-work-item" ||
        record.operation === "transition-work-item" ||
        record.operation === "resolve-delivery-thread",
    );
    expect(providerRecords.length).toBeGreaterThan(0);
    expect(providerRecords.every((record) => record.outcome === "satisfied")).toBe(true);
  });
});

describe("TC-CLOSE-017 a failed outcome is retained and retried safely", () => {
  test("the failed record is evidence and a later run converges", async () => {
    const state = makeState();
    const failing = makeProvider({
      writeWorkItem: { ok: false, code: "closeout.write.failed", detail: "synthetic failure" },
    });
    const first = await apply(makeFacts(), failing, makeGit(), state);
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.error.code).toBe("closeout.write.failed");
    const failed = state.records.filter((record) => record.outcome === "failed");
    expect(failed.length).toBeGreaterThan(0);

    const healed = makeProvider();
    const second = await apply(makeFacts(), healed, makeGit(), state);
    expect(second.ok).toBe(true);
    expect(healed.calls.some((call) => call.kind === "writeWorkItem")).toBe(true);
    const terminal = state.records.filter(
      (record) => record.outcome === "applied" || record.outcome === "satisfied",
    );
    expect(terminal.length).toBeGreaterThan(failed.length);
  });
});

describe("TC-CLOSE-019 ledger via the fenced state port", () => {
  test("plan mode acquires no fence and appends nothing", async () => {
    const state = makeState();
    const provider = makeProvider();
    const git = makeGit();
    const result = await runCloseout({
      plan: buildCloseoutPlan(makeFacts()),
      provider: provider.runtime,
      git: git.runtime,
      state: state.runtime,
      timestamp: CLOSEOUT_TIMESTAMP,
      fenceToken: "fence-1",
      apply: false,
    });
    expect(result.ok).toBe(true);
    expect(state.fence.acquired).toBe(0);
    expect(state.fence.appends).toBe(0);
    expect(provider.calls).toEqual([]);
    expect(git.calls).toEqual([]);
  });

  test("a torn ledger is a classified state error, never zeros", async () => {
    const state = makeState({ torn: true });
    const result = await apply(makeFacts(), makeProvider(), makeGit(), state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("state.store.torn");
  });

  test("the state schema version is unchanged and no migration exists", () => {
    expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
  });
});

describe("TC-CLOSE-067 engine target discrimination writes nothing", () => {
  test("not-found returns closeout.target.unobserved with zero calls", async () => {
    const state = makeState();
    const provider = makeProvider();
    const git = makeGit();
    const result = await apply(
      makeFacts({ observedWorkItem: fakeNotFound() }),
      provider,
      git,
      state,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("closeout.target.unobserved");
    expect(state.fence.acquired).toBe(0);
    expect(provider.calls).toEqual([]);
    expect(git.calls).toEqual([]);
  });

  test("a malformed payload stays provider.payload.invalid", async () => {
    const result = await apply(
      makeFacts({ observedWorkItem: fakeInvalidPayload() }),
      makeProvider(),
      makeGit(),
      makeState(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("provider.payload.invalid");
  });
});

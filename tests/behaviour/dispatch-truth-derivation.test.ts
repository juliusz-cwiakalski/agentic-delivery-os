/**
 * TC-TRUTH-001..005 (phase-2 pure-domain slice) — the dispatch derivation is
 * artifact-first: an exit-0 session with no artifact is `failed`, an open PR is
 * `pr-open`, an unresolved URL is `pr-open-unverified` with an engine-side
 * attribute, a merged PR is detection-only `merged`, and a blocking tracker
 * state is `blocked`. No command is invoked and no ledger record is appended.
 */
import { describe, expect, test } from "bun:test";
import { deriveDispatchResult } from "../../packages/core/src/domain/dispatch-result";
import { DELIVERY_RESULT_TOKENS } from "../../packages/core/src/contracts/index";
import {
  blockedInput,
  mergedInput,
  missingTrackerFactInput,
  noArtifactInput,
  truthInput,
  unverifiedUrlInput,
} from "../fixtures/dispatch/truth";

describe("TC-TRUTH-001 exit-0 with no artifact derives failed", () => {
  test("the missing artifact is named and the token is never a success", () => {
    const result = deriveDispatchResult(noArtifactInput());
    expect(result.token).toBe("failed");
    expect(result.outcome).toBe("failed");
    expect(result.projectionClass).toBe("user-validation");
    expect(result.missingArtifact).toBe("branch-commit");
    expect(result.lastMessage).toContain("no branch commit");
    expect(DELIVERY_RESULT_TOKENS).toContain(result.token);
  });
});

describe("TC-TRUTH-002 an open PR derives pr-open with a resolved URL", () => {
  test("the token, URL, and dual-run handover state are derived", () => {
    const result = deriveDispatchResult(truthInput());
    expect(result.token).toBe("pr-open");
    expect(result.outcome).toBe("completed");
    expect(result.projectionClass).toBe("success");
    expect(result.prUrl).toBe("https://example.test/owner/repo/pull/1");
    expect(result.urlResolved).toBe(true);
    expect(result.handoverState).toBe("dual-run");
  });
});

describe("TC-TRUTH-003 an unresolvable PR URL derives pr-open-unverified", () => {
  test("the URL is empty and urlResolved is an engine-side false attribute", () => {
    const result = deriveDispatchResult(unverifiedUrlInput());
    expect(result.token).toBe("pr-open-unverified");
    expect(result.outcome).toBe("completed");
    expect(result.projectionClass).toBe("success");
    expect(result.prUrl).toBe("");
    expect(result.urlResolved).toBe(false);
    expect(result.lastMessage).toContain("could not be resolved");
  });
});

describe("TC-TRUTH-004 an already-merged PR is detection-only merged", () => {
  test("merged is derived only from the independently observed merged fact", () => {
    const result = deriveDispatchResult(mergedInput());
    expect(result.token).toBe("merged");
    expect(result.projectionClass).toBe("success");
  });

  test("an open PR is never reported as merged", () => {
    expect(deriveDispatchResult(truthInput()).token).toBe("pr-open");
  });
});

describe("TC-TRUTH-005 a blocking tracker state derives blocked; a missing fact never succeeds", () => {
  test("the blocking tracker fact derives blocked", () => {
    const result = deriveDispatchResult(blockedInput());
    expect(result.token).toBe("blocked");
    expect(result.projectionClass).toBe("success");
    expect(result.lastMessage).toContain("delivery-blocking");
  });

  test("a missing tracker fact derives state-unverified, never a success token", () => {
    const result = deriveDispatchResult(missingTrackerFactInput());
    expect(result.token).toBe("state-unverified");
    expect(result.projectionClass).toBe("platform-provider");
    expect(result.errorCode).toBe("dispatch.state-unverified");
    expect(result.readFailure).toBe("tracker");
  });
});

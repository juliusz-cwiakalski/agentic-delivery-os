/**
 * TC-CLOSE-006/057/058 — merged-head normalization and deterministic lookup.
 */
import { describe, expect, test } from "bun:test";
import { normalizeMergeRequest } from "../../packages/adapters/src/gitlab/normalize";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { readJson, requireRecord } from "./providers/support";
import { makeFacts } from "../fixtures/closeout/harness";

const context = { systemName: "gitlab" };

describe("TC-CLOSE-006 GitLab merged head normalization", () => {
  test("a provider-exposed head is copied verbatim", () => {
    const payload = readJson("tests/fixtures/providers/gitlab/closeout-merged-head-present.json");
    const result = normalizeMergeRequest(payload, context);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.headSha).toBe("2222222222222222222222222222222222222222");
  });

  test("an absent head stays absent, never an empty string", () => {
    const payload = readJson("tests/fixtures/providers/gitlab/closeout-merged-head-absent.json");
    const result = normalizeMergeRequest(payload, context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.headSha).toBeUndefined();
      expect(Object.hasOwn(result.value, "headSha")).toBe(false);
    }
  });

  test("the GitLab fixture payloads are distinct and synthetic", () => {
    const present = requireRecord(
      readJson("tests/fixtures/providers/gitlab/closeout-merged-head-present.json"),
      "present",
    );
    const absent = requireRecord(
      readJson("tests/fixtures/providers/gitlab/closeout-merged-head-absent.json"),
      "absent",
    );
    expect(present.sha).not.toBeUndefined();
    expect(absent.sha).toBeUndefined();
  });
});

describe("TC-CLOSE-058 no merged request falls back to the integration base", () => {
  test("delivery-request-dependent steps skip and the base is main-tools", () => {
    const plan = buildCloseoutPlan(makeFacts({ mergedRequest: { observation: "unavailable" } }));
    expect(plan.baseRef).toBe("main-tools");
    expect(plan.deliveryRequest).toBeUndefined();
    const threads = plan.steps.find((step) => step.stepId === "comment-resolution");
    expect(threads?.outcome).toBe("skipped-noop");
    expect(threads?.reason).toBe("no-delivery-request");
  });
});

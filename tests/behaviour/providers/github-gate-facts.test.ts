/** TC-VGATES-054/064 — PR detail gate facts, absence, and mergeability precedence. */
import { describe, expect, test } from "bun:test";
import {
  normalizeGithubPullList,
  normalizePullRequest,
} from "../../../packages/adapters/src/github/normalize";

const CONTEXT = { systemName: "github" };
const SHA = "1".repeat(40);

const payload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  number: 178,
  state: "open",
  draft: false,
  merged: false,
  head: { ref: "feat/GH-178/x", sha: SHA },
  base: { ref: "main-tools" },
  commits: 3,
  changed_files: 7,
  mergeable: true,
  mergeable_state: "clean",
  ...overrides,
});

const normalize = (overrides: Record<string, unknown> = {}) => {
  const result = normalizePullRequest(payload(overrides), CONTEXT);
  if (!result.ok) throw new Error(result.detail);
  return result.value;
};

describe("TC-VGATES-054 detail gate facts", () => {
  test("all four facts populate when present", () => {
    const view = normalize();
    expect(view.sourceHeadSha).toBe(SHA);
    expect(view.mergeableState).toBe("mergeable");
    expect(view.commitCount).toBe(3);
    expect(view.changedFileCount).toBe(7);
  });

  test("absent fields stay absent", () => {
    const view = normalize({
      head: { ref: "feat/GH-178/x" },
      commits: undefined,
      changed_files: undefined,
      mergeable: undefined,
      mergeable_state: undefined,
    });
    expect(view.sourceHeadSha).toBeUndefined();
    expect(view.commitCount).toBeUndefined();
    expect(view.changedFileCount).toBeUndefined();
    expect(view.mergeableState).toBe("unknown");
  });

  test("zero counts stay zero; negative/non-finite counts are absent", () => {
    expect(normalize({ commits: 0, changed_files: 0 })).toMatchObject({
      commitCount: 0,
      changedFileCount: 0,
    });
    const view = normalize({ commits: -1, changed_files: Number.NaN });
    expect(view.commitCount).toBeUndefined();
    expect(view.changedFileCount).toBeUndefined();
  });

  test("the list read may populate only sourceHeadSha", () => {
    const list = normalizeGithubPullList([payload()], CONTEXT);
    if (!list.ok) throw new Error(list.detail);
    const item = list.value.items[0];
    expect(item?.sourceHeadSha).toBe(SHA);
    expect(item?.mergeableState).toBeUndefined();
    expect(item?.commitCount).toBeUndefined();
    expect(item?.changedFileCount).toBeUndefined();
  });

  test("no provider-native payload field crosses the boundary", () => {
    expect(JSON.stringify(normalize())).not.toContain("mergeable_state");
    expect(JSON.stringify(normalize())).not.toContain("changed_files");
  });
});

describe("TC-VGATES-064 mergeability precedence matrix", () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ mergeable: false, mergeable_state: "clean" }, "conflicting"],
    [{ mergeable: false, mergeable_state: "dirty" }, "conflicting"],
    [{ mergeable: true, mergeable_state: "dirty" }, "conflicting"],
    [{ mergeable: true, mergeable_state: "blocked" }, "not-mergeable"],
    [{ mergeable: true, mergeable_state: "behind" }, "not-mergeable"],
    [{ mergeable: true, mergeable_state: "unstable" }, "not-mergeable"],
    [{ mergeable: true, mergeable_state: "draft" }, "not-mergeable"],
    [{ mergeable: null, mergeable_state: null }, "unknown"],
    [{ mergeable: undefined, mergeable_state: "computing" }, "unknown"],
    [{ mergeable: false, mergeable_state: "weird" }, "unknown"],
    [{ mergeable: true, mergeable_state: "clean" }, "mergeable"],
    [{ mergeable: true, mergeable_state: undefined }, "mergeable"],
    [{ mergeable: "true", mergeable_state: "clean" }, "unknown"],
  ];
  for (const [overrides, expected] of cases) {
    test(`${JSON.stringify(overrides)} -> ${expected}`, () => {
      expect(normalize(overrides).mergeableState).toBe(expected);
    });
  }
});

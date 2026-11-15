/**
 * TC-XQUEUE-004 (GH-310 F-2, AC-F2-4, DM-6, NFR-8, DEC-2): member-ref
 * canonicalization is EXTENDED, never narrowed. The delivered `<PREFIX>-<digits>`
 * form keeps its exact behaviour, the member form is accepted on add/read/remove
 * and the landing removal, and `ref-not-canonical` never applies to a declared
 * member ref.
 */
import { describe, expect, test } from "bun:test";
import { queueRemovalForCloseout } from "../../packages/core/src/app/index";
import { QUEUE_MAX_REF_CHARS } from "../../packages/core/src/contracts/index";
import { canonicalQueueRef, memberRefFor } from "../../packages/core/src/domain/index";
import {
  API_MEMBER,
  CHANGE_REF,
  memberRef,
  WEB_MEMBER,
} from "../fixtures/cross-repository/constants";
import { createMemberQueueHarness, MEMBER_REFS } from "../fixtures/cross-repository/queue";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const data = (text: string): Record<string, unknown> => json(text).data as Record<string, unknown>;
const error = (text: string): Record<string, unknown> | undefined =>
  json(text).error as Record<string, unknown> | undefined;

describe("TC-XQUEUE-004 member-ref canonicalization", () => {
  test("the member form canonicalizes to itself and a lowercased variant normalizes", () => {
    expect(canonicalQueueRef(memberRef(API_MEMBER.repoKey))).toBe(MEMBER_REFS.api);
    expect(canonicalQueueRef(`  ${memberRef(API_MEMBER.repoKey)}  `)).toBe(MEMBER_REFS.api);
    // The change-ref part canonicalizes exactly as delivered; the repoKey is preserved.
    expect(canonicalQueueRef(`gh-0310@${WEB_MEMBER.repoKey}`)).toBe(
      memberRefFor(CHANGE_REF, WEB_MEMBER.repoKey),
    );
    expect(canonicalQueueRef(`GH-0310@${WEB_MEMBER.repoKey}`)).toBe(MEMBER_REFS.web);
  });

  test("the delivered form is unchanged and over-length delivery refs stay refused", () => {
    expect(canonicalQueueRef("GH-010")).toBe("GH-10");
    expect(canonicalQueueRef("pdev-7")).toBe("PDEV-7");
    expect(canonicalQueueRef("GH-0")).toBe("GH-0");
    expect(canonicalQueueRef("not-a-ref")).toBeUndefined();
    expect(canonicalQueueRef("GH-310@not a key")).toBeUndefined();
    expect(canonicalQueueRef(`${"A".repeat(QUEUE_MAX_REF_CHARS)}-1`)).toBeUndefined();
  });

  test("an over-length member ref is undefined", () => {
    const repoKey = `${"a".repeat(50)}-1234abcd`;
    const overlong = `${CHANGE_REF}@${repoKey}`;
    expect(overlong.length).toBeGreaterThan(QUEUE_MAX_REF_CHARS);
    expect(canonicalQueueRef(overlong)).toBeUndefined();
  });

  test("add, list, remove and the landing removal accept the member ref", async () => {
    const { harness } = createMemberQueueHarness("ref-accept");
    const added = await harness.run(["queue", "add", MEMBER_REFS.api, "--json"]);
    expect(added.exitCode).toBe(0);
    expect(error(added.stdout)).toBeUndefined();
    expect((data(added.stdout).members as unknown[]).length).toBe(1);

    const listed = await harness.run(["queue", "list", "--json"]);
    expect(listed.exitCode).toBe(0);
    const entry = (data(listed.stdout).entries as Array<Record<string, unknown>>).find(
      (candidate) => candidate.ref === MEMBER_REFS.api,
    );
    expect(entry).toBeDefined();
    expect(JSON.stringify(listed.stdout)).not.toContain("ref-not-canonical");

    const removed = await harness.run([
      "queue",
      "remove",
      MEMBER_REFS.api,
      "--reason",
      "abandoned",
      "--json",
    ]);
    expect(removed.exitCode).toBe(0);
    expect(data(removed.stdout).reason).toBe("abandoned");

    const hook = queueRemovalForCloseout(harness.composition.store, {
      mode: "plan",
      workItemRef: MEMBER_REFS.web,
      mergedObserved: true,
      recordedAt: harness.nowIso(),
      nowMs: harness.nowMs(),
    });
    expect(hook).toBeDefined();
    expect("skipReason" in hook ? hook.skipReason : undefined).not.toBe("ref-not-canonical");
  });

  test("a genuinely non-canonical bare ref still refuses", async () => {
    const { harness } = createMemberQueueHarness("ref-refuse");
    const refused = await harness.run(["queue", "add", "not-a-ref", "--json"]);
    expect(refused.exitCode).toBe(1);
    expect(error(refused.stdout)?.code).toBe("input.value.rejected");
  });

  test("the member ref is derivable from the repoKey alone and bounded by the declared cap", () => {
    expect(memberRefFor(CHANGE_REF, API_MEMBER.repoKey)).toBe(MEMBER_REFS.api);
    for (const ref of Object.values(MEMBER_REFS)) {
      expect(ref.length).toBeLessThanOrEqual(QUEUE_MAX_REF_CHARS);
    }
  });
});

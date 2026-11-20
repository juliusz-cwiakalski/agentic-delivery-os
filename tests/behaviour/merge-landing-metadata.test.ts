/**
 * TC-F1-006 / TC-F1-007 — the crafted landing metadata: the provider-asserted
 * title transmitted verbatim, the one fixed verbatim message for every landing,
 * the declared deterministic fallback when the title signal is absent, and no
 * operator input in either field. The production composition is exercised too,
 * so the bytes are proven on the real path and not only in the harness.
 */
import { describe, expect, test } from "bun:test";
import { createMergeCommandDefinition } from "../../packages/cli/src/commands/merge";
import {
  baseRequest,
  createMergeHarness,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  MERGE_REF,
  verificationRecord,
} from "../fixtures/merge/harness";
import {
  createMergeProductionHarness,
  MERGE_PROD_BRANCH,
  MERGE_PROD_REF,
  type MergeProviderReply,
} from "../fixtures/merge/production-composition";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

/** Written here, never imported from the production composer (GAP-TP-7). */
const EXPECTED_MESSAGE = "Landed by the delivery lifecycle merge primitive.";

const dataOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.data as Record<string, unknown> | undefined;

describe("TC-F1-006 the crafted title is verbatim and the message is the fixed trailer", () => {
  test("the landing carries the request title character for character and the one-line message", async () => {
    const harness = createMergeHarness({
      request: baseRequest({ title: "feat(GH-349): crafted subject" }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      expect((await harness.run()).exitCode).toBe(0);
      const landing = harness.landings[0];
      expect(landing?.commitTitle).toBe("feat(GH-349): crafted subject");
      expect(landing?.commitMessage).toBe(EXPECTED_MESSAGE);
      // One bounded line: no newline, no leading or trailing whitespace.
      expect(landing?.commitMessage?.split("\n")).toHaveLength(1);
      expect(landing?.commitMessage).toBe(landing?.commitMessage?.trim());
      expect(landing?.commitMessage).not.toContain("GH-349");
      expect(landing?.commitMessage).not.toContain("Delivery-Request");
    } finally {
      harness.cleanup();
    }
  });

  test("a second request with a different ref and identity transmits the identical message bytes", async () => {
    const harness = createMergeHarness({
      ref: "GH-777",
      request: baseRequest({
        identity: { systemName: "github", entityId: "777" },
        title: "another subject",
      }),
    });
    try {
      harness.seedVerification(
        verificationRecord({ changeRef: "GH-777", verifiedAt: isoAt(-2 * MINUTE) }),
      );
      expect((await harness.run()).exitCode).toBe(0);
      expect(harness.landings[0]?.commitMessage).toBe(EXPECTED_MESSAGE);
      expect(harness.landings[0]?.deliveryRequest.entityId).toBe("777");
    } finally {
      harness.cleanup();
    }
  });

  test("a title carrying a leading space is transmitted verbatim, never trimmed", async () => {
    const harness = createMergeHarness({
      request: baseRequest({ title: " feat(GH-349): leading space" }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      await harness.run();
      expect(harness.landings[0]?.commitTitle).toBe(" feat(GH-349): leading space");
      expect(harness.landings[0]?.commitTitle).not.toBe("feat(GH-349): leading space");
    } finally {
      harness.cleanup();
    }
  });

  test("the merge command's flag set carries no title, message, or body input", () => {
    const harness = createMergeHarness();
    try {
      const definition = createMergeCommandDefinition(harness.runtime);
      const declared = [
        ...new Set([...definition.flags, ...(definition.requiresValue ?? [])]),
      ].sort();
      expect(declared).toEqual(["--dry-run", "--waive", "--waive-reason", "--waived-by"]);
      for (const forbidden of ["--title", "--message", "--body", "--commit-title"]) {
        expect(declared).not.toContain(forbidden);
      }
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-F1-007 an absent title falls back deterministically and is never derived", () => {
  const fallback = `merge(${MERGE_REF}): squash ${baseRequest().sourceRef}`;

  test("title present, absent, and empty: exactly two forms and one fallback", async () => {
    const cases = [
      {
        id: "present",
        title: "feat(GH-349): provider title",
        expected: "feat(GH-349): provider title",
      },
      { id: "absent", title: undefined, expected: fallback },
      { id: "empty", title: "", expected: fallback },
    ] as const;

    for (const entry of cases) {
      const harness = createMergeHarness({
        request: baseRequest(entry.title === undefined ? {} : { title: entry.title }),
      });
      try {
        harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
        const result = await harness.run();
        expect(result.exitCode, entry.id).toBe(0);
        expect(harness.landings[0]?.commitTitle, entry.id).toBe(entry.expected);
      } finally {
        harness.cleanup();
      }
    }
    // The two absent forms are byte-identical and differ from the present form.
    expect(fallback).toBe(`merge(GH-301): squash feat/GH-301/merge`);
    expect(fallback.split("squash ")).toHaveLength(2);
    expect(fallback).not.toBe("feat(GH-349): provider title");
  });

  test("the fallback names the change ref and the request source ref, never the branch", async () => {
    const harness = createMergeHarness({
      branch: "feat/GH-301/merge",
      request: baseRequest({ sourceRef: "feat/GH-301/a-different-source" }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      await harness.run();
      expect(harness.landings[0]?.commitTitle).toBe(
        "merge(GH-301): squash feat/GH-301/a-different-source",
      );
      expect(harness.landings[0]?.commitTitle).not.toContain("GH-301/merge");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-F1-006/007 the production composition transmits the same crafted bytes", () => {
  const providerMergeSha = "4444444444444444444444444444444444444444";

  const pullOf = (headSha: string, title: string | undefined): Record<string, unknown> => ({
    number: 301,
    state: "open",
    ...(title === undefined ? {} : { title }),
    head: { ref: MERGE_PROD_BRANCH, sha: headSha },
    base: { ref: "main-tools" },
    commits: 1,
    changed_files: 1,
    mergeable: true,
    mergeable_state: "clean",
  });

  const landingReply = (
    url: string,
    headSha: string,
    title: string | undefined,
  ): MergeProviderReply => {
    if (url.endsWith("/merge")) {
      return { status: 200, body: { merged: true, sha: providerMergeSha } };
    }
    if (/\/pulls\/\d+$/u.test(url)) return { status: 200, body: pullOf(headSha, title) };
    if (url.includes("/pulls?")) return { status: 200, body: [pullOf(headSha, title)] };
    if (url.includes("/issues/")) {
      return {
        status: 200,
        body: {
          number: 293,
          title: "Engine-first operations",
          state: "open",
          labels: [],
          updated_at: "2026-11-18T09:59:00Z",
        },
      };
    }
    if (url.includes("/check-runs")) {
      return {
        status: 200,
        body: {
          check_runs: [{ id: 7001, name: "CI / test", status: "completed", conclusion: "success" }],
        },
      };
    }
    if (url.includes("/graphql")) return { status: 200, body: { data: {} } };
    return { status: 404, body: {} };
  };

  test("one provider landing carries the provider title, the fixed message, and the verified head", async () => {
    const harness = createMergeProductionHarness({ label: "gh349-metadata" });
    try {
      harness.setReply((url) =>
        landingReply(url, harness.headSha, "feat(GH-293): provider-asserted title"),
      );
      // A fresh verification at the checkout head, produced by the dry run.
      const dry = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
      expect(dry.exitCode, dry.stderr).toBe(0);
      const result = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      expect(result.exitCode, result.stderr).toBe(0);
      expect(dataOf(result)?.result).toBe("merged");
      expect(dataOf(result)?.squashSha).toBe(providerMergeSha);

      const merge = harness.transportRequests.find(
        (request) => request.method === "PUT" && request.url.endsWith("/pulls/301/merge"),
      );
      expect(merge).toBeDefined();
      const body = JSON.parse(merge?.body ?? "{}") as Record<string, unknown>;
      expect(body.merge_method).toBe("squash");
      expect(body.sha).toBe(harness.headSha);
      expect(body.commit_title).toBe("feat(GH-293): provider-asserted title");
      expect(body.commit_message).toBe(EXPECTED_MESSAGE);
      // No force, bypass, auto-merge, queue, or retry variant is transmitted.
      expect(Object.keys(body).sort()).toEqual([
        "commit_message",
        "commit_title",
        "merge_method",
        "sha",
      ]);
      // The provider's merge commit is not in the checkout, so the recorded
      // containment is the honest third state, never a locally derived `true`.
      const recorded = dataOf(result)?.landing as Record<string, unknown> | undefined;
      expect(recorded?.shaOnBase).toBe("unknown");
      expect(recorded?.requestState).toBe("merged");
    } finally {
      harness.dispose();
    }
  });

  test("an absent provider title falls back to the declared deterministic subject", async () => {
    const harness = createMergeProductionHarness({ label: "gh349-metadata-absent" });
    try {
      harness.setReply((url) => landingReply(url, harness.headSha, undefined));
      const dry = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
      expect(dry.exitCode, dry.stderr).toBe(0);
      const result = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      expect(result.exitCode, result.stderr).toBe(0);
      const merge = harness.transportRequests.find(
        (request) => request.method === "PUT" && request.url.endsWith("/pulls/301/merge"),
      );
      const body = JSON.parse(merge?.body ?? "{}") as Record<string, unknown>;
      expect(body.commit_title).toBe(`merge(${MERGE_PROD_REF}): squash ${MERGE_PROD_BRANCH}`);
      expect(body.commit_message).toBe(EXPECTED_MESSAGE);
      expect(MERGE_HEAD).not.toBe(harness.headSha);
    } finally {
      harness.dispose();
    }
  });
});

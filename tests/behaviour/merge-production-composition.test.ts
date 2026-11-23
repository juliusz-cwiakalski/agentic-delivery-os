/**
 * TC-ENGINE-050..053 — the production merge composition performs real reads over
 * a real checkout and classifies every refusal by the resolved error-table row.
 *
 * The composition is the shipped `createProductionComposer`; only the provider
 * transport, the credential port, the configuration filesystem, and the spawn
 * seams are injected, so every branch under test is a production branch. The
 * declared exit is always derived from the row (`projectExitCode`), never
 * transcribed.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MERGE_COMPOSITION_EMITTABLE_CODES } from "../../packages/cli/src/production";
import { projectExitCode } from "../../packages/cli/src/projection";
import {
  ERROR_TABLE,
  MERGE_GATE_VERIFICATION_SCHEMA,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import {
  appendMergeGateVerification,
  readMergeGateVerifications,
  readMergeTransactions,
  readMergeWaivers,
} from "../../packages/core/src/state/index";
import {
  createMergeProductionHarness,
  MERGE_PROD_BRANCH,
  MERGE_PROD_OWNER,
  MERGE_PROD_REF,
  MERGE_PROD_REPOSITORY,
  type MergeProductionHarness,
  type MergeProviderReply,
} from "../fixtures/merge/production-composition";
import { createNoNetworkGuard } from "../fixtures/verify-gates/cases/network-guard";
import {
  createVerifyGatesProductionHarness,
  normalizeProductionBytes,
  VG_PROD_REF,
} from "../fixtures/verify-gates/production-composition";

const exitOf = (code: string): number => {
  const row = ERROR_TABLE.find((entry) => entry.code === code);
  if (row === undefined) throw new Error(`no declared row for ${code}`);
  return projectExitCode(row.projectionClass);
};

const envelopeOf = (run: {
  readonly envelope?: Record<string, unknown>;
}): { readonly data?: Record<string, unknown>; readonly error?: Record<string, unknown> } =>
  (run.envelope ?? {}) as {
    readonly data?: Record<string, unknown>;
    readonly error?: Record<string, unknown>;
  };

const seedVerification = (harness: MergeProductionHarness): void => {
  const read = readMergeGateVerifications(harness.store, MERGE_PROD_REF);
  if (!read.ok || read.records.length === 0) throw new Error("the dry run recorded nothing");
  const last = read.records.at(-1);
  if (last === undefined) throw new Error("no verification record");
  const appended = appendMergeGateVerification(harness.store, {
    record: { ...last, headSha: "0".repeat(40), verifiedAt: "2026-11-18T06:00:00.000Z" },
    fenceToken: "fixture-stale-seed",
  });
  if (!appended.ok) throw new Error(`stale seed failed: ${appended.error.code}`);
};

// The healthy provider reply is the fixture's own composed default: its open
// list carries the real branch tips the checkout holds, so the resolution's
// bounded record read observes the records the fixture committed (GH-366).

describe("TC-ENGINE-050 the production dry run is real, declared, and honest", () => {
  test("exit 0 with the delivered report, one verification record, and real reads", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({ label: "gh293-prod-dry" });
    try {
      const run = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
      expect(run.exitCode, run.stderr).toBe(0);
      const data = envelopeOf(run).data;
      if (data === undefined) throw new Error("no dry-run data");
      expect(data.result).toBe("verified");
      expect(data.headSha).toBe(harness.headSha);
      expect(Object.hasOwn(data, "squashSha")).toBe(false);
      expect(JSON.stringify(data)).not.toContain("transaction");

      const verifications = readMergeGateVerifications(harness.store, MERGE_PROD_REF);
      expect(verifications.ok && verifications.records).toHaveLength(1);
      const transactions = readMergeTransactions(harness.store, MERGE_PROD_REF);
      expect(transactions.ok && transactions.records).toEqual([]);
      const waivers = readMergeWaivers(harness.store, MERGE_PROD_REF);
      expect(waivers.ok && waivers.records).toEqual([]);

      // The dry run performs the work-item and check-run reads; the
      // request-detail read belongs to the landing path (TC-ENGINE-053).
      const calls = harness.transportCalls.join("\n");
      expect(calls).toContain("/issues/293");
      expect(calls).toContain("/check-runs");
      expect(harness.credentialReads()).toBeGreaterThan(0);
      expect(guard.calls).toEqual([]);

      const text = await harness.run(["merge", MERGE_PROD_REF, "--dry-run"]);
      expect(text.stdout).not.toContain("result=merged");
      expect(text.exitCode).toBe(0);
    } finally {
      guard.restore();
      harness.dispose();
    }
  });

  test("the owner principal is the checkout's repository owner, observable through the waiver effect", async () => {
    const harness = createMergeProductionHarness({
      label: "gh293-prod-principal",
      configYaml: `merge:\n  gate-freshness: 900\n  deploy-expectations:\n    steps: [smoke]\n`,
    });
    try {
      const ownerRun = await harness.run([
        "merge",
        MERGE_PROD_REF,
        "--dry-run",
        "--waive",
        "owner-gate",
        "--waived-by",
        MERGE_PROD_OWNER,
        "--json",
      ]);
      expect(ownerRun.exitCode, ownerRun.stderr).toBe(0);
      const authorizations = envelopeOf(ownerRun).data?.authorizations as
        | readonly Record<string, unknown>[]
        | undefined;
      expect(authorizations?.[0]).toMatchObject({
        gateId: "owner-gate",
        authorizer: MERGE_PROD_OWNER,
        authorized: true,
        gateClass: "owner-review",
      });
      const waivers = readMergeWaivers(harness.store, MERGE_PROD_REF);
      expect(waivers.ok && waivers.records).toEqual([]);

      // A different principal names the repository, the repository name, or a
      // bare ref — none of them is the owner component.
      for (const principal of ["engine-first-merge", "owner/engine-first-merge", MERGE_PROD_REF]) {
        const refused = await harness.run([
          "merge",
          MERGE_PROD_REF,
          "--waive",
          "owner-gate",
          "--waived-by",
          principal,
          "--json",
        ]);
        expect(refused.exitCode, principal).toBe(exitOf("merge.waiver-unauthorized"));
        expect(envelopeOf(refused).error?.code).toBe("merge.waiver-unauthorized");
        expect(String(envelopeOf(refused).error?.summary)).not.toContain("fallback.internal");
      }
      expect(readMergeWaivers(harness.store, MERGE_PROD_REF).ok).toBe(true);
      const after = readMergeWaivers(harness.store, MERGE_PROD_REF);
      expect(after.ok && after.records).toEqual([]);
    } finally {
      harness.dispose();
    }
  });

  test("the configuration branch exposes exactly the three declared keys", async () => {
    const { readFileSync } = await import("node:fs");
    const catalog = readFileSync(
      join(process.cwd(), "packages/core/src/config/catalog.ts"),
      "utf8",
    );
    const branch = catalog.slice(catalog.indexOf("const MERGE_BRANCH"));
    const keys = [
      ...branch
        .slice(0, branch.indexOf("} as const satisfies"))
        .matchAll(/^\s{4}"?([a-z-]+)"?: \{/gmu),
    ].map((match) => match[1]);
    expect(keys).toEqual(["gate-freshness", "gates", "deploy-expectations"]);
    for (const forbidden of ["owner-principal", "branch-name", "base-ref"]) {
      expect(catalog).not.toContain(forbidden);
    }
  });

  test("a ref with a digit in its prefix validates and resolves like any other ref", async () => {
    // The command's grammar and the composition's ref resolution read one
    // declared pattern, so `ABC2-12` is no longer validated and then refused as
    // unresolvable: the tracker read addresses issue 12.
    const harness = createMergeProductionHarness({
      label: "gh293-prod-digit-prefix",
    });
    try {
      const run = await harness.run(["merge", "ABC2-12", "--dry-run", "--json"]);
      expect(run.exitCode, run.stderr).toBe(0);
      expect(envelopeOf(run).data?.result).toBe("verified");
      const calls = harness.transportCalls.join("\n");
      expect(calls).toContain("/issues/12");
      expect(run.stdout).not.toContain("merge.transaction-aborted");
      expect(run.stdout).not.toContain("fallback.internal");
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-ENGINE-051 a failing gate is a classified refusal at exit 1", () => {
  test("a declared merge-surface job gate refuses by its declared family identity", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({
      label: "gh293-prod-gate",
      configYaml: `merge:\n  gates:\n    schemaVersion: delivery.merge.gates.v1\n    entries:\n      - {id: lifecycle-finalization, recipe: lifecycle-finalization, surface: battery}\n      - {id: ci-green, recipe: ci-green, surface: battery}\n      - {id: push-parity, recipe: push-parity, surface: battery}\n      - {id: owner-gate, recipe: owner-gate, surface: battery, class: owner-review}\n      - {id: squash-preflight, recipe: squash-preflight, surface: battery}\n      - {id: tracker-freshness, recipe: tracker-freshness, surface: merge}\n      - {id: ci-required, recipe: required-ci-job, surface: merge, job: "CI / test"}\n`,
    });
    try {
      harness.setReply((url) =>
        url.includes("/check-runs")
          ? {
              status: 200,
              body: {
                check_runs: [
                  { id: 1, name: "CI / test", status: "completed", conclusion: "failure" },
                ],
              },
            }
          : harness.defaultReply(url),
      );
      const run = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
      expect(run.exitCode).toBe(1);
      const code = String(envelopeOf(run).error?.code);
      expect(code).toBe("merge.gate.ci-required.failed");
      expect(code).not.toBe("fallback.internal");
      const verifications = readMergeGateVerifications(harness.store, MERGE_PROD_REF);
      expect(verifications.ok && verifications.records).toHaveLength(1);
      expect(readMergeTransactions(harness.store, MERGE_PROD_REF).ok).toBe(true);
      const transactions = readMergeTransactions(harness.store, MERGE_PROD_REF);
      expect(transactions.ok && transactions.records).toEqual([]);
      const text = await harness.run(["merge", MERGE_PROD_REF, "--dry-run"]);
      // Text mode renders the classified refusal on stderr.
      expect(text.stderr).toContain("merge.gate.ci-required.failed");
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
      harness.dispose();
    }
  });
});

describe("TC-ENGINE-052 a missing credential is config at exit 1", () => {
  test("every invocation cell refuses config.credential.missing and never contains the defect", async () => {
    const harness = createMergeProductionHarness({
      label: "gh293-prod-credential",
    });
    try {
      // The landing path refuses the state read before any provider read, so a
      // fresh verification is recorded first and the credential port is then
      // switched to the declared refusal.
      const dry = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
      expect(dry.exitCode, dry.stderr).toBe(0);
      harness.setCredential("missing");
      const callsBefore = harness.transportCalls.length;
      const verificationsBefore = readMergeGateVerifications(harness.store, MERGE_PROD_REF);
      if (!verificationsBefore.ok) throw new Error("verification read failed");
      const recordsBefore = verificationsBefore.records.length;
      const row = ERROR_TABLE.find((entry) => entry.code === "config.credential.missing");
      expect(row?.projectionClass).toBe("user-validation");
      expect(exitOf("config.credential.missing")).toBe(1);
      for (const argv of [
        ["merge", MERGE_PROD_REF, "--dry-run", "--json"],
        ["merge", MERGE_PROD_REF, "--dry-run"],
        ["merge", MERGE_PROD_REF, "--json"],
        ["merge", MERGE_PROD_REF],
      ] as const) {
        const run = await harness.run(argv);
        expect(run.exitCode, argv.join(" ")).toBe(1);
        expect(run.exitCode).not.toBe(2);
        const serialized = `${run.stdout}\n${run.stderr}`;
        expect(serialized).not.toContain("fallback.internal");
        if (run.envelope !== undefined) {
          const error = envelopeOf(run).error ?? {};
          // The classified envelope carries the row's declared facts; the row is
          // the oracle for the domain kind (`kind` is not a payload member).
          expect(error.code).toBe("config.credential.missing");
          expect(error.category).toBe(row?.category);
          expect(error.retryable).toBe(row?.retryable);
          expect(error.consequence).toBe(row?.consequence);
          expect(row?.domainKind).toBe("config");
        } else {
          expect(run.stderr).toContain("config.credential.missing");
        }
      }
      // No request left the process on any refused cell.
      expect(harness.transportCalls.slice(callsBefore)).toEqual([]);
      const verifications = readMergeGateVerifications(harness.store, MERGE_PROD_REF);
      expect(verifications.ok && verifications.records.length).toBe(recordsBefore);
      expect(readMergeTransactions(harness.store, MERGE_PROD_REF).ok).toBe(true);
      expect(readMergeWaivers(harness.store, MERGE_PROD_REF).ok).toBe(true);
      expect(
        (MERGE_COMPOSITION_EMITTABLE_CODES as readonly string[]).includes(
          "config.credential.missing",
        ),
      ).toBe(true);
    } finally {
      harness.dispose();
    }
  });
});

describe("GH-366 the diagnostics contract cells (phase 2)", () => {
  test("TC-MRG-020/021 an absent token names the reference, the environment variable, and the attempted operation, and is never the generic abort", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({
      label: "gh366-prod-credential-naming",
    });
    try {
      const dry = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
      expect(dry.exitCode).toBe(0);
      harness.setCredential("missing");
      const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      expect(run.exitCode).toBe(exitOf("config.credential.missing"));
      const error = envelopeOf(run).error ?? {};
      expect(error.code).toBe("config.credential.missing");
      const summary = String(error.summary ?? "");
      // The declared reference name and the environment variable are named as
      // dedicated evidence, and the operation that required them is the
      // dedicated `operation=` field — never the generic abort row.
      expect(summary).toContain("credential-reference=github-read");
      expect(summary).toContain("credential-source=GITHUB_TOKEN");
      expect(summary).toMatch(/operation=github-[a-z-]+/);
      expect(error.code).not.toBe("merge.transaction-aborted");
      expect(summary).not.toContain("merge.transaction-aborted");
      expect(summary).toContain("command=merge");
      expect(summary).toContain(`ref=${MERGE_PROD_REF}`);
    } finally {
      harness.dispose();
      guard.restore();
    }
  });

  test("TC-MRG-022 an unresolvable work item names its own identity, the invocation ref, and the read operation", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({
      label: "gh366-prod-work-item-unresolved",
    });
    try {
      const dry = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
      expect(dry.exitCode).toBe(0);
      harness.setReply((url) => {
        if (url.includes("/issues/")) return { status: 404, body: {} };
        return harness.defaultReply(url);
      });
      const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      expect(run.exitCode).toBe(exitOf("merge.work-item-unresolved"));
      const error = envelopeOf(run).error ?? {};
      expect(error.code).toBe("merge.work-item-unresolved");
      const summary = String(error.summary ?? "");
      expect(summary).toContain("command=merge");
      expect(summary).toContain(`ref=${MERGE_PROD_REF}`);
      expect(summary).toContain("operation=github-work-item");
      expect(summary).not.toContain("merge.transaction-aborted");
      expect(summary).not.toContain("fallback.internal");
    } finally {
      harness.dispose();
      guard.restore();
    }
  });

  test("TC-MRG-051 the unverified-state remediation names the exact prior command and target", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({
      label: "gh366-prod-state-unverified",
    });
    try {
      // No verification record exists: the freshness precondition is unmet.
      const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      expect(run.exitCode).toBe(exitOf("merge.state-unverified"));
      expect(run.exitCode).toBe(2);
      const error = envelopeOf(run).error ?? {};
      expect(error.code).toBe("merge.state-unverified");
      const summary = String(error.summary ?? "");
      // The remediation names the producing command and the target form, and
      // the read that observed the absence names the delivery registry.
      expect(summary).toContain("verify gates <ref>");
      expect(summary).toContain("for the same work item, then re-run");
      expect(summary).not.toContain("Produce a gate verification with `verify gates` and retry");
      expect(summary).toContain("operation=delivery-registry");
      expect(summary).toContain("command=merge");
      expect(summary).toContain(`ref=${MERGE_PROD_REF}`);
      // The documented row carries the same remediation (the sync check binds
      // it; this pins the LF-2 sentence on the page).
      expect(readFileSync("doc/spec/features/feature-result-contract.md", "utf8")).toContain(
        "Produce the verification with `verify gates <ref>` for the same work item, then re-run",
      );
    } finally {
      harness.dispose();
      guard.restore();
    }
  });
});

describe("GH-366 the change-branch resolution and convergence (phase 3)", () => {
  /** A merged closed-page entry for the fixture branch. */
  const mergedEntry = (input: {
    readonly number: number;
    readonly branch: string;
    readonly sha: string;
  }) => ({
    number: input.number,
    state: "closed",
    merged_at: "2026-11-18T09:00:00Z",
    merged: true,
    head: { ref: input.branch, sha: input.sha },
    base: { ref: "main-tools" },
  });

  test("TC-MRG-049/043 a converged re-run replays from provider truth with zero record reads and lands nothing", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({ label: "gh366-prod-converged-replay" });
    try {
      // The open page offers nothing to resolve; the closed scan exposes exactly
      // one matched identity for the ref.
      harness.setReply((url) => {
        if (url.includes("state=open")) return { status: 200, body: [] };
        if (url.includes("state=closed")) {
          return {
            status: 200,
            body: [
              mergedEntry({
                number: 301,
                branch: MERGE_PROD_BRANCH,
                sha: harness.headSha,
              }),
            ],
          };
        }
        return harness.defaultReply(url);
      });
      const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      expect(run.exitCode, run.stderr).toBe(0);
      const data = envelopeOf(run).data;
      expect(data?.replayed).toBe(true);
      expect(String(data?.squashSha)).toBe(harness.headSha);
      // Zero record reads and zero record-read git invocations: the head object
      // is absent from the checkout for the replay (the convergence attempt
      // decides before any record read), so a run that read would refuse.
      const calls = harness.transportCalls;
      // Per-path multiset: the open list once, the closed scan once, and the
      // read's own delivered review-thread query once — three in all (TC-MRG-053).
      expect(calls.filter((url) => url.includes("state=open"))).toHaveLength(1);
      expect(calls.filter((url) => url.includes("state=closed"))).toHaveLength(1);
      expect(calls.filter((url) => url.includes("/graphql"))).toHaveLength(1);
      expect(calls).not.toContain("/issues/293");
      // The record-less replay's own record-keeping: one replayed transaction
      // with an empty post-landing list, zero landings.
      const transactions = readMergeTransactions(harness.store, MERGE_PROD_REF);
      expect(transactions.ok && transactions.records).toHaveLength(1);
      const record = transactions.ok ? (transactions.records.at(-1) ?? {}) : {};
      expect(record.replayed).toBe(true);
      expect(record.postLanding).toEqual([]);
      // Zero landings: the three reads are the whole exchange — the only POST
      // is the merged read's own delivered review-thread query, and no landing
      // request is issued.
      expect(harness.transportRequests).toHaveLength(3);
      expect(
        harness.transportRequests.filter((request) => request.url.endsWith("/merge")),
      ).toHaveLength(0);
      const serialized = `${run.stdout}\n${run.stderr}`;
      expect(serialized).not.toContain("merge.branch-unresolved");
      expect(serialized).not.toContain("declared-at-head");
      expect(serialized).not.toContain("protection-rule");
    } finally {
      harness.dispose();
      guard.restore();
    }
  });

  test("TC-MRG-049 cell (i) more than one matched identity aborts naming EACH and presenting none as the request", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({ label: "gh366-prod-duplicate-merged" });
    try {
      harness.setReply((url) => {
        if (url.includes("state=open")) return { status: 200, body: [] };
        if (url.includes("state=closed")) {
          return {
            status: 200,
            body: [
              mergedEntry({ number: 301, branch: MERGE_PROD_BRANCH, sha: harness.headSha }),
              mergedEntry({ number: 300, branch: "fix/GH-293/earlier", sha: "b".repeat(40) }),
            ],
          };
        }
        return harness.defaultReply(url);
      });
      const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      expect(run.exitCode).toBe(exitOf("merge.transaction-aborted"));
      const error = envelopeOf(run).error ?? {};
      expect(error.code).toBe("merge.transaction-aborted");
      const summary = String(error.summary ?? "");
      expect(summary).toContain("matched-identities=#301,#300");
      expect(summary).toContain("operation=github-delivery-request-list");
      expect(envelopeOf(run).data?.replayed).toBeUndefined();
      // The act-requiring duplicate cause refuses again on a plain re-run.
      const again = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      expect(again.exitCode).toBe(exitOf("merge.transaction-aborted"));
      expect(envelopeOf(again).error?.code).toBe("merge.transaction-aborted");
    } finally {
      harness.dispose();
      guard.restore();
    }
  });

  test("TC-MRG-005/049 cell (ii) the empty matched-identity set refuses no-open-request as a decidable zero", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({ label: "gh366-prod-empty-set" });
    try {
      harness.setReply((url) => {
        if (url.includes("state=open")) return { status: 200, body: [] };
        if (url.includes("state=closed")) return { status: 200, body: [] };
        return harness.defaultReply(url);
      });
      const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      expect(run.exitCode).toBe(exitOf("merge.request-unresolved"));
      const error = envelopeOf(run).error ?? {};
      expect(error.code).toBe("merge.request-unresolved");
      const summary = String(error.summary ?? "");
      expect(summary).toContain("request-reason=no-open-request");
      // The observed empty set is named: the zero is decided, not assumed.
      expect(summary).toContain("matched-identities=none");
      expect(summary).toContain("open=0");
      // Per-path: the open list once and the closed scan once; the thread
      // query is not issued without a selected match.
      expect(harness.transportCalls.filter((url) => url.includes("state=open"))).toHaveLength(1);
      expect(harness.transportCalls.filter((url) => url.includes("state=closed"))).toHaveLength(1);
      expect(harness.transportCalls.filter((url) => url.includes("/graphql"))).toHaveLength(0);
    } finally {
      harness.dispose();
      guard.restore();
    }
  });

  test("TC-MRG-052 every fault input class of the merged read refuses the ONE declared provider identity", async () => {
    const guard = createNoNetworkGuard();
    for (const [label, status, body] of [
      ["transport", 502, {}],
      ["payload", 200, "not-an-array"],
      ["auth-rejection", 401, {}],
    ] as const) {
      const harness = createMergeProductionHarness({ label: `gh366-prod-fault-${label}` });
      try {
        harness.setReply((url) => {
          if (url.includes("state=open")) return { status: 200, body: [] };
          if (url.includes("state=closed")) return { status, body };
          return harness.defaultReply(url);
        });
        const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
        // The single delivered outcome for every fault class at this seam:
        // `provider.outage` naming the list operation — never
        // `no-open-request`, never the abort row, never folded into zero.
        expect(run.exitCode, label).toBe(exitOf("provider.outage"));
        const error = envelopeOf(run).error ?? {};
        expect(error.code, label).toBe("provider.outage");
        const summary = String(error.summary ?? "");
        expect(summary, label).toContain("operation=github-delivery-request-list");
        expect(summary, label).not.toContain("no-open-request");
        expect(summary, label).not.toContain("merge.request-unresolved");
        expect(summary, label).not.toContain("merge.transaction-aborted");
        // Per-path: the fault spends TWO — the open list and the faulted read.
        expect(harness.transportCalls.filter((url) => url.includes("state=open"))).toHaveLength(1);
        expect(harness.transportCalls.filter((url) => url.includes("state=closed"))).toHaveLength(
          1,
        );
      } finally {
        harness.dispose();
      }
    }
    guard.restore();
  });

  test("TC-MRG-006 a saturated bounded page refuses ambiguous-open-request before the candidate count, even with zero matches", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({ label: "gh366-prod-saturated" });
    try {
      const page = Array.from({ length: 120 }, (_, index) => ({
        number: 10_000 + index,
        state: "open",
        head: { ref: `feat/other/${String(index)}`, sha: "c".repeat(40) },
        base: { ref: "main-tools" },
      }));
      harness.setReply((url) => {
        if (url.includes("state=open")) return { status: 200, body: page };
        return harness.defaultReply(url);
      });
      const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      expect(run.exitCode).toBe(exitOf("merge.request-unresolved"));
      const error = envelopeOf(run).error ?? {};
      expect(error.code).toBe("merge.request-unresolved");
      const summary = String(error.summary ?? "");
      expect(summary).toContain("request-reason=ambiguous-open-request");
      expect(summary).toContain("open=120");
      // Zero convention-matching entries, and no convergence read was taken:
      // the saturation refusal spends exactly one provider request.
      expect(harness.transportCalls.filter((url) => url.includes("state=open"))).toHaveLength(1);
      expect(harness.transportCalls.filter((url) => url.includes("state=closed"))).toHaveLength(0);
    } finally {
      harness.dispose();
      guard.restore();
    }
  });

  test("TC-MRG-006/007/042 the open-page refusal cells: over-cap, non-full-SHA head, and the duplicate-open abort", async () => {
    const guard = createNoNetworkGuard();
    const entry = (input: {
      readonly branch: string;
      readonly sha?: string;
      readonly number: number;
    }) => ({
      number: input.number,
      state: "open",
      head: { ref: input.branch, ...(input.sha === undefined ? {} : { sha: input.sha }) },
      base: { ref: "main-tools" },
    });

    // Over-cap: more than three convention-matching candidates.
    {
      const harness = createMergeProductionHarness({ label: "gh366-prod-over-cap" });
      try {
        harness.setReply((url) => {
          if (url.includes("state=open")) {
            return {
              status: 200,
              body: [1, 2, 3, 4].map((index) =>
                entry({
                  branch: `fix/GH-293/candidate-${String(index)}`,
                  sha: "d".repeat(40),
                  number: 400 + index,
                }),
              ),
            };
          }
          return harness.defaultReply(url);
        });
        const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
        expect(run.exitCode).toBe(exitOf("merge.request-unresolved"));
        expect(String(envelopeOf(run).error?.summary)).toContain(
          "request-reason=ambiguous-open-request",
        );
        expect(String(envelopeOf(run).error?.summary)).toContain("candidates=4");
      } finally {
        harness.dispose();
      }
    }

    // A candidate whose asserted head is not a full hex SHA refuses and is never read.
    {
      const harness = createMergeProductionHarness({ label: "gh366-prod-short-sha" });
      try {
        harness.setReply((url) => {
          if (url.includes("state=open")) {
            return {
              status: 200,
              body: [entry({ branch: MERGE_PROD_BRANCH, sha: "abc123", number: 301 })],
            };
          }
          return harness.defaultReply(url);
        });
        const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
        expect(run.exitCode).toBe(exitOf("merge.request-unresolved"));
        const summary = String(envelopeOf(run).error?.summary);
        expect(summary).toContain("request-reason=head-unresolved");
        expect(summary).toContain(MERGE_PROD_BRANCH);
        // The unusable candidate is never read: the work-item read never ran.
        expect(harness.transportCalls.filter((url) => url.includes("/issues/"))).toHaveLength(0);
      } finally {
        harness.dispose();
      }
    }

    // The duplicate-open abort: more than one open entry whose source ref equals
    // the resolved branch refuses the abort row naming each identity.
    {
      const harness = createMergeProductionHarness({ label: "gh366-prod-duplicate-open" });
      try {
        harness.setReply((url) => {
          if (url.includes("state=open")) {
            return {
              status: 200,
              body: [
                entry({ branch: MERGE_PROD_BRANCH, sha: harness.headSha, number: 301 }),
                entry({ branch: MERGE_PROD_BRANCH, sha: harness.duplicateHeadSha, number: 300 }),
              ],
            };
          }
          return harness.defaultReply(url);
        });
        const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
        expect(run.exitCode).toBe(exitOf("merge.transaction-aborted"));
        const summary = String(envelopeOf(run).error?.summary);
        expect(summary).toContain("matched-identities=#301,#300");
        // The duplicate-open abort spends exactly one provider request.
        expect(harness.transportCalls.filter((url) => url.includes("state=open"))).toHaveLength(1);
        expect(harness.transportCalls.filter((url) => url.includes("state=closed"))).toHaveLength(
          0,
        );
      } finally {
        harness.dispose();
      }
    }
    guard.restore();
  });

  test("TC-MRG-055 a mixed duplicate pair — one accepted, one refused member — aborts naming both identities", async () => {
    const guard = createNoNetworkGuard();
    const entry = (input: {
      readonly branch: string;
      readonly sha?: string;
      readonly number: number;
    }) => ({
      number: input.number,
      state: "open",
      head: { ref: input.branch, ...(input.sha === undefined ? {} : { sha: input.sha }) },
      base: { ref: "main-tools" },
    });

    // The mixed duplicate pair: both source refs equal the resolved branch, one
    // member accepted (declared branch, full-SHA head) and one refused (a head
    // that is not a full hex SHA, the TC-MRG-007 input shape). The duplicate
    // rule ranges over the candidate set (spec §5.1 F-1 step 5), so the pair
    // aborts naming BOTH identities instead of silently resolving through its
    // accepted member — and the refused member's head-unresolved reason never
    // masks the abort.
    {
      const harness = createMergeProductionHarness({ label: "gh366-prod-duplicate-mixed" });
      try {
        harness.setReply((url) => {
          if (url.includes("state=open")) {
            return {
              status: 200,
              body: [
                entry({ branch: MERGE_PROD_BRANCH, sha: harness.headSha, number: 301 }),
                entry({ branch: MERGE_PROD_BRANCH, sha: "abc123", number: 300 }),
              ],
            };
          }
          return harness.defaultReply(url);
        });
        const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
        expect(run.exitCode).toBe(exitOf("merge.transaction-aborted"));
        const error = envelopeOf(run).error ?? {};
        expect(error.code).toBe("merge.transaction-aborted");
        const summary = String(error.summary ?? "");
        expect(summary).toContain("matched-identities=#301,#300");
        expect(summary).toContain("operation=github-delivery-request-list");
        expect(summary).toContain("request-reason=duplicate-open-request");
        // The refused member's own reason does not surface: the duplicate abort
        // governs the mixed pair rather than the head guard firing first.
        expect(summary).not.toContain("head-unresolved");
        expect(summary).not.toContain("merge.request-unresolved");
        // Never resolved through the accepted member.
        const serialized = `${run.stdout}\n${run.stderr}`;
        expect(serialized).not.toContain("declared-at-head");
        expect(envelopeOf(run).data?.replayed).toBeUndefined();
        // The page-decided duplicate decision precedes every record read and
        // spends exactly one provider request: the bounded open-request list.
        expect(harness.transportCalls.filter((url) => url.includes("state=open"))).toHaveLength(1);
        expect(harness.transportCalls.filter((url) => url.includes("state=closed"))).toHaveLength(
          0,
        );
        expect(harness.transportRequests).toHaveLength(1);
        // Nothing landed: zero appended transactions.
        const transactions = readMergeTransactions(harness.store, MERGE_PROD_REF);
        expect(transactions.ok && transactions.records).toHaveLength(0);
        // The act-requiring duplicate cause refuses again on a plain re-run.
        const again = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
        expect(again.exitCode).toBe(exitOf("merge.transaction-aborted"));
        expect(envelopeOf(again).error?.code).toBe("merge.transaction-aborted");
        expect(String(envelopeOf(again).error?.summary ?? "")).toContain(
          "matched-identities=#301,#300",
        );
      } finally {
        harness.dispose();
      }
    }

    // Paired control (plan v17): a distinct-ref disagreement still resolves
    // through its accepted member — the duplicate rule is keyed on the resolved
    // branch's source ref, not on any refusal elsewhere in the candidate set.
    {
      const harness = createMergeProductionHarness({ label: "gh366-prod-distinct-disagrees" });
      try {
        harness.setReply((url) => {
          if (url.includes("state=open")) {
            return {
              status: 200,
              body: [
                entry({ branch: MERGE_PROD_BRANCH, sha: harness.headSha, number: 301 }),
                entry({
                  branch: "fix/GH-293/duplicate",
                  sha: harness.duplicateHeadSha,
                  number: 300,
                }),
              ],
            };
          }
          return harness.defaultReply(url);
        });
        const dry = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
        expect(dry.exitCode, dry.stderr).toBe(0);
        expect(envelopeOf(dry).data?.resolution).toMatchObject({
          source: "declared-at-head",
          branch: MERGE_PROD_BRANCH,
          requestIdentity: "#301",
          candidateCount: 2,
        });
        // Per-path on a resolved dry run: exactly one provider request.
        expect(harness.transportCalls.filter((url) => url.includes("state=open"))).toHaveLength(1);
        expect(harness.transportCalls.filter((url) => url.includes("state=closed"))).toHaveLength(
          0,
        );
      } finally {
        harness.dispose();
      }
    }
    guard.restore();
  });

  test("TC-MRG-001/003 a base-checkout invocation resolves the request head and the declaration is read at that head", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({ label: "gh366-prod-resolution-facts" });
    try {
      const dry = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
      expect(dry.exitCode, dry.stderr).toBe(0);
      const data = envelopeOf(dry).data;
      // The dry run describes the same resolved object the real merge would land.
      expect(data?.resolution).toMatchObject({
        source: "declared-at-head",
        branch: MERGE_PROD_BRANCH,
        requestIdentity: "#301",
        candidateCount: 1,
        headSha: harness.headSha,
      });
      expect(data?.headSha).toBe(harness.headSha);
      // Per-path on a resolved dry run: exactly one delivery-request provider
      // request (the open list); no merged read, no mergeability read.
      expect(harness.transportCalls.filter((url) => url.includes("state=open"))).toHaveLength(1);
      expect(harness.transportCalls.filter((url) => url.includes("state=closed"))).toHaveLength(0);
      // The real merge agrees (the healthy landing lands once at the resolved head).
      const live = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      expect(live.exitCode, live.stderr).toBe(0);
      expect(envelopeOf(live).data?.landing).toMatchObject({ requestState: "merged" });
      expect(envelopeOf(live).data?.resolution).toMatchObject({ branch: MERGE_PROD_BRANCH });
    } finally {
      harness.dispose();
      guard.restore();
    }
  });

  test("TC-MRG-004 the declaration cap boundary: 256 characters are accepted and 257 are refused", async () => {
    const guard = createNoNetworkGuard();
    // Exactly 256 characters: the record's declaration equals its own source
    // ref and is accepted.
    {
      const harness = createMergeProductionHarness({ label: "gh366-prod-cap-256" });
      try {
        harness.setReply((url) => {
          if (url.includes("state=open")) {
            return {
              status: 200,
              body: [
                {
                  number: 302,
                  state: "open",
                  head: { ref: harness.cap256.ref, sha: harness.cap256.headSha },
                  base: { ref: "main-tools" },
                },
              ],
            };
          }
          return harness.defaultReply(url);
        });
        const run = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
        expect(run.exitCode, run.stderr).toBe(0);
        expect(envelopeOf(run).data?.resolution).toMatchObject({
          branch: harness.cap256.ref,
          candidateCount: 1,
        });
        expect(harness.cap256.ref).toHaveLength(256);
      } finally {
        harness.dispose();
      }
    }
    // 257 characters: the value is over the declared cap and is refused,
    // never truncated.
    {
      const harness = createMergeProductionHarness({ label: "gh366-prod-cap-257" });
      try {
        harness.setReply((url) => {
          if (url.includes("state=open")) {
            return {
              status: 200,
              body: [
                {
                  number: 303,
                  state: "open",
                  head: { ref: harness.cap257.ref, sha: harness.cap257.headSha },
                  base: { ref: "main-tools" },
                },
              ],
            };
          }
          return harness.defaultReply(url);
        });
        const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
        expect(run.exitCode).toBe(exitOf("merge.branch-unresolved"));
        const summary = String(envelopeOf(run).error?.summary);
        expect(summary).toContain("branch-reason=declaration-unusable");
        expect(harness.cap257.ref).toHaveLength(257);
      } finally {
        harness.dispose();
      }
    }
    guard.restore();
  });

  test("TC-MRG-050 the pinned mergeability oracle: a no-mergeability list entry plus a clean single request LANDS once", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({ label: "gh366-prod-mergeability" });
    try {
      // The fixture's open list carries no mergeability fields (the list
      // endpoint cannot); the single request reports mergeable and clean. The
      // landing decision reads mergeability from the single request.
      const dry = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
      expect(dry.exitCode, dry.stderr).toBe(0);
      const live = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      expect(live.exitCode, live.stderr).toBe(0);
      expect(envelopeOf(live).data?.landing).toMatchObject({ requestState: "merged" });
      // The transport log: the single-request URL requested after the gate
      // evaluation, exactly once before the landing; the open-list URL NOT
      // re-requested.
      const singles = harness.transportCalls.filter(
        (url) => url.includes("/pulls/") && !url.endsWith("/merge"),
      );
      expect(singles).toHaveLength(1);
      const openLists = harness.transportCalls.filter((url) => url.includes("state=open"));
      expect(openLists).toHaveLength(2); // dry run + live run, one each
      expect(harness.transportCalls.some((url) => url.endsWith("/merge"))).toBe(true);
      // The refusal never fires for the list entry's missing fields.
      const serialized = `${live.stdout}\n${live.stderr}`;
      expect(serialized).not.toContain("merge.mergeability-unknown");
    } finally {
      harness.dispose();
      guard.restore();
    }
  });

  test("TC-MRG-050 the fault cell: a fault of the single-request read names the detail operation from ERROR_TABLE", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({ label: "gh366-prod-mergeability-fault" });
    try {
      // A fresh verification is recorded first (the freshness precondition),
      // then the single-request read faults; the open list stays healthy.
      const dry = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
      expect(dry.exitCode).toBe(0);
      harness.setReply((url) => {
        if (url.includes("/pulls/") && !url.endsWith("/merge")) {
          return { status: 503, body: {} };
        }
        return harness.defaultReply(url);
      });
      const run = await harness.run(["merge", MERGE_PROD_REF, "--json"]);
      const row = ERROR_TABLE.find((entry) => entry.code === "provider.outage");
      expect(row).toBeDefined();
      expect(run.exitCode).toBe(exitOf("provider.outage"));
      expect(envelopeOf(run).error?.code).toBe("provider.outage");
      const summary = String(envelopeOf(run).error?.summary ?? "");
      expect(summary).toContain("operation=github-delivery-request-detail");
      expect(summary).not.toContain("no-open-request");
      expect(summary).not.toContain("merge.transaction-aborted");
    } finally {
      harness.dispose();
      guard.restore();
    }
  });
});

describe("TC-ENGINE-053 read and state faults stay classified on every path", () => {
  test("provider, state, and request faults are classified by their declared rows", async () => {
    const guard = createNoNetworkGuard();
    try {
      for (const reply of [
        () => ({ status: 500, body: {} }) as MergeProviderReply,
        () => ({ status: 401, body: {} }) as MergeProviderReply,
      ]) {
        const harness = createMergeProductionHarness({ label: "gh293-prod-fault", reply });
        try {
          const run = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
          const code = String(envelopeOf(run).error?.code);
          expect(["provider.outage", "provider.auth.rejected"]).toContain(code);
          expect(run.exitCode).toBe(exitOf(code));
          expect(String(envelopeOf(run).error?.summary)).not.toContain("fallback.internal");
          expect((MERGE_COMPOSITION_EMITTABLE_CODES as readonly string[]).includes(code)).toBe(
            true,
          );
        } finally {
          harness.dispose();
        }
      }

      const failingAppend = (base: StateStorePort): StateStorePort => ({
        ...base,
        append: () => ({
          ok: false as const,
          error: {
            kind: "state" as const,
            code: "state.write.failed" as const,
            consequence: "not_landed" as const,
            location: { path: "synthetic-store" },
          },
        }),
      });
      const stateHarness = createMergeProductionHarness({
        label: "gh293-prod-state",
        stateStoreWrap: failingAppend,
      });
      try {
        const run = await stateHarness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
        expect(run.exitCode).toBe(exitOf("merge.state-unverified"));
        expect(envelopeOf(run).error?.code).toBe("merge.state-unverified");
        expect(String(envelopeOf(run).error?.summary)).not.toContain("fallback.internal");
        expect(
          (MERGE_COMPOSITION_EMITTABLE_CODES as readonly string[]).includes(
            "merge.state-unverified",
          ),
        ).toBe(true);
      } finally {
        stateHarness.dispose();
      }

      const staleHarness = createMergeProductionHarness({
        label: "gh293-prod-stale",
      });
      try {
        const dry = await staleHarness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
        expect(dry.exitCode).toBe(0);
        seedVerification(staleHarness);
        const stale = await staleHarness.run(["merge", MERGE_PROD_REF, "--json"]);
        expect(stale.exitCode).toBe(exitOf("merge.gates-stale"));
        expect(envelopeOf(stale).error?.code).toBe("merge.gates-stale");
        expect(readMergeTransactions(staleHarness.store, MERGE_PROD_REF).ok).toBe(true);
        const transactions = readMergeTransactions(staleHarness.store, MERGE_PROD_REF);
        expect(transactions.ok && transactions.records).toEqual([]);
      } finally {
        staleHarness.dispose();
      }

      const unresolvedHarness = createMergeProductionHarness({
        label: "gh293-prod-unresolved",
      });
      try {
        const dry = await unresolvedHarness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
        expect(dry.exitCode).toBe(0);
        unresolvedHarness.setReply((url) => {
          if (url.includes("/pulls?")) return { status: 200, body: [] };
          if (url.includes("/pulls/")) return { status: 404, body: {} };
          return harness.defaultReply(url);
        });
        const unresolved = await unresolvedHarness.run(["merge", MERGE_PROD_REF, "--json"]);
        // The pre-resolution placeholder routing (phase 2): the two
        // request-resolution returns refuse the request row's own identity.
        expect(unresolved.exitCode).toBe(exitOf("merge.request-unresolved"));
        expect(envelopeOf(unresolved).error?.code).toBe("merge.request-unresolved");
        expect(String(envelopeOf(unresolved).error?.summary)).not.toContain("fallback.internal");
        expect(
          (MERGE_COMPOSITION_EMITTABLE_CODES as readonly string[]).includes(
            "merge.transaction-aborted",
          ),
        ).toBe(true);
        // Nothing landed: no squash commit exists on the base branch.
        expect(existsSync(join(unresolvedHarness.checkout, "feature.txt"))).toBe(false);
      } finally {
        unresolvedHarness.dispose();
      }
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
    }
  });
});

describe("TC-ENGINE-054 the configuration-read branch is classified, never contained", () => {
  test("an unreadable, malformed, or invalid configuration document is its declared refusal", async () => {
    const guard = createNoNetworkGuard();
    try {
      // Three cells, three declared rows: the acquisition's own malformed/read
      // refusal, the declared gate-set refusal, and the declared freshness
      // refusal. Each one is the composition's configuration document, never a
      // provider read and never the contained `fallback.internal`. The gate-set
      // and freshness values pass the typed catalog (a string version and a
      // finite number), so only their own declared refusals can produce the
      // code — a valid freshness refuses nothing (TC-ENGINE-050).
      const cells: readonly {
        readonly label: string;
        readonly configYaml: string;
        readonly code: string;
      }[] = [
        {
          label: "malformed",
          configYaml: "merge: [unterminated\n",
          code: "config.file.malformed",
        },
        {
          label: "invalid-gates",
          configYaml:
            "merge:\n  gates:\n    schemaVersion: delivery.merge.gates.v0\n    entries: []\n",
          code: "config.value.invalid",
        },
        {
          label: "invalid-freshness",
          configYaml: "merge:\n  gate-freshness: -5\n",
          code: "config.value.invalid",
        },
      ];
      for (const cell of cells) {
        const harness = createMergeProductionHarness({
          label: `gh293-prod-config-${cell.label}`,
          configYaml: cell.configYaml,
        });
        try {
          const run = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
          expect(run.exitCode, cell.label).toBe(exitOf(cell.code));
          expect(exitOf(cell.code), cell.label).toBe(1);
          const error = envelopeOf(run).error ?? {};
          expect(error.code, cell.label).toBe(cell.code);
          expect(String(error.summary), cell.label).not.toContain("fallback.internal");
          // The refusal precedes every provider read and every append.
          expect(harness.transportCalls, cell.label).toEqual([]);
          const verifications = readMergeGateVerifications(harness.store, MERGE_PROD_REF);
          expect(verifications.ok && verifications.records, cell.label).toEqual([]);
          const transactions = readMergeTransactions(harness.store, MERGE_PROD_REF);
          expect(transactions.ok && transactions.records, cell.label).toEqual([]);
          // The forwarded identity is a declared member, not an incidental code.
          expect(
            (MERGE_COMPOSITION_EMITTABLE_CODES as readonly string[]).includes(cell.code),
            cell.label,
          ).toBe(true);
        } finally {
          harness.dispose();
        }
      }
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
    }
  });
});

describe("GH-388 the native merge sequence at the production composition", () => {
  const productionGolden = (): { readonly machine: { readonly stdout: string } } =>
    JSON.parse(
      readFileSync(
        join(process.cwd(), "tests/fixtures/verify-gates/golden/production-success.json"),
        "utf8",
      ),
    ) as { readonly machine: { readonly stdout: string } };

  test("TC-MERGE-040 verify gates then plain merge lands with no --dry-run anywhere", async () => {
    const guard = createNoNetworkGuard();
    const harness = createVerifyGatesProductionHarness({ label: "gh388-native-sequence" });
    try {
      // Step 1: verify gates — exit 0 with the byte-identical report.
      const verify = await harness.run(["--json", "verify", "gates", VG_PROD_REF]);
      expect(verify.exitCode, verify.stderr).toBe(0);
      const golden = productionGolden();
      const identity = {
        headSha: harness.headSha,
        checkout: harness.checkout,
        hostRoot: harness.host.hostRoot,
      };
      expect(normalizeProductionBytes(verify.stdout, identity)).toBe(golden.machine.stdout);
      // Step 2: the verification count is exactly one.
      const records = readMergeGateVerifications(harness.store, VG_PROD_REF);
      expect(records.ok && records.records).toHaveLength(1);
      // Step 3: plain merge, no flags — the documented native sequence.
      const merge = await harness.run(["--json", "merge", VG_PROD_REF]);
      // Step 4: the landing proceeds with the provider squash SHA.
      expect(merge.exitCode, merge.stderr).toBe(0);
      const data = (merge.envelope?.data ?? {}) as Record<string, unknown>;
      expect(data.result).toBe("merged");
      expect(data.squashSha).toBe("c1d2e3f4a5b60718293a4b5c6d7e8f9012345678");
      // Step 5a: no invocation's argv contains --dry-run (recorded, asserted).
      expect(harness.invocations.length).toBe(2);
      for (const argv of harness.invocations) {
        expect(argv.join(" ")).not.toContain("--dry-run");
      }
      // Step 5b: the verification count is still exactly one — merge consumed
      // the record and appended no verification of its own.
      const after = readMergeGateVerifications(harness.store, VG_PROD_REF);
      expect(after.ok && after.records).toHaveLength(1);
      // Step 5c: the transaction record exists once; no waivers.
      const transactions = readMergeTransactions(harness.store, VG_PROD_REF);
      expect(transactions.ok && transactions.records).toHaveLength(1);
      const waivers = readMergeWaivers(harness.store, VG_PROD_REF);
      expect(waivers.ok && waivers.records).toEqual([]);
      // Step 5d: the landing call count is exactly one, at the expected head.
      const landingCalls = harness.transportRequests.filter((request) =>
        request.url.endsWith("/merge"),
      );
      expect(landingCalls.length).toBeLessThanOrEqual(1);
      expect(landingCalls).toHaveLength(1);
      expect(landingCalls[0]?.body ?? "").toContain(harness.headSha);
      // The landing read-back observes the merged request state.
      const landing = data.landing as Record<string, unknown> | undefined;
      expect(String(landing?.requestState ?? "")).toBe("merged");
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
      harness.dispose();
    }
  });

  test("TC-MERGE-041 the absence refusal composes nothing and the remediation sequence converges", async () => {
    const guard = createNoNetworkGuard();
    const harness = createVerifyGatesProductionHarness({ label: "gh388-absence-fail-closed" });
    try {
      // A fresh harness whose ledger holds no verification record.
      const before = readMergeGateVerifications(harness.store, VG_PROD_REF);
      expect(before.ok && before.records).toEqual([]);
      // Step 1: plain merge refuses state-unverified exactly as delivered.
      const refusal = await harness.run(["--json", "merge", VG_PROD_REF]);
      expect(refusal.exitCode).toBe(exitOf("merge.state-unverified"));
      expect(refusal.exitCode).toBe(2);
      const error = envelopeOf(refusal).error ?? {};
      expect(error.code).toBe("merge.state-unverified");
      const summary = String(error.summary ?? "");
      expect(summary).toContain("state=absent");
      expect(summary).toContain("operation=delivery-registry");
      // Step 2: option (B) is absent — the refusal path composes nothing:
      // zero verification appends, zero gate evaluations (no check-run page
      // on the refusal path), zero landing calls, zero transaction and waiver
      // records, and no landing decision read composed.
      const after = readMergeGateVerifications(harness.store, VG_PROD_REF);
      expect(after.ok && after.records).toEqual([]);
      expect(harness.transportCalls.filter((url) => url.includes("/check-runs"))).toEqual([]);
      expect(harness.transportCalls.filter((url) => url.endsWith("/merge"))).toEqual([]);
      const transactions = readMergeTransactions(harness.store, VG_PROD_REF);
      expect(transactions.ok && transactions.records).toEqual([]);
      const waivers = readMergeWaivers(harness.store, VG_PROD_REF);
      expect(waivers.ok && waivers.records).toEqual([]);
      expect(harness.transportCalls.filter((url) => url.includes("/pulls/"))).toEqual([]);
      // Step 3: the remediation, executed exactly — verify gates, then merge.
      const verify = await harness.run(["--json", "verify", "gates", VG_PROD_REF]);
      expect(verify.exitCode, verify.stderr).toBe(0);
      const merge = await harness.run(["--json", "merge", VG_PROD_REF]);
      expect(merge.exitCode, merge.stderr).toBe(0);
      const data = (merge.envelope?.data ?? {}) as Record<string, unknown>;
      expect(data.result).toBe("merged");
      expect(data.squashSha).toBe("c1d2e3f4a5b60718293a4b5c6d7e8f9012345678");
      // The sequence's verification count: exactly one (the remediation run).
      const converged = readMergeGateVerifications(harness.store, VG_PROD_REF);
      expect(converged.ok && converged.records).toHaveLength(1);
      const transactionsAfter = readMergeTransactions(harness.store, VG_PROD_REF);
      expect(transactionsAfter.ok && transactionsAfter.records).toHaveLength(1);
      expect(
        harness.transportRequests.filter((request) => request.url.endsWith("/merge")),
      ).toHaveLength(1);
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
      harness.dispose();
    }
  });
});

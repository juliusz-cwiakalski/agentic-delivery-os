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
import { existsSync } from "node:fs";
import { join } from "node:path";
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
import { projectExitCode } from "../../packages/cli/src/projection";
import { MERGE_COMPOSITION_EMITTABLE_CODES } from "../../packages/cli/src/production";
import { createNoNetworkGuard } from "../fixtures/verify-gates/cases/network-guard";
import {
  createMergeProductionHarness,
  MERGE_PROD_BRANCH,
  MERGE_PROD_OWNER,
  MERGE_PROD_REF,
  MERGE_PROD_REPOSITORY,
  type MergeProductionHarness,
  type MergeProviderReply,
} from "../fixtures/merge/production-composition";

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

const failingCheckRuns: (url: string) => MergeProviderReply = (url) => {
  if (url.includes("/check-runs")) {
    return {
      status: 200,
      body: {
        check_runs: [{ id: 1, name: "CI / test", status: "completed", conclusion: "failure" }],
      },
    };
  }
  return healthyReply(url);
};

const healthyReply = (url: string): MergeProviderReply => {
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
  if (url.includes("/pulls?")) {
    return {
      status: 200,
      body: [
        {
          number: 301,
          state: "open",
          head: { ref: MERGE_PROD_BRANCH, sha: "0".repeat(40) },
          base: { ref: "main-tools" },
          commits: 1,
          changed_files: 1,
          mergeable: true,
        },
      ],
    };
  }
  if (url.includes("/graphql")) return { status: 200, body: { data: {} } };
  return { status: 404, body: {} };
};

describe("TC-ENGINE-050 the production dry run is real, declared, and honest", () => {
  test("exit 0 with the delivered report, one verification record, and real reads", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({ label: "gh293-prod-dry", reply: healthyReply });
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
      reply: healthyReply,
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
});

describe("TC-ENGINE-051 a failing gate is a classified refusal at exit 1", () => {
  test("a declared merge-surface job gate refuses by its declared family identity", async () => {
    const guard = createNoNetworkGuard();
    const harness = createMergeProductionHarness({
      label: "gh293-prod-gate",
      reply: failingCheckRuns,
      configYaml: `merge:\n  gates:\n    schemaVersion: delivery.merge.gates.v1\n    entries:\n      - {id: lifecycle-finalization, recipe: lifecycle-finalization, surface: battery}\n      - {id: ci-green, recipe: ci-green, surface: battery}\n      - {id: push-parity, recipe: push-parity, surface: battery}\n      - {id: owner-gate, recipe: owner-gate, surface: battery, class: owner-review}\n      - {id: squash-preflight, recipe: squash-preflight, surface: battery}\n      - {id: tracker-freshness, recipe: tracker-freshness, surface: merge}\n      - {id: ci-required, recipe: required-ci-job, surface: merge, job: "CI / test"}\n`,
    });
    try {
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
      reply: healthyReply,
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
        reply: healthyReply,
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
        reply: healthyReply,
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
        reply: healthyReply,
      });
      try {
        const dry = await unresolvedHarness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
        expect(dry.exitCode).toBe(0);
        unresolvedHarness.setReply((url) => {
          if (url.includes("/pulls?")) return { status: 200, body: [] };
          if (url.includes("/pulls/")) return { status: 404, body: {} };
          return healthyReply(url);
        });
        const unresolved = await unresolvedHarness.run(["merge", MERGE_PROD_REF, "--json"]);
        expect(unresolved.exitCode).toBe(exitOf("merge.transaction-aborted"));
        expect(envelopeOf(unresolved).error?.code).toBe("merge.transaction-aborted");
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
          reply: healthyReply,
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

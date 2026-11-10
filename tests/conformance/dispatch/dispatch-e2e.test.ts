/**
 * TC-E2E-001 / TC-E2E-002 (phase 10) — the controlled-proof repository accrues
 * real command evidence to eligibility with all eleven classes, flips, dispatches
 * once more end to end, and reverses back to dual-run; a provenance guard proves
 * no evidence was hand-inserted and no non-controlled-proof record counted.
 */
import { describe, expect, test } from "bun:test";
import { createControlledRepo, type ControlledRepo } from "./controlled-repo";
import {
  COMPLETED_EVIDENCE,
  SPAWN_REFUSED_EVIDENCE,
  TIMED_OUT_EVIDENCE,
  TOOL_FAILURE_EVIDENCE,
} from "../../fixtures/dispatch/harness";
import { artifacts, ledger, prNone, readFail, readOk } from "../../fixtures/dispatch/truth";

const drive = async (repo: ControlledRepo, token: string): Promise<void> => {
  switch (token) {
    case "pr-open":
      await repo.run({ label: token });
      return;
    case "pr-open-unverified":
      await repo.run({
        reads: {
          artifacts: readOk(
            artifacts({ branchCommits: 2, pr: { state: "open", url: null, mergeReady: true } }),
          ),
        },
      });
      return;
    case "merged":
      await repo.run({
        reads: {
          artifacts: readOk(
            artifacts({
              branchCommits: 3,
              pr: {
                state: "already-merged",
                url: "https://example.test/owner/repo/pull/1",
                mergeReady: false,
              },
            }),
          ),
        },
      });
      return;
    case "blocked":
      await repo.run({ reads: { tracker: readOk({ state: "delivery-blocked", blocking: true }) } });
      return;
    case "finished":
      await repo.run({ reads: { artifacts: readOk(artifacts({ branchCommits: 2, pr: prNone })) } });
      return;
    case "failed":
      await repo.run({
        reads: {
          artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })),
          ledger: readOk(ledger({ progressed: false })),
        },
      });
      return;
    case "partial":
      await repo.run({
        evidence: TOOL_FAILURE_EVIDENCE,
        reads: { artifacts: readOk(artifacts({ branchCommits: 2, pr: prNone })) },
      });
      return;
    case "max-restarts":
      await repo.run({
        evidence: TIMED_OUT_EVIDENCE,
        reads: { artifacts: readOk(artifacts({ branchCommits: 2, pr: prNone })) },
      });
      return;
    case "state-unverified":
      // An unreadable ledger cannot establish delivered evidence, so this class
      // is exposure-only and owes no divergence (the delivered-evidence case is
      // covered by its own suite).
      await repo.run({
        reads: {
          ledger: readFail("ledger", "ledger.read-unreadable"),
          tracker: readFail("tracker", "tracker.read-unreadable"),
        },
      });
      return;
    case "noop-lane-permission":
      await repo.run({ evidence: SPAWN_REFUSED_EVIDENCE });
      return;
    case "noop-lane-nothing-to-do":
      await repo.run({
        reads: {
          artifacts: readOk(artifacts({ branchCommits: 2, pr: prNone })),
          ledger: readOk(
            ledger({ completed: 9, total: 9, progressed: false, workRemaining: false }),
          ),
        },
      });
      return;
    default:
      throw new Error(`unknown class ${token}`);
  }
};

const ALL_CLASSES = [
  "merged",
  "blocked",
  "pr-open",
  "pr-open-unverified",
  "failed",
  "finished",
  "max-restarts",
  "state-unverified",
  "partial",
  "noop-lane-permission",
  "noop-lane-nothing-to-do",
] as const;

describe("TC-E2E-001 controlled-proof evidence reaches eligibility, flips, and dispatches", () => {
  test("the full path runs with real commands and a provenance guard", async () => {
    const repo = createControlledRepo();
    try {
      for (const token of ALL_CLASSES) await drive(repo, token);
      let produced = ALL_CLASSES.length;
      while (produced < 20) {
        await repo.run({ evidence: COMPLETED_EVIDENCE });
        produced += 1;
      }
      const provenance = repo.provenance();
      expect(provenance.dispatches).toBe(produced);
      expect(provenance.attempts).toBe(produced);
      expect(provenance.classes).toEqual(["controlled-proof"]);

      const summary = await repo.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        repo.repository,
        "--json",
      ]);
      expect(summary.exit).toBe(0);
      const data = summary.envelope?.data as {
        readonly eligibility?: boolean;
        readonly verdict?: string;
        readonly coverage?: {
          readonly present: readonly string[];
          readonly missing: readonly string[];
        };
        readonly countedEvidenceClass?: string;
        readonly unmetConditions?: readonly unknown[];
      };
      expect(data.eligibility).toBe(true);
      expect(data.verdict).toBe("eligible");
      expect(data.countedEvidenceClass).toBe("controlled-proof");
      expect(data.coverage?.missing).toEqual([]);
      expect(data.unmetConditions).toEqual([]);
      expect(data.coverage?.present).toContain("state-unverified");
      expect(data.coverage?.present).toContain("pr-open-unverified");

      const handover = await repo.invoke(["dispatch", "handover", repo.repository, "--json"]);
      expect(handover.exit).toBe(0);
      expect(handover.envelope?.data).toMatchObject({ recorded: true, operation: "authoritative" });

      const post = await repo.run({ evidence: COMPLETED_EVIDENCE });
      expect(post.exit).toBe(0);
      expect(typeof post.envelope?.data?.result).toBe("string");
      expect(repo.provenance().attempts).toBe(produced + 1);
    } finally {
      repo.dispose();
    }
  });
});

describe("TC-E2E-002 reversal returns the repository to dual-run", () => {
  test("history is retained and the bash-facing view returns to dual-run", async () => {
    const repo = createControlledRepo();
    try {
      for (const token of ALL_CLASSES) await drive(repo, token);
      let produced = ALL_CLASSES.length;
      while (produced < 20) {
        await repo.run({ evidence: COMPLETED_EVIDENCE });
        produced += 1;
      }
      await repo.invoke(["dispatch", "handover", repo.repository, "--json"]);
      const revert = await repo.invoke([
        "dispatch",
        "handover",
        repo.repository,
        "--revert",
        "--json",
      ]);
      expect(revert.exit).toBe(0);
      expect(revert.envelope?.data).toMatchObject({ operation: "dual-run", recorded: true });

      const { readDispatchAuthority } = await import(
        "../../../packages/adapters/src/file/dispatch-authority"
      );
      expect(readDispatchAuthority(repo.state.root, repo.repository).authority).toBe("dual-run");
      const { readDispatchHandover } = await import(
        "../../../packages/core/src/app/dispatch-ledger"
      );
      const handover = readDispatchHandover(repo.state.store);
      expect(handover.ok).toBe(true);
      if (!handover.ok) return;
      expect(handover.records.map((record) => record.operation)).toEqual([
        "authoritative",
        "dual-run",
      ]);
    } finally {
      repo.dispose();
    }
  });
});

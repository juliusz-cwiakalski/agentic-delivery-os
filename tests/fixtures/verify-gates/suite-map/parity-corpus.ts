/**
 * The delivered corpus fact builders, shared by the pre-change parity baseline
 * capture and the scoped parity suite (GH-300 TC-SPAR-001/TC-SPAR-006).
 *
 * The builders mirror `tests/behaviour/verify-gates-corpus.test.ts` exactly: the
 * delivered corpus manifest names a builder, and the suite reassembles the same
 * fact bundle from the same pure fixture helpers. No I/O, no clock, no network.
 */
import type { VerifyGatesFacts } from "../../../../packages/core/src/domain/index";
import { baseFacts, clone, EXPECTED_JOBS, lifecycle, request, run, workItem } from "../cases/facts";

export type CorpusCase = {
  readonly id: string;
  readonly builder: string;
  readonly fixture: string;
  readonly canary: string;
  readonly gate: string;
  readonly expectedVerdict: string;
  readonly expectedReason: string;
  readonly expectedExit: number;
  readonly squashSignals: readonly string[];
};

const withRuns = (runs: ReturnType<typeof run>[]) => {
  const facts = clone(baseFacts());
  facts.checkRuns = { ok: true, value: { items: runs, pageItemCount: runs.length } };
  return facts;
};

const green = () => EXPECTED_JOBS.map((name) => run(name, "succeeded"));

const withRequest = (overrides: Parameters<typeof request>[0]) => {
  const facts = clone(baseFacts());
  const detail = request(overrides);
  facts.deliveryRequestDetail = { ok: true, value: { request: detail } };
  facts.openPullRequests = { ok: true, value: { items: [detail], pageItemCount: 1 } };
  facts.checkRuns = { ok: true, value: { items: green(), pageItemCount: 23 } };
  return facts;
};

/** Rebuild one manifest case's fact bundle by its declared builder name. */
export const factsFor = (builder: string): VerifyGatesFacts => {
  switch (builder) {
    case "lifecycle-complete":
      return baseFacts();
    case "lifecycle-incomplete": {
      const facts = clone(baseFacts());
      facts.lifecycle.evaluation = lifecycle({
        outcome: "partial",
        completedPhases: ["phase-1"],
        missingPhases: ["phase-2"],
        declaration: { requiredCount: 11, completedCount: 1 },
        code: "verify.ledger.incomplete",
      });
      return facts;
    }
    case "lifecycle-unverifiable": {
      const facts = clone(baseFacts());
      facts.lifecycle.evaluation = lifecycle({
        outcome: "state-unverified",
        kind: "state",
        code: "state.store.torn",
      });
      return facts;
    }
    case "ci-green":
      return baseFacts();
    case "ci-failed":
    case "ticket-red-pipeline":
    case "red-pipeline":
      return withRuns(
        green().map((entry, index) => (index === 0 ? run(entry.pipelineName, "failed") : entry)),
      );
    case "ci-pending":
      return withRuns(
        green().map((entry, index) => (index === 0 ? run(entry.pipelineName, "running") : entry)),
      );
    case "ci-canceled":
      return withRuns(
        green().map((entry, index) => (index === 0 ? run(entry.pipelineName, "canceled") : entry)),
      );
    case "ci-no-runs":
    case "ticket-vacuous-green":
    case "vacuous-green":
      return withRuns([]);
    case "ci-all-skipped":
      return withRuns(EXPECTED_JOBS.map((name) => run(name, "skipped")));
    case "ci-missing-jobs":
    case "ticket-missing-job":
    case "missing-job": {
      const facts = withRuns(green().filter((entry) => entry.pipelineName !== EXPECTED_JOBS[0]));
      return facts;
    }
    case "ci-expected-jobs-invalid": {
      const facts = clone(baseFacts());
      facts.workflow = { outcome: "read", names: [] };
      return facts;
    }
    case "ci-truncated": {
      const runs = [
        ...green(),
        ...Array.from({ length: 77 }, (_, index) => run(`extra-${index}`, "succeeded")),
      ];
      const facts = clone(baseFacts());
      facts.checkRuns = { ok: true, value: { items: runs, pageItemCount: 100 } };
      return facts;
    }
    case "parity-matched":
      return baseFacts();
    case "parity-mismatched":
    case "push-mismatch": {
      const facts = clone(baseFacts());
      facts.deliveryRequestDetail = {
        ok: true,
        value: { request: request({ sourceHeadSha: "2".repeat(40) }) },
      };
      return facts;
    }
    case "branch-mismatch": {
      const facts = clone(baseFacts());
      const lone = request({ sourceRef: "feat/other" });
      facts.openPullRequests = { ok: true, value: { items: [lone], pageItemCount: 1 } };
      facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
      return facts;
    }
    case "branch-unresolved": {
      const facts = clone(baseFacts());
      facts.repository.head = { sha: "1".repeat(40), detached: true };
      facts.openPullRequests = { ok: false, reason: "not-attempted" };
      facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
      return facts;
    }
    case "no-open-pr": {
      const facts = clone(baseFacts());
      facts.openPullRequests = { ok: true, value: { items: [], pageItemCount: 0 } };
      facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
      return facts;
    }
    case "ambiguous-open-pr":
    case "at-limit-with-match":
    case "at-limit-without-match": {
      const facts = clone(baseFacts());
      const items =
        builder === "at-limit-without-match"
          ? Array.from({ length: 100 }, (_, index) => request({ sourceRef: `other-${index}` }))
          : [
              request(),
              ...Array.from({ length: 99 }, (_, index) => request({ sourceRef: `other-${index}` })),
            ];
      facts.openPullRequests = { ok: true, value: { items, pageItemCount: 100 } };
      facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
      return facts;
    }
    case "head-unresolved":
    case "matched-detail-404-ci":
    case "matched-detail-404-parity":
    case "matched-detail-404-squash": {
      const facts = clone(baseFacts());
      facts.deliveryRequestDetail = { ok: false, reason: "not-found" };
      facts.checkRuns = { ok: false, reason: "not-attempted" };
      return facts;
    }
    case "owner-gate-absent": {
      const facts = clone(baseFacts());
      facts.workItem = { ok: true, value: { item: workItem(["change"]) } };
      return facts;
    }
    case "owner-gate-present":
    case "owner-present": {
      const facts = clone(baseFacts());
      facts.workItem = { ok: true, value: { item: workItem(["hand-back"]) } };
      return facts;
    }
    case "ticket-unresolved": {
      const facts = clone(baseFacts());
      facts.workItem = { ok: false, reason: "not-found" };
      return facts;
    }
    case "squash-ready":
      return baseFacts();
    case "squash-not-open":
      return withRequest({ reviewState: "closed" });
    case "squash-draft":
      return withRequest({ reviewState: "draft" });
    case "squash-target-mismatch":
    case "bad-squash":
      return withRequest({ targetRef: "main" });
    case "squash-conflicting":
      return withRequest({ mergeableState: "conflicting" });
    case "squash-not-mergeable":
      return withRequest({ mergeableState: "not-mergeable" });
    case "squash-mergeability-unknown":
      return withRequest({ mergeableState: "unknown" });
    case "squash-no-commits":
      return withRequest({ commitCount: 0 });
    case "squash-no-changes":
      return withRequest({ changedFileCount: 0 });
    case "squash-surface-unknown":
      return withRequest({ commitCount: undefined, changedFileCount: undefined });
    case "read-failed":
    case "check-run-404": {
      const facts = clone(baseFacts());
      facts.checkRuns =
        builder === "check-run-404"
          ? { ok: false, reason: "not-found" }
          : { ok: false, reason: "read-failed", failureClass: "provider.payload.invalid" };
      return facts;
    }
    case "credential-unavailable": {
      const facts = clone(baseFacts());
      facts.openPullRequests = {
        ok: false,
        reason: "credential-unavailable",
        failureCode: "config.credential.missing",
      };
      facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
      facts.checkRuns = { ok: false, reason: "not-attempted" };
      return facts;
    }
    case "address-unresolved": {
      const facts = clone(baseFacts());
      facts.repository.binding = "address-unresolved";
      facts.openPullRequests = { ok: false, reason: "address-unresolved" };
      facts.deliveryRequestDetail = { ok: false, reason: "address-unresolved" };
      facts.checkRuns = { ok: false, reason: "address-unresolved" };
      return facts;
    }
    case "unrecognized-state":
      return withRuns(
        green().map((entry, index) =>
          index === 0
            ? { ...entry, jobs: [{ jobName: entry.pipelineName, jobState: "mystery" as never }] }
            : entry,
        ),
      );
    default:
      throw new Error(`unknown corpus builder ${builder}`);
  }
};

/** Rebuild one case's facts and stamp its canary on the work-item title. */
export const caseFacts = (entry: CorpusCase): VerifyGatesFacts => {
  const facts = factsFor(entry.builder);
  if (facts.workItem.ok) {
    facts.workItem = {
      ok: true,
      value: { item: { ...facts.workItem.value.item, title: entry.canary } },
    };
  }
  return facts;
};

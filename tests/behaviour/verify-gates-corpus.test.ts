/** TC-VGATES-057/058 — corpus completeness and non-vacuity. */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  VERIFY_GATES_GATE_ORDER,
  VERIFY_GATES_REASONS,
  VERIFY_GATES_VERDICTS,
} from "../../packages/core/src/contracts/index";
import {
  evaluateVerifyGates,
  verifyGatesUnknownIdentity,
} from "../../packages/core/src/domain/index";
import {
  baseFacts,
  clone,
  EXPECTED_JOBS,
  lifecycle,
  request,
  run,
  workItem,
} from "../fixtures/verify-gates/cases/facts";

type Case = {
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

type CaseInput = Partial<Case>;

const ROOT = process.cwd();
const CORPUS_ROOT = join(ROOT, "tests/fixtures/verify-gates/corpus");
const manifest = JSON.parse(readFileSync(join(CORPUS_ROOT, "cases.json"), "utf8")) as {
  cases: CaseInput[];
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

const factsFor = (builder: string): ReturnType<typeof baseFacts> => {
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

const exitFor = (facts: ReturnType<typeof baseFacts>): number => {
  const evaluated = evaluateVerifyGates(facts);
  if (evaluated.overall === "pass") return 0;
  if (evaluated.overall === "fail") return 1;
  const identity = verifyGatesUnknownIdentity(evaluated);
  return identity?.projectionClass === "user-validation" ? 1 : 2;
};

const signalsOf = (record: {
  readonly citation: {
    readonly names: readonly { readonly kind: string; readonly values: readonly string[] }[];
  };
}): readonly string[] =>
  record.citation.names.find((entry) => entry.kind === "squash-signals")?.values ?? [];

const caseFacts = (entry: Case): ReturnType<typeof baseFacts> => {
  const facts = factsFor(entry.builder);
  if (facts.workItem.ok) {
    facts.workItem = {
      ok: true,
      value: { item: { ...facts.workItem.value.item, title: entry.canary } },
    };
  }
  return facts;
};

const REQUIRED_REASONS = [
  "lifecycle-complete",
  "lifecycle-incomplete",
  "lifecycle-unverifiable",
  "ci-green",
  "ci-failed",
  "ci-pending",
  "ci-canceled",
  "ci-no-runs",
  "ci-all-skipped",
  "ci-missing-jobs",
  "ci-expected-jobs-invalid",
  "ci-truncated",
  "parity-matched",
  "parity-mismatched",
  "branch-mismatch",
  "branch-unresolved",
  "no-open-pr",
  "ambiguous-open-pr",
  "head-unresolved",
  "owner-gate-absent",
  "owner-gate-present",
  "ticket-unresolved",
  "squash-ready",
  "squash-not-open",
  "squash-draft",
  "squash-target-mismatch",
  "squash-conflicting",
  "squash-not-mergeable",
  "squash-mergeability-unknown",
  "squash-no-commits",
  "squash-no-changes",
  "squash-surface-unknown",
  "read-failed",
  "credential-unavailable",
  "address-unresolved",
] as const;

const REQUIRED_IDS = [
  "ticket-red-pipeline",
  "ticket-missing-job",
  "ticket-vacuous-green",
  "push-mismatch",
  "owner-present",
  "bad-squash",
  "at-limit-with-match",
  "at-limit-without-match",
  "matched-detail-404-ci",
  "matched-detail-404-parity",
  "matched-detail-404-squash",
  "check-run-404",
  "unrecognized-state",
] as const;

const completenessFailures = (cases: readonly CaseInput[]): string[] => {
  const failures: string[] = [];
  const reasons = new Set(cases.map((entry) => entry.expectedReason));
  const ids = new Set(cases.map((entry) => entry.id));
  for (const reason of REQUIRED_REASONS) {
    if (!reasons.has(reason)) failures.push(`missing reason ${reason}`);
  }
  for (const id of REQUIRED_IDS) {
    if (!ids.has(id)) failures.push(`missing required case ${id}`);
  }
  return failures;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readFixture = (relative: string): Record<string, unknown> => {
  const text = readFileSync(join(CORPUS_ROOT, relative), "utf8");
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error(`${relative}: fixture root is not an object`);
  return parsed;
};

const failuresFor = (cases: readonly CaseInput[]): string[] => {
  const failures: string[] = [];
  if (cases.length === 0) return ["corpus is empty"];
  const ids = new Set<string>();
  const canaries = new Set<string>();
  for (const entry of cases) {
    const id = entry.id;
    if (typeof id !== "string" || id.length === 0) {
      failures.push("case without an id");
      continue;
    }
    if (ids.has(id)) failures.push(`${id}: duplicate case`);
    ids.add(id);

    const canary = entry.canary;
    if (typeof canary !== "string" || canary.length === 0) {
      failures.push(`${id}: missing canary`);
    } else {
      if (canaries.has(canary)) failures.push(`${id}: duplicate canary`);
      canaries.add(canary);
    }

    if (
      entry.gate === undefined ||
      !(VERIFY_GATES_GATE_ORDER as readonly string[]).includes(entry.gate)
    ) {
      failures.push(`${id}: unknown gate ${String(entry.gate)}`);
    }
    if (
      entry.expectedVerdict === undefined ||
      !(VERIFY_GATES_VERDICTS as readonly string[]).includes(entry.expectedVerdict)
    ) {
      failures.push(`${id}: unknown verdict ${String(entry.expectedVerdict)}`);
    }
    if (
      entry.expectedReason === undefined ||
      !(VERIFY_GATES_REASONS as readonly string[]).includes(entry.expectedReason)
    ) {
      failures.push(`${id}: stale reason ${String(entry.expectedReason)}`);
    }
    if (entry.expectedExit === undefined || ![0, 1, 2].includes(entry.expectedExit)) {
      failures.push(`${id}: invalid exit ${String(entry.expectedExit)}`);
    }

    const signals = entry.squashSignals;
    if (!Array.isArray(signals)) {
      failures.push(`${id}: missing squash-signals expectation`);
    } else if (signals.length !== 0 && signals.length !== 2) {
      failures.push(`${id}: squash-signals must be empty or two tokens`);
    } else if (
      signals.length === 2 &&
      (!signals[0]?.startsWith("draft=") || !signals[1]?.startsWith("mergeable="))
    ) {
      failures.push(`${id}: squash-signals are not draft then mergeable`);
    }

    const fixturePath = entry.fixture;
    if (typeof fixturePath !== "string" || fixturePath.length === 0) {
      failures.push(`${id}: missing fixture path`);
      continue;
    }
    if (fixturePath === "cases.json") {
      failures.push(`${id}: fixture points at the manifest`);
      continue;
    }
    let fixture: Record<string, unknown>;
    try {
      fixture = readFixture(fixturePath);
    } catch {
      failures.push(`${id}: fixture missing or unreadable (${fixturePath})`);
      continue;
    }
    if (fixture.id !== id || fixture.builder !== entry.builder || fixture.canary !== canary) {
      failures.push(`${id}: stale fixture ${fixturePath}`);
    }

    const builder = entry.builder;
    if (typeof builder !== "string" || builder.length === 0) {
      failures.push(`${id}: missing builder`);
      continue;
    }
    const normalized: Case = {
      id,
      builder,
      fixture: fixturePath,
      canary: canary ?? "",
      gate: entry.gate ?? "",
      expectedVerdict: entry.expectedVerdict ?? "",
      expectedReason: entry.expectedReason ?? "",
      expectedExit: entry.expectedExit ?? -1,
      squashSignals: signals ?? [],
    };
    let facts: ReturnType<typeof baseFacts>;
    try {
      facts = caseFacts(normalized);
    } catch {
      failures.push(`${id}: unknown builder ${builder}`);
      continue;
    }
    if (facts.workItem.ok && facts.workItem.value.item.title !== canary) {
      failures.push(`${id}: builder did not carry the case canary`);
    }

    const evaluated = evaluateVerifyGates(facts);
    const record = evaluated.gates.find((gate) => gate.id === entry.gate);
    if (record === undefined) {
      failures.push(`${id}: gate ${String(entry.gate)} absent`);
      continue;
    }
    if (record.verdict !== entry.expectedVerdict) {
      failures.push(`${id}: verdict ${record.verdict} != ${String(entry.expectedVerdict)}`);
    }
    if (record.reason !== entry.expectedReason) {
      failures.push(`${id}: reason ${record.reason} != ${String(entry.expectedReason)}`);
    }
    if (signalsOf(record).join("|") !== (signals ?? []).join("|")) {
      failures.push(`${id}: fabricated or missing squash-signals`);
    }
    const exit = exitFor(facts);
    if (exit !== entry.expectedExit) {
      failures.push(`${id}: exit ${exit} != ${String(entry.expectedExit)}`);
    }
    if (entry.expectedVerdict !== "pass" && (evaluated.overall === "pass" || exit === 0)) {
      failures.push(`${id}: fail/unknown case would emit success`);
    }
    if (entry.expectedVerdict === "pass" && record.verdict !== "pass") {
      failures.push(`${id}: pass declaration over a ${record.verdict} gate`);
    }
    if (entry.expectedVerdict === "pass" && evaluated.overall !== "pass") {
      failures.push(`${id}: pass case does not produce an all-pass report`);
    }
    if (canary !== undefined && JSON.stringify(evaluated).includes(canary)) {
      failures.push(`${id}: canary leaked into the report`);
    }
  }
  return failures;
};

describe("TC-VGATES-057 corpus completeness", () => {
  test("the manifest is non-empty, unique, complete, and every case executes", () => {
    expect(failuresFor(manifest.cases)).toEqual([]);
    expect(completenessFailures(manifest.cases)).toEqual([]);
    const reasons = new Set(manifest.cases.map((entry) => entry.expectedReason));
    for (const required of REQUIRED_REASONS) {
      expect(reasons, required).toContain(required);
    }
    for (const id of REQUIRED_IDS) {
      expect(
        manifest.cases.some((entry) => entry.id === id),
        id,
      ).toBe(true);
    }
  });
});

describe("TC-VGATES-058 negative controls", () => {
  const first = (): Case => {
    const entry = manifest.cases[0];
    if (entry === undefined) throw new Error("empty manifest");
    return {
      id: entry.id ?? "",
      builder: entry.builder ?? "",
      fixture: entry.fixture ?? "",
      canary: entry.canary ?? "",
      gate: entry.gate ?? "",
      expectedVerdict: entry.expectedVerdict ?? "",
      expectedReason: entry.expectedReason ?? "",
      expectedExit: entry.expectedExit ?? -1,
      squashSignals: entry.squashSignals ?? [],
    };
  };

  test("an empty or duplicate manifest fails", () => {
    expect(failuresFor([])).toEqual(["corpus is empty"]);
    expect(failuresFor([first(), first()]).some((failure) => failure.includes("duplicate"))).toBe(
      true,
    );
  });

  test("a missing fixture, a stale fixture, and a stale reason fail", () => {
    expect(
      failuresFor([{ ...first(), fixture: "fixtures/missing-case.json" }]).some((failure) =>
        failure.includes("fixture missing"),
      ),
    ).toBe(true);
    expect(
      failuresFor([{ ...first(), canary: "corpus-canary-stale" }]).some((failure) =>
        failure.includes("stale fixture"),
      ),
    ).toBe(true);
    expect(
      failuresFor([{ ...first(), expectedReason: "ci-not-a-reason" }]).some((failure) =>
        failure.includes("stale reason"),
      ),
    ).toBe(true);
  });

  test("a fabricated, absent, or defaulted squash-signals expectation fails", () => {
    const squash = manifest.cases.find((entry) => entry.id === "squash-ready");
    if (squash === undefined) throw new Error("missing squash-ready case");
    expect(
      failuresFor([{ ...squash, squashSignals: ["draft=false"] }]).some((failure) =>
        failure.includes("squash-signals"),
      ),
    ).toBe(true);
    expect(
      failuresFor([{ ...squash, squashSignals: ["draft=false", "mergeable=unknown"] }]).some(
        (failure) => failure.includes("fabricated or missing squash-signals"),
      ),
    ).toBe(true);
    const withoutSignals = { ...squash };
    delete withoutSignals.squashSignals;
    expect(
      failuresFor([withoutSignals]).some((failure) =>
        failure.includes("missing squash-signals expectation"),
      ),
    ).toBe(true);
  });

  test("a fail or unknown case cannot be declared as success", () => {
    const red = manifest.cases.find((entry) => entry.id === "ticket-red-pipeline");
    if (red === undefined) throw new Error("missing ticket-red-pipeline case");
    expect(
      failuresFor([{ ...red, expectedVerdict: "pass", expectedExit: 0 }]).some((failure) =>
        failure.includes("pass declaration"),
      ),
    ).toBe(true);
    for (const entry of manifest.cases) {
      if (entry.expectedVerdict !== "pass") {
        expect(entry.expectedExit, entry.id).not.toBe(0);
      }
    }
  });

  test("a temp copy missing a required case fails completeness", () => {
    const directory = mkdtempSync(join(tmpdir(), "verify-gates-corpus-"));
    try {
      const copy = {
        cases: manifest.cases.filter((entry) => entry.id !== "bad-squash"),
      };
      const copyPath = join(directory, "cases.json");
      writeFileSync(copyPath, JSON.stringify(copy));
      const loaded = JSON.parse(readFileSync(copyPath, "utf8")) as { cases: CaseInput[] };
      expect(loaded.cases.some((entry) => entry.id === "bad-squash")).toBe(false);
      expect(completenessFailures(loaded.cases)).toContain("missing required case bad-squash");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

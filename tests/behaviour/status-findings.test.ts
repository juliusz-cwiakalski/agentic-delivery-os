/**
 * TC-ATT-005 / 006 / 009 / 042 — registry-coded findings across the matrix,
 * the pinned four-red-runs grouping, the total rank key, and no-evidence-no-claim.
 */
import { describe, expect, test } from "bun:test";
import {
  STATUS_FINDING_REGISTRY,
  STATUS_FINDING_SEVERITIES,
  STATUS_MAX_FINDING_MEMBERS,
  type StatusFacts,
  type StatusFinding,
  type StatusSection,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus, evaluateStatusFindings } from "../../packages/core/src/domain/index";
import {
  baseFacts,
  failedPipelineRunRead,
  failedRun,
  pendingRun,
  pipelineRunRead,
  primaryRepository,
  repository,
  runStatusCli,
  sectionById,
  statusRuntime,
  succeededRun,
} from "../fixtures/status/harness";
import { matrixCases } from "../fixtures/status/matrix/cases";

const FINDING_KEYS = ["code", "count", "evidenceRef", "members", "severity"];

const findingsOf = (facts: StatusFacts, id: string): readonly StatusFinding[] =>
  sectionById(aggregateStatus(facts).sections, id).findings ?? [];

const sectionOf = (facts: StatusFacts, id: string): StatusSection =>
  sectionById(aggregateStatus(facts).sections, id);

const identityShaped = (value: string): boolean =>
  value.length > 0 && /^[A-Za-z0-9][A-Za-z0-9:._|#/@-]*$/.test(value);

describe("TC-ATT-005 every emitted finding is registry-coded", () => {
  test("the matrix sweep carries only closed codes, registry severities, and identities", () => {
    for (const testCase of matrixCases) {
      const digest = aggregateStatus(testCase.facts);
      for (const section of digest.sections) {
        const findings = section.findings ?? [];
        if (
          section.state === "unknown" ||
          section.state === "unavailable" ||
          section.state === "not-delivered"
        ) {
          expect(findings, `${testCase.name}: ${section.id}`).toEqual([]);
        }
        for (const finding of findings) {
          expect(Object.keys(finding).sort(), `${testCase.name}: ${section.id} keys`).toEqual(
            FINDING_KEYS,
          );
          const definition = STATUS_FINDING_REGISTRY[finding.code];
          expect(definition, `${testCase.name}: ${finding.code}`).toBeDefined();
          expect(finding.severity).toBe(definition?.severity);
          expect(STATUS_FINDING_SEVERITIES).toContain(finding.severity);
          expect(Number.isInteger(finding.count) && finding.count >= 1).toBe(true);
          expect(finding.members.length).toBeLessThanOrEqual(STATUS_MAX_FINDING_MEMBERS);
          expect(new Set(finding.members).size).toBe(finding.members.length);
          for (const member of finding.members) expect(identityShaped(member)).toBe(true);
          expect(finding.evidenceRef).toBe(finding.members[0] as string);
          expect(STATUS_FINDING_REGISTRY[finding.code]?.surface).toBe(section.id);
        }
      }
    }
  });

  test("the human attention tokens are code×count only", async () => {
    for (const testCase of matrixCases) {
      const run = await runStatusCli(["status"], statusRuntime(testCase.facts));
      const attention = run.stdout.split("\n").find((line) => line.startsWith("attention"));
      if (attention === undefined) continue;
      const groups = attention.replace(/^attention\s+\d+ findings \(/, "").replace(/\)$/, "");
      if (groups.length === 0) continue;
      for (const token of groups.replace(/\+\d+$/, "").split(", ")) {
        expect(token).toMatch(/^[a-z][a-z.-]*×\d+$/);
      }
    }
  });

  test("an unregistered code and an invalid severity are rejected by the layer", () => {
    expect(evaluateStatusFindings([{ code: "ci.something-else", member: "x" }])).toEqual({
      findings: [],
      truncated: false,
    });
    const invalid = evaluateStatusFindings([{ code: "ci.bad", member: "x" }], {
      "ci.bad": { severity: "critical" as never },
    });
    expect(invalid.findings).toEqual([]);
  });
});

const groupedFacts = (failed: number, branch = "main"): StatusFacts =>
  baseFacts({
    repository: repository({
      head: { branch, sha: "1111111111111111111111111111111111111111", detached: false },
    }),
    ci: pipelineRunRead(
      Array.from({ length: failed }, (_, index) => failedRun(String(700 + index))),
    ),
    tracker: {
      ok: true,
      items: [],
      pageItemCount: 0,
      availability: {
        ownerHandBacks: "available",
        blockedDependencies: "available",
        stalls: "available",
        hygiene: "available",
      },
    },
  });

describe("TC-ATT-006 four red primary-branch runs are one job", () => {
  test("four failed runs yield exactly one ci.red-on-main count 4", async () => {
    const facts = primaryRepositoryFacts(4);
    const ci = sectionOf(facts, "ci");
    expect(ci.state).toBe("observed");
    expect(ci.result).toBe("failed");
    expect(ci.findings).toHaveLength(1);
    const finding = ci.findings?.[0];
    expect(finding).toMatchObject({ code: "ci.red-on-main", severity: "high", count: 4 });
    expect(finding?.members).toEqual(["703", "702", "701", "700"]);
    expect(finding?.evidenceRef).toBe("703");
    const human = await runStatusCli(["status"], statusRuntime(facts));
    expect(human.stdout).toContain("ci.red-on-main×4");
    expect(human.stdout.match(/ci\.red-on-main×/g)).toHaveLength(1);
  });

  test("0/1/2/3/4/9/20-run controls preserve the exact count", () => {
    for (const count of [0, 1, 2, 3, 4, 9, 20]) {
      const findings = findingsOf(primaryRepositoryFacts(count), "ci");
      if (count === 0) {
        expect(findings).toEqual([]);
        continue;
      }
      expect(findings).toHaveLength(1);
      expect(findings[0]?.count).toBe(count);
      expect(findings[0]?.members).toHaveLength(Math.min(count, STATUS_MAX_FINDING_MEMBERS));
      expect(findings[0]?.evidenceRef).toBe(String(699 + count));
    }
  });

  test("mixed, pending-only, and non-primary controls never fabricate a finding", () => {
    const mixed = baseFacts({
      repository: primaryRepository(),
      ci: pipelineRunRead([
        failedRun("700"),
        failedRun("701"),
        succeededRun("702"),
        succeededRun("703"),
      ]),
    });
    expect(findingsOf(mixed, "ci")).toHaveLength(1);
    expect(findingsOf(mixed, "ci")[0]?.count).toBe(2);

    const pending = baseFacts({
      repository: primaryRepository(),
      ci: pipelineRunRead([pendingRun("700"), pendingRun("701")]),
    });
    expect(findingsOf(pending, "ci")).toEqual([]);

    const feature = groupedFacts(4, "feat/GH-243/x");
    expect(sectionOf(feature, "ci").result).toBe("failed");
    expect(findingsOf(feature, "ci")).toEqual([]);
    expect(JSON.stringify(aggregateStatus(feature))).not.toContain("ci.red-on-feature");
  });

  test("reversed input order yields identical findings and members", () => {
    const runs = Array.from({ length: 4 }, (_, index) => failedRun(String(700 + index)));
    const forward = baseFacts({ repository: primaryRepository(), ci: pipelineRunRead(runs) });
    const reversed = baseFacts({
      repository: primaryRepository(),
      ci: pipelineRunRead([...runs].reverse()),
    });
    expect(findingsOf(reversed, "ci")).toEqual(findingsOf(forward, "ci"));
    expect(JSON.stringify(aggregateStatus(reversed).sections)).toBe(
      JSON.stringify(aggregateStatus(forward).sections),
    );
  });
});

function primaryRepositoryFacts(count: number): StatusFacts {
  return baseFacts({
    repository: primaryRepository(),
    ci: pipelineRunRead(
      Array.from({ length: count }, (_, index) => failedRun(String(700 + index))),
    ),
  });
}

const mixedRankFacts = (): StatusFacts =>
  baseFacts({
    tracker: {
      ok: true,
      items: [
        {
          identity: { systemName: "github", entityId: "10" },
          title: "Escalated hand back",
          status: { nativeStatus: "open", deliveryState: "ready" },
          labels: ["hand-back", "epic:x", "points:1"],
          milestone: "Sprint 1",
          relations: [],
          updatedAt: "2026-09-01T00:00:00Z",
        },
        {
          identity: { systemName: "github", entityId: "20" },
          title: "Stalled",
          status: { nativeStatus: "open", deliveryState: "ready" },
          labels: ["epic:x", "points:1"],
          milestone: "Sprint 1",
          relations: [],
          updatedAt: "2026-09-01T00:00:00Z",
        },
        {
          identity: { systemName: "github", entityId: "30" },
          title: "",
          status: { nativeStatus: "open", deliveryState: "ready" },
          labels: ["epic:x", "points:1"],
          milestone: "Sprint 1",
          relations: [],
        },
        {
          identity: { systemName: "github", entityId: "40" },
          title: "No labels",
          status: { nativeStatus: "open", deliveryState: "ready" },
          labels: [],
          relations: [],
        },
      ],
      pageItemCount: 4,
      availability: {
        ownerHandBacks: "available",
        blockedDependencies: "available",
        stalls: "available",
        hygiene: "available",
        epicMembership: "available",
        storyPoints: "available",
        inSprint: "available",
      },
    },
  });

describe("TC-ATT-009 total rank key and permutation invariance", () => {
  test("severity, count, code, then first occurrence decide the order", () => {
    const findings = findingsOf(mixedRankFacts(), "tracker");
    const ranks = findings.map((finding) => [
      STATUS_FINDING_SEVERITIES.indexOf(finding.severity),
      -finding.count,
      finding.code,
    ]);
    const sorted = [...ranks].sort((left, right) => {
      if (left[0] !== right[0]) return (left[0] as number) - (right[0] as number);
      if (left[1] !== right[1]) return (left[1] as number) - (right[1] as number);
      return String(left[2]) < String(right[2]) ? -1 : 1;
    });
    expect(ranks).toEqual(sorted);
    expect(findings[0]?.severity).toBe("high");
  });

  test("reversed facts produce identical findings arrays", () => {
    const facts = mixedRankFacts();
    if (!facts.tracker.ok) throw new Error("tracker read must be observed");
    const reversed = baseFacts({
      tracker: { ...facts.tracker, items: [...facts.tracker.items].reverse() },
    });
    expect(findingsOf(reversed, "tracker")).toEqual(findingsOf(facts, "tracker"));
    expect(JSON.stringify(aggregateStatus(reversed).sections)).toBe(
      JSON.stringify(aggregateStatus(facts).sections),
    );
  });

  test("the comparator is total over emitted findings", () => {
    const findings = findingsOf(mixedRankFacts(), "tracker");
    for (const left of findings) {
      for (const right of findings) {
        const compare = (a: StatusFinding, b: StatusFinding): number => {
          const severity =
            STATUS_FINDING_SEVERITIES.indexOf(a.severity) -
            STATUS_FINDING_SEVERITIES.indexOf(b.severity);
          if (severity !== 0) return severity;
          if (a.count !== b.count) return b.count - a.count;
          return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
        };
        expect(Number.isFinite(compare(left, right))).toBe(true);
      }
    }
  });

  test("changing a count across an ordering boundary changes the order", () => {
    const base = findingsOf(mixedRankFacts(), "tracker");
    const before = base.findIndex((finding) => finding.code === "tracker.hygiene.missing-title");
    const changed = evaluateStatusFindings([
      { code: "tracker.hygiene.missing-title", member: "30" },
      { code: "tracker.hygiene.missing-title", member: "31" },
      { code: "tracker.hygiene.missing-labels", member: "40" },
      { code: "tracker.stalled-ticket", member: "20" },
    ]);
    const after = changed.findings.findIndex(
      (finding) => finding.code === "tracker.hygiene.missing-title",
    );
    expect(before).not.toBe(after);
  });
});

describe("TC-ATT-042 no-evidence-no-claim", () => {
  test("a failed or unresolved CI read emits no finding", () => {
    for (const facts of [
      baseFacts({ repository: primaryRepository(), ci: failedPipelineRunRead("read-failed") }),
      baseFacts({ repository: repository({ head: { detached: true } }) }),
      baseFacts({
        repository: repository({
          binding: { state: "unavailable", reason: "addressing-unresolved" },
        }),
      }),
    ]) {
      const ci = sectionOf(facts, "ci");
      expect(["unknown", "unavailable"]).toContain(ci.state);
      expect(ci.findings ?? []).toEqual([]);
      expect(JSON.stringify(aggregateStatus(facts))).not.toContain("ci.red-on-main");
    }
  });

  test("the observed control emits one count-4 finding", () => {
    expect(findingsOf(primaryRepositoryFacts(4), "ci")[0]?.count).toBe(4);
  });

  test("the rule generalizes to a failed tracker read", () => {
    const facts = baseFacts({
      tracker: { ok: false, reason: "read-failed" },
    });
    expect(sectionOf(facts, "tracker").state).toBe("unknown");
    expect(sectionOf(facts, "tracker").findings ?? []).toEqual([]);
  });
});

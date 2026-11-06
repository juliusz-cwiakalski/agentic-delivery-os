/**
 * TC-RETRO-041..046 / TC-RETRO-048 — the five pipeline-truth checks, their
 * blocking identities, verified-empty explicitness, and the no-target versus
 * zero-collector distinction.
 */
import { describe, expect, test } from "bun:test";
import {
  collectRetro,
  evaluateRetroTruthChecks,
  reportRetro,
} from "../../packages/core/src/domain/retro";
import { readRetroRegistry, readRetroRuns } from "../../packages/core/src/state/index";
import {
  auditOutcome,
  auditRecord,
  collectDeps,
  makeRetroDir,
  type RetroFixture,
  reportDeps,
  sidecarLines,
  transitionRecord,
} from "../fixtures/retro/harness";

const change = (ref: string, completedAt: string) => ({
  changeRef: ref,
  completedAt,
  transitions: [transitionRecord({ changeRef: ref, timestamp: completedAt })],
});

const baseSources = (fixture: RetroFixture, ref: string): void => {
  fixture.scriptStateFamilies(ref, {
    transitions: [transitionRecord({ changeRef: ref })],
    closeouts: [{ outcome: "complete" }],
    telemetry: [],
  });
  fixture.scriptNotes(ref, { retroNotes: [] });
};

const collectFor = (label: string) => {
  const fixture = makeRetroDir(label);
  fixture.scriptDeliveryChanges([change("GH-232", "2026-11-06T12:00:00Z")]);
  return fixture;
};

describe("TC-RETRO-041 C-01 skipped ordinals", () => {
  test("orphans surface as named findings and disappear from the clean control", () => {
    const fixture = collectFor("truth-c01");
    fixture.scriptAudit(
      auditOutcome({
        records: [auditRecord()],
        orphans: [
          { auditSeq: 4, runId: "orphan-4", position: 2 },
          { auditSeq: 5, runId: "orphan-5", position: 3 },
        ],
      }),
    );
    baseSources(fixture, "GH-232");
    const result = collectRetro(collectDeps(fixture));
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.outcome !== "collected") return;
    const c01 = result.data.truth?.checks.find((check) => check.id === "C-01");
    expect(c01?.outcome).toBe("finding");
    expect(c01?.findings).toHaveLength(2);
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
    if (report.ok && "findings" in report.data) {
      expect(report.data.findings.filter((finding) => finding.kind === "truth-check").length).toBe(
        2,
      );
    }
  });

  test("the clean control has no C-01 finding", () => {
    const fixture = collectFor("truth-c01-clean");
    fixture.scriptAudit(auditOutcome({ records: [auditRecord()] }));
    baseSources(fixture, "GH-232");
    const result = collectRetro(collectDeps(fixture));
    expect(result.ok).toBe(true);
    if (result.ok && result.data.outcome === "collected") {
      expect(result.data.truth?.checks.find((check) => check.id === "C-01")?.outcome).toBe(
        "passed",
      );
    }
  });
});

describe("TC-RETRO-042 C-02 broken audit verdict", () => {
  test("fails tamper-flagged with a finding naming the audit domain, never silently clean", () => {
    const fixture = collectFor("truth-c02");
    fixture.scriptAudit(auditOutcome({ records: [auditRecord()], verified: false }));
    baseSources(fixture, "GH-232");
    const result = collectRetro(collectDeps(fixture));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("retro.evidence.tamper-flagged");
    expect(result.error.kind).toBe("retro");
    const serialized = JSON.stringify(result.error);
    expect(serialized).toContain("audit");
    expect(serialized).not.toContain("sidecar");
  });
});

describe("TC-RETRO-043 C-03 dangling evidence refs", () => {
  test("a dangling ref is a finding and is never served as a trusted ref", () => {
    const fixture = collectFor("truth-c03");
    fixture.scriptAudit(auditOutcome({ records: [auditRecord()] }));
    baseSources(fixture, "GH-232");
    expect(collectRetro(collectDeps(fixture)).ok).toBe(true);
    const report = reportRetro(reportDeps(fixture, { extraReferencedTraceIds: ["ev-missing"] }));
    expect(report.ok).toBe(true);
    if (!report.ok || !("findings" in report.data)) return;
    expect(
      report.data.findings.some((finding) => finding.text.includes("dangling evidence ref")),
    ).toBe(true);
    expect(report.data.evidenceRefs).not.toContain("ev-missing");
  });
});

describe("TC-RETRO-044 C-04 expected activity absent", () => {
  test("zero audit invocations and no closeout record are findings; a quiet scope is verified-empty", () => {
    const fixture = collectFor("truth-c04");
    fixture.scriptAudit(auditOutcome({ records: [] }));
    fixture.scriptStateFamilies("GH-232", {
      transitions: [transitionRecord({ changeRef: "GH-232" })],
      closeouts: [],
      telemetry: [],
    });
    fixture.scriptNotes("GH-232", { retroNotes: ["note"] });
    const result = collectRetro(collectDeps(fixture));
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.outcome !== "collected") return;
    const c04 = result.data.truth?.checks.find((check) => check.id === "C-04");
    expect(c04?.outcome).toBe("finding");
    expect(c04?.findings.length).toBe(2);
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
    if (report.ok && "findings" in report.data) {
      const texts = report.data.findings.map((finding) => finding.text).join("\n");
      expect(texts).toContain("no audit invocations");
      expect(texts).toContain("no closeout outcome record");
    }

    const declaredQuiet = evaluateRetroTruthChecks({
      collected: 1,
      completed: false,
      hasCloseout: false,
    });
    expect(declaredQuiet.checks.find((check) => check.id === "C-04")?.outcome).toBe(
      "verified-empty",
    );
  });
});

describe("TC-RETRO-045 C-05 zero-collector run versus no-target", () => {
  test("an executed zero-collector run fails vacuous-run; all-collected is a distinct no-target success", () => {
    const fixture = collectFor("truth-c05");
    const vacuous = collectRetro(collectDeps(fixture, { sources: [] }));
    expect(vacuous.ok).toBe(false);
    if (!vacuous.ok) {
      expect(vacuous.error.code).toBe("retro.truth.vacuous-run");
      expect(vacuous.error.kind).toBe("retro");
    }

    const noTarget = makeRetroDir("truth-no-target");
    noTarget.scriptDeliveryChanges([change("GH-232", "2026-11-06T12:00:00Z")]);
    noTarget.scriptAudit(auditOutcome({ records: [auditRecord()] }));
    noTarget.scriptStateFamilies("GH-232", {
      transitions: [transitionRecord({ changeRef: "GH-232" })],
      closeouts: [{ outcome: "complete" }],
      telemetry: [],
    });
    noTarget.scriptNotes("GH-232", { retroNotes: ["note"] });
    const seeded = collectRetro(collectDeps(noTarget));
    expect(seeded.ok).toBe(true);
    const allCollected = collectRetro(collectDeps(noTarget));
    expect(allCollected.ok).toBe(true);
    if (allCollected.ok) {
      expect(allCollected.data).toMatchObject({ outcome: "no-target" });
    }
  });

  test("the run record carries the truth verdict for the vacuous run", () => {
    const fixture = collectFor("truth-c05-run");
    expect(collectRetro(collectDeps(fixture, { sources: [] })).ok).toBe(false);
    const registry = readRetroRegistry(fixture.store);
    expect(registry.ok).toBe(true);
    if (registry.ok) {
      const runs = readRetroRuns(registry.value);
      expect(runs[runs.length - 1]?.truth.blocking).toBe("retro.truth.vacuous-run");
    }
  });
});

describe("TC-RETRO-046 verified-empty is explicit", () => {
  test("legitimately empty sources produce explicit verified-empty evidence and zero findings", () => {
    const fixture = collectFor("truth-verified-empty");
    fixture.scriptAudit(auditOutcome({ records: [auditRecord()] }));
    fixture.scriptStateFamilies("GH-232", {
      transitions: [transitionRecord({ changeRef: "GH-232" })],
      closeouts: [{ outcome: "complete" }],
      telemetry: [],
    });
    fixture.scriptNotes("GH-232", { retroNotes: [] });
    const result = collectRetro(collectDeps(fixture));
    expect(result.ok).toBe(true);
    const lines = sidecarLines(fixture)
      .map(
        (line) => JSON.parse(line) as { payloadSchemaId?: string; payloadRefs?: readonly string[] },
      )
      .filter((record) => record.payloadSchemaId === "delivery.retro.verified-empty.v1");
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((record) => record.payloadRefs?.includes("source:pm-notes"))).toBe(true);
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
    if (report.ok && "findings" in report.data) {
      expect(report.data.findings).toEqual([]);
      expect(report.data.evidenceRefs.length).toBeGreaterThan(0);
    }
  });
});

describe("TC-RETRO-048 findings correspond exactly to triggered checks", () => {
  test("quiet yields zero findings; one orphan yields exactly one finding", () => {
    const quiet = evaluateRetroTruthChecks({
      audit: auditOutcome({ records: [auditRecord()] }),
      collected: 1,
      completed: true,
      hasCloseout: true,
    });
    expect(quiet.checks.filter((check) => check.outcome === "finding")).toEqual([]);

    const oneOrphan = evaluateRetroTruthChecks({
      audit: auditOutcome({
        records: [auditRecord()],
        orphans: [{ auditSeq: 1, runId: "orphan", position: 2 }],
      }),
      collected: 1,
      completed: true,
      hasCloseout: true,
      orphanEvidenceRefs: ["ev-orphan"],
    });
    const findings = oneOrphan.checks.filter((check) => check.outcome === "finding");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.findings).toHaveLength(1);
  });
});

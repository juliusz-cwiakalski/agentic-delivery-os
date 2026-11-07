/**
 * TC-DOCTOR-003 / TC-DOCTOR-004 / TC-DOCTOR-030 (pure halves) — five-check
 * totality, verdict/detail/evidence/hint discipline, the Appendix A matrix cell
 * by cell with within-check precedence, and the DM-5/DM-6 evidence discipline.
 *
 * The aggregator and renderer are called directly; CLI-level runs complete in
 * Phase 5. Every negative mutates an in-memory copy and fails by name.
 */
import { describe, expect, test } from "bun:test";
import {
  DOCTOR_AREA_SOURCES,
  DOCTOR_AREAS,
  DOCTOR_EVIDENCE_OUTCOMES,
  DOCTOR_EVIDENCE_REASONS,
  DOCTOR_MAX_DETAIL_CHARS,
  DOCTOR_MAX_EVIDENCE_REASONS,
  DOCTOR_MAX_EVIDENCE_SOURCES,
  DOCTOR_MAX_HINT_CHARS,
  DOCTOR_SCHEMA_VERSION,
  DOCTOR_VERDICTS,
  type DoctorCheck,
  type DoctorReport,
  ERROR_TABLE,
} from "../../packages/core/src/contracts/index";
import {
  aggregateDoctorReport,
  formatDoctorFailureSummary,
  renderDoctorHuman,
} from "../../packages/core/src/domain/doctor";
import { doctorWorld, FIXED_NOW } from "../fixtures/doctor/harness";
import { inputsFor, MATRIX_CASES } from "../fixtures/doctor/matrix/cases";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const REPORT_KEYS = ["checks", "generatedAt", "repository", "schemaVersion", "summary"];

const reportShape = (report: DoctorReport): string[] => {
  const failures: string[] = [];
  if (JSON.stringify(Object.keys(report).sort()) !== JSON.stringify(REPORT_KEYS)) {
    failures.push(`report keys are ${Object.keys(report).join(",")}`);
  }
  if (report.schemaVersion !== DOCTOR_SCHEMA_VERSION) {
    failures.push(`schemaVersion is ${String(report.schemaVersion)}`);
  }
  if (report.generatedAt !== FIXED_NOW) failures.push("generatedAt is not the injected clock");
  if (report.checks.length !== DOCTOR_AREAS.length) {
    failures.push(`checks length is ${report.checks.length}`);
  }
  const areas = report.checks.map((entry) => entry.area);
  if (JSON.stringify(areas) !== JSON.stringify([...DOCTOR_AREAS])) {
    failures.push(`areas are ${areas.join(",")}`);
  }
  if (new Set(areas).size !== areas.length) failures.push("duplicate area");
  for (const entry of report.checks) {
    if (!DOCTOR_VERDICTS.includes(entry.verdict)) {
      failures.push(`${entry.area}: verdict ${String(entry.verdict)}`);
    }
    if (typeof entry.detail !== "string" || entry.detail.trim().length === 0) {
      failures.push(`${entry.area}: empty detail`);
    }
    if (entry.detail.length > DOCTOR_MAX_DETAIL_CHARS) {
      failures.push(`${entry.area}: detail over the cap`);
    }
    if (entry.verdict === "ok") {
      if (entry.fixHint !== undefined) failures.push(`${entry.area}: ok check carries a hint`);
    } else {
      if (entry.fixHint === undefined || entry.fixHint.trim().length === 0) {
        failures.push(`${entry.area}: non-ok check has no hint`);
      } else if (entry.fixHint.length > DOCTOR_MAX_HINT_CHARS) {
        failures.push(`${entry.area}: hint over the cap`);
      }
    }
    const sources = entry.evidence.sources;
    if (sources.length > DOCTOR_MAX_EVIDENCE_SOURCES) {
      failures.push(`${entry.area}: more than four sources`);
    }
    if (new Set(sources.map((source) => source.source)).size !== sources.length) {
      failures.push(`${entry.area}: duplicate source`);
    }
    for (const source of sources) {
      if (!DOCTOR_AREA_SOURCES[entry.area].includes(source.source)) {
        failures.push(`${entry.area}: undeclared source ${source.source}`);
      }
      if (!DOCTOR_EVIDENCE_OUTCOMES.includes(source.outcome)) {
        failures.push(`${entry.area}: outcome ${String(source.outcome)}`);
      }
    }
    const reasons = entry.evidence.reasons;
    if (reasons.length > DOCTOR_MAX_EVIDENCE_REASONS) {
      failures.push(`${entry.area}: more than four reasons`);
    }
    if (new Set(reasons).size !== reasons.length) {
      failures.push(`${entry.area}: duplicate reason`);
    }
    for (const reason of reasons) {
      if (!DOCTOR_EVIDENCE_REASONS.includes(reason)) {
        failures.push(`${entry.area}: invented reason ${String(reason)}`);
      }
    }
    if (entry.evidence.httpStatus !== undefined) {
      if (typeof entry.evidence.httpStatus !== "number") {
        failures.push(`${entry.area}: non-numeric httpStatus`);
      }
    }
    if (entry.evidence.failureClass !== undefined) {
      const identities = new Set(ERROR_TABLE.map((row) => row.code));
      if (identities.has(entry.evidence.failureClass)) {
        failures.push(`${entry.area}: failureClass promoted to an identity`);
      }
    }
  }
  const expectedSummary = {
    total: 5,
    ok: report.checks.filter((entry) => entry.verdict === "ok").length,
    fail: report.checks.filter((entry) => entry.verdict === "fail").length,
    unreachable: report.checks.filter((entry) => entry.verdict === "unreachable").length,
  };
  if (JSON.stringify(report.summary) !== JSON.stringify(expectedSummary)) {
    failures.push(`summary ${JSON.stringify(report.summary)}`);
  }
  return failures;
};

const checkOf = (report: DoctorReport, area: DoctorCheck["area"]): DoctorCheck => {
  const found = report.checks.find((entry) => entry.area === area);
  if (found === undefined) throw new Error(`${area} check missing`);
  return found;
};

describe("TC-DOCTOR-003 five-check report totality and discipline", () => {
  test("the all-ok world is total, ordered, hint-free, and counted", () => {
    const report = aggregateDoctorReport(doctorWorld());
    expect(reportShape(report)).toEqual([]);
    expect(report.summary).toEqual({ total: 5, ok: 5, fail: 0, unreachable: 0 });
    expect(report.repository).toEqual({
      state: "observed",
      host: "github.com",
      owner: "example-owner",
      name: "example-repo",
    });
    expect(report.checks.every((entry) => entry.fixHint === undefined)).toBe(true);
  });

  test("a mixed world keeps five checks with truthful counts and hints", () => {
    const report = aggregateDoctorReport(
      doctorWorld({
        checkout: { clean: false },
        tracker: { credential: { ok: false, envVar: "EXAMPLE_PRODUCT_GITHUB_TOKEN" } },
      }),
    );
    expect(reportShape(report)).toEqual([]);
    expect(report.summary).toEqual({ total: 5, ok: 3, fail: 2, unreachable: 0 });
    expect(checkOf(report, "repo").verdict).toBe("fail");
    expect(checkOf(report, "tracker").verdict).toBe("fail");
    expect(checkOf(report, "repo").fixHint).toBe(
      "commit or discard the uncommitted changes, then re-run doctor",
    );
    expect(checkOf(report, "tracker").fixHint).toContain("EXAMPLE_PRODUCT_GITHUB_TOKEN");
  });

  test("an unresolvable binding is the declared unavailable repository shape", () => {
    const report = aggregateDoctorReport(
      doctorWorld({
        checkout: { binding: { state: "unavailable", reason: "remote-unresolvable" } },
      }),
    );
    expect(report.repository).toEqual({ state: "unavailable", reason: "remote-unresolvable" });
    expect(JSON.stringify(report.repository)).not.toContain("origin");
    expect(renderDoctorHuman(report, SYNTHETIC_BRAND)).not.toContain("example-product doctor");
  });

  test("the summary names only failing checks in fixed area order", () => {
    const report = aggregateDoctorReport(
      doctorWorld({
        checkout: { clean: false },
        tracker: { read: { ok: false, reason: "read-failed" } },
      }),
    );
    const summary = formatDoctorFailureSummary(report.checks);
    expect(summary.startsWith("doctor check failures (2/5) — repo (fail): ")).toBe(true);
    expect(summary).toContain("; tracker (unreachable): ");
    expect(summary).not.toContain("provider (");
    expect(summary.split("\n")).toHaveLength(1);
  });

  test("the human report renders five lines plus one hint per non-ok check", () => {
    const report = aggregateDoctorReport(doctorWorld({ checkout: { clean: false } }));
    const text = renderDoctorHuman(report, SYNTHETIC_BRAND);
    expect(text.startsWith("example-product doctor example-owner/example-repo\n")).toBe(true);
    const lines = text.trimEnd().split("\n");
    expect(lines).toHaveLength(1 + 5 + 1);
    expect(lines.slice(1, 6).map((line) => line.split(/\s+/)[0])).toEqual([
      "repo",
      "tracker",
      "provider",
      "state",
      "ci",
    ]);
    expect(lines[6]).toBe("  hint: commit or discard the uncommitted changes, then re-run doctor");
  });

  test("report mutations fail by name", () => {
    const report = aggregateDoctorReport(doctorWorld());
    const drop = { ...report, checks: report.checks.slice(0, 4) };
    expect(reportShape(drop).join("\n")).toContain("checks length is 4");

    const duplicate = {
      ...report,
      checks: [...report.checks.slice(0, 4), report.checks[0] as DoctorCheck],
    };
    expect(reportShape(duplicate).join("\n")).toContain("duplicate area");

    const swapped = {
      ...report,
      checks: [report.checks[1], report.checks[0], ...report.checks.slice(2)],
    };
    expect(reportShape(swapped).join("\n")).toContain("areas are tracker,repo");

    const emptyDetail = {
      ...report,
      checks: report.checks.map((entry, index) => (index === 0 ? { ...entry, detail: "" } : entry)),
    };
    expect(reportShape(emptyDetail).join("\n")).toContain("repo: empty detail");

    const okHint = {
      ...report,
      checks: report.checks.map((entry, index) =>
        index === 0 ? { ...entry, fixHint: "synthetic" } : entry,
      ),
    };
    expect(reportShape(okHint).join("\n")).toContain("repo: ok check carries a hint");

    const corruptSummary = { ...report, summary: { ...report.summary, ok: 4 } };
    expect(reportShape(corruptSummary).join("\n")).toContain("summary");
  });
});

describe("TC-DOCTOR-004 the Appendix A verdict-derivation matrix", () => {
  test("every matrix cell maps to its declared verdict, reasons, and detail", () => {
    const failures: string[] = [];
    for (const entry of MATRIX_CASES) {
      const report = aggregateDoctorReport(inputsFor(entry));
      const check = checkOf(report, entry.area);
      if (check.verdict !== entry.expected.verdict) {
        failures.push(`${entry.id}: verdict ${check.verdict} != ${entry.expected.verdict}`);
      }
      for (const reason of entry.expected.reasons) {
        if (!check.evidence.reasons.includes(reason as never)) {
          failures.push(`${entry.id}: missing reason ${reason}`);
        }
      }
      if (
        entry.expected.detailIncludes !== undefined &&
        !check.detail.includes(entry.expected.detailIncludes)
      ) {
        failures.push(`${entry.id}: detail lacks "${entry.expected.detailIncludes}"`);
      }
      if (check.verdict !== "ok" && check.fixHint === undefined) {
        failures.push(`${entry.id}: non-ok without a hint`);
      }
      const shape = reportShape(report);
      if (shape.length > 0) failures.push(`${entry.id}: ${shape.join("; ")}`);
      if (report.summary.ok + report.summary.fail + report.summary.unreachable !== 5) {
        failures.push(`${entry.id}: summary does not total five`);
      }
      if (
        JSON.stringify(report.checks.map((item) => item.area)) !== JSON.stringify([...DOCTOR_AREAS])
      ) {
        failures.push(`${entry.id}: area order drifted`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("every declared condition cell is represented exactly once", () => {
    const ids = MATRIX_CASES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const areas = new Set(MATRIX_CASES.map((entry) => entry.area));
    expect([...areas].sort()).toEqual([...DOCTOR_AREAS].sort());
    const verdicts = new Set(MATRIX_CASES.map((entry) => entry.expected.verdict));
    expect([...verdicts].sort()).toEqual(["fail", "ok", "unreachable"]);
    for (const area of DOCTOR_AREAS) {
      const areaCases = MATRIX_CASES.filter((entry) => entry.area === area);
      for (const verdict of DOCTOR_VERDICTS) {
        expect(
          areaCases.some((entry) => entry.expected.verdict === verdict),
          `${area}/${verdict}`,
        ).toBe(true);
      }
    }
  });

  test("an in-memory flipped verdict and an invented reason fail by name", () => {
    const entry = MATRIX_CASES[0];
    if (entry === undefined) throw new Error("matrix is empty");
    const report = aggregateDoctorReport(inputsFor(entry));
    const check = checkOf(report, entry.area);
    expect(check.verdict).not.toBe("fail");

    const mutated = {
      ...report,
      checks: report.checks.map((item) =>
        item.area === entry.area
          ? {
              ...item,
              evidence: {
                ...item.evidence,
                reasons: ["chain-not-declared" as never],
              },
            }
          : item,
      ),
    };
    expect(reportShape(mutated).join("\n")).toContain("invented reason chain-not-declared");
  });

  test("old draft reason spellings are never emitted", () => {
    for (const entry of MATRIX_CASES) {
      const report = aggregateDoctorReport(inputsFor(entry));
      const text = JSON.stringify(report);
      expect(text).not.toContain('"chain-not-declared"');
      expect(text).not.toContain('"chain-unresolved"');
    }
  });
});

describe("TC-DOCTOR-030 evidence discipline (pure half)", () => {
  test("each check uses exactly its DM-5 source subset", () => {
    const report = aggregateDoctorReport(doctorWorld());
    for (const entry of report.checks) {
      const declared = DOCTOR_AREA_SOURCES[entry.area];
      for (const source of entry.evidence.sources) {
        expect(declared, `${entry.area}/${source.source}`).toContain(source.source);
      }
      expect(entry.evidence.sources.length).toBeLessThanOrEqual(DOCTOR_MAX_EVIDENCE_SOURCES);
      expect(entry.evidence.reasons.length).toBeLessThanOrEqual(DOCTOR_MAX_EVIDENCE_REASONS);
    }
  });

  test("credentials are the only 401/403 rejection source and failureCode stays classified", () => {
    const rejected = aggregateDoctorReport(
      doctorWorld({ tracker: { read: { ok: false, reason: "read-failed", httpStatus: 401 } } }),
    );
    const failure = checkOf(rejected, "tracker");
    expect(failure.verdict).toBe("fail");
    expect(failure.evidence.reasons).toContain("credential-rejected");
    expect(failure.evidence.httpStatus).toBe(401);

    const server = aggregateDoctorReport(
      doctorWorld({ tracker: { read: { ok: false, reason: "read-failed", httpStatus: 500 } } }),
    );
    const serverFailure = checkOf(server, "tracker");
    expect(serverFailure.verdict).toBe("unreachable");
    expect(serverFailure.evidence.reasons).toContain("read-failed");
    expect(serverFailure.evidence.reasons).not.toContain("credential-rejected");

    const classified = aggregateDoctorReport(
      doctorWorld({
        provider: {
          config: { ok: false, reason: "config-invalid", failureCode: "config.file.malformed" },
        },
      }),
    );
    const providerCheck = checkOf(classified, "provider");
    expect(providerCheck.evidence.failureCode).toBe("config.file.malformed");
    const codes = new Set(ERROR_TABLE.map((row) => row.code));
    expect(codes.has(providerCheck.evidence.failureCode as never)).toBe(true);
  });

  test("a provider payload class is evidence data and never a failure code or identity", () => {
    const report = aggregateDoctorReport(
      doctorWorld({
        tracker: {
          read: {
            ok: false,
            reason: "read-failed",
            failureClass: "provider.payload.invalid",
          },
        },
      }),
    );
    const tracker = checkOf(report, "tracker");
    expect(tracker.evidence.failureClass).toBe("provider.payload.invalid");
    expect(tracker.evidence.failureCode).toBeUndefined();
    const identities = new Set(ERROR_TABLE.map((row) => row.code));
    expect(identities.has("provider.payload.invalid")).toBe(false);
  });

  test("wiring-neutral parks never flip a verdict or fabricate a zero claim", () => {
    const report = aggregateDoctorReport(doctorWorld());
    const provider = checkOf(report, "provider");
    expect(provider.verdict).toBe("ok");
    expect(provider.detail).not.toContain("no parks");

    const parked = aggregateDoctorReport(
      doctorWorld({
        provider: {
          fold: {
            ok: false,
            reason: "state-unreadable",
            failureCode: "state.store.torn",
          },
        },
      }),
    );
    const unreadable = checkOf(parked, "provider");
    expect(unreadable.verdict).toBe("unreachable");
    expect(unreadable.detail).not.toContain("no parks");
  });

  test("the pure aggregator never returns fallback.internal", () => {
    for (const entry of MATRIX_CASES) {
      const report = aggregateDoctorReport(inputsFor(entry));
      expect(JSON.stringify(report)).not.toContain("fallback.internal");
    }
  });

  test("malformed and missing results are contained, not dropped", () => {
    const inputs = doctorWorld({ contained: ["tracker", "ci"] });
    const report = aggregateDoctorReport({ ...inputs, results: inputs.results.slice(0, 3) });
    expect(report.checks).toHaveLength(5);
    expect(checkOf(report, "tracker").verdict).toBe("unreachable");
    expect(checkOf(report, "state").verdict).toBe("unreachable");
    expect(checkOf(report, "state").evidence.reasons).toContain("check-unreachable");
    expect(reportShape(report)).toEqual([]);
  });
});

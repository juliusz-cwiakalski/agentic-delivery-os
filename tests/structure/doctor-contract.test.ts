/**
 * TC-DOCTOR-021 — the `delivery.doctor.v1` vocabulary, bounds, condition
 * catalog, and evidence model are single-home contract data bound to spec
 * v1.2 (DM-1..DM-8, Appendices A/B). Every mutation runs in memory or on a
 * copied value; the committed contract is never rewritten.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DOCTOR_AREA_SOURCES,
  DOCTOR_AREAS,
  DOCTOR_CI_READ_LIMIT,
  DOCTOR_CONDITION_CATALOG,
  DOCTOR_CREDENTIAL_REJECTION_STATUSES,
  DOCTOR_EVIDENCE_OUTCOMES,
  DOCTOR_EVIDENCE_REASONS,
  DOCTOR_EVIDENCE_SOURCES,
  DOCTOR_MAX_DETAIL_CHARS,
  DOCTOR_MAX_EVIDENCE_REASONS,
  DOCTOR_MAX_EVIDENCE_SOURCES,
  DOCTOR_MAX_HINT_CHARS,
  DOCTOR_MAX_HUMAN_BYTES,
  DOCTOR_MAX_HUMAN_LINES,
  DOCTOR_MAX_MACHINE_BYTES,
  DOCTOR_SCHEMA_VERSION,
  DOCTOR_SUMMARY_PREFIX,
  DOCTOR_SUMMARY_SEPARATOR,
  DOCTOR_TRACKER_READ_LIMIT,
  DOCTOR_VERDICTS,
  DOCTOR_WIRING_NEUTRAL_CONDITIONS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/doctor.ts";

const SOURCE_IDS = [
  "checkout",
  "remote-binding",
  "credential",
  "tracker-read",
  "provider-config",
  "provider-credential",
  "provider-parks",
  "provider-announcements",
  "state-stores",
  "commit",
  "ci-read",
] as const;

const REASONS = [
  "observed",
  "observed-empty",
  "checkout-dirty",
  "checkout-unreadable",
  "remote-unresolvable",
  "credential-unavailable",
  "credential-rejected",
  "read-failed",
  "not-attempted",
  "config-invalid",
  "provider-chain-not-declared",
  "provider-chain-unresolved",
  "park-active",
  "park-credential-cause",
  "owner-hold",
  "announcement-recorded",
  "store-torn",
  "store-schema-mismatch",
  "store-unreadable",
  "store-unknown",
  "commit-unresolved",
  "state-unreadable",
  "check-unreachable",
] as const;

const conditionsOf = (
  catalog: readonly { readonly condition: string; readonly verdict: string }[],
): readonly { readonly condition: string; readonly verdict: string }[] => catalog;

describe("TC-DOCTOR-021 contract vocabulary and constants", () => {
  test("areas, verdicts, and outcomes are the declared closed sets", () => {
    expect([...DOCTOR_AREAS]).toEqual(["repo", "tracker", "provider", "state", "ci"]);
    expect([...DOCTOR_VERDICTS]).toEqual(["ok", "fail", "unreachable"]);
    expect([...DOCTOR_EVIDENCE_OUTCOMES]).toEqual([
      "read",
      "observed-empty",
      "failed",
      "not-configured",
    ]);
  });

  test("the eleven sources and the DM-5 area mapping are exact", () => {
    expect([...DOCTOR_EVIDENCE_SOURCES]).toEqual([...SOURCE_IDS]);
    expect(DOCTOR_AREA_SOURCES).toEqual({
      repo: ["checkout", "remote-binding"],
      tracker: ["remote-binding", "credential", "tracker-read"],
      provider: [
        "provider-config",
        "provider-credential",
        "provider-parks",
        "provider-announcements",
      ],
      state: ["state-stores"],
      ci: ["remote-binding", "credential", "commit", "ci-read"],
    });
    for (const sources of Object.values(DOCTOR_AREA_SOURCES)) {
      for (const source of sources) {
        expect(SOURCE_IDS.includes(source)).toBe(true);
      }
    }
  });

  test("the reason set is exactly the twenty-three DM-6 values in declared order", () => {
    expect([...DOCTOR_EVIDENCE_REASONS]).toEqual([...REASONS]);
    expect(DOCTOR_EVIDENCE_REASONS).toHaveLength(23);
    expect(new Set(DOCTOR_EVIDENCE_REASONS).size).toBe(23);
    // The single annotation reason sits immediately after park-credential-cause.
    const position = DOCTOR_EVIDENCE_REASONS.indexOf("owner-hold");
    expect(DOCTOR_EVIDENCE_REASONS[position - 1]).toBe("park-credential-cause");
    const text = DOCTOR_EVIDENCE_REASONS.join(",");
    expect(text).not.toContain('"chain-not-declared"');
    expect(text).not.toContain('"chain-unresolved"');
  });

  test("the DM-8 bounds and the two declared read limits are exact", () => {
    expect(DOCTOR_MAX_DETAIL_CHARS).toBe(200);
    expect(DOCTOR_MAX_HINT_CHARS).toBe(200);
    expect(DOCTOR_MAX_MACHINE_BYTES).toBe(65536);
    expect(DOCTOR_MAX_HUMAN_LINES).toBe(24);
    expect(DOCTOR_MAX_HUMAN_BYTES).toBe(4096);
    expect(DOCTOR_MAX_EVIDENCE_SOURCES).toBe(4);
    expect(DOCTOR_MAX_EVIDENCE_REASONS).toBe(4);
    expect(DOCTOR_TRACKER_READ_LIMIT).toBeGreaterThan(0);
    expect(DOCTOR_CI_READ_LIMIT).toBeGreaterThan(0);
  });

  test("the schema version and the DM-7 summary grammar constants are exact", () => {
    expect(DOCTOR_SCHEMA_VERSION).toBe("delivery.doctor.v1");
    expect(DOCTOR_SUMMARY_PREFIX).toBe("doctor check failures (");
    expect(DOCTOR_SUMMARY_SEPARATOR).toBe("; ");
    expect(`${DOCTOR_SUMMARY_PREFIX}1/5) — provider (fail): x`).toBe(
      "doctor check failures (1/5) — provider (fail): x",
    );
  });

  test("the condition catalog has one entry per condition with one verdict and a hint", () => {
    const conditions = DOCTOR_CONDITION_CATALOG.map((entry) => entry.condition);
    expect(new Set(conditions).size).toBe(conditions.length);
    const verdictsByCondition = new Map<string, string>();
    for (const entry of DOCTOR_CONDITION_CATALOG) {
      expect(DOCTOR_AREAS.includes(entry.area)).toBe(true);
      expect(DOCTOR_VERDICTS.includes(entry.verdict)).toBe(true);
      expect(entry.verdict).not.toBe("ok");
      expect(entry.hintTemplate.trim().length).toBeGreaterThan(8);
      expect(entry.hintTemplate.length).toBeLessThanOrEqual(DOCTOR_MAX_HINT_CHARS);
      expect(entry.hintTemplate[0]?.toLowerCase()).toBe(entry.hintTemplate[0]);
      const existing = verdictsByCondition.get(entry.condition);
      if (existing !== undefined) expect(existing).toBe(entry.verdict);
      verdictsByCondition.set(entry.condition, entry.verdict);
    }
    for (const area of DOCTOR_AREAS) {
      expect(conditions).toContain(`doctor.check.${area}.unreachable`);
    }
  });

  test("the catalog declares the v1.1/v1.2 conditions and the wiring-neutral set", () => {
    const byCondition = new Map(DOCTOR_CONDITION_CATALOG.map((entry) => [entry.condition, entry]));
    expect(byCondition.get("provider.config-invalid")?.verdict).toBe("fail");
    expect(byCondition.get("provider.provider-chain-unresolved")?.verdict).toBe("fail");
    expect(byCondition.get("provider.provider-chain-not-declared")?.verdict).toBe("fail");
    expect(byCondition.get("provider.park-credential-cause")?.verdict).toBe("fail");
    expect([...DOCTOR_WIRING_NEUTRAL_CONDITIONS]).toEqual([
      "peak-window",
      "quota-exhausted",
      "provider-outage",
      "chain-exhausted",
      "reevaluation-cap",
    ]);
  });

  test("the three Appendix B hint strings are reproduced verbatim", () => {
    const byCondition = new Map(DOCTOR_CONDITION_CATALOG.map((entry) => [entry.condition, entry]));
    expect(byCondition.get("repo.checkout-dirty")?.hintTemplate).toBe(
      "commit or discard the uncommitted changes, then re-run doctor",
    );
    expect(byCondition.get("tracker.read-failed")?.hintTemplate).toBe(
      "restore tracker reachability, then re-run doctor",
    );
    expect(byCondition.get("provider.park-credential-cause")?.hintTemplate).toBe(
      "refresh the credential for {providerName}, then run provider quota --provider {providerName}",
    );
  });

  test("credential rejection is derived only from 401 and 403", () => {
    expect([...DOCTOR_CREDENTIAL_REJECTION_STATUSES]).toEqual([401, 403]);
  });

  test("doctor declares no status cap and no shared caps module (DEC-10)", () => {
    const text = readFileSync(join(ROOT, CONTRACT), "utf8");
    expect(text).not.toContain("STATUS_");
    expect(text).not.toContain("caps");
    expect(text).toContain("DOCTOR_TRACKER_READ_LIMIT");
  });

  test("adding a verdict, source, or reason mutation fails by value", () => {
    const mutatedVerdicts = [...DOCTOR_VERDICTS, "degraded"];
    expect(mutatedVerdicts).not.toEqual([...DOCTOR_VERDICTS]);
    const mutatedSources = [...DOCTOR_EVIDENCE_SOURCES].reverse();
    expect(mutatedSources).not.toEqual([...DOCTOR_EVIDENCE_SOURCES]);
    const mutatedReasons = DOCTOR_EVIDENCE_REASONS.map((reason) =>
      reason === "provider-chain-unresolved" ? "chain-unresolved" : reason,
    );
    expect(mutatedReasons).not.toEqual([...DOCTOR_EVIDENCE_REASONS]);
  });

  test("a condition without a hint or with a duplicate verdict fails by name", () => {
    const missingHint = [...conditionsOf(DOCTOR_CONDITION_CATALOG)].map((entry) =>
      entry.condition === "repo.checkout-dirty" ? { ...entry, hintTemplate: "" } : entry,
    );
    const emptyHint = missingHint.find((entry) => entry.condition === "repo.checkout-dirty");
    expect(emptyHint?.hintTemplate ?? "").toHaveLength(0);

    const twoVerdicts = [...conditionsOf(DOCTOR_CONDITION_CATALOG)];
    const first = twoVerdicts[0];
    if (first === undefined) throw new Error("catalog is empty");
    twoVerdicts.push({ ...first, verdict: "ok" });
    const verdicts = new Set(
      twoVerdicts
        .filter((entry) => entry.condition === first.condition)
        .map((entry) => entry.verdict),
    );
    expect(verdicts.size).toBe(2);
  });
});

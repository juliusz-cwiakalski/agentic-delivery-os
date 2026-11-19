/**
 * TC-PROV-049/040 — bounded, closed-allowlist evidence and no unbounded field.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ANNOUNCEMENT_EVIDENCE_FIELDS,
  type AnnouncementCode,
  PARK_EVIDENCE_FIELDS,
  PROVIDER_EVIDENCE_MAX_BYTES,
  PROVIDER_EVIDENCE_MAX_FIELDS,
  type ProviderAnnouncementEvidence,
  type ProviderParkEvidence,
} from "../../packages/core/src/contracts/index";
import {
  announcementEvidence,
  createParkRecord,
  projectParkEvidence,
} from "../../packages/core/src/provider/parks";
import { evaluateBudgets } from "../../packages/core/src/provider/budgets";

const ROOT = process.cwd();
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(ROOT, "tests/fixtures/provider/evidence", name), "utf8")) as unknown;

/** Validate one evidence object against a closed allowlist and the bounds. */
export const evidenceFailures = (
  evidence: Readonly<Record<string, unknown>>,
  allowlist: readonly string[],
): string[] => {
  const failures: string[] = [];
  const keys = Object.keys(evidence);
  if (keys.length > PROVIDER_EVIDENCE_MAX_FIELDS) failures.push(`too many fields: ${keys.length}`);
  if (Buffer.byteLength(JSON.stringify(evidence), "utf8") > PROVIDER_EVIDENCE_MAX_BYTES) {
    failures.push("serialized evidence exceeds 1024 bytes");
  }
  for (const key of keys) {
    if (!allowlist.includes(key)) failures.push(`unknown evidence key ${key}`);
  }
  return failures;
};

const parkAllowlist = (fixture("park-allowlist.json") as { fields: string[] }).fields;
const announcementAllowlist = (fixture("announcement-allowlist.json") as { fields: string[] })
  .fields;

describe("TC-PROV-049 evidence bounds and closed allowlists", () => {
  test("maximum evidence is inside both bounds", () => {
    const max = fixture("max-evidence.json") as {
      readonly park: Record<string, unknown>;
      readonly announcement: Record<string, unknown>;
    };
    expect(evidenceFailures(max.park, parkAllowlist)).toEqual([]);
    expect(evidenceFailures(max.announcement, announcementAllowlist)).toEqual([]);
    expect(Object.keys(max.park)).toHaveLength(14);
    expect(Object.keys(max.announcement)).toHaveLength(17);
    expect(PROVIDER_EVIDENCE_MAX_BYTES).toBe(1024);
    expect(PROVIDER_EVIDENCE_MAX_FIELDS).toBe(20);
  });

  test("one byte/field over and an unknown key are rejected by name", () => {
    const over = evidenceFailures(
      fixture("over-bound-evidence.json") as Record<string, unknown>,
      announcementAllowlist,
    );
    expect(over.join("\n")).toContain("exceeds 1024 bytes");
    const unknown = evidenceFailures(
      fixture("unknown-key-evidence.json") as Record<string, unknown>,
      announcementAllowlist,
    );
    expect(unknown.join("\n")).toContain("unknown evidence key rawBody");
  });

  test("the two allowlists are the closed fourteen and seventeen fields", () => {
    expect(PARK_EVIDENCE_FIELDS).toEqual(parkAllowlist);
    expect(ANNOUNCEMENT_EVIDENCE_FIELDS).toEqual(announcementAllowlist);
    expect(PARK_EVIDENCE_FIELDS).toHaveLength(14);
    expect(ANNOUNCEMENT_EVIDENCE_FIELDS).toHaveLength(17);
  });

  test("announcement evidence filters unknown keys and the bounds still reject", () => {
    const raw = {
      providerName: "zai-coding-plan",
      announcementCode: "provider.peak.parked",
      rawBody: "CANARY-RAW-BODY",
      authorization: "Bearer CANARY",
    } as unknown as ProviderAnnouncementEvidence;
    const projected = announcementEvidence(raw);
    expect(Object.keys(projected).sort()).toEqual(["announcementCode", "providerName"]);
    expect(JSON.stringify(projected)).not.toContain("CANARY");
    expect(evidenceFailures(projected, announcementAllowlist)).toEqual([]);

    const overBound = {
      providerName: "zai-coding-plan",
      rawBody: "CANARY-RAW-BODY",
      failureClass: "x".repeat(1100),
    } as unknown as ProviderAnnouncementEvidence;
    const bounded = announcementEvidence(overBound);
    expect(Object.hasOwn(bounded, "rawBody")).toBe(false);
    expect(evidenceFailures(bounded, announcementAllowlist).join("\n")).toContain(
      "exceeds 1024 bytes",
    );
  });

  test("no unbounded array or object is admitted by the field contract", () => {
    const park: ProviderParkEvidence = { conditionKinds: ["peak-window"] };
    const announcement: ProviderAnnouncementEvidence = {
      ...park,
      announcementCode: "provider.peak.parked" as AnnouncementCode,
    };
    expect(Object.keys(park).every((key) => parkAllowlist.includes(key))).toBe(true);
    expect(Object.keys(announcement).every((key) => announcementAllowlist.includes(key))).toBe(
      true,
    );
  });
});

const allowlistFixture = (name: string): string[] => (fixture(name) as { fields: string[] }).fields;

describe("GH-350 TC-BUD-015 the five budget fields and the stated arithmetic", () => {
  test("the allowlist constants and the stated arithmetic are exactly 14 and 17", () => {
    const park = allowlistFixture("park-allowlist.json");
    const announcement = allowlistFixture("announcement-allowlist.json");
    expect(park).toEqual(PARK_EVIDENCE_FIELDS);
    expect(announcement).toEqual(ANNOUNCEMENT_EVIDENCE_FIELDS);
    // Eight delivered base fields + timezone + the five budget fields.
    expect(PARK_EVIDENCE_FIELDS).toHaveLength(8 + 1 + 5);
    // The announcement list spreads the park list and adds three.
    expect(ANNOUNCEMENT_EVIDENCE_FIELDS).toHaveLength(8 + 1 + 5 + 3);
    expect(PARK_EVIDENCE_FIELDS.filter((field) => field.startsWith("budget"))).toEqual([
      "budgetName",
      "budgetScope",
      "budgetBasis",
      "budgetMeasured",
      "budgetCeiling",
    ]);
  });

  test("a crossing's evidence is the five fields within both bounds, with the declared types", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const evaluation = evaluateBudgets({
      budgets: {
        "daily-spend-with-a-long-but-bounded-name": {
          enabled: true,
          scope: "window",
          basis: "cost",
          ceiling: 40.5,
          windowSeconds: 86_400,
        },
      },
      read: {
        status: "measured",
        totals: [
          {
            scopeKey: "daily-spend-with-a-long-but-bounded-name",
            cost: 40.5,
            tokens: 1_000_000,
            newestAtMs: now - 3_600_000,
            sparse: true,
          },
        ],
      },
      nowMs: now,
    });
    const outcome = evaluation.outcomes["daily-spend-with-a-long-but-bounded-name"];
    expect(outcome?.status).toBe("parked");
    if (outcome === undefined) return;
    expect(evidenceFailures(outcome.evidence, parkAllowlist)).toEqual([]);
    expect(outcome.evidence).toMatchObject({
      budgetName: "daily-spend-with-a-long-but-bounded-name",
      budgetScope: "window",
      budgetBasis: "cost",
      budgetMeasured: 40.5,
      budgetCeiling: 40.5,
    });
    const announcement = announcementEvidence({
      ...outcome.evidence,
      announcementCode: "provider.budget.parked",
    });
    expect(evidenceFailures(announcement, announcementAllowlist)).toEqual([]);
    expect(announcement.announcementCode).toBe("provider.budget.parked");
  });
});

describe("GH-350 TC-CONFORM-004 the maximal object is constructed, never inferred", () => {
  const MAX = (): {
    readonly park: Record<string, unknown>;
    readonly announcement: Record<string, unknown>;
  } =>
    fixture("max-evidence.json") as {
      readonly park: Record<string, unknown>;
      readonly announcement: Record<string, unknown>;
    };

  test("the constructed maximal park is 14 fields and the maximal announcement 17", () => {
    const max = MAX();
    expect(Object.keys(max.park).sort()).toEqual([...PARK_EVIDENCE_FIELDS].sort());
    expect(Object.keys(max.announcement).sort()).toEqual([...ANNOUNCEMENT_EVIDENCE_FIELDS].sort());
    expect(evidenceFailures(max.park, PARK_EVIDENCE_FIELDS)).toEqual([]);
    expect(evidenceFailures(max.announcement, ANNOUNCEMENT_EVIDENCE_FIELDS)).toEqual([]);
    // Every field beyond the eight delivered base fields is one of the six additions.
    const base = [
      "providerName",
      "chainName",
      "conditionKinds",
      "waitSeconds",
      "resetEpochMs",
      "httpStatus",
      "failureClass",
      "credentialRefName",
    ];
    const additions = Object.keys(max.park).filter((key) => !base.includes(key));
    expect(additions).toEqual([
      "timezone",
      "budgetName",
      "budgetScope",
      "budgetBasis",
      "budgetMeasured",
      "budgetCeiling",
    ]);
  });

  test("a standalone budget park is not the maximal fixture: no timezone, within thirteen", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const evaluation = evaluateBudgets({
      budgets: {
        daily: { enabled: true, scope: "window", basis: "cost", ceiling: 40, windowSeconds: 3600 },
      },
      read: {
        status: "measured",
        totals: [{ scopeKey: "daily", cost: 40, tokens: 0, newestAtMs: now - 60_000 }],
      },
      nowMs: now,
    });
    const outcome = evaluation.outcomes.daily;
    if (outcome === undefined || outcome.status !== "parked") throw new Error("expected a park");
    const emitted = createParkRecord({
      subjectKind: "provider",
      subjectName: "zai-coding-plan",
      cause: "budget-exhausted",
      conditions: ["budget-exhausted"],
      createdAtMs: now,
      expiresAtMs: outcome.expiresAtMs,
      evidence: outcome.evidence,
    });
    const evidence = projectParkEvidence(emitted.evidence);
    expect(Object.hasOwn(evidence, "timezone")).toBe(false);
    const thirteen = PARK_EVIDENCE_FIELDS.filter((field) => field !== "timezone");
    expect(Object.keys(evidence).every((key) => thirteen.includes(key))).toBe(true);
    expect(Object.keys(evidence).length).toBeLessThanOrEqual(13);
    for (const field of [
      "budgetName",
      "budgetScope",
      "budgetBasis",
      "budgetMeasured",
      "budgetCeiling",
    ]) {
      expect(evidence).toHaveProperty(field);
    }
  });

  test("a peak park carries no budget field and does not reach the maximal set", () => {
    const peak = {
      providerName: "zai-coding-plan",
      conditionKinds: ["peak-window"],
      waitSeconds: 3599,
      timezone: "Europe/Berlin",
    };
    expect(evidenceFailures(peak, PARK_EVIDENCE_FIELDS)).toEqual([]);
    expect(Object.keys(peak).length).toBeLessThan(14);
    expect(Object.keys(peak).some((key) => key.startsWith("budget"))).toBe(false);
  });

  test("a 1025-byte and a 21-field evidence each fail by name", () => {
    const max = MAX();
    const overBytes = { ...max.announcement, failureClass: "x".repeat(1100) };
    expect(evidenceFailures(overBytes, ANNOUNCEMENT_EVIDENCE_FIELDS).join("\n")).toContain(
      "exceeds 1024 bytes",
    );
    const manyFields: Record<string, string> = {};
    for (let index = 0; index < 21; index += 1) manyFields[`field${index}`] = "x";
    expect(evidenceFailures(manyFields, ANNOUNCEMENT_EVIDENCE_FIELDS).join("\n")).toContain(
      "too many fields: 21",
    );
    expect(PARK_EVIDENCE_FIELDS).toHaveLength(14);
    expect(PARK_EVIDENCE_FIELDS).not.toHaveLength(15);
  });
});

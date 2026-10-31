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
import { announcementEvidence } from "../../packages/core/src/provider/parks";

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
    expect(
      evidenceFailures(
        fixture("max-evidence.json") as Record<string, unknown>,
        announcementAllowlist,
      ),
    ).toEqual([]);
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

  test("the two allowlists are the closed eight and eleven fields", () => {
    expect(PARK_EVIDENCE_FIELDS).toEqual(parkAllowlist);
    expect(ANNOUNCEMENT_EVIDENCE_FIELDS).toEqual(announcementAllowlist);
    expect(PARK_EVIDENCE_FIELDS).toHaveLength(8);
    expect(ANNOUNCEMENT_EVIDENCE_FIELDS).toHaveLength(11);
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

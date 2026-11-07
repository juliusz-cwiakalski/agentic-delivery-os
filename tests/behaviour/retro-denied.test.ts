/**
 * TC-RETRO-053 / TC-RETRO-054 — structural write refusal and claimed identity
 * as attribution, never authentication.
 */
import { describe, expect, test } from "bun:test";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import { attemptOutOfSeamEvidenceWrite, collectRetro } from "../../packages/core/src/domain/retro";
import {
  auditOutcome,
  auditRecord,
  collectDeps,
  makeRetroDir,
  readSidecarBytes,
  sidecarLines,
  transitionRecord,
} from "../fixtures/retro/harness";

const change = (ref: string) => ({
  changeRef: ref,
  completedAt: "2026-11-06T12:00:00Z",
  transitions: [transitionRecord({ changeRef: ref, timestamp: "2026-11-06T12:00:00Z" })],
});

const seed = (label: string) => {
  const fixture = makeRetroDir(label);
  fixture.scriptDeliveryChanges([change("GH-232")]);
  fixture.scriptAudit(auditOutcome({ records: [auditRecord()] }));
  fixture.scriptStateFamilies("GH-232", {
    transitions: [transitionRecord({ changeRef: "GH-232" })],
    closeouts: [{ outcome: "complete" }],
    telemetry: [],
  });
  fixture.scriptNotes("GH-232", { retroNotes: ["note"] });
  return fixture;
};

describe("TC-RETRO-053 retro.evidence.denied", () => {
  test("an out-of-seam write is refused without touching the sidecar", () => {
    const fixture = seed("denied-seam");
    const before = readSidecarBytes(fixture);
    const refused = attemptOutOfSeamEvidenceWrite();
    expect(refused.ok).toBe(false);
    expect(refused.error.kind).toBe("retro");
    expect(refused.error.code).toBe("retro.evidence.denied");
    expect(readSidecarBytes(fixture).equals(before)).toBe(true);
    const row = (ERROR_TABLE as readonly ErrorTableEntry[]).find(
      (entry) => entry.code === "retro.evidence.denied",
    );
    expect(row?.projectionClass).toBe("platform-provider");
  });

  test("a delivery-agent context is refused while the collector seam succeeds", () => {
    const fixture = seed("denied-context");
    const before = readSidecarBytes(fixture);
    const denied = collectRetro(collectDeps(fixture, { context: "delivery-agent" }));
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("retro.evidence.denied");
    expect(readSidecarBytes(fixture).equals(before)).toBe(true);
    expect(sidecarLines(fixture)).toEqual([]);
    const allowed = collectRetro(collectDeps(fixture));
    expect(allowed.ok).toBe(true);
    expect(sidecarLines(fixture).length).toBeGreaterThan(0);
  });

  test("no credential is consulted by the refusal", () => {
    const refused = attemptOutOfSeamEvidenceWrite();
    expect(JSON.stringify(refused)).not.toContain("credential");
    expect(JSON.stringify(refused)).toContain("collector");
  });
});

describe("TC-RETRO-054 claimed collector identity", () => {
  test("a present identity is recorded verbatim with the claimed marker", () => {
    const fixture = seed("identity-present");
    expect(
      collectRetro(collectDeps(fixture, { identity: { kind: "claimed", value: "qa-lane-7" } })).ok,
    ).toBe(true);
    const identities = sidecarLines(fixture)
      .map((line) => JSON.parse(line) as { collectorIdentity?: unknown })
      .map((record) => record.collectorIdentity)
      .filter((value) => value !== undefined);
    expect(identities.length).toBeGreaterThan(0);
    for (const identity of identities) {
      expect(identity).toEqual({ kind: "claimed", value: "qa-lane-7" });
    }
  });

  test("an absent identity records none and is never inferred", () => {
    const fixture = seed("identity-absent");
    expect(collectRetro(collectDeps(fixture)).ok).toBe(true);
    for (const line of sidecarLines(fixture)) {
      const record = JSON.parse(line) as Record<string, unknown>;
      expect(Object.hasOwn(record, "collectorIdentity")).toBe(false);
    }
  });

  test("a delivery-agent-shaped value is attribution only and still succeeds through the seam", () => {
    const fixture = seed("identity-shape");
    const result = collectRetro(
      collectDeps(fixture, { identity: { kind: "claimed", value: "delivery-agent" } }),
    );
    expect(result.ok).toBe(true);
    const identities = sidecarLines(fixture)
      .map((line) => JSON.parse(line) as { collectorIdentity?: { value?: string } })
      .map((record) => record.collectorIdentity?.value)
      .filter((value) => value !== undefined);
    expect(identities).toContain("delivery-agent");
  });

  test("an identity-verification mutant fails the attribution oracle", () => {
    const fixture = seed("identity-verify-mutant");
    const verificationMutant = (value: string): { readonly ok: boolean } =>
      value === "delivery-agent" ? { ok: false } : { ok: true };
    const assertAttribution = (result: { readonly ok: boolean }): void => {
      expect(result.ok).toBe(true);
    };
    expect(() => assertAttribution(verificationMutant("delivery-agent"))).toThrow();
    const real = collectRetro(
      collectDeps(fixture, { identity: { kind: "claimed", value: "delivery-agent" } }),
    );
    assertAttribution(real);
  });
});

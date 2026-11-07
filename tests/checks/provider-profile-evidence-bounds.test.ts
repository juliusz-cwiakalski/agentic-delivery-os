/**
 * TC-PROFILE-042 — every profile event and target record serializes to
 * <= 1024 bytes and <= 20 fields, drawn only from the closed allowlist (NFR-8).
 */
import { describe, expect, test } from "bun:test";
import {
  createProfileEvent,
  createProfileTargetRecord,
  projectProfileEvidence,
} from "../../packages/core/src/provider/index";
import {
  PROFILE_EVIDENCE_FIELDS,
  PROFILE_EVIDENCE_MAX_BYTES,
  PROFILE_EVIDENCE_MAX_FIELDS,
} from "../../packages/core/src/contracts/index";

const NOW = 1_700_000_000_000;

const events = () => [
  createProfileEvent({
    code: "profile.selected",
    createdAtMs: NOW,
    message: "selected profile mixed",
    evidence: { profileName: "mixed", tier: "regular", rung: "cruise", reason: "selection" },
  }),
  createProfileEvent({
    code: "profile.switched",
    createdAtMs: NOW,
    message: "switched to deepseek",
    evidence: {
      profileName: "deepseek",
      previousProfile: "mixed",
      newProfile: "deepseek",
      reason: "switch",
      revertCondition: "quota-exhausted",
    },
  }),
  createProfileEvent({
    code: "profile.reverted",
    createdAtMs: NOW,
    message: "reverted to mixed",
    evidence: {
      profileName: "mixed",
      previousProfile: "deepseek",
      newProfile: "mixed",
      reason: "revert",
      providerName: "coding-plan",
    },
  }),
  createProfileEvent({
    code: "profile.ineligible",
    severity: "warning",
    createdAtMs: NOW,
    message: "no profile eligible",
    evidence: { reason: "no-eligible-profile", blockers: ["mixed:condition:quota-exhausted"] },
  }),
  createProfileEvent({
    code: "profile.rung-changed",
    createdAtMs: NOW,
    message: "rung conserve",
    evidence: { profileName: "mixed", rung: "conserve", reason: "hold-judgment" },
  }),
];

describe("TC-PROFILE-042 evidence bounds", () => {
  test("every event serializes within the byte and field bounds", () => {
    for (const event of events()) {
      expect(JSON.stringify(event).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_BYTES);
      expect(Object.keys(event.evidence).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_FIELDS);
      for (const key of Object.keys(event.evidence)) {
        expect(PROFILE_EVIDENCE_FIELDS as readonly string[]).toContain(key);
      }
    }
  });

  test("a target record serializes within the bounds", () => {
    const record = createProfileTargetRecord({
      targetProfile: "deepseek",
      reason: "switch",
      previousProfile: "mixed",
      revertCondition: "quota-exhausted",
      providerName: "coding-plan",
      nowMs: NOW,
    });
    expect(JSON.stringify(record).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_BYTES);
    expect(Object.keys(record.evidence).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_FIELDS);
  });

  test("the projector drops unknown keys and keeps the closed allowlist", () => {
    const projected = projectProfileEvidence({
      profileName: "mixed",
      unknownKey: "dropped",
      rawVendorBody: '{"secret":true}',
    } as never);
    expect(projected).toEqual({ profileName: "mixed" });
    expect(Object.keys(projected).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_FIELDS);
  });

  test("an over-bound event message is truncated, never silently oversized", () => {
    const event = createProfileEvent({
      code: "profile.selected",
      createdAtMs: NOW,
      message: "x".repeat(2000),
      evidence: { profileName: "mixed" },
    });
    expect(JSON.stringify(event).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_BYTES);
    expect(event.message.endsWith("...")).toBe(true);
  });

  test("a 21-field evidence object is projected to the closed allowlist", () => {
    const evidence: Record<string, string> = {};
    for (let index = 0; index < 21; index += 1) evidence[`field${index}`] = "x";
    evidence.profileName = "mixed";
    const projected = projectProfileEvidence(evidence as never);
    expect(Object.keys(projected)).toEqual(["profileName"]);
  });
});

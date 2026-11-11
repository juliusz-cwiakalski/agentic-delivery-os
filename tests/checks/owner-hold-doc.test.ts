/**
 * TC-HOLDDOCS-001/002/003 (GH-280) — the operator guides state the two
 * semantics and the MAX-floor rule, and the reconciled feature specs and command
 * pages record the gate, the additive members, the one doctor annotation reason,
 * the clamp, the explicit denials, and the absence of a marker-path override.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const expectAll = (text: string, phrases: readonly string[]): void => {
  const normalized = text.replace(/\s+/g, " ");
  for (const phrase of phrases) expect(normalized).toContain(phrase);
};

describe("TC-HOLDDOCS-001 the delivery-modes guide states both semantics and the rules", () => {
  const text = read("doc/guides/delivery-modes.md");
  test("the two semantics, both sources, precedence, and removal are documented", () => {
    expectAll(text, [
      "Provider-window deferral is automatic and time-bounded",
      "An owner hold is manual, indefinite, and outranks every window",
      "DELIVERY_OS_OWNER_HOLD",
      "DELIVERY_OS_OWNER_HOLD_POLL_SECONDS",
      "$HOME/.delivery-os-state/owner-hold",
      "The environment source wins when both are active",
      "Removing the environment value and the marker",
    ]);
  });

  test("the fixed path, fail-closed marker, poll, unbounded driver, and MAX floor are documented", () => {
    expectAll(text, [
      "There is no marker-path override, and no per-project marker narrows the hold",
      "fail closed",
      "default `300`, accepted range `1`–`3600`",
      "no fixed iteration cap",
      "Conditions compose by **MAX**",
      "the hold is the floor",
    ]);
  });

  test("the owner-hold/owner-gate distinction, the refusal semantics, and the kill-switch limit are documented", () => {
    expectAll(text, [
      "The **owner hold** is distinct from the **owner gate**",
      "classified user-validation refusal at exit 1",
      "wait/do-not-abort",
      "not a kill switch",
      "scripts/hooks/pre-opencode-iteration-owner-hold.sh",
      "scripts/hooks/pre-opencode-iteration-zai.sh",
    ]);
  });
});

describe("TC-HOLDDOCS-002 the zai guide states MAX composition and the unbounded floor", () => {
  test("the extension section names the second example and the inherited unbounded driver", () => {
    const text = read("doc/guides/zai-peak-hours-hook.md");
    expectAll(text, [
      "second shipped example",
      "pre-opencode-iteration-owner-hold.sh",
      "howLongToSleepDueToOwnerHold",
      "Conditions compose by **MAX**",
      "no fixed iteration cap",
      "the hold is the floor",
    ]);
  });
});

describe("TC-HOLDDOCS-003 the feature specs and command pages are reconciled", () => {
  test("the scheduling engine records the gate, payload, lane masking, and denials", () => {
    const text = read("doc/spec/features/feature-scheduling-engine.md");
    expectAll(text, [
      "global read-only gate",
      "owner-hold",
      "before ref selection",
      "queue ready",
      "park cause",
      "state record kind",
      "seventh queue-ready condition",
      "masks the more specific reason",
    ]);
  });

  test("the status digest records the evidence-level member and unchanged vocabulary", () => {
    const text = read("doc/spec/features/feature-status-digest.md");
    expectAll(text, [
      "providers.evidence.ownerHold",
      "sibling of `sources[]`",
      "present only while the hold is active",
      "| owner-hold",
      "no new section, state, source, reason, or finding code",
      "twenty-reason set",
    ]);
  });

  test("the doctor spec records the non-failing annotation reason and the clamp", () => {
    const text = read("doc/spec/features/feature-doctor.md");
    expectAll(text, [
      "Owner-hold amendment",
      "owner-hold",
      "no evidence source",
      "fourth reason",
      "fix hint",
      "whole** hold segment is kept",
      "verdict, summary count, condition-catalog entry",
    ]);
  });

  test("the autonomous-delivery spec records the gate and the explicit denials", () => {
    const text = read("doc/spec/features/feature-autonomous-delivery.md");
    expectAll(text, [
      "Owner hold outranks provider windows (F-8.1)",
      "DELIVERY_OS_OWNER_HOLD",
      "no fixed iteration cap",
      "park cause",
      "queue ready",
      "not killed",
    ]);
  });

  test("the command pages document the additive members and keep every flag and exit", () => {
    const queue = read("doc/planning/oss-tooling/milestones/m1/commands/queue.md");
    expectAll(queue, [
      "ownerHold",
      "owner-hold",
      "no ref",
      "`queue ready` is unchanged",
      "no new command, no new flag",
    ]);
    const status = read("doc/planning/oss-tooling/milestones/m1/commands/status.md");
    expectAll(status, [
      "providers.evidence.ownerHold",
      "section, state, evidence source",
      "exit changes",
    ]);
    const doctor = read("doc/planning/oss-tooling/milestones/m1/commands/doctor.md");
    expectAll(doctor, ["owner-hold", "never cut mid-word", "fix hint", "exit change"]);
  });

  test("the registered specs and pages keep the brand-derived placeholder and no seed literal", () => {
    for (const relative of [
      "doc/spec/features/feature-scheduling-engine.md",
      "doc/spec/features/feature-status-digest.md",
      "doc/spec/features/feature-doctor.md",
      "doc/planning/oss-tooling/milestones/m1/commands/queue.md",
      "doc/planning/oss-tooling/milestones/m1/commands/status.md",
      "doc/planning/oss-tooling/milestones/m1/commands/doctor.md",
    ]) {
      const text = read(relative);
      expect(text, `${relative}: placeholder`).toContain("<PREFIX>_OWNER_HOLD");
      expect(text.includes("ADOS_OWNER_HOLD"), `${relative}: seed`).toBe(false);
      expect(text.includes(".ados-state"), `${relative}: seed path`).toBe(false);
    }
  });
});

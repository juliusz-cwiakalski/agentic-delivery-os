/**
 * TC-RETRO-014 / TC-RETRO-028 — a reported salvage removal is not a break, and
 * wholesale sidecar destruction is a store condition, not a chain break.
 */
import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import {
  appendEvidence,
  makeRetroDir,
  mutateDelete,
  type RetroFixture,
  readKeyArtifact,
  sidecarLines,
} from "../fixtures/retro/harness";

const seedThree = (label: string): RetroFixture => {
  const fixture = makeRetroDir(label);
  appendEvidence(fixture);
  appendEvidence(fixture);
  appendEvidence(fixture);
  return fixture;
};

describe("TC-RETRO-028 reported salvage is not a break", () => {
  test("a reported tail removal leaves a clean chain and the next append continues it", () => {
    const fixture = seedThree("salvage-tail");
    const lines = sidecarLines(fixture);
    fixture.io.writeText(fixture.sidecar.evidencePath, `${lines.slice(0, 2).join("\n")}\n`);
    const verdict = fixture.sidecar.verify();
    expect(verdict.ok && verdict.value.verified).toBe(true);
    if (verdict.ok) expect(verdict.value.breaks).toEqual([]);
    appendEvidence(fixture);
    const next = fixture.sidecar.verify();
    expect(next.ok && next.value.verified).toBe(true);
    if (next.ok) expect(next.value.records).toBe(3);
  });

  test("a reported middle removal is suppressed while an unreported one is a break", () => {
    const reported = seedThree("salvage-middle-reported");
    mutateDelete(reported, 2);
    const clean = reported.sidecar.read({ reportedRemovals: [2] });
    expect(clean.ok).toBe(true);
    if (clean.ok) {
      expect(clean.value.chain.verified).toBe(true);
      expect(clean.value.records).toHaveLength(2);
    }

    const unreported = seedThree("salvage-middle-unreported");
    mutateDelete(unreported, 2);
    const broken = unreported.sidecar.verify();
    expect(broken.ok).toBe(true);
    if (broken.ok) expect(broken.value.verified).toBe(false);
  });
});

describe("TC-RETRO-014 wholesale destruction is a store condition", () => {
  test("deleting the whole sidecar and key yields an empty verified store, never a break", () => {
    const fixture = seedThree("salvage-wholesale");
    const key = readKeyArtifact(fixture);
    expect(key.length).toBeGreaterThan(0);
    rmSync(fixture.sidecar.evidencePath, { force: true });
    rmSync(fixture.sidecar.keyPath, { force: true });
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records).toEqual([]);
    expect(read.value.chain.verified).toBe(true);
    expect(read.value.chain.breaks).toEqual([]);
    // A new append is a fresh store, not a continuation with a false verdict.
    appendEvidence(fixture);
    const fresh = fixture.sidecar.verify();
    expect(fresh.ok && fresh.value.verified).toBe(true);
    if (fresh.ok) expect(fresh.value.records).toBe(1);
  });
});

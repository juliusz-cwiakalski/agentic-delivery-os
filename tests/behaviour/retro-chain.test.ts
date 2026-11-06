/**
 * TC-RETRO-020 — clean keyed chain, anchor seeding, verdict shape, and the
 * exclusion of non-sidecar records.
 */
import { describe, expect, test } from "bun:test";
import { RETRO_CHAIN_ANCHOR } from "../../packages/core/src/contracts/index";
import { appendEvidence, makeRetroDir } from "../fixtures/retro/harness";

describe("TC-RETRO-020 clean keyed chain", () => {
  test("a clean three-record sidecar verifies with the anchor and no breaks", () => {
    const fixture = makeRetroDir("chain-clean");
    const records = [
      appendEvidence(fixture),
      appendEvidence(fixture),
      appendEvidence(fixture),
    ];
    const verdict = fixture.sidecar.verify();
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.value.verified).toBe(true);
    expect(verdict.value.records).toBe(3);
    expect(verdict.value.breaks).toEqual([]);
    expect(verdict.value.anchor).toBe(RETRO_CHAIN_ANCHOR);
    expect(verdict.value.affectedDomain).toBe("retro");
    expect(new Set(records.map((record) => record.chainValue)).size).toBe(3);
    expect(records[0]?.chainValue).not.toBe(RETRO_CHAIN_ANCHOR);
  });

  test("interleaved registry records do not participate in the sidecar chain", () => {
    const fixture = makeRetroDir("chain-interleave");
    appendEvidence(fixture);
    const acquired = fixture.store.acquireFence("registry-writer");
    expect(acquired.ok).toBe(true);
    if (acquired.ok) {
      fixture.store.append(acquired.value.handle, {
        kind: "phase.transition",
        recordKey: "phase.transitions:GH-232",
        payload: { changeRef: "GH-232" },
      });
      fixture.store.releaseFence(acquired.value.handle);
    }
    appendEvidence(fixture);
    const verdict = fixture.sidecar.verify();
    expect(verdict.ok && verdict.value.verified).toBe(true);
    if (verdict.ok) expect(verdict.value.records).toBe(2);
  });
});

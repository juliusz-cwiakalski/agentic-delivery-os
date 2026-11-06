/**
 * TC-RETRO-030 / TC-RETRO-031 / TC-RETRO-033 / TC-RETRO-034 — entry-level
 * malformation classifies in band with valid entries preserved; store-level
 * damage reuses the state identities and fails closed.
 */
import { describe, expect, test } from "bun:test";
import {
  RETRO_LEVEL_RECORD_KEY_PREFIX,
  RETRO_LEVEL_RECORD_KIND,
  type RetroSidecarIo,
} from "../../packages/core/src/contracts/index";
import {
  createRetroSidecar,
  readRetroLevels,
  readRetroRegistry,
  seedRetroRegistry,
} from "../../packages/core/src/state/index";
import {
  appendEvidence,
  chmodEvidence,
  corruptKeyArtifact,
  makeRetroDir,
  mutateContent,
  type RetroFixture,
  readSidecarBytes,
  removeKeyArtifact,
  sidecarLines,
  writeSidecarLines,
} from "../fixtures/retro/harness";

const seedThree = (label: string): RetroFixture => {
  const fixture = makeRetroDir(label);
  appendEvidence(fixture);
  appendEvidence(fixture);
  appendEvidence(fixture);
  return fixture;
};

describe("TC-RETRO-030 sidecar entry-level malformation", () => {
  test("a missing required field is classified in band and valid records are preserved", () => {
    const fixture = seedThree("mal-sidecar-field");
    const before = readSidecarBytes(fixture);
    mutateContent(fixture, 2, (record) => {
      delete record.traceId;
    });
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.malformed).toEqual([{ position: 2 }]);
    expect(read.value.records).toHaveLength(2);
    expect(read.value.records.map((record) => record.traceId)).toEqual(["ev-0001", "ev-0003"]);
    expect(read.value.chain.verified).toBe(false);
    expect(readSidecarBytes(fixture).equals(before)).toBe(false);
  });

  test("unknown payload schema and closed-vocabulary violations are malformed entries", () => {
    const schemaFixture = seedThree("mal-sidecar-schema");
    mutateContent(schemaFixture, 1, (record) => {
      record.payloadSchemaId = "delivery.retro.unknown.v1";
    });
    const schemaRead = schemaFixture.sidecar.read();
    expect(schemaRead.ok).toBe(true);
    if (schemaRead.ok) {
      expect(schemaRead.value.malformed).toEqual([{ position: 1, traceId: "ev-0001" }]);
    }

    const levelFixture = seedThree("mal-sidecar-level");
    mutateContent(levelFixture, 3, (record) => {
      record.level = "quarter";
    });
    const levelRead = levelFixture.sidecar.read();
    expect(levelRead.ok).toBe(true);
    if (levelRead.ok) {
      expect(levelRead.value.malformed).toEqual([{ position: 3, traceId: "ev-0003" }]);
    }
  });

  test("two simultaneous malformations report every position and preserve the valid count", () => {
    const fixture = seedThree("mal-sidecar-multi");
    mutateContent(fixture, 1, (record) => {
      delete record.collectedAt;
    });
    mutateContent(fixture, 3, (record) => {
      record.payloadRefs = "not-an-array";
    });
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.malformed.map((entry) => entry.position)).toEqual([1, 3]);
    expect(read.value.records).toHaveLength(1);
    expect(read.value.records[0]?.traceId).toBe("ev-0002");
  });

  test("a framing tear is a store-level state.store.torn, not a malformed entry", () => {
    const fixture = seedThree("mal-sidecar-framing");
    const lines = sidecarLines(fixture);
    writeSidecarLines(fixture, [`${lines[0] as string}`, "{not-json"]);
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("state.store.torn");
  });
});

describe("TC-RETRO-031 registry entry-level malformation", () => {
  test("malformed registry entries classify while valid level entries still fold", () => {
    const fixture = makeRetroDir("mal-registry");
    const seeded = seedRetroRegistry(fixture.store, "registry-seed");
    expect(seeded.ok).toBe(true);
    const acquired = fixture.store.acquireFence("malformed-writer");
    expect(acquired.ok).toBe(true);
    if (acquired.ok) {
      fixture.store.append(acquired.value.handle, {
        kind: RETRO_LEVEL_RECORD_KIND,
        recordKey: `${RETRO_LEVEL_RECORD_KEY_PREFIX}:broken`,
        payload: { schemaId: "delivery.retro.level.v1", name: "broken" },
      });
      fixture.store.append(acquired.value.handle, {
        kind: RETRO_LEVEL_RECORD_KIND,
        recordKey: `${RETRO_LEVEL_RECORD_KEY_PREFIX}:wrong-vocab`,
        payload: {
          schemaId: "delivery.retro.level.v1",
          name: "session",
          levelId: "R2",
          scopeKind: "session",
          trigger: { kind: "event", event: "session-end" },
          status: "someday",
        },
      });
      fixture.store.releaseFence(acquired.value.handle);
    }
    const read = readRetroRegistry(fixture.store);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.verdict).toBe("valid");
    expect(read.value.malformed.length).toBe(2);
    expect(readRetroLevels(read.value)).toHaveLength(6);
    expect(readRetroLevels(read.value).map((level) => level.name)).toContain("change");
  });
});

describe("TC-RETRO-033 store-level damage reuses state identities", () => {
  test("missing key on a non-first open is state.keys.missing", () => {
    const fixture = seedThree("mal-store-key");
    removeKeyArtifact(fixture);
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("state.keys.missing");
  });

  test("corrupt key content is state.store.torn", () => {
    const fixture = seedThree("mal-store-corrupt-key");
    corruptKeyArtifact(fixture);
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("state.store.torn");
  });

  test("an unreadable evidence file is state.store.torn", () => {
    const fixture = seedThree("mal-store-unreadable");
    const refusing: RetroSidecarIo = {
      ...fixture.io,
      readText: (path: string) => {
        if (path === fixture.sidecar.evidencePath) throw new Error("unreadable");
        return fixture.io.readText(path);
      },
    };
    const sidecar = createRetroSidecar(refusing);
    const read = sidecar.read();
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("state.store.torn");
  });

  test("wrong permission bits are state.permission.denied (the delivered user-validation projection)", () => {
    const fixture = seedThree("mal-store-permission");
    chmodEvidence(fixture, 0o644);
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("state.permission.denied");
  });
});

describe("TC-RETRO-034 zero crashes and zero loss across the matrix", () => {
  test("every malformation position classifies and the valid-entry set is never dropped", () => {
    const cases: Array<(record: Record<string, unknown>) => void> = [
      (record) => {
        delete record.traceId;
      },
      (record) => {
        record.payloadSchemaId = "delivery.retro.unknown.v1";
      },
      (record) => {
        record.schemaId = "delivery.retro.evidence.v0";
      },
      (record) => {
        record.source = "unknown-source";
      },
    ];
    for (const mutate of cases) {
      const fixture = seedThree("mal-matrix");
      mutateContent(fixture, 2, mutate);
      const read = fixture.sidecar.read();
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.malformed).toHaveLength(1);
        expect(read.value.records).toHaveLength(2);
        expect(read.value.chain.records).toBe(3);
      }
    }
  });
});

describe("TC-RETRO-030 / 031 domain halves", () => {
  test("collect and report classify a malformed sidecar entry with preserved facts", async () => {
    const { collectRetro, reportRetro } = await import("../../packages/core/src/domain/retro");
    const { collectDeps, reportDeps } = await import("../fixtures/retro/harness");
    const fixture = makeRetroDir("mal-domain-sidecar");
    fixture.scriptDeliveryChanges([
      {
        changeRef: "GH-232",
        completedAt: "2026-11-06T12:00:00Z",
        transitions: [],
      },
    ]);
    appendEvidence(fixture);
    appendEvidence(fixture);
    mutateContent(fixture, 1, (record) => {
      delete record.traceId;
    });
    const collect = collectRetro(collectDeps(fixture));
    expect(collect.ok).toBe(false);
    if (!collect.ok) {
      expect(collect.error.code).toBe("retro.evidence.malformed-entry");
      expect(JSON.stringify(collect.error)).toContain("firstFlaggedPosition");
      expect(JSON.stringify(collect.error)).toContain("entriesPreserved");
    }
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(false);
    if (!report.ok) {
      expect(report.error.code).toBe("retro.evidence.malformed-entry");
      expect(report.partial ?? "").toContain("ev-0002");
    }
  });

  test("collect and report classify a malformed registry entry without crashing", async () => {
    const { collectRetro, reportRetro } = await import("../../packages/core/src/domain/retro");
    const { collectDeps, reportDeps } = await import("../fixtures/retro/harness");
    const fixture = makeRetroDir("mal-domain-registry");
    expect(seedRetroRegistry(fixture.store, "seed").ok).toBe(true);
    const acquired = fixture.store.acquireFence("malformed");
    expect(acquired.ok).toBe(true);
    if (acquired.ok) {
      fixture.store.append(acquired.value.handle, {
        kind: RETRO_LEVEL_RECORD_KIND,
        recordKey: `${RETRO_LEVEL_RECORD_KEY_PREFIX}:broken`,
        payload: { schemaId: "delivery.retro.level.v1", name: "broken" },
      });
      fixture.store.releaseFence(acquired.value.handle);
    }
    const collect = collectRetro(collectDeps(fixture));
    expect(collect.ok).toBe(false);
    if (!collect.ok) expect(collect.error.code).toBe("retro.evidence.malformed-entry");
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(false);
    if (!report.ok) expect(report.error.code).toBe("retro.evidence.malformed-entry");
  });
});

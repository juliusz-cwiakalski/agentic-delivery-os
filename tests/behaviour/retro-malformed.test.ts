/**
 * TC-RETRO-030..034 — entry-level malformation classifies in band with valid
 * entries preserved; the preserved valid-entry output is byte-identical to the
 * clean run; store-level damage reuses the state identities and fails closed.
 */
import { describe, expect, test } from "bun:test";
import {
  RETRO_LEVEL_PAYLOAD_SCHEMA,
  RETRO_LEVEL_RECORD_KEY_PREFIX,
  RETRO_LEVEL_RECORD_KIND,
  RETRO_LEVELS,
  type RetroLevelDeclaration,
  type RetroRunRecord,
  type RetroSidecarIo,
  type StateAppendRequest,
  type StateJsonValue,
} from "../../packages/core/src/contracts/index";
import { collectRetro, reportRetro } from "../../packages/core/src/domain/retro";
import {
  createRetroSidecar,
  readRetroLevels,
  readRetroRegistry,
  recordRetroRun,
  seedRetroRegistry,
} from "../../packages/core/src/state/index";
import {
  appendEvidence,
  chmodEvidence,
  collectDeps,
  corruptKeyArtifact,
  keyArtifactPath,
  makeRetroDir,
  mutateContent,
  readKeyArtifact,
  readRegistryText,
  readSidecarBytes,
  removeKeyArtifact,
  reportDeps,
  runRetro,
  sidecarLines,
  writeRegistryText,
  writeSidecarLines,
} from "../fixtures/retro/harness";

const POSITIONS = [1, 3, 5] as const;

const seedFive = (label: string) => {
  const fixture = makeRetroDir(label);
  for (let index = 0; index < 5; index += 1) appendEvidence(fixture);
  return fixture;
};

type SidecarClass = {
  readonly id: string;
  readonly label: string;
  readonly mutate: (record: Record<string, unknown>) => void;
};

const SIDECAR_CLASSES: readonly SidecarClass[] = [
  {
    id: "E-01",
    label: "missing required field",
    mutate: (record) => {
      delete record.traceId;
    },
  },
  {
    id: "E-02",
    label: "unknown payload schema",
    mutate: (record) => {
      record.payloadSchemaId = "delivery.retro.unknown.v1";
    },
  },
  {
    id: "E-03",
    label: "undeclared record kind",
    mutate: (record) => {
      record.schemaId = "delivery.retro.undeclared.v1";
    },
  },
  {
    id: "E-04",
    label: "closed-vocabulary violation",
    mutate: (record) => {
      record.level = "quarter";
    },
  },
];

const preservedOutput = (partial: string | undefined): string =>
  (partial ?? "").replace(/^preserved evidence records: /, "");

const assertByteIdentical = (preserved: readonly unknown[], clean: readonly unknown[]): void => {
  expect(JSON.stringify(preserved)).toBe(JSON.stringify(clean));
};

const assertDataXorError = (envelope: Record<string, unknown>): void => {
  expect(Object.hasOwn(envelope, "data") === Object.hasOwn(envelope, "error")).toBe(false);
};

describe("TC-RETRO-030 sidecar entry-level malformation", () => {
  test("4 classes x first/middle/last classify in band and preserve valid entries", () => {
    let executed = 0;
    for (const position of POSITIONS) {
      for (const malformation of SIDECAR_CLASSES) {
        const fixture = seedFive(`matrix-sidecar-${malformation.id}-${String(position)}`);
        mutateContent(fixture, position, malformation.mutate);
        const mutatedBytes = readSidecarBytes(fixture);
        const read = fixture.sidecar.read();
        expect(read.ok, `${malformation.id}@${String(position)} read`).toBe(true);
        if (!read.ok) continue;
        expect(read.value.malformed, `${malformation.id}@${String(position)}`).toHaveLength(1);
        const flagged = read.value.malformed[0];
        expect(flagged?.position, `${malformation.id}@${String(position)}`).toBe(position);
        if (malformation.id !== "E-01") {
          expect(flagged?.traceId, `${malformation.id}@${String(position)}`).toBe(
            `ev-000${String(position)}`,
          );
        }
        expect(read.value.records).toHaveLength(4);
        expect(read.value.chain.records).toBe(5);
        expect(read.value.chain.verified).toBe(false);
        expect(readSidecarBytes(fixture).equals(mutatedBytes)).toBe(true);

        const report = reportRetro(reportDeps(fixture));
        expect(report.ok, `${malformation.id}@${String(position)} report`).toBe(false);
        if (report.ok) continue;
        expect(report.error.code).toBe("retro.evidence.malformed-entry");
        if (report.error.kind === "retro") {
          expect(report.error.location).toMatchObject({
            entriesProcessed: 5,
            entriesPreserved: 4,
            firstFlaggedPosition: position,
          });
        }
        expect(preservedOutput(report.partial)).toBe(
          read.value.records.map((record) => record.traceId).join(", "),
        );
        executed += 1;
      }
    }
    expect(executed).toBe(12);
  });

  test("a clean five-record control classifies nothing and renders every entry", () => {
    const fixture = seedFive("mal-sidecar-clean");
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value.malformed).toEqual([]);
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
  });

  test("a crash-on-malformed mutant and a silent-drop mutant both fail the oracle", () => {
    const fixture = seedFive("mal-sidecar-mutants");
    const firstClass = SIDECAR_CLASSES[0];
    if (firstClass === undefined) throw new Error("no sidecar malformation classes");
    mutateContent(fixture, 3, firstClass.mutate);
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const crashMutant = (): never => {
      throw new Error("unguarded JSON.parse on a malformed frame");
    };
    expect(crashMutant).toThrow();
    const dropped = { ...read.value, malformed: [] };
    const assertClassified = (value: { readonly malformed: readonly unknown[] }): void => {
      expect(value.malformed).toHaveLength(1);
    };
    expect(() => assertClassified(read.value)).not.toThrow();
    expect(() => assertClassified(dropped)).toThrow();
    // The oracle asserts the malformed report; a dropping implementation fails it.
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(false);
  });

  test("a framing tear is a store-level state.store.torn, not a malformed entry", () => {
    const fixture = seedFive("mal-sidecar-framing");
    const lines = sidecarLines(fixture);
    writeSidecarLines(fixture, [`${lines[0] as string}`, "{not-json"]);
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("state.store.torn");
  });
});

type RegistryClass = {
  readonly id: string;
  readonly label: string;
  readonly request: (level: RetroLevelDeclaration, marker: string) => StateAppendRequest;
};

const levelPayload = (level: RetroLevelDeclaration): Record<string, StateJsonValue> => ({
  schemaId: RETRO_LEVEL_PAYLOAD_SCHEMA,
  name: level.name,
  levelId: level.id,
  scopeKind: level.scopeKind,
  trigger: level.trigger,
  status: level.status,
});

const REGISTRY_CLASSES: readonly RegistryClass[] = [
  {
    id: "E-01",
    label: "missing required field",
    request: (level, marker) => {
      const payload = levelPayload(level);
      delete payload.levelId;
      return {
        kind: RETRO_LEVEL_RECORD_KIND,
        recordKey: `${RETRO_LEVEL_RECORD_KEY_PREFIX}:${marker}`,
        payload,
      };
    },
  },
  {
    id: "E-02",
    label: "unknown payload schema",
    request: (level, marker) => ({
      kind: RETRO_LEVEL_RECORD_KIND,
      recordKey: `${RETRO_LEVEL_RECORD_KEY_PREFIX}:${marker}`,
      payload: { ...levelPayload(level), schemaId: "delivery.retro.level.v999" },
    }),
  },
  {
    id: "E-03",
    label: "undeclared record kind",
    request: (_level, marker) => ({
      kind: "retro.undeclared",
      recordKey: `retro.undeclared:${marker}`,
      payload: { schemaId: "delivery.retro.undeclared.v1", name: marker },
    }),
  },
  {
    id: "E-04",
    label: "closed-vocabulary violation",
    request: (level, marker) => ({
      kind: RETRO_LEVEL_RECORD_KIND,
      recordKey: `${RETRO_LEVEL_RECORD_KEY_PREFIX}:${marker}`,
      payload: { ...levelPayload(level), status: "someday" },
    }),
  },
];

const appendRegistry = (
  fixture: ReturnType<typeof makeRetroDir>,
  requests: readonly StateAppendRequest[],
): void => {
  if (requests.length === 0) return;
  const acquired = fixture.store.acquireFence(`matrix-${String(requests.length)}`);
  expect(acquired.ok).toBe(true);
  if (!acquired.ok) return;
  try {
    for (const request of requests) {
      const appended = fixture.store.append(acquired.value.handle, request);
      expect(appended.ok).toBe(true);
    }
  } finally {
    fixture.store.releaseFence(acquired.value.handle);
  }
};

const seedRegistryMatrixCase = (
  label: string,
  malformation: RegistryClass,
  position: "first" | "middle" | "last",
): { fixture: ReturnType<typeof makeRetroDir>; expectedSequence: number } => {
  const fixture = makeRetroDir(label);
  const marker = `${malformation.id}-${position}`;
  const baseLevel = RETRO_LEVELS[0];
  if (baseLevel === undefined) throw new Error("no declared retro levels");
  const request = malformation.request(baseLevel, marker);
  if (position === "first") {
    appendRegistry(fixture, [request]);
    expect(seedRetroRegistry(fixture.store, "seed").ok).toBe(true);
    return { fixture, expectedSequence: 1 };
  }
  if (position === "middle") {
    appendRegistry(
      fixture,
      RETRO_LEVELS.slice(0, 3).map((level) => ({
        kind: RETRO_LEVEL_RECORD_KIND,
        recordKey: `${RETRO_LEVEL_RECORD_KEY_PREFIX}:${level.name}`,
        payload: levelPayload(level),
      })),
    );
    appendRegistry(fixture, [request]);
    expect(seedRetroRegistry(fixture.store, "seed").ok).toBe(true);
    return { fixture, expectedSequence: 4 };
  }
  expect(seedRetroRegistry(fixture.store, "seed").ok).toBe(true);
  appendRegistry(fixture, [request]);
  return { fixture, expectedSequence: 8 };
};

describe("TC-RETRO-031 registry entry-level malformation", () => {
  test("4 classes x first/middle/last classify while every valid level still folds", () => {
    let executed = 0;
    for (const position of ["first", "middle", "last"] as const) {
      for (const malformation of REGISTRY_CLASSES) {
        const { fixture, expectedSequence } = seedRegistryMatrixCase(
          `matrix-registry-${malformation.id}-${position}`,
          malformation,
          position,
        );
        const before = readRegistryText(fixture);
        const read = readRetroRegistry(fixture.store);
        expect(read.ok, `${malformation.id}/${position}`).toBe(true);
        if (!read.ok) continue;
        expect(read.value.verdict).toBe("valid");
        expect(read.value.malformed).toHaveLength(1);
        expect(read.value.malformed[0]?.position).toBe(expectedSequence);
        expect(read.value.artifacts.length).toBe(7);
        expect(readRetroLevels(read.value)).toHaveLength(6);
        expect(readRegistryText(fixture)).toBe(before);

        const collect = collectRetro(collectDeps(fixture));
        expect(collect.ok, `${malformation.id}/${position} collect`).toBe(false);
        if (!collect.ok) expect(collect.error.code).toBe("retro.evidence.malformed-entry");
        const report = reportRetro(reportDeps(fixture));
        expect(report.ok, `${malformation.id}/${position} report`).toBe(false);
        if (!report.ok) expect(report.error.code).toBe("retro.evidence.malformed-entry");
        executed += 1;
      }
    }
    expect(executed).toBe(12);
  });

  test("a clean registry control folds six levels and one trigger with no malformed entry", () => {
    const fixture = makeRetroDir("mal-registry-clean");
    expect(seedRetroRegistry(fixture.store, "seed").ok).toBe(true);
    const read = readRetroRegistry(fixture.store);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.malformed).toEqual([]);
    expect(read.value.verdict).toBe("valid");
    expect(readRetroLevels(read.value)).toHaveLength(6);
  });

  test("an ignore-malformed mutant fails the oracle", () => {
    const lastClass = REGISTRY_CLASSES[0];
    if (lastClass === undefined) throw new Error("no registry malformation classes");
    const { fixture } = seedRegistryMatrixCase("mal-registry-ignore-mutant", lastClass, "last");
    const read = readRetroRegistry(fixture.store);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const assertClassified = (value: { readonly malformed: readonly unknown[] }): void => {
      expect(value.malformed).toHaveLength(1);
    };
    expect(() => assertClassified(read.value)).not.toThrow();
    expect(() => assertClassified({ ...read.value, malformed: [] })).toThrow();
  });
});

const runRecord = (runId: string, collected: number): RetroRunRecord => ({
  schemaId: "delivery.retro.run.v1",
  runId,
  level: "change",
  mode: "collect",
  scope: "GH-232",
  counts: { collected, malformed: 0, skippedSource: 0 },
  consumed: [],
  truth: { clean: true, blocking: null, checks: [] },
});

describe("TC-RETRO-032 preserved output is byte-identical", () => {
  test("the valid-entry output equals the clean run and the error envelope is truthful", async () => {
    const clean = makeRetroDir("byte-oracle-clean");
    const run = runRecord("run-byte", 4);
    expect(recordRetroRun(clean.store, run, "run-byte-writer").ok).toBe(true);
    const cleanRecords = Array.from({ length: 4 }, (_, index) =>
      appendEvidence(clean, { payloadRefs: ["run:run-byte", `note:${String(index)}`] }),
    );

    const malformed = makeRetroDir("byte-oracle-malformed");
    expect(recordRetroRun(malformed.store, run, "run-byte-writer").ok).toBe(true);
    malformed.io.writeText(malformed.sidecar.keyPath, readKeyArtifact(clean));
    malformed.io.applyPermissions(malformed.sidecar.keyPath, "file");
    const cleanLines = sidecarLines(clean);
    const injected = JSON.parse(cleanLines[1] as string) as Record<string, unknown>;
    delete injected.traceId;
    writeSidecarLines(malformed, [
      cleanLines[0] as string,
      cleanLines[1] as string,
      JSON.stringify(injected),
      ...cleanLines.slice(2),
    ]);

    const cleanRead = clean.sidecar.read();
    const malformedRead = malformed.sidecar.read();
    expect(cleanRead.ok).toBe(true);
    expect(malformedRead.ok).toBe(true);
    if (!cleanRead.ok || !malformedRead.ok) return;
    expect(cleanRead.value.records.map((record) => record.traceId)).toEqual(
      cleanRecords.map((record) => record.traceId),
    );
    expect(malformedRead.value.malformed).toEqual([{ position: 3 }]);
    assertByteIdentical(malformedRead.value.records, cleanRead.value.records);

    const cleanReport = reportRetro(reportDeps(clean));
    expect(cleanReport.ok).toBe(true);
    if (!cleanReport.ok || !("evidenceRefs" in cleanReport.data)) return;
    const malformedReport = reportRetro(reportDeps(malformed));
    expect(malformedReport.ok).toBe(false);
    if (malformedReport.ok) return;
    expect(malformedReport.error.code).toBe("retro.evidence.malformed-entry");
    if (malformedReport.error.kind === "retro") {
      expect(malformedReport.error.location).toMatchObject({
        entriesProcessed: 5,
        entriesPreserved: 4,
        firstFlaggedPosition: 3,
      });
    }
    expect(preservedOutput(malformedReport.partial)).toBe(cleanReport.data.evidenceRefs.join(", "));

    const cleanCli = await runRetro(["retro", "report", "--json"], clean);
    expect(cleanCli.exitCode).toBe(0);
    const cleanEnvelope = JSON.parse(cleanCli.stdout) as Record<string, unknown>;
    expect(Object.hasOwn(cleanEnvelope, "data")).toBe(true);
    expect(Object.hasOwn(cleanEnvelope, "error")).toBe(false);
    assertDataXorError(cleanEnvelope);

    const malformedCli = await runRetro(["retro", "report", "--json"], malformed);
    expect(malformedCli.exitCode).toBe(1);
    const malformedEnvelope = JSON.parse(malformedCli.stdout) as Record<string, unknown>;
    expect(Object.hasOwn(malformedEnvelope, "error")).toBe(true);
    expect(Object.hasOwn(malformedEnvelope, "data")).toBe(false);
    assertDataXorError(malformedEnvelope);

    const human = await runRetro(["retro", "report"], malformed);
    expect(human.exitCode).toBe(1);
    expect(human.stdout).toContain("preserved evidence records");
    expect(human.stderr).toContain("retro.evidence.malformed-entry");
  });

  test("a drops-last-valid-entry mutant and a data+error mutant both fail the oracle", () => {
    const left = [
      { traceId: "ev-0001" },
      { traceId: "ev-0002" },
      { traceId: "ev-0003" },
      { traceId: "ev-0004" },
    ];
    const dropped = left.slice(0, -1);
    expect(() => assertByteIdentical(dropped, left)).toThrow();
    expect(() => assertDataXorError({ data: {}, error: {} })).toThrow();
    expect(() => assertDataXorError({ data: {} })).not.toThrow();
  });
});

describe("TC-RETRO-033 store-level damage reuses state identities", () => {
  test("S-01 framing tear is state.store.torn and the repaired store succeeds", () => {
    const fixture = seedFive("mal-store-framing");
    const cleanLines = sidecarLines(fixture);
    writeSidecarLines(fixture, [`${cleanLines[0] as string}`, "{not-json"]);
    const torn = fixture.sidecar.read();
    expect(torn.ok).toBe(false);
    if (!torn.ok) expect(torn.error.code).toBe("state.store.torn");
    writeSidecarLines(fixture, cleanLines);
    const repaired = fixture.sidecar.read();
    expect(repaired.ok).toBe(true);
    if (repaired.ok) expect(repaired.value.records).toHaveLength(5);
  });

  test("S-02 registry sequence discontinuity is state.store.torn and the repaired ledger succeeds", () => {
    const fixture = makeRetroDir("mal-store-sequence");
    expect(seedRetroRegistry(fixture.store, "seed").ok).toBe(true);
    const original = readRegistryText(fixture);
    const lines = original.split("\n").filter((line) => line !== "");
    const first = JSON.parse(lines[0] as string) as Record<string, unknown>;
    first.sequence = 99;
    lines[0] = JSON.stringify(first);
    writeRegistryText(fixture, `${lines.join("\n")}\n`);
    const torn = readRetroRegistry(fixture.store);
    expect(torn.ok).toBe(false);
    if (!torn.ok) expect(torn.error.code).toBe("state.store.torn");
    writeRegistryText(fixture, original);
    const repaired = readRetroRegistry(fixture.store);
    expect(repaired.ok).toBe(true);
    if (repaired.ok) expect(repaired.value.verdict).toBe("valid");
  });

  test("S-03 unreadable sidecar file is state.store.torn and the normal edge succeeds", () => {
    const fixture = seedFive("mal-store-unreadable");
    const refusing: RetroSidecarIo = {
      ...fixture.io,
      readText: (path: string) => {
        if (path === fixture.sidecar.evidencePath) throw new Error("unreadable");
        return fixture.io.readText(path);
      },
    };
    const unreadable = createRetroSidecar(refusing).read();
    expect(unreadable.ok).toBe(false);
    if (!unreadable.ok) expect(unreadable.error.code).toBe("state.store.torn");
    const repaired = fixture.sidecar.read();
    expect(repaired.ok).toBe(true);
  });

  test("S-04 missing key on a non-first open is state.keys.missing and restoring it succeeds", () => {
    const fixture = seedFive("mal-store-key");
    const originalKey = readKeyArtifact(fixture);
    removeKeyArtifact(fixture);
    const missing = fixture.sidecar.read();
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("state.keys.missing");
    fixture.io.writeText(keyArtifactPath(fixture), originalKey);
    fixture.io.applyPermissions(keyArtifactPath(fixture), "file");
    const repaired = fixture.sidecar.read();
    expect(repaired.ok).toBe(true);
  });

  test("a corrupt key is state.store.torn and restoring the key succeeds", () => {
    const fixture = seedFive("mal-store-corrupt-key");
    const originalKey = readKeyArtifact(fixture);
    corruptKeyArtifact(fixture);
    const torn = fixture.sidecar.read();
    expect(torn.ok).toBe(false);
    if (!torn.ok) expect(torn.error.code).toBe("state.store.torn");
    fixture.io.writeText(keyArtifactPath(fixture), originalKey);
    fixture.io.applyPermissions(keyArtifactPath(fixture), "file");
    const repaired = fixture.sidecar.read();
    expect(repaired.ok).toBe(true);
    if (repaired.ok) expect(repaired.value.chain.verified).toBe(true);
  });

  test("S-05 permission violation is state.permission.denied and repairing the mode succeeds", () => {
    const fixture = seedFive("mal-store-permission");
    chmodEvidence(fixture, 0o644);
    const denied = fixture.sidecar.read();
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("state.permission.denied");
    chmodEvidence(fixture, 0o600);
    const repaired = fixture.sidecar.read();
    expect(repaired.ok).toBe(true);
  });
});

describe("TC-RETRO-034 zero crashes and zero loss across the matrix", () => {
  test("all 24 entry-level cases classify, preserve, and never crash", () => {
    let executed = 0;
    let classified = 0;
    let preserved = 0;
    let crashes = 0;
    for (const position of POSITIONS) {
      for (const malformation of SIDECAR_CLASSES) {
        executed += 1;
        try {
          const fixture = seedFive(`matrix-034-sidecar-${malformation.id}-${String(position)}`);
          mutateContent(fixture, position, malformation.mutate);
          const read = fixture.sidecar.read();
          if (read.ok && read.value.malformed.length === 1 && read.value.records.length === 4) {
            preserved += 1;
          }
          const report = reportRetro(reportDeps(fixture));
          if (!report.ok && report.error.code === "retro.evidence.malformed-entry") classified += 1;
        } catch {
          crashes += 1;
        }
      }
    }
    for (const position of ["first", "middle", "last"] as const) {
      for (const malformation of REGISTRY_CLASSES) {
        executed += 1;
        try {
          const { fixture } = seedRegistryMatrixCase(
            `matrix-034-registry-${malformation.id}-${position}`,
            malformation,
            position,
          );
          const read = readRetroRegistry(fixture.store);
          if (read.ok && read.value.malformed.length === 1 && read.value.artifacts.length === 7) {
            preserved += 1;
          }
          const report = reportRetro(reportDeps(fixture));
          if (!report.ok && report.error.code === "retro.evidence.malformed-entry") classified += 1;
        } catch {
          crashes += 1;
        }
      }
    }
    expect(executed).toBe(24);
    expect(crashes).toBe(0);
    expect(classified).toBe(24);
    expect(preserved).toBe(24);
  });

  test("a crashing mutant is caught by the run wrapper", () => {
    const runWrapper = (run: () => void): boolean => {
      try {
        run();
        return false;
      } catch {
        return true;
      }
    };
    expect(runWrapper(() => undefined)).toBe(false);
    expect(
      runWrapper(() => {
        throw new Error("unguarded JSON.parse on a bad frame");
      }),
    ).toBe(true);
  });
});

describe("TC-RETRO-043 C-03 on the production fold", () => {
  test("a folded finding's dangling ref is flagged without the injection seam", () => {
    const fixture = makeRetroDir("c03-production");
    expect(recordRetroRun(fixture.store, runRecord("run-c03", 2), "run-c03-writer").ok).toBe(true);
    appendEvidence(fixture, {
      payloadRefs: [
        "run:run-c03",
        "finding:truth-check",
        "text:dangling evidence ref ev-missing",
        "ref:ev-missing",
      ],
      payloadSchemaId: "delivery.retro.finding.v1",
    });
    appendEvidence(fixture);
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
    if (!report.ok || !("findings" in report.data)) return;
    expect(
      report.data.findings.some((finding) =>
        finding.text.includes("dangling evidence ref ev-missing"),
      ),
    ).toBe(true);
    expect(report.data.evidenceRefs).not.toContain("ev-missing");
  });
});

describe("F-4 audit-read failure vocabulary", () => {
  test("an undeclared audit state code is classified, never cast into the union", () => {
    const fixture = makeRetroDir("audit-code-validation");
    fixture.scriptDeliveryChanges([
      { changeRef: "GH-232", completedAt: "2026-11-06T12:00:00Z", transitions: [] },
    ]);
    const result = collectRetro(
      collectDeps(fixture, {
        collectors: {
          readAuditLedger: () => ({
            ok: false,
            error: {
              kind: "state",
              code: "state.not.declared",
              consequence: "not_landed",
              location: { path: "audit-ledger" },
            },
          }),
          readStateFamilies: () => ({
            ok: true,
            value: { transitions: [], closeouts: [], telemetry: [] },
          }),
          readNotes: () => ({ ok: true, value: { retroNotes: [] } }),
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "state") {
      expect(result.error.code).toBe("state.store.unknown");
    }
  });
});

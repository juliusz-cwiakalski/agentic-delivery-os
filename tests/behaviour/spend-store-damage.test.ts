/**
 * TC-SPEND-008 (consumer half) — store damage reuses the delivered `state.*`
 * identities at the spend read seam, with the path and record position only,
 * never a partial or zeroed read, and a repaired-store control per case.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { classifyDomainKind } from "../../packages/cli/src/classify";
import {
  ERROR_TABLE,
  type ErrorTableEntry,
  HARNESS_TELEMETRY_RECORD_KIND,
  HARNESS_TELEMETRY_SCHEMA_ID,
} from "../../packages/core/src/contracts/index";
import { readSpendLedger } from "../../packages/core/src/state/index";
import {
  appendRecords,
  appendTransitions,
  independentChecksum,
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeSessionRecord,
  makeTempRoot,
  openStore,
  removeRoot,
  runSpendCli,
  SPEND_REF,
  spendRuntimeOver,
  tokens,
  withinFence,
} from "../fixtures/spend/harness";
import { T0 } from "../fixtures/spend/transitions";
import {
  makeStepRecord as makeStepRecordFor,
  seedSteps,
  TELEMETRY_REF,
  tokens as telemetryTokens,
} from "../fixtures/telemetry";

const POSIX = process.platform !== "win32";
const CANARY = "planted-spend-payload-canary";

type LedgerRecord = {
  kind: string;
  sequence: number;
  checksum: string;
  payload: Record<string, unknown>;
};

const rewriteLedger = (path: string, edit: (lines: LedgerRecord[]) => LedgerRecord[]): void => {
  const text = readFileSync(path, "utf8");
  const lines = text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as LedgerRecord);
  writeFileSync(
    path,
    `${edit(lines)
      .map((line) => JSON.stringify(line))
      .join("\n")}\n`,
  );
};

const headerPath = (root: string): string => `${root}/header.workspace-a.json`;

/** Seed one v2 step record through the delivered append path. */
const seedStepsFor = (store: ReturnType<typeof openStore>["store"]): void => {
  seedSteps(store, [
    makeStepRecordFor({
      ref: TELEMETRY_REF,
      runId: "run-v2-damage",
      sessionId: "ses_v2_damage",
      tokens: telemetryTokens({ input: 11 }),
    }),
  ]);
};

const withSeeded = (label: string, body: (context: ReturnType<typeof seed>) => void): void => {
  const context = seed(label);
  try {
    body(context);
  } finally {
    removeRoot(context.root);
  }
};

const seed = (label: string) => {
  const root = makeTempRoot(`gh236-damage-${label}`);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  appendRecords(store, [
    makeSessionRecord({ runId: "run-R1", tokens: tokens({ input: 100 }), calls: 1 }),
  ]);
  appendTransitions(store, SPEND_REF, [
    { phaseId: "clarify_scope", operation: "complete", timestamp: T0 },
  ]);
  return { root, identity, store, intake: ledgerText(identity) };
};

const entryOf = (code: string): ErrorTableEntry =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find(
    (entry) => entry.code === code,
  ) as ErrorTableEntry;

const expectClassified = (
  read: ReturnType<typeof readSpendLedger>,
  code: string,
  projectionClass: "user-validation" | "platform-provider",
): void => {
  expect(read.ok).toBe(false);
  if (read.ok) return;
  expect(read.error.code).toBe(code);
  expect(read.error.kind).toBe("state");
  expect(read.error.consequence).toBe("not_landed");
  expect(read.error.location.path.length).toBeGreaterThan(0);
  expect(entryOf(code).projectionClass).toBe(projectionClass);
  expect(classifyDomainKind("state", code).projectionClass).toBe(projectionClass);
  const rendered = JSON.stringify(read.error);
  expect(rendered).not.toContain(CANARY);
  expect(rendered).not.toContain("tokens");
};

describe("TC-SPEND-008 store damage at the read seam", () => {
  test("R-04 framing tear names the store path and record position", () => {
    withSeeded("tear", ({ identity, intake }) => {
      const lines = intake.split("\n");
      lines[0] = "{not-framed";
      writeFileSync(ledgerPath(identity), lines.join("\n"));
      const torn = readSpendLedger(openStore(identity).store, SPEND_REF);
      expectClassified(torn, "state.store.torn", "platform-provider");
      if (!torn.ok) expect(typeof torn.error.location.record).toBe("number");

      writeFileSync(ledgerPath(identity), intake);
      const repaired = readSpendLedger(openStore(identity).store, SPEND_REF);
      expect(repaired.ok).toBe(true);
    });
  });

  test("R-05 schema mismatch names the store path", () => {
    withSeeded("schema", ({ root, identity, intake }) => {
      const original = readFileSync(headerPath(root), "utf8");
      writeFileSync(headerPath(root), JSON.stringify({ schemaVersion: "delivery.state.v999" }));
      const mismatch = readSpendLedger(openStore(identity).store, SPEND_REF);
      expectClassified(mismatch, "state.schema.mismatch", "platform-provider");

      writeFileSync(headerPath(root), original);
      expect(readSpendLedger(openStore(identity).store, SPEND_REF).ok).toBe(true);
      expect(intake.length).toBeGreaterThan(0);
    });
  });

  test("R-06 an unknown record kind under the telemetry key never serves a partial read", () => {
    withSeeded("unknown-kind", ({ identity, intake }) => {
      const { store } = openStore(identity);
      withinFence(store, "writer", (handle) => {
        const outcome = store.append(handle, {
          kind: "mystery.kind",
          recordKey: `harness.telemetry:${SPEND_REF}`,
          payload: { note: CANARY },
        });
        expect(outcome.ok).toBe(true);
      });
      const read = readSpendLedger(openStore(identity).store, SPEND_REF);
      expectClassified(read, "state.store.torn", "platform-provider");
      if (!read.ok) expect(typeof read.error.location.record).toBe("number");

      writeFileSync(ledgerPath(identity), intake);
      expect(readSpendLedger(openStore(identity).store, SPEND_REF).ok).toBe(true);
    });
  });

  test("R-07 a malformed telemetry payload never coerces defaults", () => {
    withSeeded("malformed", ({ identity, intake }) => {
      const { store } = openStore(identity);
      withinFence(store, "writer", (handle) => {
        const outcome = store.append(handle, {
          kind: HARNESS_TELEMETRY_RECORD_KIND,
          recordKey: `harness.telemetry:${SPEND_REF}`,
          payload: { schemaId: HARNESS_TELEMETRY_SCHEMA_ID },
        });
        expect(outcome.ok).toBe(true);
      });
      const read = readSpendLedger(openStore(identity).store, SPEND_REF);
      expectClassified(read, "state.store.torn", "platform-provider");

      writeFileSync(ledgerPath(identity), intake);
      expect(readSpendLedger(openStore(identity).store, SPEND_REF).ok).toBe(true);
    });
  });

  test("R-08 a permission violation keeps its delivered user-validation projection", () => {
    if (!POSIX) return;
    withSeeded("permission", ({ identity }) => {
      chmodSync(ledgerPath(identity), 0o644);
      const read = readSpendLedger(openStore(identity).store, SPEND_REF);
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe("state.permission.denied");
        expect(entryOf("state.permission.denied").projectionClass).toBe("user-validation");
      }
      chmodSync(ledgerPath(identity), 0o600);
      expect(readSpendLedger(openStore(identity).store, SPEND_REF).ok).toBe(true);
    });
  });

  test("R-09 a corrupt transitions payload classifies (never a silent unknown window)", () => {
    withSeeded("transitions", ({ identity, intake }) => {
      rewriteLedger(ledgerPath(identity), (lines) =>
        lines.map((line) => {
          if (!line.kind.includes("phase.transition")) return line;
          const payload = {
            ...line.payload,
            transitions: [{ changeRef: SPEND_REF, operation: "complete" }],
          };
          return { ...line, payload, checksum: independentChecksum(payload) };
        }),
      );
      const read = readSpendLedger(openStore(identity).store, SPEND_REF);
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe("state.keys.missing");
        expect(entryOf("state.keys.missing").projectionClass).toBe("platform-provider");
        expect(JSON.stringify(read.error)).not.toContain(CANARY);
      }
      writeFileSync(ledgerPath(identity), intake);
      expect(readSpendLedger(openStore(identity).store, SPEND_REF).ok).toBe(true);
    });
  });
});

describe("TC-TELEMETRY-026 v2 telemetry damage keeps the delivered identities", () => {
  test("a torn v2 step family classifies as state.store.torn, never absence", () => {
    const root = makeTempRoot("gh291-v2-damage-torn");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seedStepsFor(store);
      const intake = readFileSync(ledgerPath(identity), "utf8");
      writeFileSync(ledgerPath(identity), "{not-framed\n");
      const torn = readSpendLedger(openStore(identity).store, TELEMETRY_REF);
      expectClassified(torn, "state.store.torn", "platform-provider");
      if (!torn.ok) expect(torn.error.code).not.toBe("spend.telemetry-absent");
      writeFileSync(ledgerPath(identity), intake);
      expect(readSpendLedger(openStore(identity).store, TELEMETRY_REF).ok).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("an unknown kind under the v2 step key is damage, never absence", () => {
    const root = makeTempRoot("gh291-v2-damage-kind");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seedStepsFor(store);
      withinFence(store, "writer", (handle) => {
        const appended = store.append(handle, {
          kind: "mystery.kind",
          recordKey: `harness.telemetry.step:${TELEMETRY_REF}`,
          payload: { note: CANARY },
        });
        expect(appended.ok).toBe(true);
      });
      const read = readSpendLedger(openStore(identity).store, TELEMETRY_REF);
      expectClassified(read, "state.store.torn", "platform-provider");
      expect(JSON.stringify(read.ok ? {} : read.error)).not.toContain(CANARY);
    } finally {
      removeRoot(root);
    }
  });

  test("a malformed v2 step payload never renders a partial truth", () => {
    const root = makeTempRoot("gh291-v2-damage-malformed");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      withinFence(store, "writer", (handle) => {
        const appended = store.append(handle, {
          kind: "harness.telemetry.step",
          recordKey: `harness.telemetry.step:${TELEMETRY_REF}`,
          payload: { schemaId: "delivery.harness.telemetry.step.v1" },
        });
        expect(appended.ok).toBe(true);
      });
      const read = readSpendLedger(openStore(identity).store, TELEMETRY_REF);
      expectClassified(read, "state.store.torn", "platform-provider");
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-SPEND-008 runCli integration half", () => {
  test("a torn store classifies at exit 2 and permission at exit 1", async () => {
    const root = makeTempRoot("gh236-damage-cli");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      appendRecords(store, [
        makeSessionRecord({ runId: "run-R1", tokens: tokens({ input: 10 }), calls: 1 }),
      ]);
      const intact = readFileSync(ledgerPath(identity), "utf8");
      const lines = intact.split("\n");
      lines[0] = "{not-framed";
      writeFileSync(ledgerPath(identity), lines.join("\n"));
      const torn = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF],
        spendRuntimeOver(openStore(identity).store),
      );
      expect(torn.exitCode).toBe(2);
      const tornEnvelope = JSON.parse(torn.stdout) as unknown;
      if (typeof tornEnvelope !== "object" || tornEnvelope === null) throw new Error("envelope");
      expect((tornEnvelope as { error?: { code?: string } }).error?.code).toBe("state.store.torn");
      expect(torn.stdout).not.toContain(CANARY);

      if (POSIX) {
        writeFileSync(ledgerPath(identity), intact);
        chmodSync(ledgerPath(identity), 0o644);
        const denied = await runSpendCli(
          ["--json", "spend", "--ref", SPEND_REF],
          spendRuntimeOver(openStore(identity).store),
        );
        expect(denied.exitCode).toBe(1);
        const deniedEnvelope = JSON.parse(denied.stdout) as unknown;
        if (typeof deniedEnvelope !== "object" || deniedEnvelope === null) {
          throw new Error("envelope");
        }
        expect((deniedEnvelope as { error?: { code?: string } }).error?.code).toBe(
          "state.permission.denied",
        );
        chmodSync(ledgerPath(identity), 0o600);
      }
    } finally {
      removeRoot(root);
    }
  });
});

/**
 * GH-347 phase 1 — the additive dispatch contract surfaces.
 *
 * Asserts the declared lane record (kind, schema, key, exact field set and
 * state/terminal rules), the fresh-spawn title grammar and helper, and the
 * closed delay-reason vocabulary. The structure half of TC-LANE-001 lives here;
 * its behaviour half is owned by phase 3's lane/resume suite.
 *
 * Mutation controls: an extra lane field, a terminal record without its token,
 * a malformed title, and an ambient delay reason each fail by name.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  DISPATCH_DELAY_REASONS,
  DISPATCH_LANE_KEY_PREFIX,
  DISPATCH_LANE_PAYLOAD_SCHEMA,
  DISPATCH_LANE_RECORD_KIND,
  DISPATCH_LANE_STATES,
  DISPATCH_MAX_SPAWN_TITLE_CHARS,
  DISPATCH_SPAWN_TITLE_PATTERN,
  DISPATCH_SPAWN_TITLE_PREFIX,
  type DispatchLaneRecord,
  dispatchLaneRecordKey,
} from "../../packages/core/src/contracts/index";
import { isDispatchLaneRecord } from "../../packages/core/src/app/dispatch-ledger";
import { isSpawnTitle, spawnTitleFor } from "../../packages/core/src/domain/dispatch-identity";

const ROOT = process.cwd();
const CONTRACTS_DIR = "packages/core/src/contracts";

type FieldShape = {
  readonly name: string;
  readonly optional: boolean;
  readonly readonly: boolean;
};

const collectTypeFields = (module: string, typeName: string): FieldShape[] | undefined => {
  const path = join(ROOT, CONTRACTS_DIR, module);
  const source = ts.createSourceFile(
    module,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== typeName) continue;
    if (!ts.isTypeLiteralNode(statement.type)) return undefined;
    return statement.type.members.filter(ts.isPropertySignature).map((member) => ({
      name: ts.isIdentifier(member.name) ? member.name.text : member.name.getText(source),
      optional: member.questionToken !== undefined,
      readonly: (member.modifiers ?? []).some(
        (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword,
      ),
    }));
  }
  return undefined;
};

const laneRecord = (overrides: Partial<Record<string, unknown>> = {}): DispatchLaneRecord =>
  ({
    schema: DISPATCH_LANE_PAYLOAD_SCHEMA,
    ref: "GH-347",
    repository: "github.com/owner/repo",
    attemptId: "attempt-GH-347-1",
    sessionId: "ses-347",
    harnessKind: "opencode",
    owner: { processId: 4242, startedAt: "2026-11-19T00:00:00.000Z" },
    iterationOrdinal: 1,
    restartsConsumed: 0,
    state: "active",
    recordedAt: "2026-11-19T00:00:00.000Z",
    ...overrides,
  }) as DispatchLaneRecord;

describe("GH-347 the dispatch lane record is declared once", () => {
  test("the kind, schema, key prefix and key builder are the declared values", () => {
    expect(DISPATCH_LANE_RECORD_KIND).toBe("dispatch.lane");
    expect(DISPATCH_LANE_PAYLOAD_SCHEMA).toBe("delivery.dispatch.lane.v1");
    expect(DISPATCH_LANE_KEY_PREFIX).toBe("dispatch.lanes:");
    expect(dispatchLaneRecordKey("GH-347")).toBe("dispatch.lanes:GH-347");
  });

  test("the two lane states are the closed pair in order", () => {
    expect([...DISPATCH_LANE_STATES]).toEqual(["active", "terminal"]);
  });

  test("the record carries exactly the declared field set, with the terminal pair optional", () => {
    const fields = collectTypeFields("dispatch.ts", "DispatchLaneRecord");
    expect(fields).toBeDefined();
    const names = (fields ?? []).map((field) => field.name);
    expect(names).toEqual([
      "schema",
      "ref",
      "repository",
      "attemptId",
      "sessionId",
      "harnessKind",
      "owner",
      "iterationOrdinal",
      "restartsConsumed",
      "state",
      "lastToken",
      "lastOutcome",
      "recordedAt",
    ]);
    for (const field of fields ?? []) {
      expect(field.readonly, `${field.name} must be readonly`).toBe(true);
      const optional = field.name === "lastToken" || field.name === "lastOutcome";
      expect(field.optional, `${field.name} optional`).toBe(optional);
    }
    // No prompt, transcript, diff, credential, or provider payload key exists.
    for (const forbidden of ["prompt", "transcript", "diff", "credential", "payload"]) {
      expect(names).not.toContain(forbidden);
    }
  });

  test("the owner shape is exactly processId and startedAt", () => {
    const fields = collectTypeFields("dispatch.ts", "DispatchLaneOwner");
    expect((fields ?? []).map((field) => field.name)).toEqual(["processId", "startedAt"]);
  });

  test("exactly one contracts module declares the lane kind", () => {
    const owners: string[] = [];
    for (const module of ["dispatch.ts", "daemon.ts", "state.ts"]) {
      if (readFileSync(join(ROOT, CONTRACTS_DIR, module), "utf8").includes('"dispatch.lane"')) {
        owners.push(module);
      }
    }
    expect(owners).toEqual(["dispatch.ts"]);
  });

  test("the guard accepts an active record and a terminal record", () => {
    expect(isDispatchLaneRecord(laneRecord())).toBe(true);
    expect(
      isDispatchLaneRecord(
        laneRecord({ state: "terminal", lastToken: "pr-open", lastOutcome: "completed" }),
      ),
    ).toBe(true);
  });

  test("the guard refuses a malformed value by name", () => {
    // Unknown keys are excluded structurally by the declared type and by the
    // exact-field-set probe above; the reader guard validates the declared
    // values so a malformed record is refused rather than decoded.
    expect(isDispatchLaneRecord(laneRecord({ sessionId: "" }))).toBe(false);
    expect(isDispatchLaneRecord(laneRecord({ iterationOrdinal: 0 }))).toBe(false);
    expect(isDispatchLaneRecord(laneRecord({ restartsConsumed: -1 }))).toBe(false);
    expect(isDispatchLaneRecord(laneRecord({ owner: { processId: 0, startedAt: "now" } }))).toBe(
      false,
    );
  });

  test("an active record carrying a terminal token is refused", () => {
    expect(isDispatchLaneRecord(laneRecord({ lastToken: "pr-open" }))).toBe(false);
    expect(
      isDispatchLaneRecord(laneRecord({ state: "terminal", lastToken: "pr-open" })),
    ).toBe(false);
  });
});

describe("GH-347 the fresh-spawn title grammar and helper", () => {
  test("the declared prefix, bound and anchored pattern", () => {
    expect(DISPATCH_SPAWN_TITLE_PREFIX).toBe("ticket-");
    expect(DISPATCH_MAX_SPAWN_TITLE_CHARS).toBe(64);
    expect(DISPATCH_SPAWN_TITLE_PATTERN.startsWith("^ticket-")).toBe(true);
  });

  test("a canonical ref yields one token, byte-identical across calls", () => {
    expect(spawnTitleFor("GH-347")).toBe("ticket-GH-347");
    expect(spawnTitleFor("PDEV-12")).toBe("ticket-PDEV-12");
    expect(spawnTitleFor("GH-347")).toBe(spawnTitleFor("GH-347"));
    expect(spawnTitleFor("GH-347")?.includes(" ")).toBe(false);
  });

  test("a malformed reference is refused rather than sanitized", () => {
    for (const ref of ["gh-347", "GH347", "GH-", "-347", "GH-347 extra", " GH-347"]) {
      expect(spawnTitleFor(ref), ref).toBeUndefined();
    }
  });

  test("the title validator rejects a non-title and an over-long title", () => {
    expect(isSpawnTitle("ticket-GH-347")).toBe(true);
    expect(isSpawnTitle("GH-347")).toBe(false);
    expect(isSpawnTitle("ticket-GH-347-extra")).toBe(false);
    expect(isSpawnTitle(`ticket-${"A".repeat(DISPATCH_MAX_SPAWN_TITLE_CHARS)}-1`)).toBe(false);
  });
});

describe("GH-347 the injected delay vocabulary is closed", () => {
  test("the three reasons are exactly the declared ones", () => {
    expect([...DISPATCH_DELAY_REASONS]).toEqual([
      "claim-fence",
      "tracker-ladder",
      "terminate-grace",
    ]);
  });

  test("the engine declares no ambient timer for the fact", () => {
    const engine = readFileSync(join(ROOT, "packages/core/src/app/dispatch.ts"), "utf8");
    expect(engine).not.toContain("setTimeout");
    expect(engine).not.toContain("setInterval");
    expect(engine).not.toContain("node:timers");
  });
});

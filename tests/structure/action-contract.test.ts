/**
 * TC-ACTION-004 (vocabulary half), TC-ACTION-005, TC-ACTION-026 (constants
 * half), TC-ACTION-036 (step 1: one home per declared constant) — the
 * action-registry contract declaration.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  ACTION_AGING_BASIS,
  ACTION_AGING_BASIS_FIELD,
  ACTION_AGING_DAY_MS,
  ACTION_AGING_ESCALATE_DAYS,
  ACTION_AGING_NUDGE_DAYS,
  ACTION_AGING_STATES,
  ACTION_CLOSURE_JUSTIFICATION_FIELDS,
  ACTION_CLOSURE_PLANE_FIELDS,
  ACTION_CLOSURE_PLANE_STATES,
  ACTION_CLOSURE_PLANES,
  ACTION_CLOSURE_ROUTES,
  ACTION_CONTRACT_FIELDS,
  ACTION_FIVE_FIELDS,
  ACTION_FLAGS,
  ACTION_FREE_TEXT_BOUNDS,
  ACTION_LIST_DATA_KEY,
  ACTION_OWNER_KINDS,
  ACTION_REFUSED_OWNER_KINDS,
  ACTION_REFUSED_VERBS,
  ACTION_SECOND_MISS_LAPSES,
  ACTION_TRACKER_CORROBORATION_STATES,
  ACTION_VERBS,
  ACTION_VERIFICATION_WINDOW_STATES,
  ACTION_WIP_LIMIT,
  BOARD_ACTIONS_LABEL,
  BOARD_MAX_ACTIONS,
  BOARD_SECTION_DROP_ORDER,
  BOARD_SECTION_ORDER,
  RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA,
  RETRO_ACTION_CLOSURE_RECORD_KEY_PREFIX,
  RETRO_ACTION_CLOSURE_RECORD_KIND,
  RETRO_ACTION_ERROR_CODES,
  RETRO_ACTION_PAYLOAD_SCHEMA,
  RETRO_ACTION_RECORD_KEY_PREFIX,
  RETRO_ACTION_RECORD_KIND,
  RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION,
  RETRO_ACTION_REGISTRY_RECORD_KEY_PREFIX,
  RETRO_ACTION_VERBS,
  RETRO_REGISTRY_BOUNDARY_DECLARATION,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const MODULE = "packages/core/src/contracts/action.ts";
const source = readFileSync(join(ROOT, MODULE), "utf8");

const specifiersOf = (relative: string): string[] => {
  const file = ts.createSourceFile(
    relative,
    readFileSync(join(ROOT, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  for (const statement of file.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
};

describe("TC-ACTION-005 closed verifiable-verb vocabulary", () => {
  test("the vocabulary is exactly the five declared verbs in declared order", () => {
    expect([...ACTION_VERBS]).toEqual(["add", "remove", "change", "test", "deploy"]);
    expect([...ACTION_REFUSED_VERBS]).toEqual(["review", "improve"]);
    for (const verb of ACTION_REFUSED_VERBS) {
      expect(ACTION_VERBS as readonly string[]).not.toContain(verb);
    }
  });

  test("the owner vocabulary is agent-role or human and team is refused by name", () => {
    expect([...ACTION_OWNER_KINDS]).toEqual(["agent-role", "human"]);
    expect([...ACTION_REFUSED_OWNER_KINDS]).toEqual(["team"]);
    expect(ACTION_OWNER_KINDS as readonly string[]).not.toContain("team");
  });

  test("the contract member set is the five fields plus artifact, verifier, rollback", () => {
    expect([...ACTION_FIVE_FIELDS]).toEqual([
      "owner",
      "verb",
      "measurableOutcome",
      "trackerEntry",
      "dueDate",
    ]);
    expect([...ACTION_CONTRACT_FIELDS]).toEqual([
      "owner",
      "verb",
      "measurableOutcome",
      "trackerEntry",
      "dueDate",
      "verificationArtifact",
      "outcomeVerifier",
      "rollbackCondition",
    ]);
  });
});

describe("TC-ACTION-004 record declaration", () => {
  test("record kinds, payload schemas, and prefixes are exact and additive", () => {
    expect(RETRO_ACTION_RECORD_KIND).toBe("retro.action");
    expect(RETRO_ACTION_CLOSURE_RECORD_KIND).toBe("retro.action-closure");
    expect(RETRO_ACTION_PAYLOAD_SCHEMA).toBe("delivery.retro.action.v1");
    expect(RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA).toBe("delivery.retro.action-closure.v1");
    expect(RETRO_ACTION_RECORD_KEY_PREFIX).toBe("retro.actions");
    expect(RETRO_ACTION_CLOSURE_RECORD_KEY_PREFIX).toBe("retro.action-closures");
    expect(RETRO_ACTION_REGISTRY_RECORD_KEY_PREFIX).toBe("retro.action");
  });

  test("the registry boundary declares exactly the two action kinds", () => {
    expect(RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION.kinds.map((kind) => kind.kind)).toEqual([
      RETRO_ACTION_RECORD_KIND,
      RETRO_ACTION_CLOSURE_RECORD_KIND,
    ]);
    for (const kind of RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION.kinds) {
      expect(kind.fields.length).toBeGreaterThan(0);
      expect(kind.payloadSchema).toBeDefined();
      expect(kind.identityField.length).toBeGreaterThan(0);
    }
    expect(RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION.recordKeyPrefix).toBe("retro.action");
  });

  test("the delivered retro-registry boundary keeps exactly its three kinds", () => {
    expect(RETRO_REGISTRY_BOUNDARY_DECLARATION.kinds).toHaveLength(3);
    const deliveredPrefixes = RETRO_REGISTRY_BOUNDARY_DECLARATION.kinds.map((kind) => kind.kind);
    expect(deliveredPrefixes).toEqual(["retro.level", "retro.run", "retro.trigger"]);
  });

  test("the declared tracker corroboration states are closed", () => {
    expect([...ACTION_TRACKER_CORROBORATION_STATES]).toEqual([
      "confirmed",
      "unreachable",
      "unverified",
    ]);
  });
});

describe("TC-ACTION-006/007/008 aging constants", () => {
  test("the basis, thresholds, day length, and states are pinned contract data", () => {
    expect(ACTION_AGING_BASIS).toBe("time-open-since-filing");
    expect(ACTION_AGING_BASIS_FIELD).toBe("filedAt");
    expect(ACTION_AGING_NUDGE_DAYS).toBe(14);
    expect(ACTION_AGING_ESCALATE_DAYS).toBe(30);
    expect(ACTION_AGING_DAY_MS).toBe(86_400_000);
    expect([...ACTION_AGING_STATES]).toEqual(["current", "nudged", "escalated"]);
    expect(ACTION_SECOND_MISS_LAPSES).toBe(2);
  });

  test("the aging basis has exactly one declaration home", () => {
    const declarations = source.split(`ACTION_AGING_BASIS =`).length - 1;
    expect(declarations).toBe(1);
    expect(source).toContain(`ACTION_AGING_BASIS_FIELD = "filedAt"`);
  });
});

describe("TC-ACTION-014/015/016 WIP contract data", () => {
  test("the limit is the fixed value three", () => {
    expect(ACTION_WIP_LIMIT).toBe(3);
    expect(source.split("ACTION_WIP_LIMIT =").length - 1).toBe(1);
  });
});

describe("TC-ACTION-009..013/038/039 closure vocabulary", () => {
  test("routes, planes, plane states, and window states are closed vocabularies", () => {
    expect([...ACTION_CLOSURE_ROUTES]).toEqual(["done", "deprioritized", "superseded"]);
    expect([...ACTION_CLOSURE_PLANES]).toEqual(["artifact", "outcome"]);
    expect([...ACTION_CLOSURE_PLANE_STATES]).toEqual(["open", "closed"]);
    expect([...ACTION_VERIFICATION_WINDOW_STATES]).toEqual(["open", "elapsed", "mooted"]);
    expect(ACTION_CLOSURE_PLANE_FIELDS).toEqual({
      artifact: "artifactClosure",
      outcome: "outcomeClosure",
    });
  });

  test("each route names the justification member it requires", () => {
    expect(ACTION_CLOSURE_JUSTIFICATION_FIELDS).toEqual({
      done: "artifact",
      deprioritized: "reason",
      superseded: "successor",
    });
  });
});

describe("TC-ACTION-026 additive refusal identities", () => {
  test("exactly three exact two-segment codes are declared once", () => {
    expect([...RETRO_ACTION_ERROR_CODES]).toEqual([
      "retro.action-incomplete",
      "retro.closure-incomplete",
      "retro.wip-limit-exceeded",
    ]);
    for (const code of RETRO_ACTION_ERROR_CODES) {
      expect(code.split(".")).toHaveLength(2);
      expect(code.startsWith("retro.")).toBe(true);
    }
    expect(source.split(`RETRO_ACTION_ERROR_CODES =`).length - 1).toBe(1);
  });
});

describe("TC-ACTION-036 pinned grammar and board member set", () => {
  test("the additive verb group is exactly file, close, list", () => {
    expect([...RETRO_ACTION_VERBS]).toEqual(["file", "close", "list"]);
    expect(ACTION_LIST_DATA_KEY).toBe("actions");
  });

  test("every flag shape has one declaration home", () => {
    const flags = Object.values(ACTION_FLAGS);
    expect(new Set(flags).size).toBe(flags.length);
    for (const flag of flags) expect(flag.startsWith("--")).toBe(true);
  });

  test("the board actions member set declares its label, cap, order, and drop order", () => {
    expect(BOARD_ACTIONS_LABEL).toBe("ACTIONS");
    expect(BOARD_MAX_ACTIONS).toBe(8);
    expect([...BOARD_SECTION_ORDER]).toEqual(["lanes", "gates", "asks", "actions", "parked"]);
    expect([...BOARD_SECTION_DROP_ORDER]).toEqual(["parked", "asks", "actions", "lanes", "gates"]);
    expect(new Set(BOARD_SECTION_ORDER).size).toBe(BOARD_SECTION_ORDER.length);
    expect(new Set(BOARD_SECTION_DROP_ORDER).size).toBe(BOARD_SECTION_DROP_ORDER.length);
  });

  test("free-text fields carry declared bounds", () => {
    expect(ACTION_FREE_TEXT_BOUNDS.measurableOutcome).toBeGreaterThan(0);
    expect(ACTION_FREE_TEXT_BOUNDS.closureReason).toBeGreaterThan(0);
  });
});

describe("TC-ACTION-027 contracts-tier purity", () => {
  test("the contract module imports only relative modules and declares no runtime API", () => {
    for (const specifier of specifiersOf(MODULE)) {
      expect(specifier.startsWith("node:"), specifier).toBe(false);
      expect(specifier.startsWith("bun:"), specifier).toBe(false);
      expect(specifier.startsWith("."), specifier).toBe(true);
    }
    for (const marker of ["Date.now", "Math.random", "process.", "Bun.", "fetch("]) {
      expect(source.includes(marker), marker).toBe(false);
    }
  });
});

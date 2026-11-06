/**
 * TC-BLK-001 / TC-BLK-002 (data half) / TC-BLK-003 (contract half) — the
 * blockers vocabulary, the delegation map, and the declaration-only contract
 * are pinned as data, and every mutation fails by name.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  BLOCKER_ANSWER_CHANNEL_BY_TYPE,
  BLOCKER_ANSWER_CHANNELS,
  BLOCKER_ANSWER_PAYLOAD_SCHEMA,
  BLOCKER_ANSWER_RECORD_KIND,
  BLOCKER_AUDIENCES,
  BLOCKER_CALLER_AUDIENCE_SUFFIX,
  BLOCKER_CAPABILITY_SOURCES,
  BLOCKER_DEFAULT_AUDIENCE,
  BLOCKER_DEFAULT_RESUME_MODE,
  BLOCKER_DELEGATION_POLICY_ROWS,
  BLOCKER_FALLBACK_RESUME_MODE,
  BLOCKER_MAX_ANSWER_CHARS,
  BLOCKER_MAX_OPTION_CHARS,
  BLOCKER_MAX_OPTIONS,
  BLOCKER_MAX_QUESTION_CHARS,
  BLOCKER_PRIORITY_BY_TYPE,
  BLOCKER_QUESTION_PAYLOAD_SCHEMA,
  BLOCKER_QUESTION_RECORD_KIND,
  BLOCKER_QUESTION_TYPES,
  BLOCKER_RESUME_MODES,
  BLOCKER_SESSION_REENTRY_BY_MODE,
  BLOCKER_VARIABLE_NAME_PATTERN,
  BLOCKERS_ERROR_CODES,
  BLOCKERS_MAX_HUMAN_BYTES,
  BLOCKERS_MAX_HUMAN_LINES,
  BLOCKERS_MAX_MACHINE_BYTES,
  BLOCKERS_MAX_QUESTIONS,
  BLOCKERS_SCHEMA_VERSION,
  OWNER_GATE_SLA_AUDIENCES,
  STATUS_MAX_HUMAN_BYTES,
  STATUS_MAX_HUMAN_LINES,
  STATUS_MAX_ITEMS_PER_SECTION,
  STATUS_MAX_MACHINE_BYTES,
} from "../../packages/core/src/contracts/index";
import {
  resolveBlockerDelegation,
  validateBlockerDelegationPolicy,
} from "../../packages/core/src/domain/blockers";
import {
  coordinatorOwnerAllowed,
  missingCoordinatorOwner,
  shippedPolicy,
  withFifthRow,
} from "../fixtures/blockers/policy";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/blockers.ts";

type ContractSnapshot = {
  readonly types: readonly string[];
  readonly channels: Readonly<Record<string, string>>;
  readonly answerChannels: readonly string[];
  readonly audiences: readonly string[];
  readonly priorities: Readonly<Record<string, number>>;
  readonly modes: readonly string[];
  readonly sources: readonly string[];
  readonly reentry: Readonly<Record<string, boolean>>;
  readonly defaultAudience: string;
  readonly defaultMode: string;
  readonly fallbackMode: string;
  readonly namePattern: string;
  readonly caps: Readonly<Record<string, number>>;
  readonly questionKind: string;
  readonly answerKind: string;
  readonly questionSchema: string;
  readonly answerSchema: string;
  readonly listSchema: string;
  readonly callerSuffix: string;
  readonly errors: readonly string[];
  readonly policy: readonly {
    readonly questionAudience: string;
    readonly answeringAudience: string;
    readonly allowed: boolean;
    readonly policy: string;
  }[];
};

const live = (): ContractSnapshot => ({
  types: [...BLOCKER_QUESTION_TYPES],
  channels: { ...BLOCKER_ANSWER_CHANNEL_BY_TYPE },
  answerChannels: [...BLOCKER_ANSWER_CHANNELS],
  audiences: [...BLOCKER_AUDIENCES],
  priorities: { ...BLOCKER_PRIORITY_BY_TYPE },
  modes: [...BLOCKER_RESUME_MODES],
  sources: [...BLOCKER_CAPABILITY_SOURCES],
  reentry: { ...BLOCKER_SESSION_REENTRY_BY_MODE },
  defaultAudience: BLOCKER_DEFAULT_AUDIENCE,
  defaultMode: BLOCKER_DEFAULT_RESUME_MODE,
  fallbackMode: BLOCKER_FALLBACK_RESUME_MODE,
  namePattern: BLOCKER_VARIABLE_NAME_PATTERN,
  caps: {
    question: BLOCKER_MAX_QUESTION_CHARS,
    options: BLOCKER_MAX_OPTIONS,
    option: BLOCKER_MAX_OPTION_CHARS,
    answer: BLOCKER_MAX_ANSWER_CHARS,
    renderQuestions: BLOCKERS_MAX_QUESTIONS,
    machineBytes: BLOCKERS_MAX_MACHINE_BYTES,
    humanLines: BLOCKERS_MAX_HUMAN_LINES,
    humanBytes: BLOCKERS_MAX_HUMAN_BYTES,
  },
  questionKind: BLOCKER_QUESTION_RECORD_KIND,
  answerKind: BLOCKER_ANSWER_RECORD_KIND,
  questionSchema: BLOCKER_QUESTION_PAYLOAD_SCHEMA,
  answerSchema: BLOCKER_ANSWER_PAYLOAD_SCHEMA,
  listSchema: BLOCKERS_SCHEMA_VERSION,
  callerSuffix: BLOCKER_CALLER_AUDIENCE_SUFFIX,
  errors: [...BLOCKERS_ERROR_CODES],
  policy: BLOCKER_DELEGATION_POLICY_ROWS.map((row) => ({ ...row })),
});

const clone = (snapshot: ContractSnapshot): ContractSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as ContractSnapshot;

const audit = (snapshot: ContractSnapshot): string[] => {
  const failures: string[] = [];
  const eq = (name: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`${name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
    }
  };
  eq("BLOCKER_QUESTION_TYPES", snapshot.types, [
    "decision-needed",
    "spec-ambiguity",
    "credential-missing",
    "external-wait",
  ]);
  eq("BLOCKER_ANSWER_CHANNEL_BY_TYPE", snapshot.channels, {
    "decision-needed": "choice",
    "spec-ambiguity": "text",
    "credential-missing": "text",
    "external-wait": "text",
  });
  eq("BLOCKER_ANSWER_CHANNELS", snapshot.answerChannels, ["choice", "text"]);
  eq("BLOCKER_AUDIENCES", snapshot.audiences, ["owner", "coordinator"]);
  eq("BLOCKER_PRIORITY_BY_TYPE", snapshot.priorities, {
    "decision-needed": 1,
    "credential-missing": 1,
    "spec-ambiguity": 2,
    "external-wait": 3,
  });
  eq("BLOCKER_RESUME_MODES", snapshot.modes, [
    "boundary-note",
    "attach-continue",
    "resume-prompt-reentry",
  ]);
  eq("BLOCKER_CAPABILITY_SOURCES", snapshot.sources, ["adapter-declared", "capability-absent"]);
  eq("BLOCKER_SESSION_REENTRY_BY_MODE", snapshot.reentry, {
    "boundary-note": false,
    "attach-continue": false,
    "resume-prompt-reentry": true,
  });
  eq("BLOCKER_DEFAULT_AUDIENCE", snapshot.defaultAudience, "coordinator");
  eq("BLOCKER_DEFAULT_RESUME_MODE", snapshot.defaultMode, "boundary-note");
  eq("BLOCKER_FALLBACK_RESUME_MODE", snapshot.fallbackMode, "resume-prompt-reentry");
  eq("BLOCKER_VARIABLE_NAME_PATTERN", snapshot.namePattern, "^[A-Z][A-Z0-9_]*$");
  eq("BLOCKER_MAX_QUESTION_CHARS", snapshot.caps.question, 120);
  eq("BLOCKER_MAX_OPTIONS", snapshot.caps.options, 4);
  eq("BLOCKER_MAX_OPTION_CHARS", snapshot.caps.option, 60);
  eq("BLOCKER_MAX_ANSWER_CHARS", snapshot.caps.answer, 160);
  eq("BLOCKERS_MAX_QUESTIONS", snapshot.caps.renderQuestions, 8);
  eq("BLOCKERS_MAX_MACHINE_BYTES", snapshot.caps.machineBytes, 65536);
  eq("BLOCKERS_MAX_HUMAN_LINES", snapshot.caps.humanLines, 24);
  eq("BLOCKERS_MAX_HUMAN_BYTES", snapshot.caps.humanBytes, 4096);
  eq("BLOCKER_QUESTION_RECORD_KIND", snapshot.questionKind, "blocker.question");
  eq("BLOCKER_ANSWER_RECORD_KIND", snapshot.answerKind, "blocker.answer");
  eq("BLOCKER_QUESTION_PAYLOAD_SCHEMA", snapshot.questionSchema, "delivery.blocker.question.v1");
  eq("BLOCKER_ANSWER_PAYLOAD_SCHEMA", snapshot.answerSchema, "delivery.blocker.answer.v1");
  eq("BLOCKERS_SCHEMA_VERSION", snapshot.listSchema, "delivery.blockers.v1");
  eq("BLOCKER_CALLER_AUDIENCE_SUFFIX", snapshot.callerSuffix, "CALLER_AUDIENCE");
  eq("BLOCKERS_ERROR_CODES", snapshot.errors, [
    "blockers.invalid-type",
    "blockers.unknown-id",
    "blockers.credential-value-rejected",
    "blockers.audience-mismatch",
  ]);

  // The answer-channel map is total over the type set and one channel per type.
  const typeSet = new Set(snapshot.types);
  if (Object.keys(snapshot.channels).length !== typeSet.size) {
    failures.push("BLOCKER_ANSWER_CHANNEL_BY_TYPE: not total over the type set");
  }
  for (const type of snapshot.types) {
    const channel = snapshot.channels[type];
    if (channel === undefined || !snapshot.answerChannels.includes(channel)) {
      failures.push(`BLOCKER_ANSWER_CHANNEL_BY_TYPE: ${type} lacks exactly one valid channel`);
    }
  }
  for (const type of snapshot.types) {
    if (snapshot.priorities[type] === undefined) {
      failures.push(`BLOCKER_PRIORITY_BY_TYPE: ${type} lacks a priority`);
    }
  }
  if (Object.keys(snapshot.priorities).length !== typeSet.size) {
    failures.push("BLOCKER_PRIORITY_BY_TYPE: has keys outside the type set");
  }

  // The delegation map is total over the four combinations, with one refusal.
  const combinations = new Set(
    snapshot.policy.map((row) => `${row.questionAudience}->${row.answeringAudience}`),
  );
  if (snapshot.policy.length !== 4 || combinations.size !== 4) {
    failures.push("BLOCKER_DELEGATION_POLICY_ROWS: not total over the four combinations");
  }
  for (const audience of snapshot.audiences) {
    for (const answering of snapshot.audiences) {
      const key = `${audience}->${answering}`;
      if (!combinations.has(key)) {
        failures.push(`BLOCKER_DELEGATION_POLICY_ROWS: missing ${key}`);
      }
    }
  }
  if (snapshot.policy.some((row) => !snapshot.audiences.includes(row.questionAudience))) {
    failures.push("BLOCKER_DELEGATION_POLICY_ROWS: question audience outside the closed set");
  }
  if (snapshot.policy.some((row) => !snapshot.audiences.includes(row.answeringAudience))) {
    failures.push("BLOCKER_DELEGATION_POLICY_ROWS: answering audience outside the closed set");
  }
  const refused = snapshot.policy.filter((row) => !row.allowed);
  eq("BLOCKER_DELEGATION_POLICY_ROWS.refused", refused, [
    {
      questionAudience: "coordinator",
      answeringAudience: "owner",
      allowed: false,
      policy: "none",
    },
  ]);
  return failures;
};

const DATA_ONLY = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

const declarationViolations = (text: string): string[] => {
  const source = ts.createSourceFile(
    CONTRACT,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const violations: string[] = [];
  for (const statement of source.statements) {
    if (!DATA_ONLY.has(statement.kind)) {
      violations.push(`executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
    if (ts.isFunctionDeclaration(statement)) {
      violations.push(`function ${statement.name?.text ?? "<anonymous>"}`);
    }
  }
  return violations;
};

describe("TC-BLK-001 blocker vocabulary is pinned as data", () => {
  test("the live contract matches every declared datum", () => {
    expect(audit(live())).toEqual([]);
  });

  test("audiences are the delivered owner-gate seam vocabulary", () => {
    expect(BLOCKER_AUDIENCES).toBe(OWNER_GATE_SLA_AUDIENCES);
    expect([...BLOCKER_AUDIENCES]).toEqual([...OWNER_GATE_SLA_AUDIENCES]);
  });

  test("the render caps are reused by reference from the status digest", () => {
    expect(BLOCKERS_MAX_QUESTIONS).toBe(STATUS_MAX_ITEMS_PER_SECTION);
    expect(BLOCKERS_MAX_MACHINE_BYTES).toBe(STATUS_MAX_MACHINE_BYTES);
    expect(BLOCKERS_MAX_HUMAN_LINES).toBe(STATUS_MAX_HUMAN_LINES);
    expect(BLOCKERS_MAX_HUMAN_BYTES).toBe(STATUS_MAX_HUMAN_BYTES);
  });

  test("the variable-name shape accepts names and refuses values or prose", () => {
    const pattern = new RegExp(BLOCKER_VARIABLE_NAME_PATTERN);
    for (const name of ["EXAMPLE_PRODUCT_GITHUB_TOKEN", "GITHUB_TOKEN", "X"]) {
      expect(pattern.test(name), name).toBe(true);
    }
    for (const text of [
      "Set EXAMPLE_PRODUCT_GITHUB_TOKEN=abc123 in the environment",
      "GITHUB_TOKEN=abc123",
      "token: abc123",
      "the value is hunter2",
      "GitHub_Token",
      "",
    ]) {
      expect(pattern.test(text), text).toBe(false);
    }
  });

  test("per-datum deep-copy mutations fail by name", () => {
    const cases: readonly [string, (snapshot: ContractSnapshot) => void][] = [
      ["BLOCKER_QUESTION_TYPES", (s) => (s.types as string[]).push("fifth-type")],
      [
        "BLOCKER_ANSWER_CHANNEL_BY_TYPE",
        (s) => ((s.channels as Record<string, string>)["external-wait"] = "choice"),
      ],
      ["BLOCKER_AUDIENCES", (s) => (s.audiences as string[]).push("human")],
      [
        "BLOCKER_PRIORITY_BY_TYPE",
        (s) => ((s.priorities as Record<string, number>)["external-wait"] = 1),
      ],
      ["BLOCKER_RESUME_MODES", (s) => (s.modes as string[]).push("custom-mode")],
      ["BLOCKER_CAPABILITY_SOURCES", (s) => (s.sources as string[]).push("third-source")],
      [
        "BLOCKER_SESSION_REENTRY_BY_MODE",
        (s) => ((s.reentry as Record<string, boolean>)["boundary-note"] = true),
      ],
      [
        "BLOCKER_DEFAULT_AUDIENCE",
        (s) => ((s as { defaultAudience: string }).defaultAudience = "owner"),
      ],
      [
        "BLOCKER_VARIABLE_NAME_PATTERN",
        (s) => ((s as { namePattern: string }).namePattern = "^.*$"),
      ],
      ["BLOCKER_MAX_QUESTION_CHARS", (s) => ((s.caps as Record<string, number>).question = 121)],
      [
        "BLOCKER_QUESTION_PAYLOAD_SCHEMA",
        (s) => ((s as { questionSchema: string }).questionSchema = "delivery.blocker.question.v2"),
      ],
      [
        "BLOCKER_ANSWER_RECORD_KIND",
        (s) => ((s as { answerKind: string }).answerKind = "blocker.response"),
      ],
      ["BLOCKERS_ERROR_CODES", (s) => (s.errors as string[]).push("blockers.extra-code")],
      [
        "BLOCKER_CALLER_AUDIENCE_SUFFIX",
        (s) => ((s as { callerSuffix: string }).callerSuffix = "AUDIENCE"),
      ],
    ];
    for (const [name, mutate] of cases) {
      const snapshot = clone(live());
      mutate(snapshot);
      expect(
        audit(snapshot).some((line) => line.startsWith(name)),
        name,
      ).toBe(true);
    }
  });
});

describe("TC-BLK-002 delegation policy-as-data is closed and mutation-live", () => {
  test("the shipped map declares all four combinations with one refusal", () => {
    expect(audit(live())).toEqual([]);
    const refused = BLOCKER_DELEGATION_POLICY_ROWS.filter((row) => !row.allowed);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({
      questionAudience: "coordinator",
      answeringAudience: "owner",
      policy: "none",
    });
  });

  test("flipping a refusal to allowed is detected as drift", () => {
    const snapshot = clone(live());
    const row = (snapshot.policy as { allowed: boolean }[]).find(
      (candidate) => candidate.allowed === false,
    );
    if (row === undefined) throw new Error("no refused row");
    row.allowed = true;
    expect(audit(snapshot).some((line) => line.startsWith("BLOCKER_DELEGATION_POLICY_ROWS"))).toBe(
      true,
    );
  });

  test("removing a row and adding a fifth key are detected as drift", () => {
    const removed = clone(live());
    (removed.policy as unknown[]).pop();
    expect(audit(removed).some((line) => line.startsWith("BLOCKER_DELEGATION_POLICY_ROWS"))).toBe(
      true,
    );

    const extra = clone(live());
    (extra.policy as unknown[]).push({
      questionAudience: "owner",
      answeringAudience: "owner",
      allowed: true,
      policy: "allowed",
    });
    expect(audit(extra).some((line) => line.startsWith("BLOCKER_DELEGATION_POLICY_ROWS"))).toBe(
      true,
    );
  });

  test("the production map is never mutated by a deep copy", () => {
    const before = JSON.stringify(BLOCKER_DELEGATION_POLICY_ROWS);
    const copy = clone(live());
    (copy.policy[0] as { allowed: boolean }).allowed = false;
    expect(JSON.stringify(BLOCKER_DELEGATION_POLICY_ROWS)).toBe(before);
  });
});

describe("TC-BLK-003 contracts are declaration-only and inventory-registered", () => {
  test("the blockers contracts module is data-only", () => {
    const text = readFileSync(join(ROOT, CONTRACT), "utf8");
    expect(declarationViolations(text)).toEqual([]);
  });

  test("an executable declaration fails the detector by name", () => {
    const text = `${readFileSync(join(ROOT, CONTRACT), "utf8")}\nexport function rogue(): number {\n  return 1;\n}\n`;
    expect(declarationViolations(text).some((line) => line.includes("rogue"))).toBe(true);
  });

  test("the contracts module is exported through the existing subpath and inventoried", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(inventory.core).toContain("src/contracts/blockers.ts");
    const index = readFileSync(join(ROOT, "packages/core/src/contracts/index.ts"), "utf8");
    expect(index).toContain('from "./blockers.js"');
    expect(BLOCKER_QUESTION_TYPES).toHaveLength(4);
  });
});

describe("TC-BLK-002 delegation resolver reads the injected map", () => {
  test("the shipped map allows owner->coordinator and same-audience answers", () => {
    const policy = shippedPolicy();
    expect(resolveBlockerDelegation(policy, "owner", "owner")).toEqual({
      allowed: true,
      policy: "allowed",
      declared: true,
    });
    expect(resolveBlockerDelegation(policy, "owner", "coordinator")).toEqual({
      allowed: true,
      policy: "allowed",
      declared: true,
    });
    expect(resolveBlockerDelegation(policy, "coordinator", "coordinator")).toEqual({
      allowed: true,
      policy: "allowed",
      declared: true,
    });
    expect(resolveBlockerDelegation(policy, "coordinator", "owner")).toEqual({
      allowed: false,
      policy: "none",
      declared: true,
    });
  });

  test("flipping the refusal is live; a missing row is a declared refusal", () => {
    expect(resolveBlockerDelegation(coordinatorOwnerAllowed(), "coordinator", "owner")).toEqual({
      allowed: true,
      policy: "allowed",
      declared: true,
    });
    expect(resolveBlockerDelegation(missingCoordinatorOwner(), "coordinator", "owner")).toEqual({
      allowed: false,
      policy: "none",
      declared: false,
    });
    expect(validateBlockerDelegationPolicy(missingCoordinatorOwner())).toContain(
      "missing-combination",
    );
    expect(validateBlockerDelegationPolicy(withFifthRow())).toContain("duplicate-combination");
    expect(validateBlockerDelegationPolicy(shippedPolicy())).toEqual([]);
  });

  test("the production map remains unchanged after mutation controls", () => {
    const before = JSON.stringify(BLOCKER_DELEGATION_POLICY_ROWS);
    resolveBlockerDelegation(coordinatorOwnerAllowed(), "coordinator", "owner");
    expect(JSON.stringify(BLOCKER_DELEGATION_POLICY_ROWS)).toBe(before);
  });
});

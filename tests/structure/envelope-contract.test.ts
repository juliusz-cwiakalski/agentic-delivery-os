/**
 * TC-META-004 / TC-META-005 — the closed v1 payload, brand-neutral constants,
 * the adapter-only write path, and the DEC-9 codec placement.
 */
import { describe, expect, test } from "bun:test";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import {
  ENVELOPE_FIELD_NAME,
  isClosedV1Payload,
  serializeEnvelope,
} from "../../packages/adapters/src/io/envelope-codec";
import {
  type CommentWriteRequest,
  ENVELOPE_SCHEMA_ID,
} from "../../packages/core/src/contracts/index";
import { matchSeedLiteral } from "../../scripts/checks/forbidden-literals";

const ROOT = process.cwd();
const CONTRACTS_DIR = "packages/core/src/contracts";
const CODEC_DIR = "packages/adapters/src/io";
const SEEDS = ["ados", "ADOS_", "~/.ados"];
const CANARY = 'canary-9f3a-quoted"-backslash\\-material';

const schemaCases = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/envelope/schema-cases.json"), "utf8"),
) as { valid: unknown; invalid: Array<{ id: string; payload: unknown }> };

const listFiles = (root: string, relativeDir: string): string[] => {
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) {
        results.push(next);
      }
    }
  };
  walk(relativeDir);
  return results.sort();
};

/** Structural placement check: the codec is adapter-internal, never core. */
export const codecPlacementViolations = (root: string): string[] => {
  const failures: string[] = [];
  const codecPath = join(root, CODEC_DIR, "envelope-codec.ts");
  try {
    readFileSync(codecPath, "utf8");
  } catch {
    failures.push(`${CODEC_DIR}/envelope-codec.ts: the pure codec is missing`);
  }
  for (const file of listFiles(root, CONTRACTS_DIR)) {
    const text = readFileSync(join(root, file), "utf8");
    for (const marker of ["serializeEnvelope", "parseEnvelope", "stripEnvelope"]) {
      if (text.includes(`export const ${marker}`) || text.includes(`export function ${marker}`)) {
        failures.push(`${file}: codec behaviour ${marker} hoisted into the contracts tier`);
      }
    }
  }
  if (readFileSync(join(root, "packages/adapters/package.json"), "utf8").includes('"./io"')) {
    failures.push("packages/adapters/package.json: the codec must not gain a declared subpath");
  }
  for (const file of listFiles(root, "packages")) {
    if (!readFileSync(join(root, file), "utf8").includes("envelope-codec")) continue;
    if (!file.startsWith(`${CODEC_DIR}/`)) {
      failures.push(`${file}: production import of the adapter-internal codec`);
    }
  }
  return failures;
};

/** Agent-facing views must not expose raw carrier construction. */
export const agentFacingViolations = (text: string): string[] => {
  const source = ts.createSourceFile(
    "envelope.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const failures: string[] = [];
  const allowed = new Map<string, readonly string[]>([
    ["CommentWriteRequest", ["body", "provenance", "delivery"]],
    ["CommentReadView", ["body", "provenance", "degradation"]],
  ]);
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || !allowed.has(statement.name.text)) continue;
    const members = ts.isTypeLiteralNode(statement.type) ? statement.type.members : [];
    for (const member of members) {
      if (!ts.isPropertySignature(member)) continue;
      const name = member.name.getText(source);
      if (!(allowed.get(statement.name.text) ?? []).includes(name)) {
        failures.push(`${statement.name.text}: unexpected agent-facing field ${name}`);
      }
    }
  }
  return failures;
};

const makeHoistCopy = (): string => {
  const root = mkdtempSync(join(tmpdir(), "codec-placement-"));
  mkdirSync(join(root, "packages"), { recursive: true });
  cpSync(join(ROOT, "packages/core/src/contracts"), join(root, CONTRACTS_DIR), { recursive: true });
  mkdirSync(join(root, CODEC_DIR), { recursive: true });
  cpSync(join(ROOT, CODEC_DIR, "envelope-codec.ts"), join(root, CODEC_DIR, "envelope-codec.ts"));
  mkdirSync(join(root, "packages/adapters"), { recursive: true });
  writeFileSync(
    join(root, "packages/adapters/package.json"),
    JSON.stringify({ name: "@delivery-os/adapters", exports: {} }),
  );
  return root;
};

describe("TC-META-004 closed payload and neutral constants", () => {
  test("the canonical payload is closed and every invalid shape is rejected", () => {
    expect(isClosedV1Payload(schemaCases.valid)).toBe(true);
    for (const invalid of schemaCases.invalid) {
      expect(isClosedV1Payload(invalid.payload), invalid.id).toBe(false);
    }
  });

  test("the schema admits no secret, credential, environment, or token field", () => {
    const keys: string[] = [];
    const collect = (value: unknown): void => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return;
      for (const [key, nested] of Object.entries(value)) {
        keys.push(key);
        collect(nested);
      }
    };
    collect(schemaCases.valid);
    expect(keys.sort()).toEqual(
      ["comment", "delivery", "operatorAuthority", "producingAgent", "runId", "workItemRef"].sort(),
    );
    expect(keys.join(" ")).not.toMatch(/secret|credential|password|token|environment/i);
  });

  test("a credential canary never enters a serialized envelope", () => {
    const request: CommentWriteRequest = {
      body: "body",
      provenance: { producingAgent: "claude-code", operatorAuthority: "operator:juliusz" },
      delivery: { workItemRef: "GH-181", runId: "run-1" },
    };
    const serialized = serializeEnvelope({
      envelope: {
        schema: ENVELOPE_SCHEMA_ID,
        kind: "work-item-comment",
        payload: { comment: request.provenance, delivery: request.delivery },
      },
      carrier: "invisible-comment-block",
      humanContent: request.body,
    });
    expect(serialized.ok).toBe(true);
    const text = serialized.ok ? JSON.stringify(serialized.carrier) : "";
    expect(text).not.toContain(CANARY);
    expect(text).not.toContain(JSON.stringify(CANARY));
  });

  test("markers follow the brand-neutral `delivery.*.v1` discipline", () => {
    expect(ENVELOPE_SCHEMA_ID).toMatch(/^delivery\.[a-z0-9]+\.v1$/);
    expect(ENVELOPE_FIELD_NAME).toMatch(/^delivery\.[a-z0-9]+\.v1$/);
    for (const file of [`${CONTRACTS_DIR}/envelope.ts`, `${CODEC_DIR}/envelope-codec.ts`]) {
      expect(matchSeedLiteral(readFileSync(join(ROOT, file), "utf8"), SEEDS), file).toBeUndefined();
    }
  });

  test("embedding a product token in a marker fails the forbidden-literal scan", () => {
    expect(matchSeedLiteral(`<!-- ${SEEDS[0]}.metadata.v1 {} -->`, SEEDS)).toBe(SEEDS[0]);
  });
});

describe("TC-META-005 adapter-only write path", () => {
  test("agent-facing views expose no raw carrier, marker, or serializer field", () => {
    expect(
      agentFacingViolations(readFileSync(join(ROOT, CONTRACTS_DIR, "envelope.ts"), "utf8")),
    ).toEqual([]);
  });

  test("the codec lives adapter-internally with no production cross-boundary edge", () => {
    expect(codecPlacementViolations(ROOT)).toEqual([]);
  });

  test("hoisting the codec into the contracts tier is detectable", () => {
    const root = makeHoistCopy();
    try {
      const path = join(root, CONTRACTS_DIR, "envelope-codec.ts");
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, 'export const serializeEnvelope = (): string => "";\n');
      const failures = codecPlacementViolations(root);
      expect(failures.some((message) => message.includes("hoisted"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("adding a raw writer to an agent-facing view is detectable", () => {
    const text = readFileSync(join(ROOT, CONTRACTS_DIR, "envelope.ts"), "utf8").replace(
      "export type CommentWriteRequest = {\n  readonly body: string;",
      "export type CommentWriteRequest = {\n  readonly rawCarrier: string;\n  readonly body: string;",
    );
    expect(agentFacingViolations(text).some((message) => message.includes("rawCarrier"))).toBe(
      true,
    );
  });
});

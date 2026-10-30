/**
 * Fixture source strings for TC-SECRET-001/004.
 *
 * Every fixture materialises in a `mkdtemp` workspace, never under `packages/**`
 * and never named `*.test.ts`.
 */
import { SECRET_READ_RULE } from "../../../scripts/checks/secret-read-boundary";

export type SecretReadCase = {
  readonly id: string;
  readonly tc: string;
  readonly expect: "violation" | "clean";
  readonly rule: string;
  readonly files: Readonly<Record<string, string>>;
  readonly assertFile: string;
};

const providerFile = (source: string): Record<string, string> => ({
  "packages/adapters/src/github/provider.ts": source,
});

export const SECRET_READ_CASES: readonly SecretReadCase[] = [
  {
    id: "planted-process-env",
    tc: "TC-SECRET-001",
    expect: "violation",
    rule: SECRET_READ_RULE,
    files: providerFile("export const secret = process.env.SECRET;\n"),
    assertFile: "packages/adapters/src/github/provider.ts",
  },
  {
    id: "bun-env",
    tc: "TC-SECRET-001",
    expect: "violation",
    rule: SECRET_READ_RULE,
    files: providerFile("export const secret = Bun.env.SECRET;\n"),
    assertFile: "packages/adapters/src/github/provider.ts",
  },
  {
    id: "deno-env",
    tc: "TC-SECRET-001",
    expect: "violation",
    rule: SECRET_READ_RULE,
    files: providerFile('export const secret = Deno.env.get("SECRET");\n'),
    assertFile: "packages/adapters/src/github/provider.ts",
  },
  {
    id: "bracket-env",
    tc: "TC-SECRET-001",
    expect: "violation",
    rule: SECRET_READ_RULE,
    files: providerFile('export const secret = process["env"]["SECRET"];\n'),
    assertFile: "packages/adapters/src/github/provider.ts",
  },
  {
    id: "optional-chaining",
    tc: "TC-SECRET-001",
    expect: "violation",
    rule: SECRET_READ_RULE,
    files: providerFile("export const secret = process?.env?.SECRET;\n"),
    assertFile: "packages/adapters/src/github/provider.ts",
  },
  {
    id: "destructured-env",
    tc: "TC-SECRET-001",
    expect: "violation",
    rule: SECRET_READ_RULE,
    files: providerFile("const { SECRET } = process.env;\nexport const secret = SECRET;\n"),
    assertFile: "packages/adapters/src/github/provider.ts",
  },
  {
    id: "aliased-global",
    tc: "TC-SECRET-001",
    expect: "violation",
    rule: SECRET_READ_RULE,
    files: providerFile("const aliased = process;\nexport const secret = aliased;\n"),
    assertFile: "packages/adapters/src/github/provider.ts",
  },
  {
    id: "global-element-access",
    tc: "TC-SECRET-001",
    expect: "violation",
    rule: SECRET_READ_RULE,
    files: providerFile('export const secret = globalThis["process"].env.SECRET;\n'),
    assertFile: "packages/adapters/src/github/provider.ts",
  },
  {
    id: "computed-key-env",
    tc: "TC-SECRET-001",
    expect: "violation",
    rule: SECRET_READ_RULE,
    files: providerFile('export const secret = process[readKey("env")].SECRET;\n'),
    assertFile: "packages/adapters/src/github/provider.ts",
  },
  {
    id: "template-literal-key-env",
    tc: "TC-SECRET-001",
    expect: "violation",
    rule: SECRET_READ_RULE,
    files: providerFile("export const secret = process[`env`].SECRET;\n"),
    assertFile: "packages/adapters/src/github/provider.ts",
  },
  {
    id: "computed-global-name",
    tc: "TC-SECRET-001",
    expect: "violation",
    rule: SECRET_READ_RULE,
    files: providerFile("export const secret = globalThis[globalName()].env.SECRET;\n"),
    assertFile: "packages/adapters/src/github/provider.ts",
  },
  {
    id: "node-process-import",
    tc: "TC-SECRET-001",
    expect: "violation",
    rule: SECRET_READ_RULE,
    files: providerFile(
      'import process from "node:process";\nexport const secret = process.env;\n',
    ),
    assertFile: "packages/adapters/src/github/provider.ts",
  },
  {
    id: "clean-sanctioned-readers",
    tc: "TC-SECRET-004",
    expect: "clean",
    rule: SECRET_READ_RULE,
    files: {
      "packages/adapters/src/credentials/index.ts":
        "export const credential = process.env.CREDENTIAL;\n",
      "packages/adapters/src/file/yaml-parser.ts":
        "export const blocked = Boolean(process.env.LOG_TOKENS);\n",
      "packages/adapters/src/legacy/index.ts": "export const legacy = process.env.LEGACY;\n",
    },
    assertFile: "packages/adapters/src/credentials/index.ts",
  },
];

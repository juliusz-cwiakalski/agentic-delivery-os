/**
 * Test support for the privacy guard: hermetic temp repositories, tree
 * snapshots, and mutant check/module copies. No live repository file is ever
 * written; every fixture tree is removed in teardown.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { runPrivacyScan, type ScanOutcome } from "../../scripts/checks/privacy-literals";
import type { RegistryLike } from "../fixtures/privacy-literals/registry";
import {
  LIVE_REGISTRY_PATH,
  type RegistryLike as Registry,
} from "../fixtures/privacy-literals/registry";

export const ROOT = process.cwd();
export const CHECK_PATH = "scripts/checks/privacy-literals.ts";
export const MODULE_PATH = "packages/adapters/src/io/privacy-rules.ts";

export type PrivacyRepo = {
  readonly root: string;
  readonly write: (relative: string, content: string) => void;
  readonly writeRegistry: (registry: Registry | string) => void;
  readonly git: (args: string[]) => string;
  readonly cleanup: () => void;
};

export const readLiveRegistry = (): RegistryLike =>
  JSON.parse(readFileSync(join(ROOT, LIVE_REGISTRY_PATH), "utf8")) as RegistryLike;

const writeInto = (root: string, relative: string, content: string): void => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

const defaultAllowlistTargets = (root: string): void => {
  const registry = readLiveRegistry();
  for (const entry of registry.allowlist) {
    if (entry.kind === "directory") {
      writeInto(root, `${entry.path}/__fixture__.txt`, "synthetic fixture content\n");
    } else {
      writeInto(root, entry.path, "synthetic fixture content\n");
    }
  }
  for (const entry of registry.exclusions) {
    writeInto(root, entry.path, "lockfileVersion: '9.0'\n");
  }
};

/** Create a committed temp repository with the live allowlist targets present. */
export const createPrivacyRepo = (
  files: Record<string, string> = {},
  options: { readonly registry?: Registry | string; readonly commitBaseline?: boolean } = {},
): PrivacyRepo => {
  const root = mkdtempSync(join(tmpdir(), "privacy-fixture-"));
  writeInto(
    root,
    "package.json",
    '{\n  "name": "synthetic-privacy-fixture",\n  "private": true\n}\n',
  );
  writeInto(root, ".gitignore", "node_modules/\nignored/\n");
  defaultAllowlistTargets(root);
  const registry = options.registry ?? readLiveRegistry();
  writeInto(
    root,
    LIVE_REGISTRY_PATH,
    typeof registry === "string" ? registry : `${JSON.stringify(registry, null, 2)}\n`,
  );
  for (const [relative, content] of Object.entries(files)) writeInto(root, relative, content);
  const git = (args: string[]): string => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
    }
    return (result.stdout ?? "").trim();
  };
  git(["init", "-q"]);
  git(["config", "user.email", "fixture@example.invalid"]);
  git(["config", "user.name", "Synthetic Fixture"]);
  if (options.commitBaseline === true) {
    git(["add", "-A"]);
    git(["commit", "-qm", "baseline"]);
  }
  return {
    root,
    write: (relative, content) => writeInto(root, relative, content),
    writeRegistry: (next) =>
      writeInto(
        root,
        LIVE_REGISTRY_PATH,
        typeof next === "string" ? next : `${JSON.stringify(next, null, 2)}\n`,
      ),
    git,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

export const scan = (root: string): ScanOutcome => runPrivacyScan(root);

export const runCheck = (
  root: string,
  args: readonly string[] = [],
  env: NodeJS.ProcessEnv = process.env,
): { readonly status: number | null; readonly stdout: string; readonly stderr: string } => {
  const result = spawnSync("bun", ["run", join(ROOT, CHECK_PATH), ...args], {
    cwd: root,
    encoding: "utf8",
    env,
    input: "",
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

export const runAuthoring = (
  input: string,
  args: readonly string[] = [],
  env: NodeJS.ProcessEnv = process.env,
): { readonly status: number | null; readonly stdout: string; readonly stderr: string } => {
  const result = spawnSync("bun", ["run", join(ROOT, CHECK_PATH), "--author", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env,
    input,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

export const withoutCiEnvironment = (env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => {
  const copy: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (key === "CI" || key === "GITHUB_ACTIONS") continue;
    copy[key] = value;
  }
  return copy;
};

/** Content-and-mode snapshot (tracked plus untracked-not-ignored files). */
export const snapshotTree = (root: string): Map<string, string> => {
  const snapshot = new Map<string, string>();
  const result = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" },
  );
  const files = (result.stdout ?? "")
    .split("\0")
    .filter((file) => file.length > 0)
    .sort();
  for (const file of files) {
    const path = join(root, file);
    const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
    snapshot.set(file, `${digest}:${statSync(path).mode}`);
  }
  return snapshot;
};

export const gitStatus = (root: string): string =>
  execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();

/** Replace the body of an exported arrow function, preserving its signature. */
export const mutateArrowFunction = (source: string, name: string, body: string): string => {
  const marker = `export const ${name} = `;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`function not found: ${name}`);
  const open = source.indexOf("(", start);
  if (open < 0) throw new Error(`parameter list not found: ${name}`);
  let depth = 0;
  let close = open;
  for (; close < source.length; close += 1) {
    if (source[close] === "(") depth += 1;
    else if (source[close] === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const arrow = source.indexOf("=>", close);
  if (arrow < 0) throw new Error(`arrow not found: ${name}`);
  let cursor = arrow + 2;
  while (cursor < source.length && /\s/.test(source[cursor] as string)) cursor += 1;
  if (source[cursor] === "{") {
    let braces = 0;
    let index = cursor;
    for (; index < source.length; index += 1) {
      if (source[index] === "{") braces += 1;
      else if (source[index] === "}") {
        braces -= 1;
        if (braces === 0) break;
      }
    }
    return `${source.slice(0, cursor)}{ ${body} }${source.slice(index + 1)}`;
  }
  const terminating = source.indexOf(";", cursor);
  if (terminating < 0) throw new Error(`function body end not found: ${name}`);
  return `${source.slice(0, cursor)}{ ${body} }${source.slice(terminating)}`;
};

export type MutantOptions = {
  /** Replace module exported-function bodies with the supplied body text. */
  readonly moduleMutations?: readonly { readonly name: string; readonly body: string }[];
  /** Literal replacements applied to the shared module source. */
  readonly moduleReplacements?: readonly {
    readonly search: string;
    readonly replacement: string;
  }[];
  /** Literal replacements applied to the check source. */
  readonly replacements?: readonly { readonly search: string; readonly replacement: string }[];
};

export type MutantCheck = {
  readonly root: string;
  readonly checkPath: string;
  readonly importCheck: () => Promise<typeof import("../../scripts/checks/privacy-literals")>;
  readonly cleanup: () => void;
};

let mutantCounter = 0;

/**
 * Build a temp copy of the check plus a temp copy of the shared module. The
 * copies are imported through a file URL so mutation tests never touch the live
 * modules.
 */
export const makeMutantCheck = (options: MutantOptions = {}): MutantCheck => {
  const root = mkdtempSync(join(tmpdir(), "privacy-mutant-"));
  let moduleSource = readFileSync(join(ROOT, MODULE_PATH), "utf8");
  for (const replacement of options.moduleReplacements ?? []) {
    moduleSource = moduleSource.replace(replacement.search, replacement.replacement);
  }
  for (const mutation of options.moduleMutations ?? []) {
    moduleSource = mutateArrowFunction(moduleSource, mutation.name, mutation.body);
  }
  writeInto(root, "packages/adapters/src/io/privacy-rules-mutant.ts", moduleSource);
  let checkSource = readFileSync(join(ROOT, CHECK_PATH), "utf8").replace(
    "../../packages/adapters/src/io/privacy-rules.js",
    "../../packages/adapters/src/io/privacy-rules-mutant.js",
  );
  for (const replacement of options.replacements ?? []) {
    checkSource = checkSource.replace(replacement.search, replacement.replacement);
  }
  const checkPath = join(root, "scripts/checks/privacy-literals-mutant.ts");
  writeInto(root, "scripts/checks/privacy-literals-mutant.ts", checkSource);
  const version = mutantCounter;
  mutantCounter += 1;
  return {
    root,
    checkPath,
    importCheck: () =>
      import(`${pathToFileURL(checkPath).href}?v=${version}`) as Promise<
        typeof import("../../scripts/checks/privacy-literals")
      >,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

/** Recursively walk every string key and value of a parsed JSON document. */
export const collectStrings = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      out.push(key);
      collectStrings(item, out);
    }
  }
  return out;
};

/** Every fixed-length window of a body at the supplied lengths. */
export const candidateWindows = (body: string, lengths: readonly number[]): string[] => {
  const windows: string[] = [];
  for (const length of lengths) {
    for (let index = 0; index + length <= body.length; index += 1) {
      windows.push(body.slice(index, index + length));
    }
  }
  return windows;
};

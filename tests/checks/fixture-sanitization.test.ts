/**
 * TC-FIXTURE-001/002 — the fixture sanitization audit plus its canary.
 *
 * `scan(root)` is the production logic the canary exercises. Committed provider
 * fixtures may contain only declared placeholders and example/reserved hosts;
 * each planted secret/PII shape must fail naming the file, line, and detail.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fixtureReferences, loadTrapCatalog } from "../behaviour/providers/trap-harness";
import { CLEAN_CANARY, SANITIZATION_CANARIES } from "../fixtures/providers/sanitization/cases";

const ROOT = process.cwd();
const PROVIDERS = "tests/fixtures/providers";
const PLACEHOLDERS_PATH = `${PROVIDERS}/sanitization/placeholders.json`;
const TRAPS = `${PROVIDERS}/traps`;
const PROVIDER_NAMES = ["jira", "gitlab", "github"] as const;

export type SanitizationFinding = {
  readonly file: string;
  readonly line: number;
  readonly detail: string;
};

const SHAPES: readonly { readonly detail: string; readonly regex: RegExp }[] = [
  { detail: "authorization bearer header", regex: /Authorization"\s*:\s*"Bearer\s+[^\s"]+/gi },
  { detail: "github token", regex: /\bghp_[A-Za-z0-9]{16,}\b/g },
  { detail: "gitlab token", regex: /\bglpat-[A-Za-z0-9_-]{16,}\b/g },
  { detail: "atlassian token", regex: /\bATATT3?[A-Za-z0-9_-]{10,}\b/g },
  { detail: "PEM private key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { detail: "email address", regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { detail: "avatar URL", regex: /avatars\.githubusercontent\.com|secure\.gravatar\.com/g },
  {
    detail: "private repository reference",
    regex: /\b(?:github|gitlab)\.com\/[A-Za-z0-9_.-]+\//g,
  },
];

const URL_REGEX = /https?:\/\/([^/"\s]+)/g;
const PLACEHOLDER_TOKEN = /[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*-placeholder\b|\bacct-\d+\b/gi;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const lineAt = (text: string, index: number): number => text.slice(0, index).split("\n").length;

const hostAllowed = (host: string): boolean =>
  host === "localhost" ||
  /\.(example|invalid|test)$/.test(host) ||
  /^(?:[a-z0-9-]+\.)*example\.(com|org|net)$/.test(host);

const listJson = (root: string, relative: string): string[] => {
  if (!existsSync(join(root, relative))) return [];
  const files: string[] = [];
  for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
    const path = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      // The audit's own inputs are not provider fixtures.
      if (entry.name === "sanitization") continue;
      files.push(...listJson(root, path));
    } else if (entry.name.endsWith(".json")) {
      files.push(path);
    }
  }
  return files.sort();
};

/** Every committed provider fixture in the audit scope. */
export const scopedFixtureFiles = (root: string): string[] => listJson(root, PROVIDERS);

export const readPlaceholders = (root: string): string[] | undefined => {
  if (!existsSync(join(root, PLACEHOLDERS_PATH))) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(join(root, PLACEHOLDERS_PATH), "utf8"));
  if (!isRecord(parsed) || !Array.isArray(parsed.placeholders)) return undefined;
  return parsed.placeholders.filter((entry): entry is string => typeof entry === "string");
};

/** The audit: committed fixtures contain no secret, PII, or live-tenant host. */
export const scan = (root: string): SanitizationFinding[] => {
  const findings: SanitizationFinding[] = [];
  const placeholders = readPlaceholders(root);
  if (placeholders === undefined) {
    return [{ file: PLACEHOLDERS_PATH, line: 1, detail: "placeholder registry is missing" }];
  }
  const files = scopedFixtureFiles(root);
  if (files.length === 0) {
    findings.push({ file: PROVIDERS, line: 1, detail: "scan scope is empty" });
  }
  const used = new Set<string>();
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    for (const shape of SHAPES) {
      for (const match of text.matchAll(shape.regex)) {
        findings.push({ file, line: lineAt(text, match.index ?? 0), detail: shape.detail });
      }
    }
    for (const match of text.matchAll(URL_REGEX)) {
      const host = match[1];
      if (host !== undefined && !hostAllowed(host)) {
        findings.push({
          file,
          line: lineAt(text, match.index ?? 0),
          detail: "non-example provider host",
        });
      }
    }
    for (const match of text.matchAll(PLACEHOLDER_TOKEN)) {
      const token = match[0];
      used.add(token);
      if (!placeholders.includes(token)) {
        findings.push({
          file,
          line: lineAt(text, match.index ?? 0),
          detail: `undeclared placeholder ${token}`,
        });
      }
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isRecord(parsed) || typeof parsed.provenance !== "string") {
        findings.push({ file, line: 1, detail: "missing provenance marker" });
      }
    } catch {
      findings.push({ file, line: 1, detail: "fixture is not valid JSON" });
    }
  }
  for (const placeholder of placeholders) {
    if (!used.has(placeholder)) {
      findings.push({
        file: PLACEHOLDERS_PATH,
        line: 1,
        detail: `stale placeholder ${placeholder}`,
      });
    }
  }
  return findings;
};

const gitStatus = (): string =>
  spawnSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).stdout ?? "";

const writeRegistry = (root: string, placeholders: readonly string[]): void => {
  const path = join(root, PLACEHOLDERS_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ placeholders })}\n`);
};

const writeFixture = (root: string, relative: string, content: string): void => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

describe("TC-FIXTURE-001 committed fixtures are sanitized", () => {
  test("the real provider fixture tree is clean and non-vacuous", () => {
    expect(scopedFixtureFiles(ROOT).length).toBeGreaterThan(0);
    expect(scan(ROOT)).toEqual([]);
  });

  test("every declared placeholder is used by the committed fixtures", () => {
    const placeholders = readPlaceholders(ROOT);
    if (placeholders === undefined) throw new Error("placeholder registry is missing");
    expect(placeholders.length).toBeGreaterThan(0);
    const corpus = scopedFixtureFiles(ROOT)
      .map((file) => readFileSync(join(ROOT, file), "utf8"))
      .join("\n");
    for (const placeholder of placeholders) {
      expect(corpus, placeholder).toContain(placeholder);
    }
  });

  test("trap-catalog references resolve to committed fixtures under the scan scope", () => {
    for (const provider of PROVIDER_NAMES) {
      const catalog = loadTrapCatalog(TRAPS, provider);
      for (const entry of catalog.entries) {
        const references = fixtureReferences(entry);
        expect(references.length, entry.trapName).toBeGreaterThan(0);
        for (const reference of references) {
          const path = reference.split("#")[0] ?? reference;
          expect(path.startsWith(`${PROVIDERS}/`), reference).toBe(true);
          expect(existsSync(join(ROOT, path)), reference).toBe(true);
        }
      }
    }
  });

  test("the audit is read-only", () => {
    const before = gitStatus();
    scan(ROOT);
    expect(gitStatus()).toBe(before);
  });
});

describe("TC-FIXTURE-002 the sanitization canary fires", () => {
  test("each planted shape fails naming file, line, and detail", () => {
    for (const canary of SANITIZATION_CANARIES) {
      const root = mkdtempSync(join(tmpdir(), "fixture-sanitization-"));
      try {
        writeRegistry(root, []);
        writeFixture(root, canary.file, canary.content);
        const findings = scan(root);
        const hit = findings.find(
          (finding) => finding.file === canary.file && finding.detail.includes(canary.detail),
        );
        expect(hit, canary.id).toBeDefined();
        expect(hit?.line, canary.id).toBeGreaterThan(0);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("a clean control passes, and an empty scope is reported", () => {
    const root = mkdtempSync(join(tmpdir(), "fixture-sanitization-clean-"));
    try {
      writeRegistry(root, [...CLEAN_CANARY.placeholders]);
      writeFixture(root, CLEAN_CANARY.file, CLEAN_CANARY.content);
      expect(scan(root)).toEqual([]);
      rmSync(join(root, CLEAN_CANARY.file));
      expect(scan(root).some((finding) => finding.detail.includes("scan scope is empty"))).toBe(
        true,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

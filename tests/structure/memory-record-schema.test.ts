/**
 * GH-301 schema parity, backfill fidelity, and (from phase 4) whole-tree
 * conformance (TC-MEMSCHEMA-001, TC-MEMPROV-002, TC-MEMSCHEMA-003).
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { scanMemoryTree } from "../../packages/adapters/src/file/memory-scan";
import {
  CAPSULE_CANDIDATE_STATUSES,
  CAPSULE_CANDIDATE_TRUST,
  CAPSULE_EVIDENCE_PREFIXES,
  HINT_MAX_CHARS,
  MEMORY_ARCHIVE_INDEX_MAX_LINES,
  MEMORY_ENTRY_MAX_LINES,
  MEMORY_INDEX_MAX_BYTES,
  MEMORY_INDEX_MAX_LINES,
  MEMORY_RECORD_BASIS_VALUES,
  MEMORY_RECORD_CAPSULE_STATUSES,
  MEMORY_RECORD_EVIDENCE_PREFIXES,
  MEMORY_RECORD_HOME_BY_KIND,
  MEMORY_RECORD_KINDS,
  MEMORY_RECORD_OPTIONAL_KEYS,
  MEMORY_RECORD_REQUIRED_KEYS,
  MEMORY_RECORD_SCOPES,
  MEMORY_RECORD_SOURCES,
  MEMORY_RECORD_STATUSES,
  MEMORY_RECORD_TRUST,
  MEMORY_ROOT,
  STATEMENT_MAX_CHARS,
} from "../../packages/core/src/contracts/index";
import { frontmatterOf, relativeToMemory } from "../fixtures/memory/tree";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");
const README = read(".ai/memory/README.md");
const CAPSULE_CONTRACT = read("packages/core/src/contracts/capsule.ts");

const requiredExampleKeys = (readme: string): string[] => {
  const block = /Required spine[^\n]*\n[\s\S]*?```yaml\n([\s\S]*?)```/.exec(readme)?.[1];
  if (block === undefined) return [];
  const lines = block.split("\n");
  if (lines[0]?.trim() === "---") lines.shift();
  while (lines.at(-1)?.trim() === "---" || lines.at(-1)?.trim() === "") lines.pop();
  const parsed: unknown = parse(lines.join("\n"));
  return typeof parsed === "object" && parsed !== null
    ? Object.keys(parsed as Record<string, unknown>)
    : [];
};

const optionalKeyList = (readme: string): string[] => {
  const section = /Optional keys \(closed set\):([\s\S]*?)\n\n/.exec(readme)?.[1] ?? "";
  return [...section.matchAll(/`([a-z_]+)`/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
};

/** Return the required-spine parity defects for one published key list. */
export const requiredSpineViolations = (
  machineRequired: readonly string[],
  published: readonly string[],
): string[] => {
  const violations: string[] = [];
  for (const key of machineRequired) {
    if (!published.includes(key)) violations.push(`required key ${key} is not published`);
  }
  for (const key of published) {
    if (!machineRequired.includes(key)) violations.push(`published key ${key} is not required`);
  }
  return violations;
};

describe("TC-MEMSCHEMA-001 human and machine schema parity", () => {
  test("required spine, closed optional set, and every vocabulary agree", () => {
    expect(
      requiredSpineViolations(MEMORY_RECORD_REQUIRED_KEYS, requiredExampleKeys(README)),
    ).toEqual([]);
    expect([...optionalKeyList(README)].sort()).toEqual([...MEMORY_RECORD_OPTIONAL_KEYS].sort());
    for (const value of [
      ...MEMORY_RECORD_KINDS,
      ...MEMORY_RECORD_SCOPES,
      ...MEMORY_RECORD_STATUSES,
      ...MEMORY_RECORD_SOURCES,
      ...MEMORY_RECORD_TRUST,
      ...MEMORY_RECORD_BASIS_VALUES,
      ...MEMORY_RECORD_EVIDENCE_PREFIXES,
    ]) {
      expect(README).toContain(value);
    }
    expect(README).toContain("human rendering");
    expect(README).toContain("Reconciliation runs one way");
  });

  test("capsule overlap is asserted only where the capsule exposes a vocabulary", () => {
    expect(MEMORY_RECORD_TRUST).toEqual(CAPSULE_CANDIDATE_TRUST);
    expect(MEMORY_RECORD_EVIDENCE_PREFIXES).toEqual(CAPSULE_EVIDENCE_PREFIXES);
    expect(MEMORY_RECORD_CAPSULE_STATUSES).toEqual(CAPSULE_CANDIDATE_STATUSES);
    for (const status of CAPSULE_CANDIDATE_STATUSES) {
      expect(MEMORY_RECORD_STATUSES).toContain(status);
    }
    // The capsule candidate contract carries no `source` vocabulary.
    expect(/\bCAPSULE_[A-Z_]*SOURCE/.test(CAPSULE_CONTRACT)).toBe(false);
  });

  test("the reconciliation table names every DM-6 capsule element", () => {
    const labels = [
      "Candidate required key set",
      "Candidate trust vocabulary",
      "Candidate evidence shapes",
      "Memory-record read projection",
      "Promotion write content",
      "Promotion read scope",
      "Projection rule — non-projectable scope",
      "Capsule events, candidate file naming, terminal close",
    ];
    for (const label of labels) expect(README).toContain(label);
  });

  test("the parity helper fails when a required key is unpublished", () => {
    const violations = requiredSpineViolations(
      MEMORY_RECORD_REQUIRED_KEYS,
      requiredExampleKeys(README).filter((key) => key !== "id"),
    );
    expect(violations).toContain("required key id is not published");
  });
});

const MIGRATED = [
  {
    path: ".ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md",
    id: "lesson-2026-001",
    statement:
      "The ci-baseline-parity check (git clone --local hardlink assertion) fails when TMPDIR sits on a different filesystem from the checkout; run local gates with a repo-local TMPDIR (TMPDIR=$PWD/tmp/tmpdir with tmp/tmpdir present), not the host /tmp.",
    status: "candidate",
    body: "Four independent M1 lanes (GH-221, GH-226, GH-222, GH-229) each rediscovered this and recorded it in pm-notes before it was promoted. Canonical local gate: ensure tmp/tmpdir exists, then TMPDIR=$PWD/tmp/tmpdir pnpm check.",
  },
  {
    path: ".ai/memory/lessons/lesson-2026-002-github-mcp-write-auth-fallback.md",
    id: "lesson-2026-002",
    statement:
      "The github-mcp server's write tools fail with 'Requires authentication' while its reads work; all tracker writes (labels, comments, transitions) must go through the gh CLI, which is authenticated with repo scope.",
    status: "candidate",
    body: "Recorded independently by three lanes (GH-221, GH-226, GH-222). Reads via MCP remain usable; writes do not. Do not block delivery on MCP write auth: route through gh CLI and record the fallback in pm-notes.",
  },
  {
    path: ".ai/memory/lessons/lesson-2026-003-pm-notes-born-gate-conformant.md",
    id: "lesson-2026-003",
    statement:
      'Write pm-notes gate-conformant from creation: full ISO timestamps with time zone (never date-only), worktree ".", never absolute worktree paths; repairing format mid-lane costs a fix-forward iteration through lint and privacy gates.',
    status: "candidate",
    body: "The lint exists because this mistake class recurred in M0; GH-221 recurred against it in M1. Born-conformant beats repaired-later.",
  },
] as const;

const recordParts = (text: string): { fields: Record<string, unknown>; body: string } => {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (match?.[1] === undefined || match[2] === undefined) return { fields: {}, body: "" };
  return { fields: (parse(match[1]) ?? {}) as Record<string, unknown>, body: match[2].trim() };
};

describe("TC-MEMPROV-002 migrated record backfill fidelity", () => {
  test("each migrated lesson gains trust and a shaped link with unchanged meaning", () => {
    for (const record of MIGRATED) {
      const { fields, body } = recordParts(read(record.path));
      expect(fields.id).toBe(record.id);
      expect(fields.statement).toBe(record.statement);
      expect(fields.status).toBe(record.status);
      expect(fields.trust).toBe("T4");
      expect(String(fields.evidence).startsWith("merged-pr: ")).toBe(true);
      expect(body).toBe(record.body);
    }
  });

  test("the delivered tree still has exactly the three migrated lessons", () => {
    const lessons = readdirSync(join(ROOT, ".ai/memory/lessons"))
      .filter((name) => name.endsWith(".md"))
      .sort();
    expect(lessons).toEqual(MIGRATED.map((record) => record.path.split("/").at(-1) as string));
  });
});

describe("TC-MEMSCHEMA-003 whole-tree conformance at the delivered HEAD", () => {
  test("the check exits zero with no schema findings and a summary", () => {
    const run = spawnSync("bun", ["run", "scripts/checks/memory-lint.ts"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(run.status).toBe(0);
    expect(run.stdout).not.toContain("memory.schema.");
    expect(run.stdout).toContain("memory-lint: records=");
  });

  test("every record renders the required spine and its kind matches its area", () => {
    const files = scanMemoryTree(ROOT, MEMORY_ROOT).files;
    const records = files.filter((file) => {
      const relative = relativeToMemory(file.path);
      return (
        /^(?:lessons|tacit|preferences)\/[^/]+\.md$/.test(relative) ||
        /^guilds\/[^/]+\/[^/]+\.md$/.test(relative)
      );
    });
    expect(records.length).toBeGreaterThan(0);
    const rendered = new Set<string>();
    for (const file of records) {
      const relative = relativeToMemory(file.path);
      const fields =
        file.frontmatter.state === "parsed" ? file.frontmatter.value : frontmatterOf(file.text);
      const value =
        typeof fields === "object" && fields !== null && "state" in fields ? {} : fields;
      for (const key of MEMORY_RECORD_REQUIRED_KEYS) {
        expect({ path: file.path, key, present: Object.hasOwn(value, key) }).toEqual({
          path: file.path,
          key,
          present: true,
        });
        rendered.add(key);
      }
      const kind = String((value as Record<string, unknown>).kind);
      const area = relative.split("/")[0];
      if (relative.startsWith("guilds/")) {
        expect((value as Record<string, unknown>).guild).toBe(relative.split("/")[1]);
      } else {
        expect(MEMORY_RECORD_HOME_BY_KIND[kind as keyof typeof MEMORY_RECORD_HOME_BY_KIND]).toBe(
          area,
        );
      }
    }
    const drift = MEMORY_RECORD_REQUIRED_KEYS.filter((key) => !rendered.has(key));
    expect(drift).toEqual([]);
  });
});

describe("TC-MEMWRITE-003 curator rules agree with the schema", () => {
  test("the skill names the schema, id rule, transitions, budgets, and row shape", () => {
    const skill = read(".opencode/skills/consolidate-memory/SKILL.md");
    for (const key of MEMORY_RECORD_REQUIRED_KEYS) expect(skill).toContain(key);
    for (const status of MEMORY_RECORD_STATUSES) expect(skill).toContain(status);
    expect(skill).toContain(String(STATEMENT_MAX_CHARS));
    expect(skill).toContain(String(HINT_MAX_CHARS));
    expect(skill).toContain(String(MEMORY_INDEX_MAX_LINES));
    expect(skill).toContain(String(MEMORY_INDEX_MAX_BYTES / 1024));
    expect(skill).toContain(String(MEMORY_ENTRY_MAX_LINES));
    expect(skill).toContain(String(MEMORY_ARCHIVE_INDEX_MAX_LINES));
    expect(skill).toContain("read-when hint");
    expect(skill).toContain("One row per covered path");
    expect(skill).toContain("no directory rows");
    expect(skill).toContain("archive index");
    for (const operation of [
      "duplicate merge",
      "demote or drop",
      "mark supersession",
      "prune stale",
      "topic files",
      "rebuild the index",
    ]) {
      expect(skill).toContain(operation);
    }
    expect(/\bvalid_from\b/.test(skill)).toBe(false);
  });
});

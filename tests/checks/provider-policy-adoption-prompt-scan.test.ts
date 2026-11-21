/**
 * GH-374 TC-POL-SCAN-004, TC-POL-SCAN-006, TC-POL-SCAN-007 — the full-roster
 * prompt-identifier scan, the generated Claude Code pair proof, and the
 * pre-change regression arm.
 *
 * The scan treats a prompt as data: it reports a provider-qualified expression
 * or a model-anchored family id used as a value, and it never reports a bare
 * family name in prose or the documented `claude.model` frontmatter (a
 * tool-specific assignment contract, not provider policy). Every family class
 * requires a model token after the family name, so the generator path
 * `scripts/build-claude-plugin.sh` in the generated file's provenance header
 * cannot match — that anchoring is asserted by value here.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const AGENTS_DIRECTORY = ".opencode/agent";
const AGENTS_INCLUDE = [AGENTS_DIRECTORY] as const;
const TOOLSMITH_SOURCE = ".opencode/agent/toolsmith.md";
const TOOLSMITH_GENERATED = ".ados-claude/agents/toolsmith.md";
const TOOLSMITH_ROSTER_SIZE = 24;
const RESERVED_TMP_ROOT = "tmp/tmpdir";

/* --------------------------- the identifier table ------------------------- */

export type PromptIdentifierClass = {
  /** The closed class id reported in a finding. */
  readonly id: string;
  /** `provider` is a provider-qualified prefix; `family` is model-anchored. */
  readonly kind: "provider" | "family";
  /** Case-sensitive: the declared lowercase forms only. */
  readonly pattern: RegExp;
};

/**
 * The declared identifier table (spec v1.5, AC-F2-2): five provider-qualified
 * expressions and five MODEL-ANCHORED family classes. No class is a bare
 * prefix: each family class requires a model token after the family name, so a
 * tool or script name (`build-claude-plugin.sh`) never matches.
 */
export const PROMPT_IDENTIFIER_CLASSES: readonly PromptIdentifierClass[] = [
  { id: "provider.zai-coding-plan", kind: "provider", pattern: /zai-coding-plan\//g },
  { id: "provider.deepseek", kind: "provider", pattern: /deepseek\//g },
  { id: "provider.openai", kind: "provider", pattern: /openai\//g },
  { id: "provider.anthropic", kind: "provider", pattern: /anthropic\//g },
  { id: "provider.gemini", kind: "provider", pattern: /gemini\//g },
  { id: "family.claude", kind: "family", pattern: /claude-(?:opus|sonnet|haiku|[0-9])/g },
  { id: "family.gemini", kind: "family", pattern: /gemini-[0-9]/g },
  { id: "family.gpt", kind: "family", pattern: /gpt-[0-9]/g },
  { id: "family.glm", kind: "family", pattern: /glm-[0-9]/g },
  { id: "family.deepseek", kind: "family", pattern: /deepseek-[a-z0-9]/g },
] as const;

/**
 * The two declared carve-outs, exported by value so widening or narrowing one
 * fails by name. A bare family name in prose is not a literal, and the
 * documented Claude Code `claude.model: opus|sonnet|haiku` frontmatter is a
 * tool-specific assignment contract that carries no provider qualifier and
 * assigns no Jaiship route (AGENTS.md), so it is outside the scan.
 */
export const PROMPT_SCAN_CARVE_OUTS = [
  {
    id: "bare-family-prose",
    reason:
      "a bare family name in prose (for example the glm family, Claude Opus) is not a provider/model identifier",
  },
  {
    id: "claude.model",
    reason:
      "the documented Claude Code frontmatter claude.model: opus|sonnet|haiku is a tool-specific assignment contract, carries no provider qualifier, and assigns no Jaiship route (AGENTS.md)",
  },
] as const;

/** The `.opencode/command/**` tree is outside this scan by declaration. */
export const PROMPT_SCAN_EXCLUDED = [".opencode/command"] as const;

export type PromptFinding = {
  readonly path: string;
  readonly line: number;
  readonly classId: string;
  readonly kind: PromptIdentifierClass["kind"];
  readonly text: string;
};

export type PromptScanRefusal = {
  readonly ok: false;
  readonly code: "prompt-scan.empty-include" | "prompt-scan.missing-root";
  readonly summary: string;
};

export type PromptScanReport =
  | {
      readonly ok: true;
      readonly findings: readonly PromptFinding[];
      readonly scanned: readonly string[];
    }
  | PromptScanRefusal;

/** Scan one text as data; each class contributes at most one finding per line. */
export const scanPromptText = (path: string, text: string): readonly PromptFinding[] => {
  const findings: PromptFinding[] = [];
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    for (const classe of PROMPT_IDENTIFIER_CLASSES) {
      classe.pattern.lastIndex = 0;
      if (!classe.pattern.test(line)) continue;
      findings.push({
        path,
        line: index + 1,
        classId: classe.id,
        kind: classe.kind,
        text: line.trim(),
      });
    }
  }
  return findings;
};

/**
 * The exported scan seam (TC-POL-SCAN-003): an empty include set is a scan
 * defect, never a pass, and a missing root is refused by name.
 */
export const scanPromptSamples = (input: {
  readonly samples: readonly { readonly path: string; readonly text: string }[];
  readonly include: readonly string[];
  readonly rootExists?: (path: string) => boolean;
}): PromptScanReport => {
  if (input.include.length === 0) {
    return {
      ok: false,
      code: "prompt-scan.empty-include",
      summary: "an empty prompt-scan include set is a scan defect, never a pass",
    };
  }
  const rootExists = input.rootExists ?? (() => true);
  for (const root of input.include) {
    if (!rootExists(root)) {
      return {
        ok: false,
        code: "prompt-scan.missing-root",
        summary: `prompt-scan include root ${root} does not exist`,
      };
    }
  }
  const findings: PromptFinding[] = [];
  const scanned: string[] = [];
  for (const sample of input.samples) {
    if (!input.include.some((root) => sample.path.startsWith(root))) continue;
    scanned.push(sample.path);
    findings.push(...scanPromptText(sample.path, sample.text));
  }
  return { ok: true, findings, scanned };
};

/** Enumerate the real roster from the prompt directory at assertion time. */
export const readRoster = (): readonly { readonly path: string; readonly text: string }[] =>
  readdirSync(join(ROOT, AGENTS_DIRECTORY))
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => ({
      path: `${AGENTS_DIRECTORY}/${name}`,
      text: readFileSync(join(ROOT, AGENTS_DIRECTORY, name), "utf8"),
    }));

/** The prompt body: everything from the first frontmatter key line onward. */
export const promptBody = (text: string): string => {
  const lines = text.split("\n");
  const start = lines.findIndex(
    (line, index) => index > 0 && /^[A-Za-z][A-Za-z0-9_-]*:/.test(line) && !line.startsWith("#"),
  );
  return start < 0 ? "" : lines.slice(start).join("\n");
};

const headerLines = (text: string): readonly string[] => text.split("\n").slice(0, 8);

const digests = (directory: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const name of readdirSync(join(ROOT, directory)).sort()) {
    const text = readFileSync(join(ROOT, directory, name));
    result[name] = createHash("sha256").update(text).digest("hex");
  }
  return result;
};

const scratch = (label: string): { readonly root: string; cleanup(): void } => {
  const root = join(ROOT, RESERVED_TMP_ROOT, `gh374-prompt-scan-${label}-${process.pid}`);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
};

/* ------------------------------ SCAN-004 --------------------------------- */

describe("GH-374 TC-POL-SCAN-004 the full roster holds zero provider/model identifiers", () => {
  test("24 prompts are scanned and report zero findings for all ten classes", () => {
    const roster = readRoster();
    expect(roster).toHaveLength(TOOLSMITH_ROSTER_SIZE);
    expect(roster.filter((entry) => entry.path === TOOLSMITH_SOURCE)).toHaveLength(1);
    const report = scanPromptSamples({ samples: roster, include: AGENTS_INCLUDE });
    if (!report.ok) throw new Error(report.summary);
    expect(report.scanned).toHaveLength(TOOLSMITH_ROSTER_SIZE);
    expect(report.findings).toEqual([]);
    expect(
      scanPromptText(TOOLSMITH_SOURCE, readFileSync(join(ROOT, TOOLSMITH_SOURCE), "utf8")),
    ).toEqual([]);
  });

  test("the exported class table is five provider prefixes and five anchored family classes", () => {
    expect(PROMPT_IDENTIFIER_CLASSES.filter((entry) => entry.kind === "provider")).toHaveLength(5);
    expect(PROMPT_IDENTIFIER_CLASSES.filter((entry) => entry.kind === "family")).toHaveLength(5);
    for (const classe of PROMPT_IDENTIFIER_CLASSES.filter((entry) => entry.kind === "family")) {
      const source = classe.pattern.source;
      // A family class is model-anchored: it names a token after the family.
      expect(source).toMatch(/(?:opus|sonnet|haiku|[0-9]|\[a-z0-9\])/);
      expect(source).not.toMatch(/^claude-$/);
    }
  });

  test("one planted sample per class is reported by the same scanner", () => {
    const samples = [
      { path: `${AGENTS_DIRECTORY}/a.md`, text: "model: zai-coding-plan/alpha" },
      { path: `${AGENTS_DIRECTORY}/b.md`, text: "model: deepseek/beta" },
      { path: `${AGENTS_DIRECTORY}/c.md`, text: "model: openai/gamma" },
      { path: `${AGENTS_DIRECTORY}/d.md`, text: "model: anthropic/delta" },
      { path: `${AGENTS_DIRECTORY}/e.md`, text: "model: gemini/epsilon" },
      { path: `${AGENTS_DIRECTORY}/f.md`, text: "model: claude-opus" },
      { path: `${AGENTS_DIRECTORY}/g.md`, text: "model: gemini-2" },
      { path: `${AGENTS_DIRECTORY}/h.md`, text: "model: gpt-4" },
      { path: `${AGENTS_DIRECTORY}/i.md`, text: "model: glm-5" },
      { path: `${AGENTS_DIRECTORY}/j.md`, text: "model: deepseek-x" },
    ] as const;
    const report = scanPromptSamples({ samples, include: AGENTS_INCLUDE });
    if (!report.ok) throw new Error(report.summary);
    expect(report.findings).toHaveLength(10);
    expect(new Set(report.findings.map((finding) => finding.classId))).toEqual(
      new Set(PROMPT_IDENTIFIER_CLASSES.map((classe) => classe.id)),
    );
    for (const finding of report.findings) {
      expect(finding.line).toBe(1);
    }
  });

  test("the two carve-outs are declared by value and are not reported", () => {
    expect(PROMPT_SCAN_CARVE_OUTS.map((entry) => entry.id)).toEqual([
      "bare-family-prose",
      "claude.model",
    ]);
    expect(PROMPT_SCAN_CARVE_OUTS[1]?.reason).toContain("claude.model");
    expect(PROMPT_SCAN_CARVE_OUTS[1]?.reason).toContain("tool-specific assignment contract");
    expect(PROMPT_SCAN_EXCLUDED).toEqual([".opencode/command"]);

    const prose = [
      "the glm family is expensive",
      "Claude Opus is a strong reasoning family",
      "model: opus",
      "claude:",
      "  model: opus",
    ].join("\n");
    expect(scanPromptText(`${AGENTS_DIRECTORY}/prose.md`, prose)).toEqual([]);
  });

  test("the generator path in the provenance header matches no declared class", () => {
    const headerLine = "# Regenerate with: scripts/build-claude-plugin.sh";
    expect(scanPromptText("header", headerLine)).toEqual([]);
    // The control: a broad bare-prefix class would report the generator path.
    expect(/claude-/.test(headerLine)).toBe(true);
  });
});

/* ------------------------------ SCAN-006 --------------------------------- */

describe("GH-374 TC-POL-SCAN-006 the generated toolsmith pair is build output", () => {
  test("the provenance header is the declared eight lines, in order", () => {
    const generated = readFileSync(join(ROOT, TOOLSMITH_GENERATED), "utf8");
    const lines = headerLines(generated);
    expect(lines[0]).toBe("---");
    expect(lines[1]).toBe("# GENERATED FILE — DO NOT EDIT DIRECTLY.");
    expect(lines[2]).toBe("# Source of truth: .opencode/agent/toolsmith.md");
    expect(lines[3]).toBe("# Regenerate with: scripts/build-claude-plugin.sh");
    expect(lines[4]).toBe("# If behavior must change, edit the source file above and rebuild.");
    expect(lines[5]).toContain("Copyright (c) 2025-2026");
    expect(lines[6]).toContain("Apache-2.0 License");
    expect(lines[7]?.startsWith("# source: ")).toBe(true);
  });

  test("the generated body contains no identifier its source body lacks, and both are empty", () => {
    const source = readFileSync(join(ROOT, TOOLSMITH_SOURCE), "utf8");
    const generated = readFileSync(join(ROOT, TOOLSMITH_GENERATED), "utf8");
    const sourceIdentifiers = scanPromptText("source-body", promptBody(source));
    const generatedIdentifiers = scanPromptText("generated-body", promptBody(generated));
    expect(sourceIdentifiers).toEqual([]);
    expect(generatedIdentifiers).toEqual([]);
    const generatedClasses = new Set(generatedIdentifiers.map((entry) => entry.classId));
    for (const finding of sourceIdentifiers) {
      expect(generatedClasses.has(finding.classId)).toBe(true);
    }
  });

  test("every neutral placeholder occurrence in the source appears in the generated body", () => {
    const sourceBody = promptBody(readFileSync(join(ROOT, TOOLSMITH_SOURCE), "utf8"));
    const generatedBody = promptBody(readFileSync(join(ROOT, TOOLSMITH_GENERATED), "utf8"));
    const placeholder = /<provider>\/<model>|<model>/g;
    const occurrences = sourceBody.match(placeholder) ?? [];
    expect(occurrences.length).toBeGreaterThan(0);
    expect(occurrences).toContain("<provider>/<model>");
    for (const occurrence of occurrences) {
      expect(generatedBody).toContain(occurrence);
    }
    expect(generatedBody).toContain("model: opus");
  });

  test("a hand-edited generated body fails the containment arm and a stale copy fails the build", () => {
    const temporary = scratch("pair");
    try {
      const source = readFileSync(join(ROOT, TOOLSMITH_SOURCE), "utf8");
      const generated = readFileSync(join(ROOT, TOOLSMITH_GENERATED), "utf8");
      const handEdited = generated.replace("model: opus", "model: deepseek-3.2");
      expect(handEdited).not.toBe(generated);
      const handEditedFindings = scanPromptText("edited-body", promptBody(handEdited));
      expect(handEditedFindings.map((entry) => entry.classId)).toContain("family.deepseek");
      // The source body carries no identifier, so the edited body's set is not
      // a subset of it: the containment arm fails by name.
      const sourceClasses = new Set(
        scanPromptText("source-body", promptBody(source)).map((entry) => entry.classId),
      );
      for (const finding of handEditedFindings) {
        expect(sourceClasses.has(finding.classId)).toBe(false);
      }
      // A stale pair is a source/generated disagreement, not a clean no-op.
      const staleGenerated = generated.replace("model: opus", "model: sonnet");
      writeFileSync(join(temporary.root, "source.md"), source);
      writeFileSync(join(temporary.root, "generated.md"), staleGenerated);
      expect(readFileSync(join(temporary.root, "generated.md"), "utf8")).not.toBe(generated);
    } finally {
      temporary.cleanup();
    }
  });

  test("a second generator run changes nothing and touches no other prompt", () => {
    const before = digests(".ados-claude/agents");
    execFileSync("scripts/build-claude-plugin.sh", [], { cwd: ROOT, stdio: "pipe" });
    const after = digests(".ados-claude/agents");
    expect(after).toEqual(before);
    // `git status` scoped to the two generated/source trees must name no path
    // outside this change's own prompt pair (empty on a committed tree).
    const status = execFileSync(
      "git",
      ["status", "--porcelain", "--", ".ados-claude", ".opencode"],
      { cwd: ROOT, encoding: "utf8" },
    )
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const allowed = new Set([`M ${TOOLSMITH_SOURCE}`, `M ${TOOLSMITH_GENERATED}`]);
    for (const line of status) {
      expect(allowed.has(line)).toBe(true);
    }
  });
});

/* ------------------------------ SCAN-007 --------------------------------- */

/**
 * The pre-change toolsmith text, reconstructed at the DoR review's line
 * evidence: `deepseek/deepseek-3.2` at 232 and 353, `deepseek-3.2` at 630 and
 * 717, `glm-4.7` at 655, `anthropic/claude-opus-4-5` at 232, 409 and 717,
 * `openai/gpt-5.2` at 232 and 409, `gpt-5.2`, `gemini-3.0-pro` at 638.
 * Reconstructed as inert sample lines at those exact indices so the regression
 * arm asserts line numbers and identifiers together.
 */
const PRE_CHANGE_LINES: readonly (readonly [number, string])[] = [
  [
    232,
    "model: <select based on task: anthropic/claude-opus-4-5 for complex reasoning/code, openai/gpt-5.2 for speed/chat, deepseek/deepseek-3.2 for cost-sensitive>",
  ],
  [353, "model: deepseek/deepseek-3.2"],
  [
    409,
    "model: <select based on task: anthropic/claude-opus-4-5 for complex, openai/gpt-5.2 for speed>",
  ],
  [630, '<model id="deepseek-3.2">'],
  [638, '<model id="gemini-3.0-pro">'],
  [655, '<model id="glm-4.7">'],
  [
    717,
    "<decision>Default to anthropic/claude-opus-4-5 for complex agents, gpt-5.2 for speed-critical tools, deepseek-3.2 for cost-sensitive batch tasks.</decision>",
  ],
] as const;

const preChangeText = (): string => {
  const lines: string[] = [];
  for (let index = 1; index <= 748; index += 1) {
    const recorded = PRE_CHANGE_LINES.find(([line]) => line === index);
    lines.push(recorded === undefined ? `<!-- line ${index} -->` : recorded[1]);
  }
  return lines.join("\n");
};

describe("GH-374 TC-POL-SCAN-007 the pre-change identifiers are reported by the same scanner", () => {
  test("every recorded pre-change identifier is reported, so the green roster is not blindness", () => {
    const report = scanPromptSamples({
      samples: [{ path: TOOLSMITH_SOURCE, text: preChangeText() }],
      include: AGENTS_INCLUDE,
    });
    if (!report.ok) throw new Error(report.summary);
    const atLine = (line: number): string =>
      report.findings
        .filter((entry) => entry.line === line)
        .map((entry) => entry.text)
        .join("\n");
    expect(atLine(232)).toContain("deepseek/deepseek-3.2");
    expect(atLine(232)).toContain("anthropic/claude-opus-4-5");
    expect(atLine(232)).toContain("openai/gpt-5.2");
    expect(atLine(353)).toContain("deepseek/deepseek-3.2");
    expect(atLine(409)).toContain("anthropic/claude-opus-4-5");
    expect(atLine(409)).toContain("openai/gpt-5.2");
    expect(atLine(630)).toContain("deepseek-3.2");
    expect(atLine(638)).toContain("gemini-3.0-pro");
    expect(atLine(655)).toContain("glm-4.7");
    expect(atLine(717)).toContain("deepseek-3.2");
    const identifiers = report.findings.map((entry) => entry.text).join("\n");
    for (const identifier of [
      "deepseek/deepseek-3.2",
      "anthropic/claude-opus-4-5",
      "gemini-3.0-pro",
      "openai/gpt-5.2",
      "gpt-5.2",
      "deepseek-3.2",
      "glm-4.7",
    ]) {
      expect(identifiers).toContain(identifier);
    }
    // The same zero-findings assertion the roster arm applies must FAIL here.
    expect(report.findings.length).toBeGreaterThan(0);
    expect(new Set(report.findings.map((entry) => entry.line))).toEqual(
      new Set([232, 353, 409, 630, 638, 655, 717]),
    );
  });

  test("the real toolsmith prompt no longer carries the ticket's four literals", () => {
    const text = readFileSync(join(ROOT, TOOLSMITH_SOURCE), "utf8");
    for (const literal of [
      "deepseek/deepseek-3.2",
      "anthropic/claude-opus-4-5",
      "gemini-3.0-pro",
      "glm-4.7",
    ]) {
      expect(text).not.toContain(literal);
    }
    expect(scanPromptText(TOOLSMITH_SOURCE, text)).toEqual([]);
  });
});

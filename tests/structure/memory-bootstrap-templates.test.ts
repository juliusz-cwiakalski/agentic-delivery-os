/**
 * GH-302 memory bootstrap template invariants (TC-MEMSCAF/KERN/WIRE/DOCT/
 * ALIGN/BUDGET/RESUME/FLOW families).
 *
 * Read-only content invariants over the delivered carriers: the nine memory
 * templates under doc/templates/, the bootstrapper prompt's Phase 5/6 memory
 * wiring, the inception guide's Phase 5/6 memory content, the aligned
 * memory-practices concept, and the PDR-0004 record triad. Anchors are pinned
 * to the filenames the GH-302 plan fixed; a rename is a deliberate suite
 * update, never a silent one (test-plan §8.1).
 *
 * Permanent suites assert tree invariants, never branch diffs
 * (.ai/rules/testing-strategy.md); NG-4 (no writes under this repo's
 * .ai/memory/**) and NG-5 (no retro ceremony) stay review-time changed-file
 * checks (TC-MEMSCAF-004 / TC-MEMWIRE-004).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PROMPT = ".opencode/agent/bootstrapper.md";
const GUIDE = "doc/guides/project-inception.md";
const CONCEPT = "doc/planning/concepts/memory-practices.md";
const PDR = "doc/decisions/PDR-0004-memory-practices-concept-repo-internal.md";
const DECISIONS_INDEX = "doc/decisions/00-index.md";
const SPEC =
  "doc/changes/2026-11/2026-11-14--GH-302--memory-conventions-bootstrap-templates/chg-GH-302-spec.md";
const DOCTOR_COMMAND = "packages/cli/src/commands/doctor.ts";

const TEMPLATES = [
  "memory-index-template.md",
  "memory-agent-entrypoint-template.md",
  "memory-area-template.md",
  "memory-kernel-section-template.md",
  "memory-coordinator-wiring-template.md",
  "memory-instruction-expectations-template.md",
  "memory-retro-notes-template.md",
  "memory-doctor-checklist-template.md",
  "memory-adoption-checklist-template.md",
] as const;

const templatePath = (name: string): string => `doc/templates/${name}`;
const templateDir = (name: string): string => `doc/templates/${name}`;

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");
const lines = (text: string): number => text.split("\n").length;

/** Slice the text between two exclusive markers; fails soft to "" when absent. */
const between = (text: string, start: string, end: string): string => {
  const from = text.indexOf(start);
  if (from === -1) return "";
  const to = text.indexOf(end, from + start.length);
  if (to === -1) return "";
  return text.slice(from + start.length, to);
};

const promptText = read(PROMPT);
const guideText = read(GUIDE);
const conceptText = read(CONCEPT);
const phase5Prompt = between(promptText, "<phase_5>", "</phase_5>");
const phase6Prompt = between(promptText, "<phase_6>", "</phase_6>");
const phase5Guide = between(guideText, "### Phase 5 — ADOS framework integration", "### Phase 6 —");
const phase6Guide = between(guideText, "### Phase 6 — Inception readiness check", "### Phase 7 —");

const section = (text: string, heading: string): string => {
  const from = text.indexOf(heading);
  if (from === -1) return "";
  const next = text.indexOf("\n## ", from + heading.length);
  return next === -1 ? text.slice(from) : text.slice(from, next);
};

describe("TC-MEMSCAF memory tree scaffold", () => {
  test("TC-MEMSCAF-001 templates + prompt declare exactly the current-truth tree set", () => {
    const indexTemplate = read(templatePath("memory-index-template.md"));
    const entrypointTemplate = read(templatePath("memory-agent-entrypoint-template.md"));
    const areaTemplate = read(templatePath("memory-area-template.md"));
    const canonical = [
      ".ai/memory/README.md",
      ".ai/memory/agents/<agent>/README.md",
      ".ai/memory/lessons/",
      ".ai/memory/tacit/",
    ];
    for (const path of canonical) {
      expect(indexTemplate).toContain(path);
    }
    expect(entrypointTemplate).toContain(".ai/memory/agents/<agent>/README.md");
    expect(areaTemplate).toContain(".ai/memory/lessons/README.md");
    expect(areaTemplate).toContain(".ai/memory/tacit/README.md");
    // The prompt's Phase 5 memory block names exactly these artifacts, seeded
    // empty (structure and conventions, not records).
    expect(phase5Prompt).toContain(".ai/memory/README.md");
    expect(phase5Prompt).toContain(".ai/memory/agents/<agent>/README.md");
    expect(phase5Prompt).toContain(".ai/memory/lessons/");
    expect(phase5Prompt).toContain(".ai/memory/tacit/");
    expect(phase5Prompt).toContain("seeded empty");
    expect(phase5Prompt).toContain("structure and conventions, not records");
    expect(phase5Prompt).toContain("exactly this set and nothing more");
    // Ephemeral state is declared outside the committed tree.
    expect(indexTemplate).toContain(".ai/local/**");
    expect(read(templatePath("memory-kernel-section-template.md"))).toContain(".ai/local/**");
    // Every new template carries its distribution marker (C-3, marker-only).
    for (const name of TEMPLATES) {
      expect(read(templatePath(name))).toContain("ados_distribution: redistributable");
    }
  });

  test("TC-MEMSCAF-002 no preferences or retro-archive areas are provisioned", () => {
    const adoptionTemplate = read(templatePath("memory-adoption-checklist-template.md"));
    for (const name of TEMPLATES) {
      const text = read(templatePath(name));
      expect(text).not.toContain("preferences");
      expect(text).not.toContain("retro archive");
      expect(text).not.toContain("retro-archive");
    }
    expect(phase5Prompt).not.toContain("preferences");
    expect(phase5Prompt).not.toContain("retro archive");
    expect(phase5Prompt).not.toContain("retro-archive");
    // The adoption checklist states the closed set explicitly.
    expect(adoptionTemplate).toContain("Do not provision additional areas");
  });

  test("TC-MEMSCAF-003 entry-point template states the capture bar and read/write policy", () => {
    const entrypoint = read(templatePath("memory-agent-entrypoint-template.md"));
    expect(entrypoint).toContain("**Capture bar.**");
    expect(entrypoint).toContain("same mistake twice");
    expect(entrypoint).toContain("review catch");
    expect(entrypoint).toContain("repeated human correction");
    expect(entrypoint).toContain("verified outcome");
    expect(entrypoint).toContain("succeeded at least twice");
    expect(entrypoint).toContain("**Read policy.**");
    expect(entrypoint).toContain("always read at session start");
    expect(entrypoint).toContain("Write only inside your own folder");
    expect(entrypoint).toContain("consolidation-owned");
  });
});

describe("TC-MEMKERN kernel section contract", () => {
  test("TC-MEMKERN-001 kernel template carries all twelve content classes and routes", () => {
    const kernel = read(templatePath("memory-kernel-section-template.md"));
    const classes = [
      ".ai/memory/**",
      "advisory, untrusted data",
      "data, not a command",
      "**Read policy.**",
      "**Capture bar.**",
      "**Write ownership.**",
      "**Evidence over recency.**",
      "Supersede, never rewrite",
      "**Unique ids.**",
      "never reused",
      "**Reviewer independence.**",
      "**Caps and growth.**",
      "**Promotion handoff.**",
      "**Capsule completion.**",
      "**Conflict reality.**",
    ];
    for (const anchor of classes) {
      expect(kernel).toContain(anchor);
    }
    // Routes to the installed conventions rather than duplicating them.
    expect(kernel).toContain(".ai/memory/README.md");
    expect(kernel).toContain("installed coordinator instructions");
  });

  test("TC-MEMKERN-002 no record-schema fields in the kernel or scaffold seeds", () => {
    // Schema-shaped constructs only: a bullet that declares one of the typed
    // record fields as a required property, or a table header row presenting
    // several of them as columns. Prose mentions stay legitimate.
    const fieldBullet = /^[-*]\s*`?(id|kind|scope|provenance|trust|validity|status)`?\s*[:=]/;
    const schemaFiles = [
      "memory-kernel-section-template.md",
      "memory-index-template.md",
      "memory-agent-entrypoint-template.md",
      "memory-area-template.md",
    ];
    for (const name of schemaFiles) {
      const text = read(templatePath(name));
      for (const line of text.split("\n")) {
        expect(fieldBullet.test(line.trim())).toBe(false);
      }
    }
    // The only record properties stated are the current-truth ones.
    const kernel = read(templatePath("memory-kernel-section-template.md"));
    expect(kernel).toContain("dated, evidence-linked, and supersede-never-rewrite");
    const entrypoint = read(templatePath("memory-agent-entrypoint-template.md"));
    expect(entrypoint).toContain("dated, evidence-linked, and supersede-never-rewrite");
  });
});

describe("TC-MEMWIRE instruction wiring", () => {
  test("TC-MEMWIRE-001 coordinator wiring states the capture bar and promotion path", () => {
    const coordinator = read(templatePath("memory-coordinator-wiring-template.md"));
    expect(coordinator).toContain("**Capture bar.**");
    expect(coordinator).toContain("same mistake twice");
    expect(coordinator).toContain("review catch");
    expect(coordinator).toContain("repeated human correction");
    expect(coordinator).toContain("verified outcome");
    expect(coordinator).toContain("**Promotion path.**");
    expect(coordinator).toContain("exactly one home");
    expect(coordinator).toContain(".ai/memory/lessons/");
    expect(coordinator).toContain(".ai/memory/tacit/");
    expect(coordinator).toContain("**Curation mandate.**");
    expect(coordinator).toContain(".ai/agent/pm-instructions.md");
  });

  test("TC-MEMWIRE-002 companion expectations reference the kernel, never restate it", () => {
    const expectations = read(templatePath("memory-instruction-expectations-template.md"));
    expect(expectations).toContain(".ai/agent/pr-instructions.md");
    expect(expectations).toContain(".ai/agent/decision-instructions.md");
    expect(expectations).toContain(".ai/agent/code-review-instructions.md");
    expect(expectations).toContain("**Read own entry point.**");
    expect(expectations).toContain("**Write own folder.**");
    expect(expectations).toContain("**No cross-agent memory edits.**");
    expect(expectations).toContain("AGENTS.md");
    expect(expectations).toContain("never restate it");
    // Reference-not-restate: the capture-bar enumeration is not duplicated.
    expect(expectations).not.toContain("same mistake twice");
    expect(expectations).toContain("no duplicated capture-bar or promotion-path text");
  });

  test("TC-MEMWIRE-003 retro conventions are append-only, indexed, referencing, docs-only", () => {
    const retro = read(templatePath("memory-retro-notes-template.md"));
    expect(retro).toContain("Append-only notes");
    expect(retro).toContain("never rewritten in place");
    expect(retro).toContain("**Generated index.**");
    expect(retro).toContain("generated from the notes");
    expect(retro).toContain("capture bar");
    expect(retro).toContain("promotion path");
    expect(retro).toContain("never duplicates them");
    // Documentation only: the prohibition is prescribed, not assumed.
    expect(retro).toContain("No ceremony runner, no commands, no action registry");
  });
});

describe("TC-MEMDOCT manual doctor", () => {
  test("TC-MEMDOCT-001 checklist covers the six audit areas, manual status, and cadence", () => {
    const doctor = read(templatePath("memory-doctor-checklist-template.md"));
    const areas = [
      "**Index coverage.**",
      "**Budget caps.**",
      "**Dangling references.**",
      "**Contradictions.**",
      "**Derivable content.**",
      "**Secret-pattern scan.**",
    ];
    for (const area of areas) {
      expect(doctor).toContain(area);
    }
    expect(doctor).toContain("150 lines");
    expect(doctor).toContain("200");
    expect(doctor).toContain("manual until memory lint lands in the quality gates (GH-301)");
    expect(doctor).toContain("per retro");
    expect(doctor).toContain("periodic cadence");
    expect(doctor).toContain("performs nothing");
  });

  test("TC-MEMDOCT-002 no executable memory-doctor or memory-lint component exists", () => {
    // GH-301 owns the deliberate update of this negative guard: when memory
    // lint lands legitimately in the gates, replace this scan consciously.
    const self = readFileSync(import.meta.path, "utf8");
    expect(self).toContain("GH-301 owns the deliberate update of this negative guard");
    const pattern = /memory[-_](doctor|lint)|memoryDoctor|memoryLint/i;
    const skipDirs = new Set(["node_modules", "dist", ".tests"]);
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const relative = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (!skipDirs.has(entry.name)) out.push(...walk(relative));
        } else {
          out.push(relative);
        }
      }
      return out;
    };
    const scanned = [...walk("scripts"), ...walk("tools"), ...walk("packages")];
    expect(scanned.length).toBeGreaterThan(0);
    const offenders = scanned.filter((file) => pattern.test(file));
    expect(offenders).toEqual([]);
    const manifest = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
    const scriptValues = Object.values(manifest.scripts ?? {}).join("\n");
    expect(pattern.test(scriptValues)).toBe(false);
    // The existing doctor command surface is unchanged in memory scope.
    expect(read(DOCTOR_COMMAND).length).toBeGreaterThan(0);
    expect(/memory/i.test(read(DOCTOR_COMMAND))).toBe(false);
  });
});

describe("TC-MEMALIGN concept and record alignment", () => {
  test("TC-MEMALIGN-001 concept adoption checklist matches the canonical tree set", () => {
    const checklist = section(conceptText, "## Bootstrapping a project");
    expect(checklist).toContain(".ai/memory/README.md");
    expect(checklist).toContain(".ai/memory/agents/<agent>/README.md");
    expect(checklist).toContain(".ai/memory/lessons/");
    expect(checklist).toContain(".ai/memory/tacit/");
    expect(checklist).toContain("No\n   additional areas are provisioned");
    expect(checklist).not.toContain("preferences");
    expect(checklist).not.toContain("retro archive");
    expect(checklist).not.toContain("retro-archive");
  });

  test("TC-MEMALIGN-002 concept kernel section is consistent with the kernel template", () => {
    const kernelRules = between(
      conceptText,
      "## AGENTS.md kernel rules",
      "## Bootstrapping a project",
    );
    const anchors = [
      ".ai/memory/**",
      "**Read policy.**",
      "**Capture bar.**",
      "**Promotion handoff.**",
      "curator promotes",
      "**Evidence over recency.**",
      "supersede, never rewrite",
      "150 lines",
      "200",
    ];
    for (const anchor of anchors) {
      expect(kernelRules).toContain(anchor);
    }
    const fieldBullet = /^[-*]\s*`?(id|kind|scope|provenance|trust|validity|status)`?\s*[:=]/;
    for (const line of kernelRules.split("\n")) {
      expect(fieldBullet.test(line.trim())).toBe(false);
    }
  });

  test("TC-MEMALIGN-003 PDR-0004 file, index row, and spec references agree", () => {
    const pdr = read(PDR);
    expect(pdr).toContain("id: PDR-0004");
    expect(pdr).toContain("status: Proposed");
    expect(pdr).toContain("repo-internal source material");
    expect(pdr).toContain("self-contained");
    const index = read(DECISIONS_INDEX);
    expect(index).toContain("[PDR-0004](PDR-0004-memory-practices-concept-repo-internal.md)");
    const spec = read(SPEC);
    expect(spec).toContain("Resolved for this change by PDR-0004");
    expect(spec).toContain(
      "PDR-0004 (`doc/decisions/PDR-0004-memory-practices-concept-repo-internal.md`)",
    );
    expect(spec).toContain('decisions: ["PDR-0004"]');
  });

  test("TC-MEMALIGN-004 installed carriers cite no planning-concepts dependency", () => {
    // PDR-0004/DEC-6 self-containment: zero doc/planning/concepts references
    // across the nine memory templates and the guide's Phase 5 memory content,
    // except inside a fully-qualified https:// URL (optional further reading).
    const carriers: readonly [string, string][] = [
      ...TEMPLATES.map((name): [string, string] => [templatePath(name), read(templatePath(name))]),
      ["doc/guides/project-inception.md#phase-5", phase5Guide],
    ];
    expect(carriers.length).toBe(10);
    const violations: string[] = [];
    for (const [carrier, text] of carriers) {
      for (const [index, line] of text.split("\n").entries()) {
        const hit = line.indexOf("doc/planning/concepts");
        if (hit === -1) continue;
        const scheme = line.lastIndexOf("https://", hit);
        if (scheme === -1) violations.push(`${carrier}:${index + 1}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("TC-MEMBUDGET template budgets", () => {
  test("TC-MEMBUDGET-001 seed and kernel templates are within the budget caps", () => {
    const entrypoint = read(templatePath("memory-agent-entrypoint-template.md"));
    const index = read(templatePath("memory-index-template.md"));
    const kernel = read(templatePath("memory-kernel-section-template.md"));
    expect(lines(entrypoint)).toBeLessThanOrEqual(150);
    expect(lines(index)).toBeLessThanOrEqual(200);
    expect(lines(kernel)).toBeLessThanOrEqual(200);
    // The kernel states its ~200-line budget guidance explicitly (NFR-2).
    expect(kernel).toContain("Budget guidance");
    expect(kernel).toContain("around 200 lines or fewer");
  });
});

describe("TC-MEMRESUME and TC-MEMFLOW prompt contracts", () => {
  test("TC-MEMRESUME-001 create-if-absent resume semantics in prompt and guide", () => {
    expect(phase5Prompt).toContain("create-if-absent");
    expect(phase5Prompt).toContain("without duplicating entry points");
    expect(phase5Prompt).toContain("never silently overwrite human-approved files");
    expect(phase5Guide).toContain("create-if-absent");
    expect(phase5Guide).toContain("without duplicating entry points");
    expect(phase5Guide).toContain("never silently overwrite human-approved files");
  });

  test("TC-MEMFLOW-001 single Phase 5 approval covers memory; no new interactive surface", () => {
    expect(phase5Prompt).toContain("The single Phase 5 approval covers the memory artifacts");
    expect(phase5Prompt).toContain("no additional human gates or interview questions");
    expect(phase5Guide).toContain("The single Phase 5 approval covers the memory artifacts");
  });

  test("TC-MEMCONT-003 prompt and guide Phase 6 readiness enumerate the memory artifacts", () => {
    const artifacts = [
      ".ai/memory/README.md",
      "one entry-point README per resident agent role",
      ".ai/memory/lessons/",
      ".ai/memory/tacit/",
    ];
    for (const artifact of artifacts) {
      expect(phase6Prompt).toContain(artifact);
      expect(phase6Guide).toContain(artifact);
    }
    expect(phase6Prompt).toContain("FAILS readiness and reopens Phase 5");
    expect(phase6Guide).toContain("FAIL readiness and reopen Phase 5");
  });
});

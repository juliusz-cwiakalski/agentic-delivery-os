/**
 * Deterministic prompt conformance scan (GH-242 F-9, NFR-4).
 *
 * Phase 5 stands up the plan-progress rule over the foundation lifecycle
 * prompts: no prompt writes plan progress or a `tasks` key, no prompt hand-edits
 * lifecycle phase state, and no lifecycle prompt teaches raw git writes. The
 * phase-8 extension adds the allowed-command, retained/retired, and secret rule
 * sets over the full prompt tree.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const PROMPT_INVENTORY_PATH = "tests/fixtures/prompt-inventory/lifecycle.json";

/** One rule's finding: the file, the rule, and the offending line. */
export type PromptFinding = {
  readonly file: string;
  readonly rule: string;
  readonly line: number;
  readonly text: string;
};

export type PromptFile = {
  readonly path: string;
  readonly required?: readonly string[];
  readonly forbidden?: readonly string[];
};

export type PromptInventory = {
  readonly schemaVersion: string;
  readonly scanRoots?: readonly string[];
  readonly prompts: readonly PromptFile[];
};

const NEGATIONS = [
  /\bnever\b/i,
  /\bnot\b/i,
  /\bdo not\b/i,
  /\bdon't\b/i,
  /\bmust not\b/i,
  /\bno\b/i,
];

const SENTENCE_BOUNDARY = /[.!?;](?=\s|$)/g;

/** The sentence that contains `index`; negation exempts a sentence, not a line. */
const sentenceAt = (text: string, index: number): string => {
  let start = 0;
  let end = text.length;
  for (const boundary of text.matchAll(SENTENCE_BOUNDARY)) {
    const at = boundary.index ?? 0;
    if (at < index) {
      start = at + 1;
      continue;
    }
    end = at + 1;
    break;
  }
  return text.slice(start, end);
};

const isNegated = (text: string, index = 0): boolean =>
  NEGATIONS.some((pattern) => pattern.test(sentenceAt(text, index)));

/** Every match of a rule on one line, in order. */
const matchesOf = (pattern: RegExp, line: string): readonly RegExpExecArray[] => {
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );
  return [...line.matchAll(global)];
};

/** The first occurrence of `literal` that its own sentence does not negate. */
const firstVisibleOccurrence = (text: string, literal: string): number => {
  const haystack = text.toLowerCase();
  const needle = literal.toLowerCase();
  let from = 0;
  for (;;) {
    const found = haystack.indexOf(needle, from);
    if (found < 0) return -1;
    if (!isNegated(text, found)) return found;
    from = found + needle.length;
  }
};

const RULES: readonly { readonly id: string; readonly pattern: RegExp }[] = [
  // Plan progress must not be written into the plan.
  {
    id: "plan.no-progress",
    pattern:
      /\b(tasks\s*:|add a `tasks` key|update (the )?plan file|\bplan update\b(?!s)|mark .*(plan .*(complete|done)|(complete|done).*plan))/i,
  },
  // Phase state is written only through the phase family.
  {
    id: "phase.no-hand-edit",
    pattern:
      /\b(mark|set|write|update|edit)\b.*\b(started|completed|reopened)\b.*\b(pm-notes|phases\.)/i,
  },
  { id: "phase.no-pr-url-write", pattern: /phases\.pr_creation\.url\s*[:=]/i },
  // Lifecycle prompts never teach raw git writes.
  { id: "git.no-raw-write", pattern: /\bgit\s+(add|commit|reset|stash|rebase)\b/i },
  { id: "retired.platform", pattern: /\b(gh pr merge|glab mr merge|gh pr list)\b/i },
];

/** Scan one prompt's text; negated prohibitions are allowed. */
export const scanPromptText = (file: string, text: string): readonly PromptFinding[] => {
  const findings: PromptFinding[] = [];
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    for (const rule of RULES) {
      const offending = matchesOf(rule.pattern, line).find(
        (match) => !isNegated(line, match.index),
      );
      if (offending === undefined) continue;
      findings.push({ file, rule: rule.id, line: index + 1, text: line.trim() });
    }
  }
  return findings;
};

/** Scan the inventory's required phrases and forbidden literals. */
export const scanInventory = (
  inventory: PromptInventory,
  read: (relative: string) => string,
): readonly PromptFinding[] => {
  const findings: PromptFinding[] = [];
  for (const prompt of inventory.prompts) {
    const text = read(prompt.path);
    findings.push(...scanPromptText(prompt.path, text));
    for (const required of prompt.required ?? []) {
      if (!text.toLowerCase().includes(required.toLowerCase())) {
        findings.push({
          file: prompt.path,
          rule: "required.phrase",
          line: 1,
          text: `missing required phrase: ${required}`,
        });
      }
    }
    for (const forbidden of prompt.forbidden ?? []) {
      const offending = text
        .split("\n")
        .findIndex((line) => firstVisibleOccurrence(line, forbidden) >= 0);
      if (offending >= 0) {
        findings.push({
          file: prompt.path,
          rule: "forbidden.literal",
          line: offending + 1,
          text: forbidden,
        });
      }
    }
  }
  return findings;
};

export const loadInventory = (root = process.cwd()): PromptInventory => {
  const parsed: unknown = JSON.parse(readFileSync(join(root, PROMPT_INVENTORY_PATH), "utf8"));
  return parsed as PromptInventory;
};

const promptFiles = (root: string, directory: string): readonly string[] => {
  const absolute = join(root, directory);
  const found: string[] = [];
  const walk = (relative: string): void => {
    const entries = (() => {
      try {
        return readdirSync(join(absolute, relative), { withFileTypes: true });
      } catch {
        return [];
      }
    })();
    for (const entry of entries) {
      const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".md")) found.push(`${directory}/${next}`);
    }
  };
  walk("");
  return found;
};

/** Scan every prompt under the declared roots plus the inventory's specific files. */
export const scanAllPrompts = (root = process.cwd()): readonly PromptFinding[] => {
  const inventory = loadInventory(root);
  const find = (relative: string): string => readFileSync(join(root, relative), "utf8");
  const findings: PromptFinding[] = [...scanInventory(inventory, find)];
  for (const directory of inventory.scanRoots ?? []) {
    for (const file of promptFiles(root, directory)) {
      findings.push(...scanPromptText(file, find(file)));
    }
  }
  const retired = JSON.parse(
    readFileSync(join(root, "tests/fixtures/prompt-inventory/retained-retired.json"), "utf8"),
  ) as { readonly retired: readonly { readonly literal: string }[] };
  const roots = inventory.scanRoots ?? [];
  for (const directory of roots) {
    for (const file of promptFiles(root, directory)) {
      const lines = find(file).split("\n");
      for (const [index, line] of lines.entries()) {
        for (const entry of retired.retired) {
          if (firstVisibleOccurrence(line, entry.literal) < 0) continue;
          findings.push({
            file,
            rule: "retired.literal",
            line: index + 1,
            text: entry.literal,
          });
        }
      }
    }
  }
  return findings;
};

export const runPromptConformance = (root = process.cwd()): readonly PromptFinding[] =>
  scanAllPrompts(root);

const isMain = (): boolean => {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
};

if (isMain()) {
  const findings = runPromptConformance();
  for (const finding of findings) {
    process.stderr.write(`${finding.file}:${finding.line}: ${finding.rule}: ${finding.text}\n`);
  }
  if (findings.length > 0) {
    process.stderr.write(`prompt-conformance: ${findings.length} violation(s)\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`prompt-conformance: ${loadInventory().prompts.length} prompt(s) clean\n`);
  }
}

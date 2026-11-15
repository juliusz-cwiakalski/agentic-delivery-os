/**
 * GH-301 secret findings from the delivered privacy vocabulary
 * (TC-MEMSECRET-001, TC-MEMSECRET-002).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  matchGenericRules,
  PRIVACY_RULES,
  PRIVACY_SUPPRESSION_CLASSES,
  suppressionValueFor,
} from "../../packages/adapters/src/io/privacy-rules";
import type {
  MemoryEvaluationResult,
  MemoryPrivacyVocabulary,
  MemoryScannedFile,
} from "../../packages/core/src/contracts/index";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import { secretTokenFor } from "../fixtures/memory/secrets";
import {
  archiveIndexReadme,
  indexReadme,
  indexRow,
  memoryFile,
  recordText,
  treeWith,
  validLessonFields,
} from "../fixtures/memory/tree";

const ROOT = process.cwd();
const TODAY = "2026-11-15";
const VOCABULARY: MemoryPrivacyVocabulary = {
  rules: PRIVACY_RULES.map((rule) => ({
    id: rule.id,
    recognizerClass: rule.recognizerClass,
    patternSource: rule.patternSource,
    flags: rule.flags,
    minimumMatchLength: rule.minimumMatchLength,
  })),
  suppressionClasses: PRIVACY_SUPPRESSION_CLASSES.map((entry) => ({
    id: entry.id,
    markers: entry.markers,
  })),
  suppressionValueFor,
};
const CLASSES = PRIVACY_RULES.map((rule) => rule.recognizerClass);

const evaluate = (files: readonly MemoryScannedFile[]): MemoryEvaluationResult =>
  evaluateMemory({ files, today: TODAY, privacy: VOCABULARY });

const recordWith = (token: string, relative = "lessons/lesson-2026-001-baseline.md") =>
  treeWith([
    {
      relative,
      text: recordText(validLessonFields(), `# note\n${token}\n`),
    },
  ]);

const secretFindings = (result: MemoryEvaluationResult) =>
  result.findings.filter((finding) => finding.area === "secret");

describe("TC-MEMSECRET-001 one finding per recognizer class", () => {
  for (const recognizerClass of CLASSES) {
    test(`${recognizerClass} yields one class finding and no value echo`, () => {
      const token = secretTokenFor(recognizerClass);
      const result = evaluate(recordWith(token));
      const findings = secretFindings(result);
      expect(findings.map((finding) => finding.ruleId)).toEqual([
        `memory.secret.${recognizerClass}`,
      ]);
      expect(findings[0]?.severity).toBe("error");
      expect(findings[0]?.line).toBeGreaterThan(0);
      expect(findings[0]?.detail).not.toContain(token);
      expect(findings[0]?.detail).not.toContain(token.slice(0, 12));
    });
  }

  test("the possible secret rule ids equal the vocabulary's recognizer classes", () => {
    const emitted = new Set<string>();
    for (const recognizerClass of CLASSES) {
      for (const finding of secretFindings(evaluate(recordWith(secretTokenFor(recognizerClass))))) {
        emitted.add(finding.ruleId);
      }
    }
    expect([...emitted].sort()).toEqual(CLASSES.map((entry) => `memory.secret.${entry}`).sort());
  });

  test("the scan covers entries, archive notes, and convention files", () => {
    const token = secretTokenFor("provider-token-prefix");
    const entry = [
      memoryFile("README.md", indexReadme([indexRow("agents/coder/README.md", "read it")])),
      memoryFile("agents/coder/README.md", `# coder\n\n- 2026-11-10: ${token}\n`),
    ];
    const archive = [
      memoryFile("README.md", indexReadme([indexRow("retro/INDEX.md", "read the archive")])),
      memoryFile(
        "retro/INDEX.md",
        archiveIndexReadme([indexRow("retro/2026/n.md", "read the note")]),
      ),
      memoryFile("retro/2026/n.md", `# note\n${token}\n`),
    ];
    const convention = [memoryFile("AGENTS.md", `## Agent memory\n${token}\n`)];
    for (const files of [entry, archive, convention]) {
      const findings = secretFindings(evaluate(files));
      expect(findings.map((finding) => finding.ruleId)).toEqual([
        "memory.secret.provider-token-prefix",
      ]);
    }
  });

  test("the fixture module itself is silent to the shared matcher", () => {
    const source = readFileSync(join(ROOT, "tests/fixtures/memory/secrets.ts"), "utf8");
    expect(matchGenericRules(source).filter((match) => match.suppressionClass === null)).toEqual(
      [],
    );
    const token = secretTokenFor("provider-token-prefix");
    const matches = matchGenericRules(token).filter((match) => match.suppressionClass === null);
    expect(matches.some((match) => match.id === "secret.provider-token-prefix")).toBe(true);
  });

  test("assembled positive tokens carry no suppression marker", () => {
    for (const recognizerClass of CLASSES) {
      const lowered = secretTokenFor(recognizerClass).toLowerCase();
      for (const entry of PRIVACY_SUPPRESSION_CLASSES) {
        for (const marker of entry.markers) {
          expect(lowered.includes(marker.toLowerCase())).toBe(false);
        }
      }
    }
  });
});

const SUPPRESSED = {
  "documentation-placeholder": "ghp_your-aaaaaaaaaaaaaaaa",
  "redaction-marker": "Bearer redactedaaaaaaaaaaaa",
  "fabricated-sample": "ghp_fake-aaaaaaaaaaaaaaaa",
} as const;

describe("TC-MEMSECRET-002 suppression classes and the markerless control", () => {
  for (const [classId, literal] of Object.entries(SUPPRESSED)) {
    test(`${classId} suppresses a marker-carrying span`, () => {
      const result = evaluate(recordWith(literal));
      expect(secretFindings(result)).toEqual([]);
      expect(matchGenericRules(literal).some((match) => match.suppressionClass === classId)).toBe(
        true,
      );
    });
  }

  test("the same shape without a marker fires", () => {
    const result = evaluate(recordWith(secretTokenFor("provider-token-prefix")));
    expect(secretFindings(result).map((finding) => finding.ruleId)).toEqual([
      "memory.secret.provider-token-prefix",
    ]);
  });

  test("a marker elsewhere on the line does not suppress the span", () => {
    const token = secretTokenFor("provider-token-prefix");
    const result = evaluate(recordWith(`${token} // placeholder\n`));
    expect(secretFindings(result)).toHaveLength(1);
  });

  test("a marker in the key half does not suppress a value the guard reports (F-4)", () => {
    const value = `${"a1".repeat(6)}${"z".repeat(10)}`;
    const line = `fake_token: ${value}`;
    // The whole-tree guard reports the span unsuppressed: the marker is in the
    // key, not in the protected value segment.
    const guard = matchGenericRules(line).filter(
      (match) => match.id === "secret.credential-assignment",
    );
    expect(guard).toHaveLength(1);
    expect(guard[0]?.suppressionClass).toBeNull();
    const result = evaluate(recordWith(line));
    expect(secretFindings(result).map((finding) => finding.ruleId)).toEqual([
      "memory.secret.credential-assignment",
    ]);
  });

  test("a marker inside the protected value segment still suppresses (F-4)", () => {
    const value = `fake_${"a1".repeat(6)}${"z".repeat(10)}`;
    const line = `token: ${value}`;
    const guard = matchGenericRules(line).filter(
      (match) => match.id === "secret.credential-assignment",
    );
    expect(guard).toHaveLength(1);
    expect(guard[0]?.suppressionClass).toBe("fabricated-sample");
    expect(secretFindings(evaluate(recordWith(line)))).toEqual([]);
  });

  test("a markerless value fires in a record, an entry, and a convention file", () => {
    const token = secretTokenFor("provider-token-prefix");
    const files = treeWith(
      [
        {
          relative: "lessons/lesson-2026-001-baseline.md",
          text: recordText(validLessonFields(), `# note\n${token}\n`),
        },
      ],
      [
        memoryFile("agents/coder/README.md", `# coder\n\n- 2026-11-10: ${token}\n`),
        memoryFile("AGENTS.md", `## Agent memory\n${token}\n`),
      ],
    );
    expect(secretFindings(evaluate(files))).toHaveLength(3);
  });
});

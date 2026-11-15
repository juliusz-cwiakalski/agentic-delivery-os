/**
 * The memory lint check edge (GH-301 F-4; NFR-1, NFR-6; DM-4).
 *
 * Scan -> evaluate -> print -> exit. The scanner adapter owns every file read
 * and the YAML frontmatter parse; this edge owns the single ambient date read
 * and the printing. It writes nothing, opens no network connection, and keeps
 * no state.
 */

import { scanMemoryTree } from "../../packages/adapters/src/file/memory-scan.js";
import {
  PRIVACY_RULES,
  PRIVACY_SUPPRESSION_CLASSES,
  suppressionValueFor,
} from "../../packages/adapters/src/io/privacy-rules.js";
import type {
  MemoryEvaluationResult,
  MemoryPrivacyVocabulary,
  MemoryScannedFile,
} from "../../packages/core/src/contracts/index.js";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint.js";

/** The injected execution seam; production defaults read the clock once. */
export type MemoryLintOptions = {
  readonly root?: string;
  readonly readToday?: () => string;
  readonly files?: readonly MemoryScannedFile[];
};

/** The delivered privacy vocabulary as the core structural type. */
export const memoryPrivacyVocabulary = (): MemoryPrivacyVocabulary => ({
  rules: PRIVACY_RULES.map((rule) => ({
    id: rule.id,
    recognizerClass: rule.recognizerClass,
    patternSource: rule.patternSource,
    flags: rule.flags,
    minimumMatchLength: rule.minimumMatchLength,
    suppressionValueFor: (matchedText) => suppressionValueFor(rule.id, matchedText),
  })),
  suppressionClasses: PRIVACY_SUPPRESSION_CLASSES.map((entry) => ({
    id: entry.id,
    markers: entry.markers,
  })),
});

const defaultReadToday = (): string => new Date().toISOString().slice(0, 10);

/** Run the invariant over the tree and return its deterministic result. */
export const runMemoryLint = (options: MemoryLintOptions = {}): MemoryEvaluationResult => {
  const files = options.files ?? scanMemoryTree(options.root ?? process.cwd()).files;
  const today = (options.readToday ?? defaultReadToday)();
  return evaluateMemory({ files, today, privacy: memoryPrivacyVocabulary() });
};

if (import.meta.main) {
  const result = runMemoryLint();
  for (const line of result.lines) console.log(line);
  process.exit(result.exitCode);
}

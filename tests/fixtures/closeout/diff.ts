/** Merged-diff fixtures for the owed-flip sweep (GH-240 F-5). */
import type { CloseoutDiffRead } from "../../../packages/core/src/contracts/index";

export const SQUASH_SHA = "a".repeat(40);
export const PARENT_SHA = "b".repeat(40);

export const makeDiff = (lines: readonly string[], files = 1): CloseoutDiffRead => {
  const body = [
    "diff --git a/src/file.ts b/src/file.ts",
    "--- a/src/file.ts",
    "+++ b/src/file.ts",
    "@@ -1,3 +1,10 @@",
  ];
  for (const line of lines) body.push(`+${line}`);
  return { text: `${body.join("\n")}\n`, files, squashSha: SQUASH_SHA, parentSha: PARENT_SHA };
};

export const attributedLines = [
  "// TODO close-todo GH-183 remove this guard",
  "// when GH-183 merges remove-guard",
  "// feature_flag retire-flag for GH-183",
  "// class_string rename-class for GH-183",
] as const;

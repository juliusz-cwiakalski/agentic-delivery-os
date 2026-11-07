import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

export const CLAUDE_FIXTURE_FILES = {
  "fixtures/claude-code/session-a.jsonl": readFileSync(
    join(ROOT, "tests/fixtures/harness/claude-code/session-a.jsonl"),
    "utf8",
  ),
} as const;

export const CLAUDE_FIXTURE_DIRECTORY = "fixtures/claude-code";

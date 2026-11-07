/**
 * Explicit golden regeneration (GH-233 NFR-1, TC-HARN-030).
 *
 * Run with `bun run tests/fixtures/harness/golden/regenerate.ts --write` and
 * review the diff. Tests only read these files and assert their mtime is
 * unchanged.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createBunSqliteStoreOpener,
  createClaudeTelemetryExtractor,
  createOpencodeTelemetryExtractor,
} from "../../../../packages/adapters/src/harness/index";
import { canonicalHarnessJson } from "../../../../packages/core/src/domain/index";
import { CLAUDE_FIXTURE_FILES } from "../claude-code/load";
import { createFakeFileReader } from "../claude-code/reader";
import { buildOpencodeStore } from "../opencode-store/build";
import { CLASSIFICATION_SCENARIOS } from "../scenarios/classification";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/harness/golden");
const NOW = "2026-11-06T00:00:00Z";

const classification = CLASSIFICATION_SCENARIOS.map((scenario) => ({
  id: scenario.id,
  token: scenario.expectedToken,
  evidence: scenario.expectedEvidence,
}));

const telemetry = (): unknown => {
  const store = buildOpencodeStore();
  const opencode = createOpencodeTelemetryExtractor({
    opener: (path) => createBunSqliteStoreOpener()(path),
    storePath: store.path,
    now: () => NOW,
  }).extract({ workItemRef: "GH-233", runId: "run-golden" });
  const claude = createClaudeTelemetryExtractor({
    directory: "fixtures/claude-code",
    reader: createFakeFileReader(CLAUDE_FIXTURE_FILES).reader,
    now: () => NOW,
  }).extract({ workItemRef: "GH-233", runId: "run-golden" });
  return {
    opencode: opencode.ok ? opencode.value : opencode,
    claude: claude.ok ? claude.value : claude,
  };
};

export const GOLDENS = {
  "classification.json": classification,
  "telemetry.json": telemetry(),
} as const;

if (process.argv.includes("--write")) {
  for (const [name, value] of Object.entries(GOLDENS)) {
    writeFileSync(join(GOLDEN, name), `${canonicalHarnessJson(value)}\n`);
  }
  process.stdout.write(`wrote ${Object.keys(GOLDENS).length} goldens\n`);
}

/**
 * The explicit writer for the committed parity goldens.
 *
 * Invoked only by `tests/fixtures/mcp/regenerate.ts --write`; never called from
 * a test body. Each success golden is generated from the in-process CLI oracle,
 * canonicalized, and reviewed as a committed fixture.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { canonicalJson } from "./canonical";
import { ALL_CASES, goldenPath } from "./cases";

/** Regenerate every success golden from the CLI oracle. */
export const regenerateParityGoldens = async (): Promise<void> => {
  for (const parityCase of ALL_CASES) {
    if (parityCase.expectation.kind !== "success") continue;
    const outcome = await parityCase.runCli();
    if (!outcome.ok) {
      throw new Error(`${parityCase.id}: CLI oracle unexpectedly failed`);
    }
    const path = goldenPath(parityCase.tool, parityCase.id);
    mkdirSync(dirname(path), { recursive: true });
    const canonical = JSON.parse(canonicalJson(outcome.data)) as unknown;
    writeFileSync(path, `${JSON.stringify(canonical, null, 2)}\n`);
    console.log(`regenerate: wrote ${path}`);
  }
};

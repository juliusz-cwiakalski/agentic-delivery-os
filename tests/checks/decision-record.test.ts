/**
 * TC-ERRROW-004 — TDR-0013 records the session-guard reversal, the GH-227 DEC-6
 * supersession, the retained one-shot, and the error-row retirement, and the
 * GH-242 spec references the record.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const TDR = "doc/decisions/TDR-0013-agent-session-commit-guard-reversal.md";
const INDEX = "doc/decisions/00-index.md";
const SPEC = "doc/changes/2026-11/2026-11-07--GH-242--agent-integration/chg-GH-242-spec.md";

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-ERRROW-004 TDR-0013", () => {
  test("the record exists with its id, reversal, and supersession", () => {
    const tdr = read(TDR);
    expect(tdr).toContain("id: TDR-0013");
    expect(tdr).toContain("status: Proposed");
    expect(tdr).toContain("supersede GH-227 DEC-6");
    expect(tdr.toLowerCase()).toContain("reversal");
  });

  test("the record states the retained one-shot and the error-row retirement", () => {
    const tdr = read(TDR);
    expect(tdr).toContain("harness one-shot");
    expect(tdr).toContain("error domain from six rows to five");
    expect(tdr).toContain("commit.session.context-refused");
  });

  test("the index carries the record row", () => {
    const index = read(INDEX);
    expect(index).toContain("[TDR-0013](TDR-0013-agent-session-commit-guard-reversal.md)");
    expect(index).toContain("Proposed");
  });

  test("the GH-242 spec references the record in its decision log", () => {
    expect(read(SPEC)).toContain("TDR-0013");
  });
});

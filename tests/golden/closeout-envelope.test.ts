/** TC-CLOSE-059 — the machine data matches the committed golden payload. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLOSEOUT_MAX_MACHINE_BYTES } from "../../packages/core/src/contracts/index";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF } from "../fixtures/closeout/harness";

const ROOT = process.cwd();
const GOLDEN: unknown = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/closeout/golden/envelope-data.json"), "utf8"),
);

describe("TC-CLOSE-059 machine golden", () => {
  test("the plan payload matches the committed golden", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--json"]);
    expect(run.exitCode).toBe(0);
    expect(closeoutData(run.envelope)).toEqual(GOLDEN);
  });

  test("the serialized payload stays within the bound", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--json"]);
    expect(Buffer.byteLength(JSON.stringify(closeoutData(run.envelope)))).toBeLessThanOrEqual(
      CLOSEOUT_MAX_MACHINE_BYTES,
    );
  });
});

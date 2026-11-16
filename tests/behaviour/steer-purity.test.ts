/**
 * TC-STEER-080 — the family is local-state only: no session operation, no
 * network/tracker/timer/socket, no product literal, brand seam only.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CREATED, makeAppliedOutcome, makeMessage } from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";
import { NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

const ROOT = process.cwd();
const FAMILY_SOURCES = [
  "packages/core/src/contracts/steer.ts",
  "packages/core/src/domain/steer.ts",
  "packages/core/src/state/steering.ts",
  "packages/cli/src/commands/steer.ts",
] as const;

const populated = (): ReturnType<typeof createSteerHarness> => {
  const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
  const landed = makeMessage({ id: "msg-landed", created: CREATED });
  harness.seedMessage(landed);
  harness.seedOutcome(makeAppliedOutcome(landed));
  harness.seedMessage(makeMessage({ id: "msg-due", created: CREATED }));
  return harness;
};

describe("TC-STEER-080 purity and brand neutrality", () => {
  test("all four forms perform no session operation and no external acquisition", async () => {
    const harness = populated();
    try {
      for (const argv of [
        ["send", "purity note"],
        ["list"],
        ["read"],
        ["complete", "msg-landed", "--ref", "doc/proof.md"],
      ]) {
        const run = await harness.run(argv, { json: false });
        expect(run.exitCode, argv.join(" ")).toBe(0);
        expect(run.stdout).toContain("example-product");
        for (const forbidden of ["delivery-os", "jaiship", "ados "]) {
          expect(run.stdout).not.toContain(forbidden);
        }
      }
      expect(harness.session.calls).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });

  test("the family sources import no network, tracker, credential-resolution, or session port", () => {
    const failures: string[] = [];
    for (const file of FAMILY_SOURCES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const marker of [
        "node:http",
        "node:https",
        "node:net",
        "fetch(",
        "setTimeout",
        "setInterval",
        "socket",
        "homedir",
        "createSession",
        "tracker",
      ]) {
        if (text.includes(marker)) failures.push(`${file}: ${marker}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the registered-secrets record is the one credential-adjacent input", () => {
    const harnessSource = readFileSync(join(ROOT, "packages/cli/src/commands/steer.ts"), "utf8");
    expect(harnessSource).toContain("secrets");
    const domain = readFileSync(join(ROOT, "packages/core/src/domain/steer.ts"), "utf8");
    expect(domain).toContain("containsRegisteredSecret");
    expect(domain).not.toContain("TOKEN_PATTERN");
    expect(domain).not.toContain("entropy");
  });
});

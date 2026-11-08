/**
 * TC-ENTRY-008 — the entrypoint is absent from the installer install set and no
 * packaging surface mentions it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const installScript = readFileSync(join(ROOT, "scripts/install.sh"), "utf8");

const arrayBody = (name: string): string => {
  const start = installScript.indexOf(`${name}=(`);
  if (start < 0) throw new Error(`installer array ${name} is missing`);
  const end = installScript.indexOf(")", start);
  if (end < 0) throw new Error(`installer array ${name} is unterminated`);
  return installScript.slice(start, end);
};

describe("TC-ENTRY-008 installer absence", () => {
  test("neither installer array names the entrypoint", () => {
    for (const name of ["ADOS_DELIVERY_SCRIPTS", "ADOS_DELIVERY_TOOLS"]) {
      const body = arrayBody(name);
      for (const forbidden of [
        "packages/cli",
        "bin/delivery-os",
        "src/entrypoint",
        "delivery-os.ts",
        "createProductionComposer",
      ]) {
        expect(body).not.toContain(forbidden);
      }
    }
  });

  test("the installer still declares both delivery arrays", () => {
    expect(installScript).toContain("ADOS_DELIVERY_SCRIPTS=(");
    expect(installScript).toContain("ADOS_DELIVERY_TOOLS=(");
    expect(installScript).toContain("scripts/deliver-ticket.sh");
    expect(installScript).toContain("tools/clean-merged-branches");
  });
});

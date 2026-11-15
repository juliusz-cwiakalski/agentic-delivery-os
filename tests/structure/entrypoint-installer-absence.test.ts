/**
 * TC-ENTRY-008 — the entrypoint is absent from the installer install set and no
 * packaging surface mentions it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installerArrayViolations } from "./install-launcher.test";

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
    expect(installerArrayViolations(installScript)).toEqual([]);
  });

  test("the installer still declares both delivery arrays", () => {
    expect(installScript).toContain("ADOS_DELIVERY_SCRIPTS=(");
    expect(installScript).toContain("ADOS_DELIVERY_TOOLS=(");
    expect(installScript).toContain("scripts/deliver-ticket.sh");
    expect(installScript).toContain("tools/clean-merged-branches");
  });
});

/**
 * GH-320 TC-BIN-066 / TC-BIN-054 — the launcher step is a declared separate step
 * and the arrays still name no binary, entrypoint, or composer.
 */
describe("GH-320 launcher step and array membership", () => {
  const functionBody = (name: string): string => {
    const start = installScript.indexOf(`${name}() {`);
    const end = installScript.indexOf("\n}\n", start);
    return start < 0 || end < 0 ? "" : installScript.slice(start, end);
  };

  test("the launcher step exists once, runs from the local path only, and is no array loop", () => {
    expect(installScript.split("install_local_launcher() {").length - 1).toBe(1);
    expect(functionBody("do_local_install")).toContain("install_local_launcher");
    expect(functionBody("do_global_install")).not.toContain("install_local_launcher");
    const step = functionBody("install_local_launcher");
    expect(step).not.toContain("ADOS_DELIVERY_SCRIPTS");
    expect(step).not.toContain("ADOS_DELIVERY_TOOLS");
  });

  test("the step consumes the self-description and expands only the home marker", () => {
    const step = `${functionBody("install_local_launcher")}\n${functionBody("resolve_launcher_path")}`;
    expect(step).toContain("--print-install-path");
    expect(step).toContain('"~/"');
    expect(step).not.toMatch(/\$\{HOME\}\/\.[a-z]/u);
    expect(step).not.toContain("stateDirectoryName");
  });

  test("the arrays' members are the delivered names", () => {
    for (const name of ["ADOS_DELIVERY_SCRIPTS", "ADOS_DELIVERY_TOOLS"]) {
      const body = arrayBody(name);
      expect(body.split("\n").filter((line) => line.trim().startsWith('"')).length).toBeGreaterThan(
        0,
      );
    }
    expect(arrayBody("ADOS_DELIVERY_SCRIPTS")).toContain('"scripts/deliver-ticket.sh"');
    expect(arrayBody("ADOS_DELIVERY_TOOLS")).toContain('"tools/clean-merged-branches"');
  });

  test("an injected array member naming the CLI entry fails the guard by name", () => {
    const injectedScripts = installScript.replace(
      "ADOS_DELIVERY_SCRIPTS=(",
      'ADOS_DELIVERY_SCRIPTS=(\n  "packages/cli/bin/jaiship.ts"',
    );
    expect(injectedScripts).not.toBe(installScript);
    const scriptsFailures = installerArrayViolations(injectedScripts).join("\n");
    expect(scriptsFailures).toContain("ADOS_DELIVERY_SCRIPTS");
    expect(scriptsFailures).toContain("packages/cli");

    const injectedTools = installScript.replace(
      "ADOS_DELIVERY_TOOLS=(",
      'ADOS_DELIVERY_TOOLS=(\n  "packages/cli/src/bin-launcher.ts"',
    );
    expect(injectedTools).not.toBe(installScript);
    expect(installerArrayViolations(injectedTools).join("\n")).toContain("ADOS_DELIVERY_TOOLS");
  });
});

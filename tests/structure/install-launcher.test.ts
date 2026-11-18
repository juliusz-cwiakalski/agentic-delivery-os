/**
 * GH-320 TC-BIN-054/066 — the launcher registration is its own declared step.
 *
 * The step is a named function, invoked only from the local-install path, reads
 * the install path from the executable's state-free self-description, adds one
 * declared layout reference to the CLI entry, composes no name-derived path, and
 * classifies its preconditions instead of skipping. Every assertion is driven by
 * an exported scanner so a seeded violation proves the guard is live.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const installScript = readFileSync(join(ROOT, "scripts/install.sh"), "utf8");

/** The declared layout reference to the CLI entry (the only binary-shaped name). */
const CLI_ENTRY = "packages/cli/bin/jaiship.ts";
const STEP = "install_local_launcher";

const functionBody = (source: string, name: string): string | undefined => {
  const start = source.indexOf(`${name}() {`);
  if (start < 0) return undefined;
  const end = source.indexOf("\n}\n", start);
  return end < 0 ? undefined : source.slice(start, end);
};

/** Structural violations for one installer source text (the guard's rule). */
export const launcherStepViolations = (source: string): string[] => {
  const failures: string[] = [];
  const declarations = source.split(`${STEP}() {`).length - 1;
  if (declarations !== 1) {
    failures.push(`launcher step ${STEP} is declared ${String(declarations)} times, expected once`);
  }
  const body = functionBody(source, STEP);
  if (body === undefined) {
    failures.push(`launcher step ${STEP} has no function body`);
    return failures;
  }
  const resolver = functionBody(source, "resolve_launcher_path") ?? "";
  const relevant = `${body}\n${resolver}`;
  if (!relevant.includes("--print-install-path")) {
    failures.push("the launcher step does not read the install path from self-description");
  }
  if (!relevant.includes("DELIVERY_OS_WORKING_NAME")) {
    failures.push("the launcher step does not scrub the working-name override");
  }
  if (!relevant.includes('"~/"')) {
    failures.push("the launcher step does not expand only the leading home marker");
  }
  if (!body.includes("command -v bun")) {
    failures.push("the launcher step does not classify a missing runtime");
  }
  if (!body.includes("has no CLI entry")) {
    failures.push("the launcher step does not classify a source without the CLI entry");
  }
  if (!body.includes("DRY_RUN")) {
    failures.push("the launcher step does not honour DRY_RUN");
  }
  if (!source.includes(`CLI_ENTRY_RELATIVE="${CLI_ENTRY}"`)) {
    failures.push(`the installer does not declare the CLI entry layout reference ${CLI_ENTRY}`);
  }
  if (/command -v\s+jaiship|which\s+jaiship/u.test(body)) {
    failures.push("the launcher step searches PATH for the product");
  }
  if (/--version/u.test(body)) {
    failures.push("the launcher step probes a version");
  }
  // No bash-side composition of a dot-directory or binary name from a working name.
  if (/\$\{HOME\}\/\.\$|stateDirectoryName|configDirectoryName/u.test(body)) {
    failures.push("the launcher step composes a name-derived path");
  }
  if (source.includes("${HOME}/.jaiship")) {
    failures.push("the installer composes a jaiship dot-directory path");
  }
  // The step is invoked from the local-install path only.
  const local = functionBody(source, "do_local_install");
  const global = functionBody(source, "do_global_install");
  if (local === undefined || !local.includes(STEP)) {
    failures.push("the local-install path does not invoke the launcher step");
  }
  if (global !== undefined && global.includes(STEP)) {
    failures.push("the global-install path invokes the launcher step");
  }
  // GH-346: the one content predicate. The step refuses anything at the install
  // path that is not the delivered launcher, decided by content, and names the
  // lifecycle command as the update path without reading the install record.
  if (!body.includes("LAUNCHER_CONTENT_MARKER")) {
    failures.push("the launcher step carries no content predicate for the delivered launcher");
  }
  if (!body.includes("refusing:")) {
    failures.push("the launcher step has no classified refusal arm");
  }
  if (!body.includes("lifecycle command")) {
    failures.push("the launcher step's refusal does not name the lifecycle command");
  }
  if (/-L "\$\{install_path\}"/u.test(body) === false) {
    failures.push("the launcher step does not refuse a symlink at the install path");
  }
  if (/install\.json|install\.record|recordState|record_path/u.test(body)) {
    failures.push("the launcher step reads the install record as its guard");
  }
  // The launcher content executes exactly one absolute target.
  if ((body.match(/exec bun/gu) ?? []).length !== 1) {
    failures.push("the launcher content does not exec exactly one runtime target");
  }
  return failures;
};

/** Structural violations for the installer's delivery arrays (the guard's rule). */
export const installerArrayViolations = (source: string): string[] => {
  const failures: string[] = [];
  for (const name of ["ADOS_DELIVERY_SCRIPTS", "ADOS_DELIVERY_TOOLS"]) {
    const start = source.indexOf(`${name}=(`);
    if (start < 0) {
      failures.push(`installer array ${name} is missing`);
      continue;
    }
    const end = source.indexOf(")", start);
    if (end < 0) {
      failures.push(`installer array ${name} is unterminated`);
      continue;
    }
    const body = source.slice(start, end);
    if (!/"[^"]+"/u.test(body)) {
      failures.push(`installer array ${name} names no delivered member`);
    }
    for (const forbidden of [
      "packages/cli",
      "bin/jaiship",
      "bin/delivery-os",
      "bin-launcher",
      "jaiship.ts",
      "delivery-os.ts",
      "src/entrypoint",
      "createProductionComposer",
    ]) {
      if (body.includes(forbidden)) {
        failures.push(`installer array ${name} names the CLI surface ${forbidden}`);
      }
    }
  }
  return failures;
};

describe("TC-BIN-066 the launcher step is its own declaration", () => {
  test("the installer's launcher step satisfies the declared structure", () => {
    expect(launcherStepViolations(installScript)).toEqual([]);
  });

  test("the step is declared once and invoked only from the local install", () => {
    expect(installScript.split("install_local_launcher() {").length - 1).toBe(1);
    expect(functionBody(installScript, "do_local_install")).toContain("install_local_launcher");
    expect(functionBody(installScript, "do_global_install") ?? "").not.toContain(
      "install_local_launcher",
    );
  });

  test("a seeded violation in a temp copy fails by name", () => {
    const withoutSelfDescription = installScript.replaceAll("--print-install-path", "--describe");
    expect(launcherStepViolations(withoutSelfDescription).join("\n")).toContain(
      "does not read the install path from self-description",
    );
    const withoutRuntimeCheck = installScript.replaceAll("command -v bun", "command -v sh");
    expect(launcherStepViolations(withoutRuntimeCheck).join("\n")).toContain(
      "does not classify a missing runtime",
    );
    const withPathSearch = installScript.replace(
      "exec bun",
      "command -v jaiship || true\nexec bun",
    );
    expect(launcherStepViolations(withPathSearch).join("\n")).toContain(
      "searches PATH for the product",
    );
    const composedPath = installScript.replace(
      `readonly CLI_ENTRY_RELATIVE="${CLI_ENTRY}"`,
      'readonly CLI_ENTRY_RELATIVE="${HOME}/.jaiship/bin/jaiship"',
    );
    expect(launcherStepViolations(composedPath).join("\n")).toContain(
      "composes a jaiship dot-directory path",
    );
    const calledFromGlobal = installScript.replace(
      "do_global_install() {",
      "do_global_install() {\n  install_local_launcher /tmp",
    );
    expect(launcherStepViolations(calledFromGlobal).join("\n")).toContain(
      "global-install path invokes the launcher step",
    );
  });
});

describe("TC-BIN-054 the installer arrays still name no binary", () => {
  const arrayBody = (name: string): string => {
    const start = installScript.indexOf(`${name}=(`);
    const end = installScript.indexOf(")", start);
    return start < 0 || end < 0 ? "" : installScript.slice(start, end);
  };

  test("neither array names a binary, entrypoint, or composer", () => {
    expect(installerArrayViolations(installScript)).toEqual([]);
    expect(arrayBody("ADOS_DELIVERY_SCRIPTS")).toContain('"scripts/deliver-ticket.sh"');
    expect(arrayBody("ADOS_DELIVERY_TOOLS")).toContain('"tools/clean-merged-branches"');
  });

  test("an injected array entry fails by name", () => {
    const injected = installScript.replace(
      "ADOS_DELIVERY_SCRIPTS=(",
      `ADOS_DELIVERY_SCRIPTS=(\n  "${CLI_ENTRY}"`,
    );
    expect(injected).not.toBe(installScript);
    const failures = installerArrayViolations(injected).join("\n");
    expect(failures).toContain("installer array ADOS_DELIVERY_SCRIPTS names the CLI surface");
    expect(failures).toContain("packages/cli");
  });
});

describe("GH-346 TC-INST-090/091 the managed-artifact guard is live", () => {
  test("the delivered guard is green and the delivered launcher is still owned", () => {
    expect(launcherStepViolations(installScript)).toEqual([]);
    expect(installScript).toContain(
      'readonly LAUNCHER_CONTENT_MARKER="# Installed by the local install"',
    );
    expect(installScript).toContain('readonly LAUNCHER_TARGET_MARKER="readonly TARGET="');
    expect(installScript).toContain('return "${EXIT_CONFIG}"');
  });

  test("a seeded copy without the guard, and one keyed on the record, fail by name", () => {
    const withoutGuard = installScript
      .replaceAll('"${existing}" != *"${LAUNCHER_CONTENT_MARKER}"*', "false")
      .replace(
        'if [[ -L "${install_path}" ]] || [[ -d "${install_path}" ]]; then',
        "if false; then",
      );
    const guardFailures = launcherStepViolations(withoutGuard).join("\n");
    expect(guardFailures).toContain("content predicate");
    expect(guardFailures).toContain("symlink");
    const recordKeyed = installScript.replace(
      'local existing=""',
      'local existing="" # install.json',
    );
    expect(launcherStepViolations(recordKeyed).join("\n")).toContain("reads the install record");
  });
});

/**
 * GH-346 TC-INST-093 (and the scanner arm behind TC-INST-092) — one owner per
 * artifact class.
 *
 * The installer owns repository artifacts and the launcher step; the lifecycle
 * family owns the binary, its slot, its record, and the managed PATH block. Each
 * surface names the other and neither deletes the other's artifacts. The
 * uninstaller derives both the install path and the record path from the
 * product's own read-free self-description — no hardcoded brand or record path —
 * and a missing binary reports no managed install without an error.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const INSTALLER = readFileSync(join(ROOT, "scripts/install.sh"), "utf8");
const UNINSTALLER = readFileSync(join(ROOT, "scripts/uninstall.sh"), "utf8");

const functionBody = (source: string, name: string): string | undefined => {
  const start = source.indexOf(`${name}() {`);
  if (start < 0) return undefined;
  const end = source.indexOf("\n}\n", start);
  return end < 0 ? undefined : source.slice(start, end);
};

/** The ownership split's structural rule over both script texts. */
export const ownershipViolations = (input: {
  readonly installer: string;
  readonly uninstaller: string;
}): readonly string[] => {
  const failures: string[] = [];
  const report = functionBody(input.uninstaller, "report_managed_install");
  if (report === undefined) {
    failures.push("the uninstaller declares no managed-install reporting arm");
  } else {
    if (!report.includes("--print-install-path")) {
      failures.push("the reporting arm does not ask the product for its install path");
    }
    if (!report.includes("env -u DELIVERY_OS_WORKING_NAME")) {
      failures.push("the reporting arm does not scrub the working-name override");
    }
    if (!report.includes("install uninstall")) {
      failures.push("the reporting arm does not name the owning removal command");
    }
    if (!report.includes("No managed install detected")) {
      failures.push("the reporting arm has no no-binary answer");
    }
    if (/rm -|rmdir|remove_file/u.test(report)) {
      failures.push("the reporting arm removes something");
    }
  }
  // No hardcoded brand install path and no hardcoded record path.
  if (input.uninstaller.includes("${HOME}/.jaiship")) {
    failures.push("the uninstaller hardcodes the brand install path");
  }
  if (/\/\.jaiship\/install\.json/u.test(input.uninstaller)) {
    failures.push("the uninstaller hardcodes the record path");
  }
  if (/stateDirectoryName|configDirectoryName/u.test(input.uninstaller)) {
    failures.push("the uninstaller composes a name-derived path");
  }
  // The installer names the lifecycle command and owns no lifecycle member.
  const launcher = functionBody(input.installer, "install_local_launcher") ?? "";
  if (!launcher.includes("lifecycle command")) {
    failures.push("the installer's refusal does not name the lifecycle command");
  }
  for (const forbidden of ["install.json", "install.record", ".previous"]) {
    if (input.installer.includes(forbidden)) {
      failures.push(`the installer names the lifecycle member ${forbidden}`);
    }
  }
  return failures;
};

describe("TC-INST-093 neither surface deletes the other's artifacts and each names the other", () => {
  test("the delivered ownership split is green", () => {
    expect(ownershipViolations({ installer: INSTALLER, uninstaller: UNINSTALLER })).toEqual([]);
  });

  test("the uninstaller's report removes nothing and the installer's refusal names the family", () => {
    const report = functionBody(UNINSTALLER, "report_managed_install") ?? "";
    expect(report).toContain("removes no binary, slot, record, or Jaiship root");
    expect(report).toContain("Managed install detected at");
    const launcher = functionBody(INSTALLER, "install_local_launcher") ?? "";
    expect(launcher).toContain("refusing:");
    expect(launcher).toContain("no launcher was written");
  });

  test("a missing reporting arm and a hardcoded path both fail by name", () => {
    const withoutReport = UNINSTALLER.replace("report_managed_install() {", "report_nothing() {");
    const failures = ownershipViolations({
      installer: INSTALLER,
      uninstaller: withoutReport,
    }).join("\n");
    expect(failures).toContain("no managed-install reporting arm");
    const hardcoded = `${UNINSTALLER}\nrm -f "\${HOME}/.jaiship/install.json"\n`;
    expect(
      ownershipViolations({ installer: INSTALLER, uninstaller: hardcoded }).join("\n"),
    ).toContain("hardcodes the record path");
    const composed = `${UNINSTALLER}\npath="\${HOME}/.jaiship"\n`;
    expect(
      ownershipViolations({ installer: INSTALLER, uninstaller: composed }).join("\n"),
    ).toContain("hardcodes the brand install path");
  });

  test("a scanner arm records the uninstaller's probe source", () => {
    // TC-INST-092's detection source is asserted, not left to review.
    expect(UNINSTALLER).toContain('readonly CLI_ENTRY_RELATIVE="packages/cli/bin/jaiship.ts"');
    expect(UNINSTALLER).toContain("env -u DELIVERY_OS_WORKING_NAME");
    expect(UNINSTALLER).toContain("install_path}.previous");
    expect(UNINSTALLER).toContain("record_path=");
  });
});

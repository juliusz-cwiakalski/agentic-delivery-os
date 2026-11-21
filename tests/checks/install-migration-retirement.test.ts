/**
 * GH-365 P6 — the two retirements and the family/help surface.
 *
 * TC-MIGRATE-011: `install.migration.unavailable` leaves the domain (11 -> 10),
 * the error table, the guide's required-fact set, and the result-code corpus
 * together; the retired `--migrate` flag stays in the parser grammar so the
 * remedy `install migrate` is reachable and is retired from the documented set.
 * TC-MIGRATE-012: the family page carries the verb and the prompt-required
 * inventory stays 28.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInstallCommandDefinition } from "../../packages/cli/src/commands/install";
import { allHelpEntries } from "../../packages/cli/src/help";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { ERROR_TABLE, INSTALL_DOMAIN_CODES } from "../../packages/core/src/contracts/index";
import {
  createInstallRuntime,
  createInstallScratch,
  fixtureIdentity,
} from "../fixtures/install/home";

const ROOT = process.cwd();
const RETIRED = "install.migration.unavailable";

const installRows = (): readonly { readonly code: string }[] =>
  (ERROR_TABLE as readonly { readonly code: string; readonly domainKind: string }[]).filter(
    (entry) => entry.domainKind === "install",
  );

describe("TC-MIGRATE-011 the retired identity and the retired flag form", () => {
  test("the install domain is exactly ten identities and the retired row is absent", () => {
    expect(INSTALL_DOMAIN_CODES).toHaveLength(10);
    expect(INSTALL_DOMAIN_CODES).not.toContain(RETIRED);
    expect(installRows()).toHaveLength(10);
    expect(installRows().some((row) => row.code === RETIRED)).toBe(false);
    for (const code of [
      "install.target.worktree",
      "install.dev-build",
      "install.state.incompatible",
      "install.identity.not-owning",
      "install.shell-profile.unresolved",
      "install.daemon.running",
      "install.record.unreadable",
      "install.slot.absent",
      "install.slot.invalid",
      "install.purge.unconfirmed",
    ]) {
      expect(INSTALL_DOMAIN_CODES).toContain(code);
    }
  });

  test("the retired code survives only in the declared corpora", () => {
    const grep = spawnSync("git", ["grep", "-l", RETIRED], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const files = (grep.stdout ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const outside = files.filter(
      (file) => !file.startsWith("doc/changes/") && !file.startsWith("doc/decisions/"),
    );
    expect(outside).toEqual([]);
  });

  test("install --migrate refuses with the remedy and the parser keeps the flag", async () => {
    const scratch = createInstallScratch("retirement");
    try {
      const runtime = createInstallRuntime({
        scratch,
        runningArtifactPath: "/nonexistent/artifact",
        identity: fixtureIdentity(),
      });
      const definition = createInstallCommandDefinition(runtime);
      expect(definition.flags).toContain("--migrate");
      expect(definition.requiresValue).toContain("--backup-dir");
      const outcome = (await definition.handler({
        command: "install",
        flags: { "--migrate": true },
        argv: ["install", "--migrate"],
        positionals: [],
        brand: undefined,
      } as never)) as { readonly error?: { readonly code?: string; readonly summary?: string } };
      expect(outcome.error?.code).toBe("fallback.invocation");
      expect(outcome.error?.summary).toContain("retired");
      expect(outcome.error?.summary).toContain("install migrate");
    } finally {
      scratch.dispose();
    }
  });

  test("the documented flag set omits --migrate while the verb entry exists", () => {
    const entries = allHelpEntries().filter((entry) => entry.path[0] === "install");
    expect(entries).toHaveLength(6);
    const family = entries.find((entry) => entry.path.length === 1);
    if (family === undefined) throw new Error("no install family entry");
    expect(family.options.map(([flag]) => flag)).not.toContain("--migrate");
    const verb = entries.find((entry) => entry.path[1] === "migrate");
    expect(verb).toBeDefined();
    const verbFlags = verb?.options.map(([flag]) => flag) ?? [];
    for (const flag of ["--dry-run", "--backup-dir <abs>", "--stop-daemon"]) {
      expect(verbFlags.join(" ")).toContain(flag);
    }
    expect(verb?.summary.toLowerCase()).toContain("retired");
  });

  test("the result-code corpus and the guide carry no retired code", () => {
    const corpus = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/result/code-corpora/true-positives.json"), "utf8"),
    ) as { rows: { text: string }[] };
    expect(corpus.rows.some((row) => row.text === RETIRED)).toBe(false);
    const guide = readFileSync(join(ROOT, "doc/guides/local-install.md"), "utf8");
    expect(guide).not.toContain(RETIRED);
    for (const fact of [
      "install migrate",
      "install.migration.plan.v1",
      "--backup-dir",
      "zero records of any kind",
    ]) {
      expect(guide, fact).toContain(fact);
    }
  });
});

describe("TC-MIGRATE-012 the family surface and the prompt-required inventory", () => {
  test("the prompt-required inventory stays 28 with install in place", () => {
    expect(PROMPT_REQUIRED_COMMANDS).toHaveLength(28);
    expect(PROMPT_REQUIRED_COMMANDS).toContain("install");
  });

  test("the M4 page carries the verb, its flags and both self-description flags", () => {
    const page = readFileSync(
      join(ROOT, "doc/planning/oss-tooling/milestones/m4/commands/install.md"),
      "utf8",
    );
    expect(page).toContain("install migrate");
    expect(page).toContain("--backup-dir");
    expect(page).toContain("--dry-run");
    expect(page).toContain("--stop-daemon");
    expect(page).toContain("--help");
    expect(page).toContain("--version");
  });
});

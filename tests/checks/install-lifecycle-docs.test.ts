/**
 * GH-346 TC-INST-110 — the local install guide states the delivered cadence and
 * every declared operating fact, and no document claims byte-identical rebuilds.
 *
 * A self-contained requirement table over one page: the cadence, the admissible
 * origins and the worktree refusal with its reason, the dev-build requirement,
 * upgrade and rollback, uninstall versus purge with the residual report, the
 * dry-run daemon disposition, the opt-in PATH block and its removal, the
 * compatibility asymmetry with its rationale, and the ownership split. A missing
 * fact fails by name.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const GUIDE = "doc/guides/local-install.md";

/** The guide's declared operating facts, in the order the guide states them. */
export const GUIDE_REQUIREMENTS = [
  "install a release",
  "Deliver.",
  "Decide, then re-install",
  "Admissible installation origins",
  "linked git worktree",
  "deleted after merge",
  "dirty tree is never an admission question",
  "injected build identity",
  "install.dev-build",
  "Upgrade is installing a different compiled artifact",
  "single step back",
  "install.slot.absent",
  "install.record.unreadable",
  "purge would additionally delete",
  "install.purge.unconfirmed",
  "nothing to remove",
  "daemon: unchecked",
  "--add-to-path",
  "install.shell-profile.unresolved",
  "shell mapping",
  "advisory",
  "install.state.incompatible",
  "state.schema.mismatch",
  "One owner per artifact class",
  "install.identity.not-owning",
  "install.migration.unavailable",
] as const;

/** One page's claim rule: every declared fact present, and the retired claim absent. */
export const guideViolations = (text: string | undefined): readonly string[] => {
  if (text === undefined) return [`${GUIDE}: page does not exist`];
  const failures: string[] = [];
  for (const fact of GUIDE_REQUIREMENTS) {
    if (!text.includes(fact)) failures.push(`${GUIDE}: missing required fact: ${fact}`);
  }
  for (const retired of [
    "launcher-only installation",
    "No uninstall path exists",
    "Removing a registered launcher is an operator action: reinstall to update it",
    "daemon: absent",
  ]) {
    if (text.includes(retired)) failures.push(`${GUIDE}: retired statement present: ${retired}`);
  }
  return failures;
};

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-INST-110 the guide states the cadence and every declared operating fact", () => {
  test("the guide satisfies the declared requirement table", () => {
    expect(guideViolations(read(GUIDE))).toEqual([]);
  });

  test("a missing fact and a retired statement both fail by name", () => {
    const missing = read(GUIDE).replaceAll("deleted after merge", "merged later");
    expect(guideViolations(missing).join("\n")).toContain(
      "missing required fact: deleted after merge",
    );
    const missingDaemon = read(GUIDE).replaceAll("daemon: unchecked", "daemon: unknown");
    expect(guideViolations(missingDaemon).join("\n")).toContain(
      "missing required fact: daemon: unchecked",
    );
    const retired = `${read(GUIDE)}\nNo uninstall path exists.\n`;
    expect(guideViolations(retired).join("\n")).toContain(
      "retired statement present: No uninstall path exists",
    );
    const retiredDaemon = `${read(GUIDE)}\ndaemon: absent\n`;
    expect(guideViolations(retiredDaemon).join("\n")).toContain(
      "retired statement present: daemon: absent",
    );
  });
});

describe("TC-BIN-063 (documentation half) no document claims byte-identical rebuilds", () => {
  test("no page asserts a reproducible byte-identical rebuild", () => {
    const forbidden = [
      "byte-identical rebuild",
      "byte-identical builds",
      "reproducible build guarantees",
      "rebuilds are reproducible",
    ];
    const offenders: string[] = [];
    const walk = (relative: string): void => {
      for (const entry of readdirSync(join(ROOT, relative), { withFileTypes: true })) {
        const next = `${relative}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(next);
        } else if (entry.name.endsWith(".md")) {
          const text = readFileSync(join(ROOT, next), "utf8");
          for (const phrase of forbidden) {
            if (text.toLowerCase().includes(phrase)) offenders.push(`${next}: ${phrase}`);
          }
        }
      }
    };
    walk("doc/guides");
    walk("doc/spec");
    walk("doc/planning");
    expect(offenders).toEqual([]);
  });

  test("the build limit is stated honestly where the artifact is described", () => {
    const model = read("doc/planning/oss-tooling/milestones/m4/install-model.md");
    expect(model).toContain("build instant");
    const entrypoint = read("doc/spec/features/feature-cli-entrypoint.md");
    expect(entrypoint).toContain("build instant never appears");
  });
});

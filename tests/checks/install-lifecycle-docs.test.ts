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

const SPEC_PAGE = "doc/spec/features/feature-install-lifecycle.md";

/**
 * The spec page's rollback declaration: five causes, the four missing-name
 * record conditions plus the separate destination-shape cause.
 */
export const SPEC_ROLLBACK_REQUIRED = [
  "There are **five causes**",
  "Four are **missing-name** record conditions",
  "**destination-shape** cause, not a record condition",
  "not a compiled artifact at all — a delivered launcher, a symlink, or a foreign file",
  "refuses before the daemon gate and any rename",
] as const;

/** The retired claim: the rollback precondition has only four missing-name causes. */
export const SPEC_ROLLBACK_STALE = [
  "The four causes are missing-name conditions",
  "four causes",
  "only *missing* names are refused",
] as const;

/** The spec page's claim rule: every declared cause present, every retired claim absent. */
export const specRollbackViolations = (text: string | undefined): readonly string[] => {
  if (text === undefined) return [`${SPEC_PAGE}: page does not exist`];
  const failures: string[] = [];
  for (const fact of SPEC_ROLLBACK_REQUIRED) {
    if (!text.includes(fact)) failures.push(`${SPEC_PAGE}: missing required fact: ${fact}`);
  }
  for (const retired of SPEC_ROLLBACK_STALE) {
    if (text.includes(retired))
      failures.push(`${SPEC_PAGE}: retired statement present: ${retired}`);
  }
  return failures;
};

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

describe("TC-INST-110 (spec half) the rollback precondition declares all five causes", () => {
  test("the spec page satisfies the declared cause table", () => {
    expect(specRollbackViolations(read(SPEC_PAGE))).toEqual([]);
  });

  test("every declared phrase is non-vacuous in both directions", () => {
    const text = read(SPEC_PAGE);
    for (const fact of SPEC_ROLLBACK_REQUIRED) {
      expect({ fact, present: text.includes(fact) }).toEqual({ fact, present: true });
      expect(
        specRollbackViolations(text.replaceAll(fact, "declared elsewhere")).join("\n"),
      ).toContain(`missing required fact: ${fact}`);
    }
    for (const retired of SPEC_ROLLBACK_STALE) {
      expect({ retired, present: text.includes(retired) }).toEqual({ retired, present: false });
      expect(specRollbackViolations(`${text}\n${retired}\n`).join("\n")).toContain(
        `retired statement present: ${retired}`,
      );
    }
  });

  test("the destination-shape cause is a separate cause, not a missing name", () => {
    const withoutShape = read(SPEC_PAGE).replaceAll(
      "not a compiled artifact at all — a delivered launcher, a symlink, or a foreign file",
      "not the pair the swap inverts",
    );
    expect(specRollbackViolations(withoutShape).join("\n")).toContain(
      "missing required fact: not a compiled artifact at all — a delivered launcher, a symlink, or a foreign file",
    );
    const oldClaim = read(SPEC_PAGE).replaceAll(
      "There are **five causes**",
      "The four causes are missing-name conditions",
    );
    expect(specRollbackViolations(oldClaim).join("\n")).toContain(
      "retired statement present: The four causes are missing-name conditions",
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

/**
 * GH-365 P9 TC-IDENTITY-004 — the documented-fact battery over the reconciled
 * page set.
 *
 * Every enumerated page carries its declared reconciliation facts and no stale
 * current-as-prior statement; the prompt names the current path; the generated
 * projection equals its source; the reference page agrees with `--help`; every
 * changed distributable page declares its distribution marker; and the shell
 * fallback remediation names the script without a pre-freeze literal.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { allHelpEntries } from "../../packages/cli/src/help";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

type PageRule = {
  readonly page: string;
  readonly required?: readonly string[];
  readonly stale?: readonly string[];
  readonly distributable?: boolean;
};

const PAGES: readonly PageRule[] = [
  {
    page: "doc/guides/local-install.md",
    required: [
      "install migrate",
      "--backup-dir",
      "migration-backups",
      "install.migration.manifest.v1",
      "install.migration.plan.v1",
      "already-migrated",
      "partial",
      "conflict",
      "blocked",
      "--stop-daemon",
      "zero records of any kind",
      "scripts/lib/dispatch-authority.sh",
      "own header",
      "ten identities",
    ],
    stale: ["install.migration.unavailable", "ADOS_"],
  },
  {
    page: "doc/spec/features/feature-config-layer.md",
    required: [".jaiship/config.yaml", "override-read", "loaded-path guarantee", "not an error"],
    stale: [".delivery-os"],
  },
  {
    page: "doc/spec/features/feature-projects.md",
    required: ["~/.jaiship-state", "derived cache", "never redirects a read", "operator-local"],
    stale: [".delivery-os"],
  },
  {
    page: "doc/spec/features/feature-project-groups.md",
    required: [
      "operator-local, git-ignored overlay",
      "empty listing",
      "invoking checkout's own",
      "No tracked template",
    ],
    stale: ["project-committed `projects.yaml`"],
  },
  {
    page: "doc/spec/features/feature-ceremony-runner.md",
    required: ["invoking checkout's own", "declared empty target set"],
    stale: ["committed `projects.yaml`"],
  },
  {
    page: "doc/spec/features/feature-state-layer.md",
    required: [
      "byte-preserving",
      "header.<workspace>.json",
      "zero records of any kind",
      "TDR-0047",
    ],
  },
  {
    page: "doc/spec/features/feature-mcp-surface.md",
    required: ["current-identity default working name `jaiship`"],
  },
  {
    page: "doc/spec/features/feature-autonomous-delivery.md",
    required: ["prior-environment-prefix"],
    stale: ["current default brand"],
  },
  {
    page: "doc/guides/delivery-modes.md",
    required: ["prior-environment-prefix"],
    stale: ["current default brand"],
  },
  {
    page: "doc/quality/test-specs/test-spec-autonomous-delivery.md",
    distributable: false,
    required: ["prior-environment-prefix"],
    stale: ["current default brand"],
  },
  {
    page: "doc/overview/glossary.md",
    required: [
      "install.migration.plan.v1",
      "install.migration.manifest.v1",
      "namespace.shims.v1",
      "Disposition",
      "Verdict",
      "Root scope",
      "Symlink entry",
      "Command audit",
      "Derived entry",
      "Derived residual",
    ],
  },
  {
    page: "doc/planning/oss-tooling/milestones/m4/commands/install.md",
    distributable: false,
    required: [
      "install migrate",
      "--backup-dir",
      "--stop-daemon",
      "install.migration.manifest.v1",
      "zero records",
    ],
  },
  {
    page: "doc/planning/oss-tooling/milestones/m4/install-model.md",
    distributable: false,
    required: ["install migrate", "delivered by GH-365"],
  },
  {
    page: "doc/planning/oss-tooling/milestones/m4/backlog.md",
    distributable: false,
    required: ["Delivered by GH-365"],
  },
  {
    page: "doc/planning/oss-tooling/milestones/m4/schedule.md",
    distributable: false,
    required: ["S2 Namespace migration | GH-365 | delivered"],
  },
  {
    page: "doc/guides/opencode-model-configuration.md",
    required: [".jaiship/config.yaml"],
    stale: [".delivery-os/config.yaml"],
  },
  {
    page: "doc/guides/provider-conditions-and-parks.md",
    stale: [".delivery-os"],
  },
  {
    page: "doc/guides/ceremony-runner.md",
    required: [".jaiship", "invoking checkout's own", "declared empty target set"],
    stale: [".delivery-os"],
  },
];

describe("TC-IDENTITY-004 the reconciled page set", () => {
  test("every enumerated page carries its required facts and no stale statement", () => {
    const failures: string[] = [];
    for (const rule of PAGES) {
      const text = read(rule.page);
      for (const phrase of rule.required ?? []) {
        if (!text.includes(phrase))
          failures.push(`${rule.page}: missing required phrase: ${phrase}`);
      }
      for (const phrase of rule.stale ?? []) {
        if (text.includes(phrase)) failures.push(`${rule.page}: stale phrase present: ${phrase}`);
      }
      if (rule.distributable !== false && !text.includes("ados_distribution:")) {
        failures.push(`${rule.page}: missing ados_distribution marker`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the prompt names the current configuration path and the projection equals its source", () => {
    const source = read(".opencode/agent/toolsmith.md");
    const projection = read(".ados-claude/agents/toolsmith.md");
    const routing = /<routing_authority>[\s\S]*?<\/routing_authority>/u;
    const sourceLine = source.match(routing)?.[0];
    expect(sourceLine).toBeDefined();
    expect(sourceLine).toContain(".jaiship/config.yaml");
    expect(sourceLine).not.toContain(".delivery-os/config.yaml");
    expect(projection).toContain(sourceLine as string);
  });

  test("the reference page agrees with the rendered install help", () => {
    const page = read("doc/planning/oss-tooling/milestones/m4/commands/install.md");
    const installEntries = allHelpEntries().filter((entry) => entry.path[0] === "install");
    const family = installEntries.find((entry) => entry.path.length === 1);
    const verb = installEntries.find((entry) => entry.path[1] === "migrate");
    expect(family).toBeDefined();
    expect(verb).toBeDefined();
    expect(family?.options.map(([flag]) => flag)).not.toContain("--migrate");
    for (const flag of (verb?.options ?? []).map(([key]) => key)) {
      expect(page, flag).toContain(flag.split(" ")[0] as string);
    }
    for (const usage of verb?.usage ?? []) {
      expect(page).toContain(usage.replace("<binary>", "jaiship").split(" ")[2] as string);
    }
    expect(page).toContain("--help");
    expect(page).toContain("--version");
  });

  test("the shell-fallback remediation names the script and never writes the pre-freeze literal", () => {
    const guide = read("doc/guides/local-install.md");
    expect(guide).toContain("scripts/lib/dispatch-authority.sh");
    expect(guide).toContain("own header");
    expect(guide).toContain("ADR-0003 DEC-8");
    expect(guide).not.toContain("ADOS_");
  });

  test("the DOD-9 stale set is clean", () => {
    const model = read("doc/guides/opencode-model-configuration.md");
    expect(model).toContain(".jaiship/config.yaml");
    expect(model).not.toContain(".delivery-os/config.yaml");
    const glossary = read("doc/overview/glossary.md");
    expect(glossary).toContain("<environmentPrefix>WORKING_NAME");
    expect(glossary).toContain(".jaiship/config.yaml");
    for (const rule of PAGES) {
      const text = read(rule.page);
      expect(text.includes("projects.yaml` is committed"), rule.page).toBe(false);
      expect(text.includes("committed `projects.yaml`"), rule.page).toBe(false);
    }
  });
});

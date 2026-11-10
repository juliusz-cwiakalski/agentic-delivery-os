/**
 * TC-DOCS-001 / TC-DOCS-003 — the provisioning guide documents the sanctioned
 * bridge, the no-implicit-inheritance rule, least privilege, rotation, and the
 * 404 scope check; it declares its distribution marker and carries no value.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const GUIDE = join(ROOT, "doc/guides/tracker-credential-provisioning.md");

const text = (): string => readFileSync(GUIDE, "utf8");

describe("TC-DOCS-001 the provisioning guide documents the sanctioned bridge", () => {
  test("the guide exists with the redistributable distribution marker", () => {
    expect(existsSync(GUIDE)).toBe(true);
    expect(text()).toContain("ados_distribution: redistributable");
  });

  test("it names the exact key and reference", () => {
    const guide = text();
    expect(guide).toContain("GITHUB_TOKEN");
    expect(guide).toContain("github-read");
  });

  test("it carries the explicit command-substitution export bridge", () => {
    expect(text()).toContain('export GITHUB_TOKEN="$(gh auth token)"');
  });

  test("it states the declared-data, environment-only, no-keyring/no-ambient/no-fallback rule", () => {
    const guide = text().toLowerCase();
    expect(guide).toContain("declared data");
    expect(guide).toContain("only an environment source");
    expect(guide).toContain("keyring");
    expect(guide).toContain("ambient");
    expect(guide).toContain("fallback");
  });

  test("it carries shell-history hygiene, least privilege, and rotation/revocation guidance", () => {
    const guide = text().toLowerCase();
    expect(guide).toContain("history");
    expect(guide).toContain("least privilege");
    expect(guide).toContain("rotation");
    expect(guide).toContain("revoke");
  });

  test("it names the rejected-credential path and the 404 scope check", () => {
    const guide = text().toLowerCase();
    expect(guide).toContain("provider.auth.rejected");
    expect(guide).toContain("404");
    expect(guide).toContain("scope");
    expect(guide).toContain("repository access");
  });

  test("it records the redaction registration by this change", () => {
    const guide = text().toLowerCase();
    expect(guide).toContain("registered for serialization redaction");
    expect(guide).toContain("config-catalog");
  });

  test("it is plain text and contains no credential-shaped example", () => {
    const guide = text();
    expect(guide).not.toMatch(/[\u2018\u2019\u201c\u201d]/u);
    expect(guide).not.toMatch(/gh[pousr]_[A-Za-z0-9]{20,}/u);
  });
});

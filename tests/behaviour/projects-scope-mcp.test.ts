/**
 * GH-288 TC-PROJ-022 — MCP and CLI open the identical project root under the
 * override, and their error identities agree.
 *
 * Both surfaces consume the same core policy; the MCP composition is driven
 * in process through the exported serve seam, so no transport is involved.
 */
import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import { STATE_SCHEMA_VERSION } from "../../packages/core/src/contracts/index";
import { composeServeSurface } from "../../packages/mcp/src/serve";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
} from "../fixtures/projects/production";
import { createHostFixture, stateOverrideVariable } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

const dataOf = (run: { readonly envelope?: Record<string, unknown> }): Record<string, unknown> => {
  const data = run.envelope?.data as Record<string, unknown> | undefined;
  if (data === undefined) throw new Error("no data envelope");
  return data;
};

describe("TC-PROJ-022 MCP and CLI agree on the project root", () => {
  it("both surfaces open the same project root, honour the override, and share the status shape", async () => {
    const host = createHostFixture("scope-mcp");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "mcp-parity");
      const brand = resolveBrandIdentity({ workingName: "delivery-os" });
      if (!brand.ok) throw new Error("brand resolution failed");
      const harness = createProductionProjectsHarness({
        label: "mcp-parity",
        host,
        workingDirectory: checkout,
        originUrl: "https://github.com/owner/mcp-parity.git",
      });
      harnesses.push(harness);
      expect((await harness.run(["queue", "list", "--json"])).exitCode).toBe(0);

      const environment = {
        HOME: host.home,
        [stateOverrideVariable(brand.value)]: host.hostRoot,
      };
      const surface = composeServeSurface({
        brand: brand.value,
        environment,
        cwd: checkout,
        homeDirectory: host.home,
      });
      expect(surface.ok).toBe(true);
      if (!surface.ok) return;

      // The two state roots are identical and both are the project root.
      expect(surface.state.roots.projectRoot).toBe(harness.stateLocation);
      expect(surface.state.roots.hostRoot).toBe(host.hostRoot);
      expect(surface.state.roots.projectRoot).toBe(
        `${host.hostRoot}/projects/${harness.projectKey}`,
      );
      expect(surface.state.store.identity.workspaceId).toBe("default");
      expect(harness.store.identity.workspaceId).toBe("default");
      expect(surface.state.store.identity.schemaVersion).toBe(STATE_SCHEMA_VERSION);
      expect(harness.store.identity.schemaVersion).toBe(STATE_SCHEMA_VERSION);

      // Neither surface resolves under the home default, and it was never created.
      const homeDefault = join(host.home, brand.value.stateDirectoryName);
      expect(existsSync(homeDefault)).toBe(false);
      expect(surface.state.roots.projectRoot.startsWith(homeDefault)).toBe(false);

      // One status-shaped tool call against the CLI's own status projection.
      const tool = await surface.toolset.callTool("status");
      expect(tool.ok).toBe(true);
      const cli = await harness.run(["status", "--json"]);
      expect(cli.exitCode).toBe(0);
      const toolData = (tool as { readonly data?: Record<string, unknown> }).data ?? {};
      const cliData = dataOf(cli);
      const sectionIds = (value: Record<string, unknown>): readonly string[] =>
        ((value.sections as readonly { readonly id?: string }[]) ?? []).map(
          (section) => section.id ?? "",
        );
      expect(sectionIds(toolData)).toEqual(sectionIds(cliData));
      expect(Object.keys(toolData).sort()).toEqual(Object.keys(cliData).sort());
      // Neither payload projects a state location.
      expect(JSON.stringify(toolData)).not.toContain("stateLocation");
      expect(JSON.stringify(cliData)).not.toContain("stateLocation");
    } finally {
      for (const record of harnesses) record.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });

  it("both surfaces report the same identity refusal code for an unusable checkout", async () => {
    const host = createHostFixture("scope-mcp-refusal");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const broken = join(base, "broken-gitdir");
      mkdirSync(broken, { recursive: true });
      writeFileSync(join(broken, ".git"), "gitdir:   \n");
      const brand = resolveBrandIdentity({ workingName: "delivery-os" });
      if (!brand.ok) throw new Error("brand resolution failed");

      const harness = createProductionProjectsHarness({
        label: "mcp-refusal",
        host,
        workingDirectory: broken,
        originUrl: "https://github.com/owner/broken.git",
      });
      harnesses.push(harness);
      const cli = await harness.run(["projects", "list", "--json"]);
      expect(cli.exitCode).toBe(1);
      const cliCode = (cli.envelope?.error as { readonly code?: string } | undefined)?.code;
      expect(cliCode).toBe("projects.identity-unreadable");

      const surface = composeServeSurface({
        brand: brand.value,
        environment: { HOME: host.home, [stateOverrideVariable(brand.value)]: host.hostRoot },
        cwd: broken,
        homeDirectory: host.home,
      });
      expect(surface.ok).toBe(false);
      if (surface.ok) return;
      expect(surface.code).toBe(cliCode);
    } finally {
      for (const record of harnesses) record.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

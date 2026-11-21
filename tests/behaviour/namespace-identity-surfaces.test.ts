/**
 * GH-365 P8 TC-IDENTITY-001 — every current-identity composed surface creates
 * only current-namespace paths on a clean home, and the compatibility alias's
 * declared prior default is asserted separately as a shim fact.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import { composeServeSurface, resolveServeBrand } from "../../packages/mcp/src/serve";
import {
  runThroughComposition,
  scratchCheckout,
  scratchHome,
} from "../fixtures/entrypoint/prior-identity/harness";

const listing = (root: string): readonly string[] => {
  try {
    return readdirSync(root).sort();
  } catch {
    return [];
  }
};

const brandOf = (workingName: string) => {
  const resolved = resolveBrandIdentity({ workingName });
  if (!resolved.ok) throw new Error(`the resolver rejected ${workingName}`);
  return resolved.value;
};

describe("TC-IDENTITY-001 current surfaces create only current-namespace paths", () => {
  test("the entrypoint composition's status creates only ~/.jaiship-state paths", async () => {
    const checkout = scratchCheckout("identity-surfaces", {});
    const home = scratchHome("identity-surfaces-home");
    try {
      const run = await runThroughComposition({
        bin: "jaiship",
        argv: ["status", "--json"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(run.exitCode).toBe(0);
      const homeEntries = listing(home.root);
      expect(homeEntries.some((entry) => entry.startsWith(".delivery-os"))).toBe(false);
      expect(homeEntries).toContain(".jaiship-state");
      const checkoutEntries = listing(checkout.root);
      expect(checkoutEntries.some((entry) => entry.startsWith(".delivery-os"))).toBe(false);
    } finally {
      checkout.dispose();
      home.dispose();
    }
  });

  test("the MCP composition with no configured name resolves the current identity", () => {
    const resolved = resolveServeBrand({});
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.brand.binaryName).toBe("jaiship");
    expect(resolved.brand.configDirectoryName).toBe(".jaiship");
    expect(resolved.brand.stateDirectoryName).toBe(".jaiship-state");

    const checkout = scratchCheckout("identity-mcp", {});
    const home = scratchHome("identity-mcp-home");
    try {
      const surface = composeServeSurface({
        brand: resolved.brand,
        environment: { HOME: home.root },
        cwd: checkout.root,
        homeDirectory: home.root,
      });
      expect(surface.ok).toBe(true);
      if (!surface.ok) return;
      expect(surface.state.roots.hostRoot).toBe(join(home.root, ".jaiship-state"));
      expect(surface.state.roots.hostRoot.startsWith(join(home.root, ".delivery-os"))).toBe(false);
    } finally {
      checkout.dispose();
      home.dispose();
    }
  });

  test("the MCP composition honours the current and prior override channels", () => {
    const current = resolveServeBrand({ JAISHIP_WORKING_NAME: "acme" });
    expect(current.ok && current.brand.binaryName).toBe("acme");
    const prior = resolveServeBrand({ DELIVERY_OS_WORKING_NAME: "acme" });
    expect(prior.ok && prior.brand.binaryName).toBe("acme");
    const preFreeze = resolveServeBrand({ ADOS_WORKING_NAME: "acme" });
    expect(preFreeze.ok && preFreeze.brand.binaryName).toBe("acme");
  });

  test("the alias's declared prior default is a shim fact; its override arm is current", async () => {
    const checkout = scratchCheckout("identity-alias", {});
    const home = scratchHome("identity-alias-home");
    try {
      const aliasDefault = await runThroughComposition({
        bin: "delivery-os",
        argv: ["--version"],
        checkout: checkout.root,
        home: home.root,
      });
      expect(aliasDefault.stdout.startsWith("delivery-os ")).toBe(true);
      const aliasOverride = await runThroughComposition({
        bin: "delivery-os",
        argv: ["--version"],
        checkout: checkout.root,
        home: home.root,
        extra: { DELIVERY_OS_WORKING_NAME: "acme" },
      });
      expect(aliasOverride.stdout.startsWith("acme ")).toBe(true);
      expect(brandOf("acme").configDirectoryName).toBe(".acme");
    } finally {
      checkout.dispose();
      home.dispose();
    }
  });
});

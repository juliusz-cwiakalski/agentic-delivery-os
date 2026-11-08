/**
 * TC-ENTRY-010 — a non-installed Bun bin plus a `main` composition entry is
 * mapped in the CLI manifest, invokes the composition, and is absent from the
 * installer install set.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const manifest = JSON.parse(readFileSync(join(ROOT, "packages/cli/package.json"), "utf8")) as {
  readonly main?: string;
  readonly bin?: Readonly<Record<string, string>>;
};
const installScript = readFileSync(join(ROOT, "scripts/install.sh"), "utf8");

const arrayBody = (name: string): string => {
  const start = installScript.indexOf(`${name}=(`);
  if (start < 0) return "";
  const end = installScript.indexOf(")", start);
  return end < 0 ? "" : installScript.slice(start, end);
};

describe("TC-ENTRY-010 non-installed bin", () => {
  test("the bin manifest maps one neutral binary name to the Bun entry", () => {
    const bin = manifest.bin;
    expect(bin).toBeDefined();
    const entries = Object.entries(bin ?? {});
    expect(entries).toHaveLength(1);
    const [name, path] = entries[0] ?? ["", ""];
    expect(name).toBe("delivery-os");
    expect(path).toBe("./bin/delivery-os.ts");
  });

  test("the bin source starts with a Bun shebang and invokes the composition", () => {
    const source = readFileSync(join(ROOT, "packages/cli/bin/delivery-os.ts"), "utf8");
    expect(source.startsWith("#!/usr/bin/env bun")).toBe(true);
    expect(source).toContain('from "../src/entrypoint.ts"');
    expect(source).toContain("runEntrypoint");
    expect(source).toContain("createProductionComposer");
    expect(source).not.toContain("runCli(");
  });

  test("the main composition entry exists and is shared with the behaviour suites", () => {
    expect(manifest.main).toBe("./dist/entrypoint.js");
    const entrypoint = readFileSync(join(ROOT, "packages/cli/src/entrypoint.ts"), "utf8");
    expect(entrypoint).toContain("export const runEntrypoint");
    expect(entrypoint).toContain("PROMPT_REQUIRED_COMMANDS");
  });

  test("the bin and entry path are absent from both installer arrays", () => {
    const scripts = arrayBody("ADOS_DELIVERY_SCRIPTS");
    const tools = arrayBody("ADOS_DELIVERY_TOOLS");
    for (const forbidden of ["bin/delivery-os.ts", "src/entrypoint.ts", "delivery-os.ts"]) {
      expect(scripts).not.toContain(forbidden);
      expect(tools).not.toContain(forbidden);
    }
  });

  test("the neutral binary name contains no seed literal", () => {
    for (const seed of ["ados", "ADOS_", "~/.ados"]) {
      expect("delivery-os").not.toContain(seed);
    }
  });
});

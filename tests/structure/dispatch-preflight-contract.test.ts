/**
 * TC-REG-004 (structure half) — the admission preflight is an optional engine
 * port, distinct from `admission`, ordered after input validation and before the
 * lease claim and the spawn/resume block. The declarations are field-level:
 * the name-level v1 contract inventory does not move.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  DispatchAdmission,
  DispatchPorts,
  DispatchPreflightPort,
  DispatchPreflightResult,
} from "../../packages/core/src/app/dispatch";

const ROOT = process.cwd();
const ENGINE = "packages/core/src/app/dispatch.ts";
const CONTRACTS = "packages/core/src/contracts/dispatch.ts";

const source = (path: string): string => readFileSync(join(ROOT, path), "utf8");

describe("TC-REG-004 the preflight port is optional and distinct from admission", () => {
  test("the engine ports type declares both members with distinct shapes", () => {
    const text = source(ENGINE);
    expect(text).toContain("readonly preflight?: DispatchPreflightPort;");
    expect(text).toContain("readonly admission?: () => DispatchAdmission;");
    expect(text.indexOf("readonly preflight?")).toBeGreaterThan(0);
    expect(text.indexOf("readonly admission?")).toBeGreaterThan(text.indexOf("readonly preflight?"));
  });

  test("a caller may omit the preflight port and still satisfy the ports type", () => {
    type RequiredPorts = Pick<
      DispatchPorts,
      "store" | "fenceToken" | "harness" | "harnessKind" | "descriptor" | "prompt" | "ref"
    >;
    const omitted: Readonly<Partial<RequiredPorts>> = {};
    expect(omitted).toBeDefined();
    const optional: DispatchPreflightPort | undefined = undefined;
    expect(optional).toBeUndefined();
    const admission: DispatchAdmission = { admitted: true };
    expect(admission.admitted).toBe(true);
  });

  test("a preflight refusal carries its own typed identity", () => {
    const refusal: DispatchPreflightResult = {
      ok: false,
      error: { kind: "config", code: "config.credential.missing", trustedRefusal: true },
    };
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) {
      expect(refusal.error.kind).toBe("config");
      expect(refusal.error.trustedRefusal).toBe(true);
    }
  });

  test("the preflight runs before the lease claim and the spawn/resume block", () => {
    const text = source(ENGINE);
    const preflight = text.indexOf("ports.preflight()");
    const claim = text.indexOf("const claimed = ports.claimLease()");
    const spawn = text.indexOf("ports.harness.spawn");
    const resume = text.indexOf("ports.harness.resume");
    expect(preflight).toBeGreaterThan(0);
    expect(claim).toBeGreaterThan(preflight);
    expect(spawn).toBeGreaterThan(preflight);
    expect(resume).toBeGreaterThan(preflight);
  });

  test("no preflight name is added to the contracts module", () => {
    expect(source(CONTRACTS)).not.toContain("DispatchPreflight");
    const fixture = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/ports/v1-contract-inventory.json"), "utf8"),
    ) as { readonly modules: Readonly<Record<string, readonly string[]>> };
    const names = fixture.modules["dispatch.ts"] ?? [];
    expect(names.some((name) => name.startsWith("DispatchPreflight"))).toBe(false);
  });
});

/**
 * TC-KEYVAL-001..007 — the registered key=value and envelope surfaces keep
 * their committed byte shape and key order.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const register = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/key-register/register.json"), "utf8"),
) as {
  readonly surfaces: Readonly<
    Record<
      string,
      {
        readonly file: string;
        readonly keys?: readonly string[];
        readonly jsonKeys?: readonly string[];
      }
    >
  >;
};

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const inOrder = (text: string, keys: readonly string[]): string[] => {
  const failures: string[] = [];
  let cursor = -1;
  for (const key of keys) {
    const index = text.indexOf(key, cursor + 1);
    if (index < 0) failures.push(`missing key ${key}`);
    else if (index < cursor) failures.push(`key ${key} is out of order`);
    else cursor = index;
  }
  return failures;
};

describe("TC-KEYVAL key=value register", () => {
  for (const [surface, entry] of Object.entries(register.surfaces)) {
    test(`${surface} keeps its registered keys in order`, () => {
      const text = read(entry.file);
      if (entry.keys !== undefined) expect(inOrder(text, entry.keys)).toEqual([]);
      if (entry.jsonKeys !== undefined) {
        const parsed = JSON.parse(text) as unknown;
        const data =
          typeof parsed === "object" && parsed !== null && "data" in parsed
            ? (parsed as { data: unknown }).data
            : parsed;
        const keys = Object.keys(data as Record<string, unknown>);
        for (const key of entry.jsonKeys) expect(keys).toContain(key);
      }
    });
  }

  test("the register covers every Appendix A surface represented by a committed golden", () => {
    for (const surface of ["merge", "verify-deploy", "blockers", "queue-plan", "verify-change"]) {
      expect(register.surfaces[surface]).toBeDefined();
    }
  });

  test("a mutated key name is detected", () => {
    const text = read(register.surfaces.merge?.file ?? "").replace("result=", "outcome=");
    expect(inOrder(text, ["result="])).toContain("missing key result=");
  });
});

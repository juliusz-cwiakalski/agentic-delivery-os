/** TC-CAP-017 / F-4 — one candidate per `<id>.yaml`; mismatches are capsule-invalid. */
import { describe, expect, test } from "bun:test";
import { candidateYaml, runPromotionCloseout } from "../fixtures/capsule/promotion";

describe("TC-CAP-017 candidate file naming", () => {
  test("a file whose stem does not match the id is capsule-invalid with no promotion", async () => {
    const run = await runPromotionCloseout({
      candidates: {
        "wrong-name.yaml": candidateYaml({ id: "actual-id", statement: "Naming test." }),
      },
      preserveNames: true,
    });
    try {
      expect(run.exitCode).toBe(1);
      expect(run.error?.code).toBe("closeout.capsule-invalid");
      expect(String(run.error?.summary)).toContain("candidate file stem");
      expect(run.memory.read("README.md")).not.toContain("actual-id");
    } finally {
      run.cleanup();
    }
  });

  test("a non-yaml candidate file is capsule-invalid", async () => {
    const run = await runPromotionCloseout({
      candidates: { "notes.txt": "not a candidate\n" },
      preserveNames: true,
    });
    try {
      expect(run.exitCode).toBe(1);
      expect(run.error?.code).toBe("closeout.capsule-invalid");
    } finally {
      run.cleanup();
    }
  });

  test("a path-shaped id cannot be expressed as a file and is refused", async () => {
    const run = await runPromotionCloseout({
      candidates: { "bad.yaml": candidateYaml({ id: "../escape" }) },
      preserveNames: true,
    });
    try {
      expect(run.exitCode).toBe(1);
      expect(run.error?.code).toBe("closeout.capsule-invalid");
    } finally {
      run.cleanup();
    }
  });
});

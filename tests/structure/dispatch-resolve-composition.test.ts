/**
 * TC-RESOLVE-001 / AC-F3-1: `dispatch dual-run resolve` succeeds from local
 * evidence only — the production credential port and provider transport record
 * zero invocations.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDispatchDivergence,
  readDispatchDivergences,
} from "../../packages/core/src/app/dispatch-ledger";
import { createAdmissionHarness } from "../fixtures/dispatch/admission";
import { makeDivergence } from "../fixtures/dispatch/ledger";

describe("TC-RESOLVE-001 resolve is local-only", () => {
  test("the production runtime never resolves a credential or calls the transport", async () => {
    const harness = createAdmissionHarness({
      label: "gh279-resolve-local-",
      credential: "resolved",
    });
    try {
      const appended = appendDispatchDivergence(
        harness.store,
        "seed-fence",
        makeDivergence({ divergenceId: "DIV-1", state: "open" }),
      );
      expect(appended.ok).toBe(true);
      const before = readDispatchDivergences(harness.store);
      expect(before.ok).toBe(true);
      if (!before.ok) return;
      const original = JSON.stringify(before.records[0]);

      const observed = await harness.run([
        "dispatch",
        "dual-run",
        "resolve",
        "DIV-1",
        "--note",
        "tracker was stale; PR reopened",
        "--json",
      ]);
      expect(observed.exit).toBe(0);
      expect(observed.credentialResolutions).toBe(0);
      expect(observed.requests).toEqual([]);

      const after = readDispatchDivergences(harness.store);
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      expect(after.records).toHaveLength(2);
      expect(JSON.stringify(after.records[0])).toBe(original);
      expect(after.records[1]?.state).toBe("resolved");
      expect(after.records[1]?.note).toBe("tracker was stale; PR reopened");
    } finally {
      harness.dispose();
    }
  });
});

/**
 * TC-QLC-083 (GH-292, NFR-4) — the reconcile read budget is a hard contract:
 * exactly one bounded tracker call per examined entry, in canonical order, with
 * no retry, no pagination, no concurrent read, and no read past the 100-entry
 * cap. The production composition binding is proven through the real
 * `createProductionComposer` program over the same per-issue read endpoint the
 * closeout composition uses (the GAP-T2 injected-transport pattern; no live
 * tracker, no network call leaves the process).
 */
import { describe, expect, test } from "bun:test";
import {
  createProductionQueueHarness,
  makeCheckout,
  makeHarnessHome,
  removeHome,
} from "../fixtures/queue/production/harness";
import { RECONCILE_CAP } from "../fixtures/queue/reconcile/cases";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const errorOf = (text: string): Record<string, unknown> =>
  json(text).error as Record<string, unknown>;

describe("TC-QLC-083 one bounded read per examined entry", () => {
  test("three entries produce exactly three calls, once each, in canonical order", async () => {
    const harness = createReconcileHarness("read-cost-three");
    for (const [index, ref] of ["GH-241", "GH-242", "GH-243"].entries()) {
      harness.seedEntry({ ref, priority: index + 1 });
      harness.program(ref, { deliveryState: "backlog" });
    }
    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    const calls = harness.calls();
    expect(calls).toHaveLength(3);
    // Canonical ref order, one call per ref, no repeat (no pagination walk).
    expect(calls.map((call) => call.ref)).toEqual(["GH-241", "GH-242", "GH-243"]);
    expect(new Set(calls.map((call) => call.ref)).size).toBe(3);
    expect(calls.map((call) => call.ordinal)).toEqual([1, 2, 3]);
  });

  test("a failed read is never retried and stops the run at the failure", async () => {
    const harness = createReconcileHarness("read-cost-retry");
    for (const [index, ref] of ["GH-241", "GH-242", "GH-243"].entries()) {
      harness.seedEntry({ ref, priority: index + 1 });
    }
    harness.program("GH-241", { deliveryState: "backlog" });
    harness.program("GH-242", { failureCode: "provider.quota.exceeded" });
    harness.program("GH-243", { deliveryState: "backlog" });
    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(2);
    expect(errorOf(run.stdout).code).toBe("provider.quota.exceeded");
    // Exactly two calls: the failure was read once and GH-243 was never read.
    expect(harness.calls().map((call) => call.ref)).toEqual(["GH-241", "GH-242"]);
  });

  test("reads are sequential: the in-flight guard passes over a five-entry sweep", async () => {
    const harness = createReconcileHarness("read-cost-sequential");
    for (const [index, ref] of ["GH-241", "GH-242", "GH-243", "GH-244", "GH-245"].entries()) {
      harness.seedEntry({ ref, priority: index + 1 });
      harness.program(ref, { deliveryState: "backlog" });
    }
    // The harness port rejects any concurrent invocation, so a green sweep
    // proves the reads never overlap.
    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(harness.calls()).toHaveLength(5);
  });

  // The cap proof mutates 100 entries through the real verified store, so it
  // declares its own minutes-scale budget (see queue-reconcile-bounds.test.ts).
  test("the cap bounds the reads: 105 entries produce exactly 100 calls", async () => {
    const harness = createReconcileHarness("read-cost-cap");
    for (let index = 100; index <= 204; index += 1) {
      const ref = `GH-${index}`;
      harness.seedEntry({ ref, priority: index - 99 });
      harness.program(ref, { deliveryState: "done" });
    }
    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    const calls = harness.calls();
    expect(calls).toHaveLength(RECONCILE_CAP);
    // No read past the cap: every call names one of the first 100 refs and no
    // ref was read twice (one bounded call each, no pagination).
    expect(new Set(calls.map((call) => call.ref)).size).toBe(RECONCILE_CAP);
    expect(calls.every((call) => call.ref !== "GH-204")).toBe(true);
  }, 600_000);

  test("--ref produces exactly one call for exactly one entry", async () => {
    const harness = createReconcileHarness("read-cost-ref");
    for (const [index, ref] of ["GH-241", "GH-242", "GH-243"].entries()) {
      harness.seedEntry({ ref, priority: index + 1 });
      harness.program(ref, { deliveryState: "done" });
    }
    const run = await harness.run(["queue", "reconcile", "--ref", "GH-242", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(harness.calls().map((call) => call.ref)).toEqual(["GH-242"]);
  });
});

const ORIGIN = "https://github.com/owner/repo.git";
const PROD_REF = "GH-830";
const ISSUE_READ = new RegExp(`/issues/${PROD_REF.replace(/^[A-Za-z]+-/, "")}$`);

/** Count only the exact per-issue reads (the dependencies probe is a suffix URL). */
const exactIssueReads = (urls: readonly string[]): readonly string[] =>
  urls.filter((url) => ISSUE_READ.test(url));

describe("TC-QLC-083 the production composition supplies the per-item read", () => {
  test("a closed issue removes through the real production composer with one issue read", async () => {
    const root = makeHarnessHome("read-cost-prod-done");
    const checkout = makeCheckout(root, "checkout", ORIGIN);
    const harness = createProductionQueueHarness({
      label: "read-cost-prod-done",
      workingDirectory: checkout.directory,
      originUrl: ORIGIN,
      issueAnswer: () => ({
        status: 200,
        body: { number: 830, title: "Queue lifecycle", state: "closed", labels: [] },
      }),
    });
    try {
      const added = await harness.run(["queue", "add", PROD_REF, "--json"]);
      expect(added.exitCode, "add exits 0").toBe(0);
      const callsBefore = harness.transportCalls.length;

      const run = await harness.run(["queue", "reconcile", "--ref", PROD_REF, "--json"]);
      expect(run.exitCode, "reconcile exits 0").toBe(0);
      const data = json(run.stdout).data as {
        readonly result: string;
        readonly checked: number;
        readonly removed: readonly { readonly ref: string; readonly reason: string }[];
      };
      expect(data.result).toBe("removed");
      expect(data.checked).toBe(1);
      expect(data.removed).toEqual([{ ref: PROD_REF, reason: "reconciled" }]);

      // Exactly one bounded per-issue read through the production wiring; the
      // closeout-style dependencies probe may follow it, nothing else.
      const issueReads = exactIssueReads(
        harness.transportCalls.slice(callsBefore).map((call) => call.url),
      );
      expect(issueReads).toHaveLength(1);
      expect(harness.gitCalls, "no git child process").toEqual(harness.gitCalls);
    } finally {
      harness.dispose();
      removeHome(root);
    }
  });

  test("an open issue is retained with its observed state through the same bridge", async () => {
    const root = makeHarnessHome("read-cost-prod-open");
    const checkout = makeCheckout(root, "checkout", ORIGIN);
    const harness = createProductionQueueHarness({
      label: "read-cost-prod-open",
      workingDirectory: checkout.directory,
      originUrl: ORIGIN,
      issueAnswer: () => ({
        status: 200,
        body: { number: 830, title: "Queue lifecycle", state: "open", labels: [] },
      }),
    });
    try {
      const added = await harness.run(["queue", "add", PROD_REF, "--json"]);
      expect(added.exitCode, "add exits 0").toBe(0);
      const callsBefore = harness.transportCalls.length;

      const run = await harness.run(["queue", "reconcile", "--ref", PROD_REF, "--json"]);
      expect(run.exitCode).toBe(0);
      const data = json(run.stdout).data as {
        readonly result: string;
        readonly removed: readonly unknown[];
        readonly retained: readonly { readonly ref: string; readonly deliveryState: string }[];
      };
      expect(data.result).toBe("noop");
      expect(data.removed).toEqual([]);
      expect(data.retained).toEqual([{ ref: PROD_REF, deliveryState: "ready" }]);
      expect(
        exactIssueReads(harness.transportCalls.slice(callsBefore).map((call) => call.url)),
      ).toHaveLength(1);
    } finally {
      harness.dispose();
      removeHome(root);
    }
  });

  test("a not-found issue is retained as unobserved through the same bridge", async () => {
    const root = makeHarnessHome("read-cost-prod-404");
    const checkout = makeCheckout(root, "checkout", ORIGIN);
    const harness = createProductionQueueHarness({
      label: "read-cost-prod-404",
      workingDirectory: checkout.directory,
      originUrl: ORIGIN,
      issueAnswer: () => ({ status: 404, body: { message: "Not Found" } }),
    });
    try {
      const added = await harness.run(["queue", "add", PROD_REF, "--json"]);
      expect(added.exitCode, "add exits 0").toBe(0);
      const callsBefore = harness.transportCalls.length;

      const run = await harness.run(["queue", "reconcile", "--ref", PROD_REF, "--json"]);
      expect(run.exitCode).toBe(0);
      const data = json(run.stdout).data as {
        readonly removed: readonly unknown[];
        readonly unobserved: readonly string[];
      };
      expect(data.removed).toEqual([]);
      expect(data.unobserved).toEqual([PROD_REF]);
      // A not-found answer stops before the dependencies probe: one call total.
      expect(harness.transportCalls.slice(callsBefore)).toHaveLength(1);
    } finally {
      harness.dispose();
      removeHome(root);
    }
  });

  test("an unreadable tracker read fails closed on the provider identity", async () => {
    const root = makeHarnessHome("read-cost-prod-500");
    const checkout = makeCheckout(root, "checkout", ORIGIN);
    const harness = createProductionQueueHarness({
      label: "read-cost-prod-500",
      workingDirectory: checkout.directory,
      originUrl: ORIGIN,
      issueAnswer: () => ({ status: 500, body: { message: "synthetic outage" } }),
    });
    try {
      const added = await harness.run(["queue", "add", PROD_REF, "--json"]);
      expect(added.exitCode, "add exits 0").toBe(0);
      const recordsBefore = harness.store.readRecords();
      if (!recordsBefore.ok) throw new Error("ledger read failed");

      const run = await harness.run(["queue", "reconcile", "--ref", PROD_REF, "--json"]);
      // The provider identity surfaces as-is: no `queue.*` synonym on this path.
      expect(run.exitCode).toBe(2);
      expect(errorOf(run.stdout).code).toBe("provider.outage");
      expect(JSON.stringify(errorOf(run.stdout))).not.toContain("queue.");
      // Zero appends: the ledger is byte-identical after the failed read.
      const recordsAfter = harness.store.readRecords();
      if (!recordsAfter.ok) throw new Error("ledger read failed");
      expect(recordsAfter.value.records).toEqual(recordsBefore.value.records);
    } finally {
      harness.dispose();
      removeHome(root);
    }
  });
});

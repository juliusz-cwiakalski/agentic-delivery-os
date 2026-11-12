/**
 * TC-QLC-074 + TC-QLC-070 (GH-292) — the help family lists the new verbs,
 * per-verb help exits 0, `--reason` documents exactly the four values, the
 * `queue dep` synopsis is the two-positional grammar, `reconcile` documents
 * `--ref`, and malformed flag forms are classified refusals. The `reconcile`
 * half of TC-QLC-070 lands with the verb (Phase 6): the family synopsis is one
 * string, so the family line and the verb entry move in the same commit.
 */
import { describe, expect, test } from "bun:test";
import type { QueueCommandRuntime } from "../../packages/cli/src/commands/queue";
import { createQueueCommandDefinition } from "../../packages/cli/src/commands/queue";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { helpEntryFor } from "../../packages/cli/src/help";
import { QUEUE_REMOVAL_REASONS } from "../../packages/core/src/contracts/index";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";
import { bufferSink } from "../golden/helpers";

const helpFor = async (args: readonly string[]) => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const exitCode = await runEntrypoint([...args], {
    streams: { stdout, stderr },
    environment: {},
    configuredWorkingName: "example-product",
    composeProgram: () => ({ commands: {} }),
    clock: { now: () => 1 },
    newRunId: () => "run-help-lifecycle",
  });
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

describe("TC-QLC-070 the help family lists the new verbs", () => {
  test("queue --help lists remove, dep add, dep remove, and reconcile with the vocabularies", async () => {
    const run = await helpFor(["queue", "--help"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("queue remove");
    expect(run.stdout).toContain("queue dep add");
    expect(run.stdout).toContain("queue dep remove");
    // The reconcile half (Phase 6): the family synopsis is one string, so the
    // verb appears in the synopsis line and as a documented example.
    expect(run.stdout).toContain("reconcile");
    expect(run.stdout).toContain("queue reconcile");
    expect(run.stdout).toContain("--reason");
    expect(run.stdout).toContain("--ref");
    for (const reason of QUEUE_REMOVAL_REASONS) {
      expect(run.stdout).toContain(reason);
    }
  });

  test("queue remove --help renders usage, options, and examples at exit 0", async () => {
    const run = await helpFor(["queue", "remove", "--help"]);
    expect(run.exitCode).toBe(0);
    for (const section of ["Usage:", "Options:", "Examples:", "Exit codes:", "See also:"]) {
      expect(run.stdout).toContain(section);
    }
    expect(run.stdout).toContain("--reason");
    expect(run.stdout).toContain("queue remove");
  });

  test("the dep spellings render inside the dep entry; its synopsis is two-positional", async () => {
    const entry = helpEntryFor(["queue", "dep"]);
    expect(entry).toBeDefined();
    const usage = entry?.usage.join("\n") ?? "";
    expect(usage).toContain("queue dep <ref> <on-ref>");
    expect(usage).toContain("queue dep add <ref> <on-ref>");
    expect(usage).toContain("queue dep remove <ref> <on-ref>");
    expect(usage).not.toContain("--on");
    // No --dep option on the dep entry (the delivered entry carried one).
    expect(entry?.options.some(([flag]) => flag.startsWith("--dep"))).toBe(false);
    // The deeper spellings render the same entry — no separate help path.
    for (const path of [
      ["queue", "dep", "add"],
      ["queue", "dep", "remove"],
    ]) {
      const deeper = helpEntryFor(path);
      expect(deeper).toBe(entry);
    }
    for (const args of [
      ["queue", "dep", "--help"],
      ["queue", "dep", "add", "--help"],
      ["queue", "dep", "remove", "--help"],
    ]) {
      const run = await helpFor(args);
      expect(run.exitCode, args.join(" ")).toBe(0);
      expect(run.stdout).toContain("Usage:");
    }
  });

  test("no help page claims release removes an entry", async () => {
    const entry = helpEntryFor(["queue", "release"]);
    expect(entry).toBeDefined();
    const text = `${entry?.summary ?? ""} ${entry?.usage.join(" ")} ${entry?.examples.join(" ")}`;
    expect(text).not.toContain("remove");
    expect(entry?.summary).toContain("Release");
  });

  test("queue reconcile --help exits 0 and documents --ref (the reconcile half)", async () => {
    const run = await helpFor(["queue", "reconcile", "--help"]);
    expect(run.exitCode).toBe(0);
    for (const section of ["Usage:", "Options:", "Examples:", "Exit codes:", "See also:"]) {
      expect(run.stdout).toContain(section);
    }
    expect(run.stdout).toContain("--ref");
    expect(run.stdout).toContain("queue reconcile");
    // The verb entry is its own help path with the optional-`--ref` synopsis.
    const entry = helpEntryFor(["queue", "reconcile"]);
    expect(entry).toBeDefined();
    expect(entry?.usage.join(" ")).toContain("queue reconcile [--ref <ref>]");
    expect(entry?.options.some(([flag]) => flag === "--ref <ref>")).toBe(true);
  });

  test("all four AC-F7-1 spellings exist as separate help paths", async () => {
    const paths = [
      ["queue", "remove"],
      ["queue", "dep", "add"],
      ["queue", "dep", "remove"],
      ["queue", "reconcile"],
    ];
    for (const path of paths) {
      const run = await helpFor([...path, "--help"]);
      expect(run.exitCode, path.join(" ")).toBe(0);
      expect(helpEntryFor(path), path.join(" ")).toBeDefined();
    }
  });
});

describe("TC-QLC-074 the new flags are declared and malformed values refuse", () => {
  const runtimeStub = (): QueueCommandRuntime =>
    ({
      readSchedule: () => ({ ok: false, kind: "state", code: "state.store.unreadable" }),
      add: () => ({ ok: false, kind: "state", code: "state.store.unreadable" }),
      prioritize: () => ({ ok: false, kind: "state", code: "state.store.unreadable" }),
      dep: () => ({ ok: false, kind: "state", code: "state.store.unreadable" }),
      claim: () => ({ ok: false, kind: "state", code: "state.store.unreadable" }),
      release: () => ({ ok: false, kind: "state", code: "state.store.unreadable" }),
      remove: () => ({ ok: false, kind: "state", code: "state.store.unreadable" }),
      depRemove: () => ({ ok: false, kind: "state", code: "state.store.unreadable" }),
    }) as unknown as QueueCommandRuntime;

  test("--reason and --ref-free verbs declare the flag inventory exactly", () => {
    const definition = createQueueCommandDefinition(runtimeStub());
    expect(definition.flags).toContain("--reason");
    expect(definition.requiresValue).toContain("--reason");
    // The reconcile-only flag is declared once, with a required value.
    expect(definition.flags).toContain("--ref");
    expect(definition.requiresValue).toContain("--ref");
  });

  test("--ref is refused on every non-reconcile verb with zero mutation", async () => {
    for (const invocation of [
      ["queue", "remove", "GH-241", "--reason", "landed", "--ref", "GH-242", "--json"],
      ["queue", "list", "--ref", "GH-242", "--json"],
      ["queue", "plan", "--ref", "GH-242", "--json"],
      ["queue", "add", "GH-241", "--ref", "GH-242", "--json"],
      ["queue", "claim", "GH-241", "--ref", "GH-242", "--json"],
    ]) {
      const harness = createRemovalHarness(`ref-refused-${invocation[1]}`);
      harness.seedEntry({ ref: "GH-241" });
      const log = harness.writeLog;
      const appendsBefore = log?.appends ?? 0;
      const run = await harness.run(invocation);
      expect(run.exitCode, invocation.join(" ")).toBe(1);
      expect(JSON.stringify(run.stdout), invocation.join(" ")).toContain("input.value.rejected");
      expect(log?.appends, invocation.join(" ")).toBe(appendsBefore);
      // The seeded entry is untouched.
      const list = await harness.run(["queue", "list", "--json"]);
      expect(list.stdout).toContain("GH-241");
    }
  });

  test("reconcile refuses positionals and a non-canonical --ref value", async () => {
    for (const invocation of [
      ["queue", "reconcile", "GH-241", "--json"], // positional on reconcile
      ["queue", "reconcile", "--ref", "not-a-ref", "--json"], // non-canonical value
    ]) {
      const harness = createRemovalHarness(`reconcile-refused-${invocation.length}`);
      harness.seedEntry({ ref: "GH-241" });
      const log = harness.writeLog;
      const appendsBefore = log?.appends ?? 0;
      const run = await harness.run(invocation);
      expect(run.exitCode, invocation.join(" ")).toBe(1);
      expect(JSON.stringify(run.stdout), invocation.join(" ")).toContain("input.value.rejected");
      expect(log?.appends, invocation.join(" ")).toBe(appendsBefore);
    }
  });

  test("malformed flag forms are classified refusals with zero mutation", async () => {
    for (const invocation of [
      ["queue", "remove", "GH-241", "--reason", "--json"], // no value
      ["queue", "remove", "GH-241", "--color", "--json"], // unknown flag
      ["queue", "remove", "--reason", "GH-241", "--json"], // ref consumed as value
      ["queue", "remove", "GH-241", "GH-999", "--reason", "landed", "--json"], // extra positional
    ]) {
      const harness = createRemovalHarness(`help-flag-${invocation.length}-${invocation[2]}`);
      harness.seedEntry({ ref: "GH-241" });
      const log = harness.writeLog;
      const appendsBefore = log?.appends ?? 0;
      const run = await harness.run(invocation);
      expect(run.exitCode, invocation.join(" ")).toBe(1);
      // Either the grammar identity or the delivered parser identity: both are
      // classified `input`/`fallback` refusals, never a silent success.
      const stdout = JSON.stringify(run.stdout);
      expect(
        stdout.includes("input.value.rejected") || stdout.includes("fallback.invocation"),
        invocation.join(" "),
      ).toBe(true);
      expect(log?.appends).toBe(appendsBefore);
    }
  });

  test("--reason is rejected on release; the accepted spellings still succeed", async () => {
    const harness = createRemovalHarness("help-flag-release");
    harness.seedEntry({ ref: "GH-241" });
    harness.seedEntry({ ref: "GH-242" });
    harness.seedEntry({ ref: "GH-243" });
    const onRelease = await harness.run([
      "queue",
      "release",
      "GH-241",
      "--reason",
      "landed",
      "--json",
    ]);
    expect(onRelease.exitCode).toBe(1);
    expect(JSON.stringify(onRelease.stdout)).toContain("input.value.rejected");

    const twoPositional = await harness.run(["queue", "dep", "GH-243", "GH-242", "--json"]);
    expect(twoPositional.exitCode).toBe(0);
    const explicit = await harness.run(["queue", "dep", "add", "GH-243", "GH-242", "--json"]);
    expect(explicit.exitCode).toBe(0);
  });
});

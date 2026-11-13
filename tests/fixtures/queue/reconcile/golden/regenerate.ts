/**
 * The explicit reviewed golden writer for the `queue reconcile` envelopes and
 * human line (GH-292 TC-QLC-058).
 *
 * Run without arguments to print the would-be content, or with `--write` to
 * update all three committed goldens. This is the only supported regeneration
 * path; the suites never rewrite a golden. The script replays the exact
 * deterministic harness setups (same seeds, same order) the golden suite
 * uses, so the bytes stay identical.
 *
 *   bun tests/fixtures/queue/reconcile/golden/regenerate.ts --write
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { RECONCILE_REFS } from "../cases";
import { createReconcileHarness } from "../harness";

const ROOT = process.cwd();
const WRITE = process.argv.includes("--write");
const GOLDEN = join(ROOT, "tests/fixtures/queue/reconcile/golden");

/** Seed the TC-QLC-058 mixed fixture: done, canceled, ready, not-found. */
const seedMixed = (label: string) => {
  const harness = createReconcileHarness(label);
  harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 1 });
  harness.seedEntry({ ref: RECONCILE_REFS.canceled, priority: 2 });
  harness.seedEntry({ ref: RECONCILE_REFS.ready, priority: 3 });
  harness.seedEntry({ ref: RECONCILE_REFS.unobserved, priority: 4 });
  harness.program(RECONCILE_REFS.done, { deliveryState: "done" });
  harness.program(RECONCILE_REFS.canceled, { deliveryState: "canceled" });
  harness.program(RECONCILE_REFS.ready, { deliveryState: "ready" });
  harness.program(RECONCILE_REFS.unobserved, { observation: "not-found" });
  return harness;
};

const main = async (): Promise<void> => {
  // Envelope 1+2: the first run (removed) and the repeat run (noop) over the
  // same harness, in this order.
  const jsonHarness = seedMixed("golden-reconcile-json");
  const first = await jsonHarness.run(["queue", "reconcile", "--json"]);
  if (first.exitCode !== 0) throw new Error(`first run failed: ${first.stdout}`);
  const second = await jsonHarness.run(["queue", "reconcile", "--json"]);
  if (second.exitCode !== 0) throw new Error(`second run failed: ${second.stdout}`);

  // Envelope 3: the human form of the first run over a fresh harness.
  const humanHarness = seedMixed("golden-reconcile-human");
  const human = await humanHarness.run(["queue", "reconcile"]);
  if (human.exitCode !== 0) throw new Error(`human run failed: ${human.stdout}`);

  const files: readonly [string, string][] = [
    ["reconcile-first-run.json", first.stdout],
    ["reconcile-second-run.json", second.stdout],
    ["reconcile-first-run.txt", human.stdout],
  ];
  if (!WRITE) {
    for (const [name, content] of files) {
      process.stdout.write(`${join(GOLDEN, name)}\n${content}\n---\n`);
    }
    return;
  }
  for (const [name, content] of files) {
    writeFileSync(join(GOLDEN, name), content);
  }
  process.stdout.write(`wrote ${files.length} goldens under ${GOLDEN}\n`);
};

await main();

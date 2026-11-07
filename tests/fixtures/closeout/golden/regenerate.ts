/**
 * The explicit reviewed golden writer for the closeout envelope and human
 * digests (GH-240 D-10).
 *
 * Run without arguments to print the would-be content, or with `--write` to
 * update both committed goldens. This is the only supported regeneration path;
 * the suites never rewrite a golden.
 *
 *   bun tests/fixtures/closeout/golden/regenerate.ts --write
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCloseoutPlan,
  renderCloseoutHuman,
} from "../../../../packages/core/src/domain/closeout";
import { closeoutData, runCloseoutCli } from "../cli";
import { WORK_ITEM_REF, makeFacts } from "../harness";

const ROOT = process.cwd();
const WRITE = process.argv.includes("--write");

const planData = () => {
  const plan = buildCloseoutPlan(makeFacts());
  return {
    schemaId: "delivery.closeout.v1" as const,
    command: "closeout" as const,
    workItemRef: plan.workItemRef,
    mode: "plan" as const,
    baseRef: plan.baseRef,
    ...(plan.deliveryRequest === undefined ? {} : { deliveryRequest: plan.deliveryRequest }),
    steps: plan.steps,
    summary: plan.summary,
    ledgerKey: `closeout.operations:${plan.workItemRef}`,
  };
};

const main = async (): Promise<void> => {
  const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--json"]);
  if (run.exitCode !== 0) throw new Error(`closeout plan failed: ${run.stderr}`);
  const envelope = `${JSON.stringify(closeoutData(run.envelope), null, 2)}\n`;
  const human = renderCloseoutHuman(planData());
  const envelopePath = join(ROOT, "tests/fixtures/closeout/golden/envelope-data.json");
  const humanPath = join(ROOT, "tests/fixtures/closeout/golden/human.txt");
  if (!WRITE) {
    process.stdout.write(`${envelopePath}\n${envelope}\n${humanPath}\n${human}`);
    return;
  }
  writeFileSync(envelopePath, envelope);
  writeFileSync(humanPath, human);
  process.stdout.write(`wrote ${envelopePath}\nwrote ${humanPath}\n`);
};

await main();

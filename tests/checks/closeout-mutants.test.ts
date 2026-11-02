/** TC-CLOSE-064 — every broken guard fails naming its mutant case. */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CLOSEOUT_TIMESTAMP,
  makeDependent,
  makeFacts,
  makeGit,
  makeProvider,
  makeState,
  observed,
  testDependent,
} from "../fixtures/closeout/harness";
import { MUTANT_CASES } from "../fixtures/closeout/mutants/cases";

const ROOT = process.cwd();
const DOMAIN_SOURCE = join(ROOT, "packages/core/src/domain/closeout.ts");
const DOMAIN_SHA = join(ROOT, "packages/core/src/domain/sha256.ts");
const CONTRACTS = join(ROOT, "packages/core/src/contracts/index.ts");
const TMP = join(ROOT, "tmp", "tmpdir");

type DomainModule = typeof import("../../packages/core/src/domain/closeout");

const sourceFor = (): string =>
  readFileSync(DOMAIN_SOURCE, "utf8")
    .split('from "#contracts"')
    .join(`from ${JSON.stringify(pathToFileURL(CONTRACTS).href)}`)
    .split('from "./sha256.js"')
    .join(`from ${JSON.stringify(pathToFileURL(DOMAIN_SHA).href)}`);

let sequence = 0;

const loadModule = async (source: string): Promise<DomainModule> => {
  mkdirSync(TMP, { recursive: true });
  sequence += 1;
  const file = join(TMP, `gh183-mutant-${process.pid}-${sequence}.ts`);
  writeFileSync(file, source);
  try {
    return (await import(`${pathToFileURL(file).href}?x=${sequence}`)) as DomainModule;
  } finally {
    rmSync(file, { force: true });
  }
};

type SourceMutation = {
  readonly id: string;
  readonly prohibited: string;
  readonly mutate: (source: string) => string;
  /** True when the mutated production guard emits the prohibited observable. */
  readonly fires: (module: DomainModule) => boolean | Promise<boolean>;
};

const replaceOnce = (source: string, needle: string, replacement: string): string => {
  if (!source.includes(needle)) throw new Error(`mutation needle not found: ${needle}`);
  return source.replace(needle, replacement);
};

const SOURCE_MUTATIONS: readonly SourceMutation[] = [
  {
    id: "protected-set-bypass",
    prohibited: "the protected ref set always wins",
    mutate: (source) =>
      replaceOnce(
        source,
        "if (isProtectedRef(input.branchName, input.protectedRefs)) {",
        "if (false) {",
      ),
    fires: (module) =>
      module.evaluateBranchSafety({
        mergedObserved: true,
        sourceRef: "release/candidate",
        branchName: "release/candidate",
        localHead: "a".repeat(40),
        mergedHeadSha: "a".repeat(40),
        protectedRefs: ["release/candidate"],
        checkedOutElsewhere: false,
        currentCheckout: "base",
        restoreRequired: false,
        restoreSucceeded: true,
        earlierFailure: false,
      }).safe,
  },
  {
    id: "moved-head-equality",
    prohibited: "a moved local head is refused",
    mutate: (source) =>
      replaceOnce(
        source,
        "if (input.localHead === undefined || input.localHead !== input.mergedHeadSha) {",
        "if (false) {",
      ),
    fires: (module) =>
      module.evaluateBranchSafety({
        mergedObserved: true,
        sourceRef: "feat/GH-183/x",
        branchName: "feat/GH-183/x",
        localHead: "b".repeat(40),
        mergedHeadSha: "a".repeat(40),
        protectedRefs: ["main-tools"],
        checkedOutElsewhere: false,
        currentCheckout: "base",
        restoreRequired: false,
        restoreSucceeded: true,
        earlierFailure: false,
      }).safe,
  },
  {
    id: "unavailable-signal-as-empty",
    prohibited: "an unavailable relation signal is never an empty blocker set",
    mutate: (source) =>
      replaceOnce(
        source,
        "const blockers = candidate.blockers;",
        'const blockers = candidate.blockers.observation === "observed" ? candidate.blockers : { observation: "observed", value: [] };',
      ),
    fires: (module) => {
      const plan = module.buildCloseoutPlan(
        makeFacts({
          dependents: observed([
            testDependent(makeDependent("200"), { observation: "unavailable" }),
          ]),
        }),
      );
      return plan.steps.find((step) => step.stepId === "owed-flip-sweep")?.operations.length !== 0;
    },
  },
  {
    id: "gap-as-success",
    prohibited: "a provider-level gap is never reported as success",
    mutate: (source) =>
      replaceOnce(
        source,
        'return planStep("owed-flip-sweep", "skipped-gap", {',
        'return planStep("owed-flip-sweep", "applied", {',
      ),
    fires: (module) => {
      const facts = makeFacts();
      const plan = module.buildCloseoutPlan({
        ...facts,
        provider: {
          ...facts.provider,
          capabilities: {
            supportedOperations: ["read-delivery-request"],
            declaredGaps: [
              { operation: "read-work-item", reason: "provider-unsupported" },
              { operation: "write-work-item", reason: "provider-unsupported" },
            ],
            writableCarriers: [],
            readableCarriers: [],
          },
        },
      });
      return plan.steps.find((step) => step.stepId === "owed-flip-sweep")?.outcome === "applied";
    },
  },
  {
    id: "detached-as-unrelated",
    prohibited: "a clean detached-at-delivery-head checkout is restorable",
    mutate: (source) =>
      replaceOnce(
        source,
        'if (checkout.state === "base") {',
        'if (checkout.state === "base" || checkout.state === "detached-at-delivery-head") {',
      ),
    fires: (module) => {
      const plan = module.buildCloseoutPlan(
        makeFacts({ checkout: { state: "detached-at-delivery-head", head: "h" } }),
      );
      return plan.steps.find((step) => step.stepId === "checkout-restore")?.operations.length === 0;
    },
  },
  {
    id: "success-on-partial",
    prohibited: "a failed operation is never reported as applied",
    mutate: (source) =>
      replaceOnce(
        source,
        'failed > 0 ? "failed" : applied > 0 ? "applied" : "satisfied"',
        'failed > 0 ? "applied" : applied > 0 ? "applied" : "satisfied"',
      ),
    fires: async (module) => {
      const state = makeState();
      const provider = makeProvider({
        writeWorkItem: { ok: false, code: "closeout.write.failed", detail: "synthetic" },
      });
      const result = await module.runCloseout({
        plan: module.buildCloseoutPlan(makeFacts()),
        provider: provider.runtime,
        git: makeGit().runtime,
        state: state.runtime,
        timestamp: CLOSEOUT_TIMESTAMP,
        fenceToken: "fence-mutant",
        apply: true,
      });
      return result.ok;
    },
  },
];

describe("TC-CLOSE-064 non-vacuity corpus", () => {
  test("the mutant corpus is non-empty and every guard passes on the real module", () => {
    expect(MUTANT_CASES.length).toBeGreaterThan(0);
    for (const mutant of MUTANT_CASES) {
      expect(mutant.violates(mutant.real()), `${mutant.id}: real module`).toBe(false);
    }
  });

  test("every mutant produces the prohibited observable and names the case", () => {
    for (const mutant of MUTANT_CASES) {
      const prohibited = mutant.violates(mutant.mutant());
      if (!prohibited) throw new Error(`${mutant.id}: ${mutant.prohibited} did not fire`);
      expect(prohibited, mutant.id).toBe(true);
    }
  });
});

describe("TC-CLOSE-064 source-mutation non-vacuity", () => {
  test("the unchanged production source passes every guard (control)", async () => {
    const module = await loadModule(sourceFor());
    for (const mutation of SOURCE_MUTATIONS) {
      expect(await mutation.fires(module), `${mutation.id}: real source`).toBe(false);
    }
  });

  test("each mutated production source fires the prohibited observable", async () => {
    for (const mutation of SOURCE_MUTATIONS) {
      const module = await loadModule(mutation.mutate(sourceFor()));
      const fired = await mutation.fires(module);
      if (!fired) throw new Error(`${mutation.id}: ${mutation.prohibited} did not fire`);
      expect(fired, mutation.id).toBe(true);
    }
  });
});

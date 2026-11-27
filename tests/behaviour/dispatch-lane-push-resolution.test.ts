/**
 * GH-416 — structural branch resolution and the one shared predicate
 * (TC-LRES-001..005, TC-LRES-004 steps 5-7), plus the seam's one bounded
 * configuration read (the header grammar git accepts and the 64 KiB bound).
 *
 * The composed program runs over injected branch facts and the scripted
 * transport. A resolution refusal is a typed `input.value.rejected` answer with
 * no act and no record; the protected-name check is proven at the predicate
 * level because a resolved convention name can never equal a protected member.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createGitPushSeam,
  type GitPushChildRunner,
  type GitPushRunnerResult,
} from "../../packages/adapters/src/git/index";
import {
  type HarnessSpawnRunnerResult,
  isSafeRef,
  PROTECTED_REF_NAMES,
} from "../../packages/core/src/contracts/index";
import { createParityHarness, readableParityTransport } from "../fixtures/dispatch/parity/harness";
import { createGuardedRunner } from "../fixtures/dispatch/parity/process-runner";
import { createConfiguredCheckout } from "../fixtures/dispatch/parity/temp-repo";

const ROOT = process.cwd();
const REF = "GH-347";
const BRANCH = "feat/GH-347/parity";
const HEAD = "0123456789abcdef0123456789abcdef01234567";

const accepted = (): GitPushRunnerResult => ({
  stdout: "",
  stderr: "",
  status: 0,
  timedOut: false,
});

const branchGit =
  (branches: readonly string[]) =>
  ({ args }: { readonly args: readonly string[] }): HarnessSpawnRunnerResult => {
    const [verb, sub] = args;
    if (verb === "for-each-ref") {
      return {
        stdout:
          branches.map((name) => `${name} ${HEAD}`).join("\n") + (branches.length > 0 ? "\n" : ""),
        stderr: "",
        status: 0,
        timedOut: false,
      };
    }
    if (verb === "rev-parse" && sub === "--abbrev-ref") {
      return { stdout: `${BRANCH}\n`, stderr: "", status: 0, timedOut: false };
    }
    if (verb === "rev-parse") {
      return { stdout: `${HEAD}\n`, stderr: "", status: 0, timedOut: false };
    }
    return { stdout: "", stderr: "unexpected", status: 1, timedOut: false };
  };

type ResolutionRun = {
  readonly exit: number;
  readonly summary: string | undefined;
  readonly errorCode: string | undefined;
  readonly pushes: number;
  readonly lanePushRecords: number;
  readonly data: Record<string, unknown> | undefined;
};

const runResolution = async (input: {
  readonly branches: readonly string[];
  readonly pmNotesBranch?: string;
}): Promise<ResolutionRun> => {
  const guarded = createGuardedRunner({
    head: HEAD,
    git: branchGit(input.branches),
    push: accepted,
  });
  const harness = createParityHarness({
    label: "lane-push-resolution",
    localHead: HEAD,
    guarded,
    transport: readableParityTransport(),
    ...(input.pmNotesBranch === undefined ? {} : { pmNotesBranch: input.pmNotesBranch }),
  });
  try {
    const run = await harness.run(["push", REF, "--json"]);
    const records = harness.store.readRecords();
    const lanePushRecords =
      records.ok === true
        ? records.value.records.filter((record) => record.kind === "dispatch.lane-push").length
        : 0;
    return {
      exit: run.exit,
      summary: (run.envelope?.error as { readonly summary?: string } | undefined)?.summary,
      errorCode: (run.envelope?.error as { readonly code?: string } | undefined)?.code,
      pushes: guarded.pushes,
      lanePushRecords,
      data: run.envelope?.data as Record<string, unknown> | undefined,
    };
  } finally {
    harness.dispose();
  }
};

describe("GH-416 TC-LRES-001 declaration and convention disagree", () => {
  test("the refusal names both values, performs no act, and appends no record", async () => {
    const run = await runResolution({
      branches: [BRANCH],
      pmNotesBranch: "feat/GH-347/declared",
    });
    expect(run.exit).toBe(1);
    expect(run.errorCode).toBe("input.value.rejected");
    expect(run.summary).toContain("feat/GH-347/declared");
    expect(run.summary).toContain(BRANCH);
    expect(run.pushes).toBe(0);
    expect(run.lanePushRecords).toBe(0);
  });
});

describe("GH-416 TC-LRES-002 the convention read matches no branch", () => {
  test("no match is a named refusal with no current-checkout fallback", async () => {
    const run = await runResolution({ branches: [] });
    expect(run.exit).toBe(1);
    expect(run.errorCode).toBe("input.value.rejected");
    expect(run.summary).toContain("no local branch matches");
    expect(run.pushes).toBe(0);
    expect(run.lanePushRecords).toBe(0);
  });

  test("a declaration alone is insufficient when the convention read is empty", async () => {
    const run = await runResolution({
      branches: [],
      pmNotesBranch: BRANCH,
    });
    expect(run.exit).toBe(1);
    expect(run.errorCode).toBe("input.value.rejected");
    expect(run.pushes).toBe(0);
  });
});

describe("GH-416 TC-LRES-003 the convention read matches more than one branch", () => {
  test("ambiguity names the candidates with no act and no record", async () => {
    const run = await runResolution({
      branches: ["feat/GH-347/a", "fix/GH-347/b"],
    });
    expect(run.exit).toBe(1);
    expect(run.errorCode).toBe("input.value.rejected");
    expect(run.summary).toContain("feat/GH-347/a");
    expect(run.summary).toContain("fix/GH-347/b");
    expect(run.pushes).toBe(0);
    expect(run.lanePushRecords).toBe(0);
  });
});

describe("GH-416 TC-LRES-004 the shared predicate and the protected set", () => {
  test("arm a1: a convention-resolved unsafe name is refused pre-act", async () => {
    const run = await runResolution({ branches: ["feat/GH-347/a~b"] });
    expect(run.exit).toBe(1);
    expect(run.errorCode).toBe("input.value.rejected");
    expect(run.summary).toContain("feat/GH-347/a~b");
    expect(run.pushes).toBe(0);
    expect(run.lanePushRecords).toBe(0);
  });

  test("the safe-ref predicate accepts protected names; the membership check refuses them", () => {
    for (const name of PROTECTED_REF_NAMES) {
      expect(isSafeRef(name), name).toBe(true);
      expect((PROTECTED_REF_NAMES as readonly string[]).includes(name)).toBe(true);
    }
    expect(isSafeRef("feat/GH-347/parity")).toBe(true);
    expect(isSafeRef("bad~name")).toBe(false);
  });

  test("the protected-set arm is structurally unreachable from a resolved name", () => {
    for (const name of PROTECTED_REF_NAMES) {
      expect(name.includes("/")).toBe(false);
    }
    expect("feat/GH-347/parity".includes("/")).toBe(true);
  });

  test("the command composes and imports both, never re-declaring either", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/app/dispatch-lane-push.ts"), "utf8");
    expect(source).toContain("isSafeRef");
    expect(source).toContain("PROTECTED_REF_NAMES");
    expect(source).not.toContain("const isSafeRef");
    expect(source).not.toContain("PROTECTED_REF_NAMES = [");
    expect(source).not.toContain("REF_PATTERN");
  });

  test("the seam's direct-consumer guard refuses before any child", async () => {
    let calls = 0;
    const seam = createGitPushSeam({
      childRunner: async () => {
        calls += 1;
        return accepted();
      },
    });
    for (const name of ["bad~name", ...PROTECTED_REF_NAMES]) {
      const result = await seam.pushChangeBranch({ branch: name });
      expect(result.outcome).toBe("rejected");
      expect(calls).toBe(0);
    }
  });
});

describe("GH-416 TC-LRES-005 the unique-resolution arms", () => {
  test("arm B: no declaration, the convention read unique", async () => {
    const run = await runResolution({ branches: [BRANCH] });
    expect(run.exit).toBe(0);
    const lanePush = (run.data?.lanePush ?? {}) as Record<string, unknown>;
    expect(lanePush.verdict).toBe("pushed");
    expect(lanePush.branch).toBe(BRANCH);
    expect(run.pushes).toBe(1);
  });

  test("arm A: declaration and convention agree", async () => {
    const run = await runResolution({ branches: [BRANCH], pmNotesBranch: BRANCH });
    expect(run.exit).toBe(0);
    const lanePush = (run.data?.lanePush ?? {}) as Record<string, unknown>;
    expect(lanePush.branch).toBe(BRANCH);
    expect(run.pushes).toBe(1);
  });
});

/* ------------------------------------------------------------------------- */
/* The one bounded configuration read: git's header grammar and the size      */
/* bound. An unparsed or oversized configuration is `remote-unavailable` with   */
/* zero children, never a destination taken from the previous section or a     */
/* lower-precedence position.                                                  */
/* ------------------------------------------------------------------------- */

describe("GH-416 the one configuration read over git's own header grammar", () => {
  const CONFIG_BRANCH = "feat/GH-416/config-read";
  const REFSPEC = `HEAD:refs/heads/${CONFIG_BRANCH}`;

  const recordingRunner = (): {
    readonly childRunner: GitPushChildRunner;
    readonly calls: () => number;
    readonly argv: () => readonly string[];
  } => {
    let calls = 0;
    let argv: readonly string[] = [];
    return {
      childRunner: async (file, args) => {
        calls += 1;
        argv = [file, ...args];
        return accepted();
      },
      calls: () => calls,
      argv: () => argv,
    };
  };

  const resolveIn = async (input: {
    readonly label: string;
    readonly remotes?: readonly string[];
    readonly extraConfig?: readonly string[];
  }): Promise<{
    readonly outcome: unknown;
    readonly calls: number;
    readonly argv: readonly string[];
  }> => {
    const checkout = createConfiguredCheckout({
      label: input.label,
      ...(input.remotes === undefined ? {} : { remotes: input.remotes }),
      ...(input.extraConfig === undefined ? {} : { extraConfig: input.extraConfig }),
    });
    try {
      const recorder = recordingRunner();
      const seam = createGitPushSeam({
        cwd: checkout.directory,
        childRunner: recorder.childRunner,
      });
      const outcome = await seam.pushChangeBranch({ branch: CONFIG_BRANCH });
      return { outcome, calls: recorder.calls(), argv: recorder.argv() };
    } finally {
      checkout.dispose();
    }
  };

  const annotatedHeaders: readonly {
    readonly label: string;
    readonly extraConfig: readonly string[];
    readonly expected: string;
  }[] = [
    {
      label: "an annotated branch header keeps its pushRemote",
      extraConfig: [`[branch "${CONFIG_BRANCH}"] # lane\n\tpushRemote = pushed\n`],
      expected: "pushed",
    },
    {
      label: "trailing text after the branch header keeps its pushRemote",
      extraConfig: [`[branch "${CONFIG_BRANCH}"] hand-annotated\n\tpushRemote = pushed\n`],
      expected: "pushed",
    },
    {
      label: "an annotated bare remote section keeps its pushDefault",
      extraConfig: ["[remote] # defaults\n\tpushDefault = defaulted\n"],
      expected: "defaulted",
    },
    {
      label: "an annotated branch header keeps its tracking remote",
      extraConfig: [`[branch "${CONFIG_BRANCH}"] # lane\n\tremote = tracked\n`],
      expected: "tracked",
    },
    {
      label: "an annotated origin header declares the fallback destination",
      extraConfig: [`[remote "origin"] # annotated\n\turl = ./origin.git\n`],
      expected: "origin",
    },
  ];

  for (const header of annotatedHeaders) {
    test(`${header.label}, as git reads it`, async () => {
      const result = await resolveIn({
        label: `config-read-${header.expected}`,
        remotes: [],
        extraConfig: header.extraConfig,
      });
      expect(result.outcome).toEqual({ outcome: "accepted" });
      expect(result.calls).toBe(1);
      expect(result.argv).toEqual(["git", "push", header.expected, REFSPEC]);
    });
  }

  test("a header the grammar cannot parse refuses instead of re-attributing its keys", async () => {
    // `origin` is declared, so a skip-the-header parse would have answered
    // `origin`; the unterminated header makes the whole read unresolvable.
    const result = await resolveIn({
      label: "config-read-unparsed-header",
      remotes: ["origin"],
      extraConfig: [`[branch "${CONFIG_BRANCH}" # unterminated\n\tpushRemote = pushed\n`],
    });
    expect(result.outcome).toEqual({ outcome: "rejected", detail: "remote-unavailable" });
    expect(result.calls).toBe(0);
  });

  const paddingOf = (bytes: number): string => {
    const line = `# ${"p".repeat(118)}\n`;
    return line.repeat(Math.ceil(bytes / line.length));
  };

  test("a configuration larger than 64 KiB is unresolvable, never parsed partially", async () => {
    // git appends new keys at the end, so a `pushRemote` written past the cap
    // would otherwise resolve from `origin` with the act going to the wrong remote.
    const result = await resolveIn({
      label: "config-read-oversize",
      remotes: ["origin"],
      extraConfig: [
        paddingOf(64 * 1024 + 512),
        `[branch "${CONFIG_BRANCH}"]\n\tpushRemote = pushed\n`,
      ],
    });
    expect(result.outcome).toEqual({ outcome: "rejected", detail: "remote-unavailable" });
    expect(result.calls).toBe(0);
  });

  test("the same declaration inside the bound resolves, so the refusal is the size", async () => {
    const result = await resolveIn({
      label: "config-read-within-bound",
      remotes: ["origin"],
      extraConfig: [paddingOf(4 * 1024), `[branch "${CONFIG_BRANCH}"]\n\tpushRemote = pushed\n`],
    });
    expect(result.outcome).toEqual({ outcome: "accepted" });
    expect(result.argv).toEqual(["git", "push", "pushed", REFSPEC]);
  });
});

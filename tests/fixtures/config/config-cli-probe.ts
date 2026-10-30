import { createConfigProgram } from "../../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";

type Input = {
  readonly environment: Record<string, string | undefined>;
  readonly content: string;
  readonly args: readonly string[];
};

const input: Input = JSON.parse(process.argv[2] ?? "{}");
const path = "/repo/.synthetic/config.yaml";
const built = createConfigProgram({
  workingName: "synthetic",
  environment: input.environment,
  cwd: "/work",
  homeDirectory: "/home/synthetic",
  platform: "linux",
  fs: {
    exists: (candidate) => candidate === path,
    readText: (candidate) => {
      if (candidate !== path) throw new Error("missing");
      return input.content;
    },
  },
  repositoryIo: { exists: () => false, isFile: () => false, readText: () => "" },
});
if (!built.ok) {
  process.stdout.write(JSON.stringify({ ok: false, error: built.error }));
  process.exit(0);
}
const stdout: string[] = [];
const stderr: string[] = [];
let tick = 0;
const deps: CliDependencies = {
  brand: built.brand,
  clock: { now: () => (tick++ === 0 ? 1000 : 1007) },
  newRunId: () => "run-config-probe",
  secrets: built.secrets,
  program: built.program,
};
const exitCode = await runCli(
  ["config", ...input.args],
  {
    stdout: { write: (text) => stdout.push(text) },
    stderr: { write: (text) => stderr.push(text) },
  },
  deps,
);
process.stdout.write(
  JSON.stringify({ exitCode, stdout: stdout.join(""), stderr: stderr.join("") }),
);

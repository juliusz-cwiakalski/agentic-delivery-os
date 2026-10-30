/**
 * Child-process probe for the default process-scoped legacy adapter instance.
 *
 * The probe injects synthetic environment facts and a temporary home directory;
 * it never reads the real process environment. `console.warn` is captured
 * explicitly and the captured messages are printed as JSON so assertions are
 * made against the observed output, not implicit side effects.
 */
import { resolveProcessLegacy } from "../../../packages/adapters/src/legacy/index.ts";

type ProbeConfig = {
  readonly current: { readonly environmentPrefix: string; readonly configDirectoryName: string };
  readonly facts: Record<string, string>;
  readonly homeDirectory: string;
  readonly calls: number;
};

const config = JSON.parse(process.argv[2] ?? "{}") as ProbeConfig;
const messages: string[] = [];
const originalWarn = console.warn;

console.warn = (...args: unknown[]) => {
  messages.push(args.map((arg) => String(arg)).join(" "));
};

try {
  for (let index = 0; index < config.calls; index += 1) {
    resolveProcessLegacy({
      current: config.current,
      facts: config.facts,
      homeDirectory: config.homeDirectory,
    });
  }
} finally {
  console.warn = originalWarn;
}

process.stdout.write(JSON.stringify({ warnings: messages.length, messages }));

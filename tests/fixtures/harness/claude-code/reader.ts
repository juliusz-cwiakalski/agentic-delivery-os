/**
 * The recording read-only file reader for Claude Code extraction suites.
 */
import type {
  HarnessFileRead,
  HarnessFileReader,
} from "../../../../packages/adapters/src/harness/telemetry-claude";

export type RecordedFileRead = { readonly path: string };

export type FakeFileReader = {
  readonly reader: HarnessFileReader;
  readonly reads: RecordedFileRead[];
  readonly writes: string[];
};

export const createFakeFileReader = (
  files: Readonly<Record<string, string>>,
  options: { readonly missing?: boolean; readonly unreadable?: boolean } = {},
): FakeFileReader => {
  const reads: RecordedFileRead[] = [];
  const writes: string[] = [];
  return {
    reads,
    writes,
    reader: {
      list: () => ({
        ok: true,
        paths: Object.keys(files).sort(),
      }),
      read: (path): HarnessFileRead => {
        reads.push({ path });
        if (options.missing === true && !Object.hasOwn(files, path)) {
          return { ok: false, code: "missing" };
        }
        if (options.unreadable === true) return { ok: false, code: "unreadable" };
        const text = files[path];
        if (text === undefined) return { ok: false, code: "missing" };
        return { ok: true, bytes: Buffer.byteLength(text, "utf8"), text };
      },
    },
  };
};

# GH-290 events reference goldens

`events-list.txt`, `events-describe-queue-graph.txt`, and
`events-describe-lanes.txt` are the byte-exact human output of the `events`
reference surface (TC-EVT-010, TC-EVT-012). Each file starts with a generated
header and the `--- output ---` marker; the suite compares the bytes after the
marker.

Regenerate after any intentional reference-page change:

```bash
mkdir -p tmp/tmpdir && cat > tmp/tmpdir/gen-goldens.ts <<'TS'
import { writeFileSync } from "node:fs";
import { createSurfaceHarness } from "../../tests/fixtures/events/surface-harness";
const header = (what: string): string =>
  `# GH-290 ${what} (TC-EVT-010/TC-EVT-012).\n# Generated, do not hand-edit.\n--- output ---\n`;
const harness = createSurfaceHarness();
const write = async (argv: string[], file: string, what: string): Promise<void> => {
  const run = await harness.run(argv);
  if (run.exitCode !== 0) throw new Error(run.stderr);
  writeFileSync(`tests/fixtures/events/goldens/${file}`, header(what) + run.stdout);
};
await write(["events", "list"], "events-list.txt", "events list reference table");
await write(["events", "describe", "queue.graph"], "events-describe-queue-graph.txt", "events describe queue.graph reference page");
await write(["events", "describe", "lanes"], "events-describe-lanes.txt", "events describe lanes reference page");
TS
TMPDIR="$PWD/tmp/tmpdir" bun run tmp/tmpdir/gen-goldens.ts
```

Do not hand-edit the `.txt` files.

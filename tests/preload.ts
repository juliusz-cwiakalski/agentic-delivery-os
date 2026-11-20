/**
 * The test preload: the scratch-root guarantee.
 *
 * `tmp/` is git-ignored, so a fresh checkout has no `tmp/tmpdir`, yet several
 * suites `mkdtemp` beneath that path. Creating it here — idempotently, once per
 * test process, before any suite loads — means no suite depends on another
 * suite having run first.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });

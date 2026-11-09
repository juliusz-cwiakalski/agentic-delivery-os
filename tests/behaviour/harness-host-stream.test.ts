/**
 * TC-OCS-052 — the host streaming starter over a real synthetic child.
 *
 * The child is the Bun runtime running a test-supplied script
 * (`process.execPath -e '<script>'`), never `opencode` or `claude`. This is the
 * only harness suite allowed `process.execPath` (test plan TC-OCS-071).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHostSpawnStarter } from "../../packages/adapters/src/host/index";

const ROOT = process.cwd();
const BASE = join(ROOT, "tmp", "tmpdir");

const withRoot = async (run: (root: string) => Promise<void>): Promise<void> => {
  mkdirSync(BASE, { recursive: true });
  const root = mkdtempSync(join(BASE, "gh275-host-"));
  try {
    await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const collectLines = async (lines: AsyncIterable<string>): Promise<string[]> => {
  const collected: string[] = [];
  for await (const line of lines) collected.push(line);
  return collected;
};

describe("TC-OCS-052 host streaming starter", () => {
  test("streams lines and resolves completion on close with the accumulated stdout", async () => {
    await withRoot(async (root) => {
      const starter = createHostSpawnStarter();
      const script = [
        'process.stdout.write(JSON.stringify({type:"step_start",sessionID:"ses_host_1"})+"\\n");',
        'setTimeout(() => { process.stdout.write(JSON.stringify({type:"step_finish",sessionID:"ses_host_1",part:{reason:"stop"}})+"\\n"); }, 40);',
      ].join("\n");
      const stream = starter(process.execPath, ["-e", script], {
        cwd: root,
        env: {},
        handleTimeoutMs: 5_000,
      });
      const lines = await collectLines(stream.lines);
      const result = await stream.completion;
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("step_start");
      expect(lines[1]).toContain("step_finish");
      expect(result.status).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.stdout).toContain("step_finish");
    });
  });

  test("acquired() cancels the handle bound so a later close is not a timeout", async () => {
    await withRoot(async (root) => {
      const starter = createHostSpawnStarter();
      const script = [
        'process.stdout.write(JSON.stringify({sessionID:"ses_host_2"})+"\\n");',
        "setTimeout(() => process.exit(0), 400);",
      ].join("\n");
      const stream = starter(process.execPath, ["-e", script], {
        cwd: root,
        env: {},
        handleTimeoutMs: 100,
      });
      const iterator = stream.lines[Symbol.asyncIterator]();
      const first = await iterator.next();
      expect(first.done).toBe(false);
      stream.acquired();
      const result = await stream.completion;
      expect(result.timedOut).toBe(false);
      expect(result.status).toBe(0);
    });
  });

  test("handle-bound expiry kills the child and reports timedOut", async () => {
    await withRoot(async (root) => {
      const starter = createHostSpawnStarter();
      const script = ['process.on("SIGTERM", () => {});', "setInterval(() => {}, 1000);"].join(
        "\n",
      );
      const stream = starter(process.execPath, ["-e", script], {
        cwd: root,
        env: {},
        handleTimeoutMs: 50,
      });
      const lines = await collectLines(stream.lines);
      const result = await stream.completion;
      expect(lines).toEqual([]);
      expect(result.timedOut).toBe(true);
      expect(result.status).not.toBe(0);
    });
  });

  test("kill is idempotent and resolves completion", async () => {
    await withRoot(async (root) => {
      const starter = createHostSpawnStarter();
      const script = ['process.stdout.write("ready\\n");', "setInterval(() => {}, 1000);"].join(
        "\n",
      );
      const stream = starter(process.execPath, ["-e", script], {
        cwd: root,
        env: {},
        handleTimeoutMs: 5_000,
      });
      const iterator = stream.lines[Symbol.asyncIterator]();
      await iterator.next();
      stream.kill();
      stream.kill();
      const result = await stream.completion;
      expect(result.status).not.toBe(0);
    });
  });

  test("a child that ignores SIGTERM is escalated to SIGKILL and closes", async () => {
    await withRoot(async (root) => {
      const starter = createHostSpawnStarter();
      const script = [
        'process.on("SIGTERM", () => {});',
        'process.stdout.write("ready\\n");',
        "setInterval(() => {}, 1000);",
      ].join("\n");
      const stream = starter(process.execPath, ["-e", script], {
        cwd: root,
        env: {},
        handleTimeoutMs: 5_000,
      });
      const iterator = stream.lines[Symbol.asyncIterator]();
      const ready = await iterator.next();
      expect(ready.done ? "" : ready.value).toBe("ready");
      stream.kill();
      const result = await stream.completion;
      expect(result.status).not.toBe(0);
    });
  });

  test("no orphan survives once completion resolves", async () => {
    await withRoot(async (root) => {
      const starter = createHostSpawnStarter();
      const script = [
        'process.stdout.write("pid:" + process.pid + "\\n");',
        'process.on("SIGTERM", () => {});',
        "setInterval(() => {}, 1000);",
      ].join("\n");
      const stream = starter(process.execPath, ["-e", script], {
        cwd: root,
        env: {},
        handleTimeoutMs: 5_000,
      });
      const iterator = stream.lines[Symbol.asyncIterator]();
      const first = await iterator.next();
      const pidLine = first.done ? "" : first.value;
      const pid = Number(pidLine.replace("pid:", ""));
      expect(Number.isInteger(pid)).toBe(true);
      stream.kill();
      await stream.completion;
      let gone = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
          process.kill(pid, 0);
        } catch {
          gone = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(gone).toBe(true);
    });
  });

  test("the host source keeps the 16 MiB bound and the truncation marker", () => {
    const source = readFileSync(join(ROOT, "packages/adapters/src/host/index.ts"), "utf8");
    expect(source).toContain("16 * 1024 * 1024");
    expect(source).toContain("output truncated");
  });
});

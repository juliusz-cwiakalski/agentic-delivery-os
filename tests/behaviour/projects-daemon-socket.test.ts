/**
 * GH-288 TC-PROJ-023 (behavioural half) — the daemon socket derives from the
 * project root through the single composing site.
 *
 * The settings rule itself is delivered; what this suite witnesses is the
 * argument the composing site supplies and the containment rule that makes that
 * argument observable: a path inside the host root but outside the project root
 * is refused, which a host-root argument would have accepted.
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { resolveProjectDaemonSettings } from "../../packages/cli/src/daemon-compose";
import { resolveDaemonSettings } from "../../packages/core/src/config/index";
import { createProductionProjectsHarness } from "../fixtures/projects/production";
import { createHostFixture } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

describe("TC-PROJ-023 the socket path derives from the project root", () => {
  it("two projects derive different paths inside their own roots, and containment holds", async () => {
    const host = createHostFixture("daemon-socket-scope");
    const base = `${host.hostRoot}-repos`;
    const harnesses = [];
    try {
      const checks = await Promise.all(
        ["socket-a", "socket-b"].map(async (label) => {
          const checkout = createRepository(base, label);
          const harness = createProductionProjectsHarness({
            label,
            host,
            workingDirectory: checkout,
            originUrl: `https://github.com/owner/${label}.git`,
          });
          harnesses.push(harness);
          expect((await harness.run(["queue", "list", "--json"])).exitCode).toBe(0);
          return harness;
        }),
      );
      const [a, b] = checks as [(typeof checks)[number], (typeof checks)[number]];

      // The composing site's own argument (the policy-derived project root).
      const settingsA = resolveProjectDaemonSettings(a.stateLocation);
      const settingsB = resolveProjectDaemonSettings(b.stateLocation);
      expect(settingsA.ok && settingsB.ok).toBe(true);
      if (!settingsA.ok || !settingsB.ok) return;
      expect(settingsA.value.socketPath.startsWith(`${a.stateLocation}/`)).toBe(true);
      expect(settingsB.value.socketPath.startsWith(`${b.stateLocation}/`)).toBe(true);
      expect(settingsA.value.socketPath).not.toBe(settingsB.value.socketPath);
      expect(
        settingsA.value.socketPath.startsWith(`${host.hostRoot}/`) &&
          !settingsA.value.socketPath.startsWith(`${a.stateLocation}/`),
      ).toBe(false);

      // Containment in the project root, not in the host root.
      const outside = resolveDaemonSettings(
        { daemon: { "socket-path": "/tmp/gh288-not-a-project/daemon.sock" } },
        {},
        { stateDirectory: a.stateLocation },
      );
      expect(outside.ok).toBe(false);
      if (!outside.ok) expect(outside.error.key).toBe("daemon.socket-path");

      const sibling = resolveDaemonSettings(
        { daemon: { "socket-path": join(host.hostRoot, "elsewhere", "daemon.sock") } },
        {},
        { stateDirectory: a.stateLocation },
      );
      expect(sibling.ok).toBe(false);
      if (!sibling.ok) expect(sibling.error.key).toBe("daemon.socket-path");

      const relative = resolveDaemonSettings(
        { daemon: { "socket-path": "custom.sock" } },
        {},
        { stateDirectory: a.stateLocation },
      );
      expect(relative.ok).toBe(true);
      if (relative.ok) {
        expect(relative.value.socketPath.startsWith(`${a.stateLocation}/`)).toBe(true);
      }
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

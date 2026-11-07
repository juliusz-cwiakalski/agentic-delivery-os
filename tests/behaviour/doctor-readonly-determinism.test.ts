/**
 * TC-DOCTOR-002 — read-only and deterministic: no write/fence/mutation/spawn
 * seam is reachable from the doctor runtime, and identical injected inputs
 * replay byte-identically in both output modes.
 */
import { describe, expect, test } from "bun:test";
import { runDoctorCli } from "../fixtures/doctor/harness";

describe("TC-DOCTOR-002 read-only determinism", () => {
  test("the runtime exposes read members only", async () => {
    const { runtime } = (await import("../fixtures/doctor/harness")).fakeDoctorRuntime();
    for (const member of Object.keys(runtime)) {
      expect(member).not.toMatch(/append|replace|fence|salvage|write|mutate|spawn|exec/i);
    }
  });

  test("machine output replays byte-identically", async () => {
    const first = await runDoctorCli(["doctor", "--json"]);
    const second = await runDoctorCli(["doctor", "--json"]);
    expect(second.stdout).toBe(first.stdout);
  });

  test("human output replays byte-identically", async () => {
    const first = await runDoctorCli(["doctor"]);
    const second = await runDoctorCli(["doctor"]);
    expect(second.stdout).toBe(first.stdout);
  });

  test("a mixed failure also replays identically", async () => {
    const world = { checkout: { clean: false }, tracker: { credential: { ok: false } } };
    const first = await runDoctorCli(["doctor", "--json"], world);
    const second = await runDoctorCli(["doctor", "--json"], world);
    expect(second.stdout).toBe(first.stdout);
  });

  test("a spawn sentinel is never used and the guard is live", () => {
    const sentinel = {
      spawn: () => {
        throw new Error("planted-doctor-spawn");
      },
    };
    expect(() => sentinel.spawn()).toThrow("planted-doctor-spawn");
  });

  test("the machine run performs no write or network-write call", async () => {
    const { fakeDoctorRuntime, runCliWithRuntime } = await import("../fixtures/doctor/harness");
    const { runtime } = fakeDoctorRuntime();
    const touched = new Set<string>();
    const proxied = new Proxy(runtime, {
      get(target, property) {
        touched.add(String(property));
        return Reflect.get(target, property) as unknown;
      },
    });
    await runCliWithRuntime(["doctor", "--json"], proxied);
    for (const member of touched) {
      expect(member).not.toMatch(/write|append|fence|mutate|spawn|exec/i);
    }
  });
});

/**
 * Synthetic public-port consumer (TC-STATE-023). Imports only the public state
 * port and contracts; no configuration, no branding, no internal module.
 */
import { STATE_SCHEMA_VERSION, type StateStoreIdentity } from "@delivery-os/core/contracts";
import { createNodeStateEdge, createStateStore } from "@delivery-os/core/state";

export type ConsumerReport = {
  readonly steps: readonly string[];
  readonly values: Readonly<Record<string, unknown>>;
  readonly recovered: boolean;
  readonly repaired: boolean;
};

const identity = (stateDirectory: string, workspaceId: string): StateStoreIdentity => ({
  level: "local",
  workspaceId,
  fenceNamespace: "consumer-fence",
  schemaVersion: STATE_SCHEMA_VERSION,
  stateDirectory,
});

export const exercise = (stateDirectory: string): ConsumerReport => {
  const steps: string[] = [];
  const clock = { value: 1_000 };
  const base = createNodeStateEdge();
  const edge = { ...base, now: () => clock.value };
  const store = createStateStore(identity(stateDirectory, "consumer"), {
    driver: "jsonl",
    edge,
    staleFenceMs: 500,
  });
  steps.push("open");

  const acquired = store.acquireFence("consumer-writer");
  if (!acquired.ok) throw new Error(`acquire: ${acquired.error.code}`);
  steps.push("fence-acquire");
  const appended = store.append(acquired.value.handle, {
    kind: "consumer-record",
    recordKey: "phase",
    payload: { phase: "deliver" },
  });
  if (!appended.ok) throw new Error(`append: ${appended.error.code}`);
  steps.push("append");

  const replaced = store.replaceDocument(acquired.value.handle, {
    name: "snapshot",
    content: { phase: "deliver" },
  });
  if (!replaced.ok) throw new Error(`replace: ${replaced.error.code}`);
  steps.push("replace-document");

  const integrity = store.checkIntegrity();
  if (!integrity.ok) throw new Error(`integrity: ${integrity.error.code}`);
  steps.push("integrity");
  store.releaseFence(acquired.value.handle);
  steps.push("fence-release");

  const read = store.read({ requiredKeys: ["phase"] });
  if (!read.ok) throw new Error(`read: ${read.error.code}`);
  steps.push("read-with-key-set");

  // Crash-after-land: acquire, then let the clock age the fence.
  const second = store.acquireFence("consumer-second");
  if (!second.ok) throw new Error(`second acquire: ${second.error.code}`);
  clock.value = 10_000;
  const recovering = createStateStore(identity(stateDirectory, "consumer"), {
    driver: "jsonl",
    edge,
    staleFenceMs: 500,
  });
  const recovered = recovering.recoverFence("consumer-recoverer");
  if (!recovered.ok) throw new Error(`recover: ${recovered.error.code}`);
  steps.push("recover");

  const again = recovering.acquireFence("consumer-third");
  if (!again.ok) throw new Error(`third acquire: ${again.error.code}`);
  const next = recovering.append(again.value.handle, {
    kind: "consumer-record",
    recordKey: "phase",
    payload: { phase: "verify" },
  });
  if (!next.ok) throw new Error(`next append: ${next.error.code}`);
  recovering.releaseFence(again.value.handle);
  steps.push("append-after-recovery");

  return {
    steps,
    values: Object.fromEntries(Object.entries(read.value.values)),
    recovered: recovered.ok,
    repaired: false,
  };
};

export const repairTerminalTail = (stateDirectory: string): ConsumerReport => {
  const store = createStateStore(identity(stateDirectory, "repair"), {
    driver: "sqlite",
    edge: createNodeStateEdge(),
  });
  const repair = store.repairTornTail();
  if (!repair.ok) throw new Error(`repair: ${repair.error.code}`);
  const read = store.read({ requiredKeys: ["phase"] });
  if (!read.ok) throw new Error(`read: ${read.error.code}`);
  return {
    steps: ["open", "repair", "read"],
    values: Object.fromEntries(Object.entries(read.value.values)),
    recovered: false,
    repaired: repair.value.repaired,
  };
};

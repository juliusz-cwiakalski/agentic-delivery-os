/**
 * The action-registry store fixture (GH-287 test-plan §4.1 item 3): a per-test
 * temp root opened through the delivered state harness. No live state directory,
 * no `$HOME`, no socket, no spawned process.
 */
import {
  createTestEdge,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  type TestEdge,
} from "../state/harness";

export type ActionStore = {
  readonly root: string;
  readonly store: ReturnType<typeof openStore>["store"];
  readonly edge: TestEdge;
  readonly cleanup: () => void;
};

/** Open one empty action-registry store under a fresh temp root. */
export const makeActionStore = (label = "action"): ActionStore => {
  const root = makeTempRoot(`gh287-${label}`);
  const identity = makeIdentity(root, { workspaceId: "workspace-action" });
  const edge = createTestEdge();
  const { store } = openStore(identity, { edge });
  return { root, store, edge, cleanup: () => removeRoot(root) };
};

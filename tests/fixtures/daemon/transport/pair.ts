/**
 * The in-memory control transport pair (test double only).
 *
 * Never exported from the published `@delivery-os/adapters/daemon` subpath; the
 * conformance and connection suites import it directly.
 */
import type {
  ControlConnection,
  ControlTransport,
  ControlTransportPair,
} from "@delivery-os/core/contracts";

type Side = {
  handler?: (line: string) => void;
  closeHandler?: () => void;
  queue: string[];
  closed: boolean;
};

const createSide = (id: string, peer: () => Side): ControlConnection => {
  const side: Side = { queue: [], closed: false };
  const connection: ControlConnection = {
    id,
    write: (line) => {
      if (side.closed || peer().closed) return;
      const frameLine = line.replace(/\r?\n$/u, "");
      peer().queue.push(frameLine);
      peer().handler?.(frameLine);
    },
    onLine: (handler) => {
      side.handler = handler;
      for (const line of side.queue.splice(0)) handler(line);
    },
    onClose: (handler) => {
      side.closeHandler = handler;
      if (side.closed) handler();
    },
    close: () => {
      if (side.closed) return;
      side.closed = true;
      side.closeHandler?.();
    },
  };
  return Object.assign(connection, { __side: side });
};

const sideOf = (connection: ControlConnection): Side =>
  (connection as ControlConnection & { readonly __side: Side }).__side;

export const createMemoryTransportPair = (): ControlTransportPair & {
  readonly connectClient: () => Promise<ControlConnection>;
} => {
  let accept: ((connection: ControlConnection) => void) | undefined;
  let counter = 0;
  const server: ControlTransport = {
    listen: async (onConnection) => {
      accept = onConnection;
      return { close: () => undefined };
    },
    connect: async () => {
      throw new Error("the memory server transport does not connect");
    },
  };
  const client: ControlTransport = {
    listen: async () => ({ close: () => undefined }),
    connect: async () => {
      counter += 1;
      let serverSide: Side | undefined;
      let clientSide: Side | undefined;
      const serverConnection = createSide(
        `memory-server-${counter}`,
        () => clientSide ?? { queue: [], closed: false },
      );
      const clientConnection = createSide(
        `memory-client-${counter}`,
        () => serverSide ?? { queue: [], closed: false },
      );
      serverSide = sideOf(serverConnection);
      clientSide = sideOf(clientConnection);
      accept?.(serverConnection);
      return clientConnection;
    },
  };
  return {
    server,
    client,
    connectClient: async () => (await client.connect()) as ControlConnection,
  };
};

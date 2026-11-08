/**
 * The stdio control transport (GH-238 F-5; AC-F4-2).
 *
 * A single ordered byte-stream connection over the injected input/output pair.
 * Production defaults to process.stdin/stdout; tests inject a PassThrough pair.
 */
import type { Readable, Writable } from "node:stream";
import type { ControlConnection, ControlTransport } from "@delivery-os/core/contracts";
import { createLineConnection } from "./transport.js";

export type StdioTransportOptions = {
  readonly input?: Readable;
  readonly output?: Writable;
  readonly connectionId?: string;
};

export const createStdioTransport = (options: StdioTransportOptions = {}): ControlTransport => {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const id = options.connectionId ?? "stdio";
  const connection = (): ControlConnection =>
    createLineConnection(id, { readable: input, writable: output });
  return {
    listen: async (onConnection) => {
      const accepted = connection();
      onConnection(accepted);
      return { close: () => accepted.close() };
    },
    connect: async () => connection(),
  };
};

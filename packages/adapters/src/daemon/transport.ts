/**
 * Line-oriented control connections over ordered byte streams (GH-238 F-5).
 *
 * One NDJSON frame per line. Runtime I/O lives only in this adapter subpath.
 */
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { ControlConnection } from "@delivery-os/core/contracts";

export type LineStreamPair = {
  readonly readable: Readable;
  readonly writable: Writable;
};

export const createLineConnection = (
  id: string,
  pair: LineStreamPair,
  onCloseCallback?: () => void,
): ControlConnection => {
  const handlers: Array<(line: string) => void> = [];
  const closeHandlers: Array<() => void> = [];
  let closed = false;
  const reader = createInterface({ input: pair.readable, crlfDelay: Number.POSITIVE_INFINITY });
  reader.on("line", (line) => {
    for (const handler of handlers) handler(line);
  });
  const finish = (): void => {
    if (closed) return;
    closed = true;
    for (const handler of closeHandlers) handler();
    onCloseCallback?.();
  };
  reader.on("close", finish);
  pair.readable.on("end", finish);
  pair.readable.on("error", finish);
  return {
    id,
    write: (line) => {
      if (closed) return;
      pair.writable.write(line);
    },
    onLine: (handler) => {
      handlers.push(handler);
    },
    onClose: (handler) => {
      closeHandlers.push(handler);
      if (closed) handler();
    },
    close: () => {
      reader.close();
      finish();
    },
  };
};

/** A deterministic connection-id factory; process-independent. */
export const createConnectionIdFactory = (prefix: string): (() => string) => {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
};

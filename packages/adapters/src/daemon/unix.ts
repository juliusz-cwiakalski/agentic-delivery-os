/**
 * The unix-socket control transport (GH-238 F-5; AC-F5-1).
 *
 * Binds `<state-dir>/daemon.sock` only after verifying the 0700 directory,
 * applies 0600 to the socket, refuses a path outside the state directory, and
 * removes a stale socket file only when the caller owns the daemon lock.
 */
import { chmodSync, existsSync, rmSync, statSync } from "node:fs";
import { createServer, connect, type Server, type Socket } from "node:net";
import type { ControlConnection, ControlTransport } from "@delivery-os/core/contracts";
import { classifyTransportError } from "./errors.js";
import { createConnectionIdFactory, createLineConnection } from "./transport.js";

export type UnixTransportOptions = {
  readonly stateDirectory: string;
  readonly socketPath: string;
  /** True only when this process owns the daemon lock. */
  readonly lockOwned?: () => boolean;
};

const isInside = (path: string, directory: string): boolean =>
  path === directory || path.startsWith(`${directory.replace(/\/+$/u, "")}/`);

const verifyDirectory = (stateDirectory: string): void => {
  if (!existsSync(stateDirectory)) {
    throw { code: "daemon.socket-unreachable", detail: "state-directory-missing" } as const;
  }
  const mode = statSync(stateDirectory).mode & 0o777;
  if ((mode & 0o077) !== 0) {
    throw { code: "state.permission.denied", detail: "state-directory-not-private" } as const;
  }
};

const fromSocket = (socket: Socket, id: string): ControlConnection => {
  socket.setNoDelay(true);
  return createLineConnection(id, { readable: socket, writable: socket });
};

export const createUnixTransport = (options: UnixTransportOptions): ControlTransport => {
  if (!isInside(options.socketPath, options.stateDirectory)) {
    throw { code: "config.value.invalid", detail: "socket-outside-state-directory" } as const;
  }
  const nextId = createConnectionIdFactory("unix");
  let server: Server | undefined;
  return {
    listen: async (onConnection) => {
      verifyDirectory(options.stateDirectory);
      if (existsSync(options.socketPath)) {
        if (options.lockOwned?.() !== true) {
          throw { code: "daemon.socket-unreachable", detail: "socket-in-use" } as const;
        }
        rmSync(options.socketPath, { force: true });
      }
      server = createServer((socket) => onConnection(fromSocket(socket, nextId())));
      await new Promise<void>((resolve, reject) => {
        server?.once("error", (error) => reject(classifyTransportError(error)));
        server?.listen(options.socketPath, () => resolve());
      });
      chmodSync(options.socketPath, 0o600);
      return {
        close: () =>
          new Promise<void>((resolve) => {
            server?.close(() => resolve());
            server = undefined;
          }),
      };
    },
    connect: async () =>
      new Promise<ControlConnection>((resolve, reject) => {
        const socket = connect(options.socketPath);
        socket.once("error", (error) => reject(classifyTransportError(error)));
        socket.once("connect", () => resolve(fromSocket(socket, nextId())));
      }),
  };
};

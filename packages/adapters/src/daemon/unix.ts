/**
 * The unix-socket control transport (GH-238 F-5; AC-F5-1).
 *
 * Binds `<state-dir>/daemon.sock` only after verifying the 0700 directory,
 * applies 0600 to the socket, refuses a path outside the state directory, and
 * removes a stale socket file only when the caller owns the daemon lock.
 */
import { chmodSync, existsSync, rmSync, statSync } from "node:fs";
import { connect, createServer, type Server, type Socket } from "node:net";
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

/** One bounded, read-only reachability probe result (GH-288 F-5, Appendix C). */
export type DaemonSocketProbeResult =
  | { readonly reachable: true }
  | { readonly reachable: false; readonly reason: "socket-absent" | "socket-unreachable" };

/**
 * Probe one derived socket path with a bounded connect (GH-288 F-5).
 *
 * Read-only by construction: an absent path is reported without connecting, a
 * present path is connected with no payload, no command, and no authentication
 * attempt, and the socket is destroyed as soon as the connect resolves, fails,
 * or the declared timeout expires. It never creates, chmods, or removes a file.
 */
export const probeDaemonSocket = (input: {
  readonly socketPath: string;
  readonly timeoutMs: number;
}): Promise<DaemonSocketProbeResult> =>
  new Promise<DaemonSocketProbeResult>((resolve) => {
    if (!existsSync(input.socketPath)) {
      resolve({ reachable: false, reason: "socket-absent" });
      return;
    }
    let settled = false;
    const socket = connect(input.socketPath);
    const finish = (result: DaemonSocketProbeResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(
      () => finish({ reachable: false, reason: "socket-unreachable" }),
      input.timeoutMs,
    );
    const unref = (timer as { readonly unref?: () => void }).unref;
    if (typeof unref === "function") unref.call(timer);
    socket.once("connect", () => finish({ reachable: true }));
    socket.once("error", () => finish({ reachable: false, reason: "socket-unreachable" }));
  });

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

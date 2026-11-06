/**
 * Test-only network guard for the Node portability smoke.
 *
 * Installed through `node --import`; throws on `fetch` and on the
 * `node:http`/`node:https`/`node:net` connection entry points. It is a fixture,
 * never shipped code. `globalThis.__mcpNetworkGuardInstalled` records the
 * installation so the smoke can fail closed when the preload did not load.
 */
import http from "node:http";
import https from "node:https";
import net from "node:net";

const blocked = (label) => {
  throw new Error(`network-guard: ${label} is blocked in the MCP smoke`);
};

globalThis.fetch = () => blocked("fetch");
http.request = () => blocked("node:http.request");
http.get = () => blocked("node:http.get");
https.request = () => blocked("node:https.request");
https.get = () => blocked("node:https.get");
net.connect = () => blocked("node:net.connect");
net.createConnection = () => blocked("node:net.createConnection");

globalThis.__mcpNetworkGuardInstalled = "1";

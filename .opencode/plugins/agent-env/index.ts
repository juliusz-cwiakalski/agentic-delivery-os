import { Plugin } from "@opencode/plugin";

const DEFAULT_VARIABLE = "OPENCODE_AGENT";
const PENDING_TTL_MS = 5 * 60_000;
const MAX_PENDING_PER_COMMAND = 32;

type PendingShellAgent = {
  agent: string;
  at: number;
};

function resolveVariable(options: Readonly<Record<string, unknown>>): string {
  const configured = options.variable;
  if (typeof configured !== "string") return DEFAULT_VARIABLE;

  const variable = configured.trim();
  if (variable.length === 0 || variable.includes("=") || variable.includes("\0")) {
    console.warn(
      `[agent-env] Ignoring invalid "variable" option; using ${DEFAULT_VARIABLE}.`,
    );
    return DEFAULT_VARIABLE;
  }

  return variable;
}

function isShellTool(tool: string): boolean {
  return tool === "shell" || tool === "bash" || /_(shell|bash)$/.test(tool);
}

function shellCommand(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;

  const record = input as Record<string, unknown>;
  const command = record.command ?? record.cmd ?? record.script;
  return typeof command === "string" ? command : undefined;
}

export default Plugin.define({
  id: "agent-env",
  async setup(ctx) {
    const variable = resolveVariable(ctx.options);
    const previous = process.env[variable];
    let currentAgent: string | undefined;

    // Shell creation receives no session or agent, so correlate it with the
    // tool call that produced the same command. FIFO order preserves repeated
    // commands from concurrent sessions.
    const pendingShellAgents = new Map<string, PendingShellAgent[]>();

    const takePendingAgent = (command: string): string | undefined => {
      const now = Date.now();
      const agents = (pendingShellAgents.get(command) ?? []).filter(
        (entry) => now - entry.at < PENDING_TTL_MS,
      );
      const entry = agents.shift();

      if (agents.length === 0) pendingShellAgents.delete(command);
      else pendingShellAgents.set(command, agents);

      return entry?.agent;
    };

    const applyAgent = (agent: string | undefined) => {
      if (!agent) return;
      currentAgent = agent;
      process.env[variable] = agent;
    };

    const toolRegistration = await ctx.tool.hook("execute.before", (event) => {
      applyAgent(event.agent);

      if (!isShellTool(event.tool)) return;
      const command = shellCommand(event.input);
      if (!command) return;

      const now = Date.now();
      const agents = (pendingShellAgents.get(command) ?? []).filter(
        (entry) => now - entry.at < PENDING_TTL_MS,
      );
      agents.push({ agent: event.agent, at: now });
      pendingShellAgents.set(command, agents.slice(-MAX_PENDING_PER_COMMAND));
    });

    const contextRegistration = await ctx.session.hook("context", (event) => {
      applyAgent(event.agent);
    });

    const shellRegistration = await ctx.shell.hook("create.before", (event) => {
      const agent = takePendingAgent(event.command) ?? currentAgent;
      if (agent === undefined) return;
      event.env[variable] = agent;
    });

    return async () => {
      await toolRegistration.dispose();
      await contextRegistration.dispose();
      await shellRegistration.dispose();

      if (previous === undefined) delete process.env[variable];
      else process.env[variable] = previous;
    };
  },
});

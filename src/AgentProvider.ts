import { Context, Layer } from "effect";
import { parseOutputLine as claudeParseOutputLine } from "./ClaudeOutputParser.js";
import { SANDBOX_WORKSPACE_DIR } from "./SandboxFactory.js";

/** Agent output event — shared between all agent providers */
export type AgentOutputEvent =
  | { type: "text"; text: string }
  | { type: "result"; result: string; usage: TokenUsage | null }
  | { type: "tool_call"; name: string; args: string };

export interface TokenUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read_input_tokens: number;
  readonly cache_creation_input_tokens: number;
  readonly total_cost_usd: number;
  readonly num_turns: number;
  readonly duration_ms: number;
}

export interface AgentProviderService {
  readonly name: string;
  readonly envManifest: Record<string, string>;
  readonly dockerfileTemplate: string;
  readonly buildCommand: (prompt: string, model: string) => string;
  readonly parseOutputLine: (line: string) => AgentOutputEvent[];
}

export class AgentProvider extends Context.Tag("AgentProvider")<
  AgentProvider,
  AgentProviderService
>() {}

const CLAUDE_CODE_DOCKERFILE = `FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \\
  git \\
  curl \\
  jq \\
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \\
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \\
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \\
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \\
  && apt-get update && apt-get install -y gh \\
  && rm -rf /var/lib/apt/lists/*

# Create a non-root user for Claude to run as
RUN useradd -m -s /bin/bash agent
USER agent

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

# Add Claude to PATH
ENV PATH="/home/agent/.local/bin:$PATH"

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at ${SANDBOX_WORKSPACE_DIR}
# and overrides the working directory to ${SANDBOX_WORKSPACE_DIR} at container start.
# Structure your Dockerfile so that ${SANDBOX_WORKSPACE_DIR} can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
`;

export const shellEscape = (s: string): string =>
  "'" + s.replace(/'/g, "'\\''") + "'";

export const claudeCodeProvider: AgentProviderService = {
  name: "claude-code",

  envManifest: {
    ANTHROPIC_API_KEY: "Anthropic API key",
    GH_TOKEN: "GitHub personal access token",
  },

  dockerfileTemplate: CLAUDE_CODE_DOCKERFILE,

  buildCommand: (prompt: string, model: string): string =>
    `claude --print --verbose --dangerously-skip-permissions --output-format stream-json --model ${model} -p ${shellEscape(prompt)}`,

  parseOutputLine: claudeParseOutputLine,
};

export const ClaudeCodeProvider = {
  layer: Layer.succeed(AgentProvider, claudeCodeProvider),
};

const AGENT_REGISTRY: Record<string, AgentProviderService> = {
  "claude-code": claudeCodeProvider,
};

export const registerAgentProvider = (provider: AgentProviderService): void => {
  AGENT_REGISTRY[provider.name] = provider;
};

export const getAgentProvider = (name: string): AgentProviderService => {
  const provider = AGENT_REGISTRY[name];
  if (!provider) {
    throw new Error(
      `Unknown agent provider: "${name}". Available providers: ${Object.keys(AGENT_REGISTRY).join(", ")}`,
    );
  }
  return provider;
};

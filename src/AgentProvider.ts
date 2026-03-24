export interface AgentProvider {
  readonly name: string;
  readonly envManifest: Record<string, string>;
  readonly envCheck: (env: Record<string, string>) => void;
  readonly dockerfileTemplate: string;
}

import { DOCKERFILE } from "./templates.js";

export const claudeCodeProvider: AgentProvider = {
  name: "claude-code",

  envManifest: {
    CLAUDE_CODE_OAUTH_TOKEN:
      "Claude Code OAuth token (or use ANTHROPIC_API_KEY instead)",
    ANTHROPIC_API_KEY:
      "Anthropic API key (alternative to CLAUDE_CODE_OAUTH_TOKEN)",
    GH_TOKEN: "GitHub personal access token",
  },

  envCheck(env: Record<string, string>): void {
    if (!env["CLAUDE_CODE_OAUTH_TOKEN"] && !env["ANTHROPIC_API_KEY"]) {
      throw new Error(
        "Neither CLAUDE_CODE_OAUTH_TOKEN nor ANTHROPIC_API_KEY found. Set one in .env, .sandcastle/.env, or as an environment variable.",
      );
    }
    if (!env["GH_TOKEN"]) {
      throw new Error(
        "GH_TOKEN not found. Set it in .env, .sandcastle/.env, or as an environment variable.",
      );
    }
  },

  dockerfileTemplate: DOCKERFILE,
};

const AGENT_REGISTRY: Record<string, AgentProvider> = {
  "claude-code": claudeCodeProvider,
};

export const getAgentProvider = (name: string): AgentProvider => {
  const provider = AGENT_REGISTRY[name];
  if (!provider) {
    throw new Error(
      `Unknown agent provider: "${name}". Available providers: ${Object.keys(AGENT_REGISTRY).join(", ")}`,
    );
  }
  return provider;
};

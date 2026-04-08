import { Layer } from "effect";
import {
  AgentProvider,
  registerAgentProvider,
  shellEscape,
  type AgentProviderService,
} from "./AgentProvider.js";
import { SANDBOX_WORKSPACE_DIR } from "./SandboxFactory.js";

const COPILOT_DOCKERFILE = `FROM node:22-bookworm

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

# Create a non-root user for the agent to run as
RUN useradd -m -s /bin/bash agent
USER agent

# Install standalone Copilot CLI (not the retired gh-copilot extension)
RUN curl -fsSL https://gh.io/copilot-install | bash

# Add Copilot to PATH
ENV PATH="/home/agent/.local/bin:$PATH"

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at ${SANDBOX_WORKSPACE_DIR}
# and overrides the working directory to ${SANDBOX_WORKSPACE_DIR} at container start.
# Structure your Dockerfile so that ${SANDBOX_WORKSPACE_DIR} can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
`;

export const copilotProviderService: AgentProviderService = {
  name: "copilot",
  envManifest: {
    GH_TOKEN: "GitHub personal access token",
    COPILOT_GITHUB_TOKEN: "GitHub Copilot token",
  },
  dockerfileTemplate: COPILOT_DOCKERFILE,
  buildCommand: (prompt: string, model: string): string =>
    `copilot -p ${shellEscape(prompt)} --autopilot --yolo --no-ask-user --silent --model=${model} --output-format=json`,
  parseOutputLine: () => [],
};

// Register copilot in the agent registry
registerAgentProvider(copilotProviderService);

export const CopilotProvider = {
  layer: Layer.succeed(AgentProvider, copilotProviderService),
};

import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  AgentProvider,
  ClaudeCodeProvider,
  claudeCodeProvider,
  getAgentProvider,
  type AgentProviderService,
} from "./AgentProvider.js";

describe("claudeCodeProvider", () => {
  it("has name 'claude-code'", () => {
    expect(claudeCodeProvider.name).toBe("claude-code");
  });

  it("envManifest contains ANTHROPIC_API_KEY and GH_TOKEN but NOT CLAUDE_CODE_OAUTH_TOKEN", () => {
    expect(claudeCodeProvider.envManifest).not.toHaveProperty(
      "CLAUDE_CODE_OAUTH_TOKEN",
    );
    expect(claudeCodeProvider.envManifest).toHaveProperty("ANTHROPIC_API_KEY");
    expect(claudeCodeProvider.envManifest).toHaveProperty("GH_TOKEN");
  });

  it("has a non-empty dockerfileTemplate", () => {
    expect(claudeCodeProvider.dockerfileTemplate).toContain("FROM");
    expect(claudeCodeProvider.dockerfileTemplate).toContain("claude");
  });
});

describe("AgentProvider Effect Service", () => {
  it("can be provided and consumed via Layer.succeed", async () => {
    const testProvider: AgentProviderService = {
      name: "test",
      envManifest: {},
      dockerfileTemplate: "",
      buildCommand: () => "",
      parseOutputLine: () => [],
    };

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* AgentProvider;
        return provider.name;
      }).pipe(Effect.provide(Layer.succeed(AgentProvider, testProvider))),
    );

    expect(result).toBe("test");
  });
});

describe("ClaudeCodeProvider", () => {
  it("provides AgentProvider via layer with name 'claude-code'", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* AgentProvider;
        return provider.name;
      }).pipe(Effect.provide(ClaudeCodeProvider.layer)),
    );
    expect(result).toBe("claude-code");
  });

  it("buildCommand produces the expected claude CLI invocation", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* AgentProvider;
        return provider.buildCommand("hello world", "claude-opus-4-6");
      }).pipe(Effect.provide(ClaudeCodeProvider.layer)),
    );
    expect(result).toBe(
      "claude --print --verbose --dangerously-skip-permissions --output-format stream-json --model claude-opus-4-6 -p 'hello world'",
    );
  });

  it("buildCommand shell-escapes single quotes in prompt", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* AgentProvider;
        return provider.buildCommand("it's a test", "claude-opus-4-6");
      }).pipe(Effect.provide(ClaudeCodeProvider.layer)),
    );
    expect(result).toContain("'it'\\''s a test'");
  });
});

describe("getAgentProvider", () => {
  it("returns claude-code provider for 'claude-code'", () => {
    const provider = getAgentProvider("claude-code");
    expect(provider.name).toBe("claude-code");
    expect(provider.buildCommand).toBeDefined();
    expect(provider.parseOutputLine).toBeDefined();
  });

  it("returns copilot provider for 'copilot'", async () => {
    // Import CopilotProvider to trigger registration
    await import("./CopilotProvider.js");
    const provider = getAgentProvider("copilot");
    expect(provider.name).toBe("copilot");
    expect(provider.buildCommand).toBeDefined();
    expect(provider.parseOutputLine).toBeDefined();
  });

  it("throws for unknown agent name", () => {
    expect(() => getAgentProvider("unknown-agent")).toThrow(/unknown-agent/);
  });
});

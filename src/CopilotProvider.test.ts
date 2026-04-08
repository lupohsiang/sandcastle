import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { AgentProvider } from "./AgentProvider.js";
import { CopilotProvider } from "./CopilotProvider.js";

describe("CopilotProvider", () => {
  it("provides name 'copilot'", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* AgentProvider;
        return provider.name;
      }).pipe(Effect.provide(CopilotProvider.layer)),
    );
    expect(result).toBe("copilot");
  });

  it("envManifest contains GH_TOKEN and COPILOT_GITHUB_TOKEN", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* AgentProvider;
        return provider.envManifest;
      }).pipe(Effect.provide(CopilotProvider.layer)),
    );
    expect(result).toHaveProperty("GH_TOKEN");
    expect(result).toHaveProperty("COPILOT_GITHUB_TOKEN");
  });

  it("buildCommand produces copilot CLI invocation", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* AgentProvider;
        return provider.buildCommand("test prompt", "gpt-4o");
      }).pipe(Effect.provide(CopilotProvider.layer)),
    );
    expect(result).toBe(
      "copilot -p 'test prompt' --autopilot --yolo --no-ask-user --silent --model=gpt-4o --output-format=json",
    );
  });

  it("parseOutputLine returns empty array (stub)", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* AgentProvider;
        return provider.parseOutputLine('{"some":"json"}');
      }).pipe(Effect.provide(CopilotProvider.layer)),
    );
    expect(result).toEqual([]);
  });

  it("dockerfileTemplate contains copilot", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* AgentProvider;
        return provider.dockerfileTemplate;
      }).pipe(Effect.provide(CopilotProvider.layer)),
    );
    expect(result).toContain("copilot-install");
    expect(result).toContain("FROM");
    expect(result).not.toContain("gh extension install");
  });
});

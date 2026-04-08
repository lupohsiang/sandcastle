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
      "copilot -p 'test prompt' --autopilot --yolo --no-ask-user -s --model=gpt-4o --output-format=json",
    );
  });

  it("parseOutputLine delegates to CopilotOutputParser", async () => {
    const line = JSON.stringify({
      type: "assistant.message",
      data: { messageId: "m1", content: "Hello from Copilot" },
    });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* AgentProvider;
        return provider.parseOutputLine(line);
      }).pipe(Effect.provide(CopilotProvider.layer)),
    );
    expect(result).toEqual([{ type: "text", text: "Hello from Copilot" }]);
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

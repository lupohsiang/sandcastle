import { Effect } from "effect";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FilesystemSandbox } from "./FilesystemSandbox.js";
import { preprocessPrompt } from "./PromptPreprocessor.js";
import { Sandbox, SandboxError } from "./Sandbox.js";

describe("PromptPreprocessor", () => {
  const setup = async () => {
    const sandboxDir = await mkdtemp(join(tmpdir(), "preprocess-test-"));
    const layer = FilesystemSandbox.layer(sandboxDir);
    return { sandboxDir, layer };
  };

  const run = (
    prompt: string,
    layer: ReturnType<typeof FilesystemSandbox.layer>,
    cwd: string,
  ) =>
    Effect.runPromise(
      Sandbox.pipe(
        Effect.flatMap((s) => preprocessPrompt(prompt, s, cwd)),
        Effect.provide(layer),
      ),
    );

  it("passes through prompts with no !`command` expressions unchanged", async () => {
    const { sandboxDir, layer } = await setup();
    const prompt = "This is a plain prompt with no commands.\n\nJust text.";
    const result = await run(prompt, layer, sandboxDir);
    expect(result).toBe(prompt);
  });

  it("replaces a single !`command` with its stdout", async () => {
    const { sandboxDir, layer } = await setup();
    const prompt = "Here is the date: !`echo 2026-03-24`";
    const result = await run(prompt, layer, sandboxDir);
    expect(result).toBe("Here is the date: 2026-03-24");
  });

  it("replaces multiple !`command` expressions", async () => {
    const { sandboxDir, layer } = await setup();
    const prompt = "First: !`echo hello`\nSecond: !`echo world`";
    const result = await run(prompt, layer, sandboxDir);
    expect(result).toBe("First: hello\nSecond: world");
  });

  it("fails with SandboxError on non-zero exit code", async () => {
    const { sandboxDir, layer } = await setup();
    const prompt = "Output: !`exit 1`";
    const result = await Effect.runPromise(
      Sandbox.pipe(
        Effect.flatMap((s) => preprocessPrompt(prompt, s, sandboxDir)),
        Effect.provide(layer),
        Effect.flip,
      ),
    );
    expect(result).toBeInstanceOf(SandboxError);
    expect(result.operation).toBe("preprocessPrompt");
    expect(result.message).toContain("exit 1");
    expect(result.message).toContain("exited with code 1");
  });

  it("runs commands with the provided cwd", async () => {
    const { sandboxDir, layer } = await setup();
    const prompt = "Dir: !`pwd`";
    const result = await run(prompt, layer, sandboxDir);
    expect(result).toBe(`Dir: ${sandboxDir}`);
  });
});

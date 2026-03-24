import { Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readConfig } from "./Config.js";
import { DockerSandbox } from "./DockerSandbox.js";
import { FilesystemSandbox } from "./FilesystemSandbox.js";
import { DEFAULT_MODEL } from "./Orchestrator.js";
import {
  buildImage,
  cleanupContainer,
  startContainer,
} from "./DockerLifecycle.js";
import { scaffold } from "./InitService.js";
import { run } from "./run.js";
import { AgentError, ConfigDirError, InitError } from "./errors.js";
import { DockerSandboxFactory, SandboxFactory } from "./SandboxFactory.js";
import { withSandboxLifecycle } from "./SandboxLifecycle.js";
import { syncIn, syncOut } from "./SyncService.js";
import { resolveEnv } from "./EnvResolver.js";

// --- Shared options ---

const sandboxDirOption = Options.directory("sandbox-dir").pipe(
  Options.withDescription("Path to the sandbox directory"),
);

const containerOption = Options.text("container").pipe(
  Options.withDescription("Docker container name"),
  Options.withDefault("claude-sandbox"),
);

const containerOptional = Options.text("container").pipe(
  Options.withDescription("Docker container name (use Docker layer)"),
  Options.optional,
);

const baseHeadOption = Options.text("base-head").pipe(
  Options.withDescription(
    "The HEAD commit SHA from sync-in (used to determine new commits)",
  ),
);

const imageNameOption = Options.text("image-name").pipe(
  Options.withDescription("Docker image name"),
  Options.withDefault("sandcastle:local"),
);

// --- Config directory check ---

const CONFIG_DIR = ".sandcastle";

const requireConfigDir = (cwd: string): Effect.Effect<void, ConfigDirError> =>
  Effect.tryPromise({
    try: () => access(join(cwd, CONFIG_DIR)),
    catch: () =>
      new ConfigDirError({
        message: "No .sandcastle/ found. Run `sandcastle init` first.",
      }),
  });

// --- Init command ---

const initCommand = Command.make(
  "init",
  {
    container: containerOption,
    imageName: imageNameOption,
  },
  ({ container, imageName }) =>
    Effect.gen(function* () {
      const cwd = process.cwd();

      yield* Console.log("Scaffolding .sandcastle/ config directory...");
      yield* Effect.tryPromise({
        try: () => scaffold(cwd),
        catch: (e) =>
          new InitError({
            message: `${e instanceof Error ? e.message : e}`,
          }),
      });
      yield* Console.log("Config directory created.");

      // Resolve env vars
      const env = yield* Effect.tryPromise({
        try: () => resolveEnv(cwd),
        catch: (e) =>
          new InitError({
            message: `${e instanceof Error ? e.message : e}`,
          }),
      });

      // Temporary hardcoded validation (will be replaced by agent provider env check)
      if (!env["CLAUDE_CODE_OAUTH_TOKEN"]) {
        yield* Effect.fail(
          new InitError({
            message:
              "CLAUDE_CODE_OAUTH_TOKEN not found. Set it in .env, .sandcastle/.env, or as an environment variable.",
          }),
        );
      }
      if (!env["GH_TOKEN"]) {
        yield* Effect.fail(
          new InitError({
            message:
              "GH_TOKEN not found. Set it in .env, .sandcastle/.env, or as an environment variable.",
          }),
        );
      }

      // Build image from .sandcastle/ directory
      const dockerfileDir = join(cwd, CONFIG_DIR);
      yield* Console.log(`Building Docker image '${imageName}'...`);
      yield* buildImage(imageName, dockerfileDir);

      // Start container
      yield* Console.log(`Starting container '${container}'...`);
      yield* startContainer(container, imageName, env);

      yield* Console.log(`Init complete! Container '${container}' is running.`);
    }),
);

// --- Setup-sandbox command ---

const setupSandboxCommand = Command.make(
  "setup-sandbox",
  {
    container: containerOption,
    imageName: imageNameOption,
  },
  ({ container, imageName }) =>
    Effect.gen(function* () {
      const cwd = process.cwd();
      yield* requireConfigDir(cwd);

      // Resolve env vars
      const env = yield* Effect.tryPromise({
        try: () => resolveEnv(cwd),
        catch: (e) =>
          new InitError({
            message: `${e instanceof Error ? e.message : e}`,
          }),
      });

      // Temporary hardcoded validation (will be replaced by agent provider env check)
      if (!env["CLAUDE_CODE_OAUTH_TOKEN"]) {
        yield* Effect.fail(
          new InitError({
            message:
              "CLAUDE_CODE_OAUTH_TOKEN not found. Set it in .env, .sandcastle/.env, or as an environment variable.",
          }),
        );
      }
      if (!env["GH_TOKEN"]) {
        yield* Effect.fail(
          new InitError({
            message:
              "GH_TOKEN not found. Set it in .env, .sandcastle/.env, or as an environment variable.",
          }),
        );
      }

      const dockerfileDir = join(cwd, CONFIG_DIR);
      yield* Console.log(`Building Docker image '${imageName}'...`);
      yield* buildImage(imageName, dockerfileDir);

      yield* Console.log(`Starting container '${container}'...`);
      yield* startContainer(container, imageName, env);

      yield* Console.log(
        `Setup complete! Container '${container}' is running.`,
      );
    }),
);

// --- Cleanup-sandbox command ---

const cleanupSandboxCommand = Command.make(
  "cleanup-sandbox",
  {
    container: containerOption,
    imageName: imageNameOption,
  },
  ({ container, imageName }) =>
    Effect.gen(function* () {
      yield* Console.log(`Cleaning up container '${container}'...`);
      yield* cleanupContainer(container, imageName);
      yield* Console.log("Cleanup complete.");
    }),
);

// --- Sync-in command ---

const SANDBOX_REPOS_DIR = "/home/agent/repos";

const syncInCommand = Command.make(
  "sync-in",
  { sandboxDir: sandboxDirOption, container: containerOptional },
  ({ sandboxDir, container }) =>
    Effect.gen(function* () {
      const hostRepoDir = process.cwd();
      const repoName = hostRepoDir.split("/").pop()!;

      const useDocker = container._tag === "Some";
      const sandboxRepoDir = useDocker
        ? `${SANDBOX_REPOS_DIR}/${repoName}`
        : `${sandboxDir}/repo`;

      yield* Console.log(`Syncing ${hostRepoDir} into ${sandboxRepoDir}...`);

      const layer = useDocker
        ? DockerSandbox.layer(container.value)
        : FilesystemSandbox.layer(sandboxDir);

      const { branch } = yield* syncIn(hostRepoDir, sandboxRepoDir).pipe(
        Effect.provide(layer),
      );

      yield* Console.log(`Sync-in complete. Branch: ${branch}`);
    }),
);

// --- Sync-out command ---

const syncOutCommand = Command.make(
  "sync-out",
  {
    sandboxDir: sandboxDirOption,
    baseHead: baseHeadOption,
    container: containerOptional,
  },
  ({ sandboxDir, baseHead, container }) =>
    Effect.gen(function* () {
      const hostRepoDir = process.cwd();
      const repoName = hostRepoDir.split("/").pop()!;

      const useDocker = container._tag === "Some";
      const sandboxRepoDir = useDocker
        ? `${SANDBOX_REPOS_DIR}/${repoName}`
        : `${sandboxDir}/repo`;

      yield* Console.log(
        `Syncing changes from ${sandboxRepoDir} back to ${hostRepoDir}...`,
      );

      const layer = useDocker
        ? DockerSandbox.layer(container.value)
        : FilesystemSandbox.layer(sandboxDir);

      yield* syncOut(hostRepoDir, sandboxRepoDir, baseHead).pipe(
        Effect.provide(layer),
      );

      yield* Console.log("Sync-out complete.");
    }),
);

// --- Run command ---

const iterationsOption = Options.integer("iterations").pipe(
  Options.withDescription("Number of agent iterations to run"),
  Options.optional,
);

const promptOption = Options.text("prompt").pipe(
  Options.withDescription("Inline prompt string for the agent"),
  Options.optional,
);

const promptFileOption = Options.file("prompt-file").pipe(
  Options.withDescription("Path to the prompt file for the agent"),
  Options.optional,
);

const branchOption = Options.text("branch").pipe(
  Options.withDescription("Target branch name for sandbox work"),
  Options.optional,
);

const modelOption = Options.text("model").pipe(
  Options.withDescription(
    "Model to use for the agent (e.g. claude-sonnet-4-6)",
  ),
  Options.optional,
);

const runCommand = Command.make(
  "run",
  {
    iterations: iterationsOption,
    imageName: imageNameOption,
    prompt: promptOption,
    promptFile: promptFileOption,
    branch: branchOption,
    model: modelOption,
  },
  ({ iterations, imageName, prompt, promptFile, branch, model }) =>
    Effect.gen(function* () {
      const hostRepoDir = process.cwd();
      yield* requireConfigDir(hostRepoDir);

      // Read config to resolve iterations: CLI flag > config > default (5)
      const config = yield* readConfig(hostRepoDir);
      const resolvedIterations =
        iterations._tag === "Some"
          ? iterations.value
          : (config.defaultMaxIterations ?? 5);

      const resolvedBranch = branch._tag === "Some" ? branch.value : undefined;
      const resolvedModel = model._tag === "Some" ? model.value : undefined;

      yield* Console.log(`=== SANDCASTLE RUN ===`);
      yield* Console.log(`Image:      ${imageName}`);
      yield* Console.log(`Iterations: ${resolvedIterations}`);
      if (resolvedBranch) {
        yield* Console.log(`Branch:     ${resolvedBranch}`);
      }
      if (resolvedModel) {
        yield* Console.log(`Model:      ${resolvedModel}`);
      }
      yield* Console.log(``);

      const result = yield* Effect.tryPromise({
        try: () =>
          run({
            prompt: prompt._tag === "Some" ? prompt.value : undefined,
            promptFile:
              promptFile._tag === "Some"
                ? resolve(promptFile.value)
                : undefined,
            maxIterations: resolvedIterations,
            branch: resolvedBranch,
            model: resolvedModel,
            _imageName: imageName,
          }),
        catch: (e) =>
          new AgentError({
            message: `${e instanceof Error ? e.message : e}`,
          }),
      });

      if (result.complete) {
        yield* Console.log(
          `\nRun complete: agent finished after ${result.iterationsRun} iteration(s).`,
        );
      } else {
        yield* Console.log(
          `\nRun complete: reached ${result.iterationsRun} iteration(s) without completion signal.`,
        );
      }
    }),
);

// --- Interactive command ---

const interactiveSession = (options: {
  hostRepoDir: string;
  sandboxRepoDir: string;
  config: import("./Config.js").SandcastleConfig;
  model?: string;
}): Effect.Effect<void, import("./errors.js").SandboxError, SandboxFactory> =>
  Effect.gen(function* () {
    const { hostRepoDir, sandboxRepoDir, config } = options;
    const resolvedModel = options.model ?? config.model ?? DEFAULT_MODEL;
    const factory = yield* SandboxFactory;

    yield* factory.withSandbox(
      withSandboxLifecycle(
        { hostRepoDir, sandboxRepoDir, hooks: config?.hooks },
        (ctx) =>
          Effect.gen(function* () {
            // Get container ID for docker exec -it
            const hostnameResult = yield* ctx.sandbox.exec("hostname");
            const containerId = hostnameResult.stdout.trim();

            // Launch interactive Claude session with TTY passthrough
            yield* Console.log("Launching interactive Claude session...");
            yield* Console.log("");

            const exitCode = yield* Effect.async<number, AgentError>(
              (resume) => {
                const proc = spawn(
                  "docker",
                  [
                    "exec",
                    "-it",
                    "-w",
                    ctx.sandboxRepoDir,
                    containerId,
                    "claude",
                    "--dangerously-skip-permissions",
                    "--model",
                    resolvedModel,
                  ],
                  { stdio: "inherit" },
                );

                proc.on("error", (error) => {
                  resume(
                    Effect.fail(
                      new AgentError({
                        message: `Failed to launch Claude: ${error.message}`,
                      }),
                    ),
                  );
                });

                proc.on("close", (code) => {
                  resume(Effect.succeed(code ?? 0));
                });
              },
            );

            yield* Console.log("");
            yield* Console.log(
              `Session ended (exit code ${exitCode}). Syncing changes back...`,
            );
          }),
      ),
    );
  });

const interactiveCommand = Command.make(
  "interactive",
  {
    imageName: imageNameOption,
    model: modelOption,
  },
  ({ imageName, model }) =>
    Effect.gen(function* () {
      const hostRepoDir = process.cwd();
      yield* requireConfigDir(hostRepoDir);

      const repoName = hostRepoDir.split("/").pop()!;
      const sandboxRepoDir = `${SANDBOX_REPOS_DIR}/${repoName}`;

      // Resolve env vars
      const env = yield* Effect.tryPromise({
        try: () => resolveEnv(hostRepoDir),
        catch: (e) =>
          new InitError({
            message: `${e instanceof Error ? e.message : e}`,
          }),
      });

      // Temporary hardcoded validation (will be replaced by agent provider env check)
      if (!env["CLAUDE_CODE_OAUTH_TOKEN"]) {
        yield* Effect.fail(
          new InitError({
            message:
              "CLAUDE_CODE_OAUTH_TOKEN not found. Set it in .env, .sandcastle/.env, or as an environment variable.",
          }),
        );
      }
      if (!env["GH_TOKEN"]) {
        yield* Effect.fail(
          new InitError({
            message:
              "GH_TOKEN not found. Set it in .env, .sandcastle/.env, or as an environment variable.",
          }),
        );
      }

      const config = yield* readConfig(hostRepoDir);
      const resolvedModel = model._tag === "Some" ? model.value : undefined;

      yield* Console.log("=== SANDCASTLE (Interactive) ===");
      yield* Console.log(`Image: ${imageName}`);
      yield* Console.log("");

      const factoryLayer = DockerSandboxFactory.layer(imageName, env);

      yield* interactiveSession({
        hostRepoDir,
        sandboxRepoDir,
        config,
        model: resolvedModel,
      }).pipe(Effect.provide(factoryLayer));
    }),
);

// --- Root command ---

const rootCommand = Command.make("sandcastle", {}, () =>
  Effect.gen(function* () {
    yield* Console.log("Sandcastle v0.0.1");
    yield* Console.log("Use --help to see available commands.");
  }),
);

export const sandcastle = rootCommand.pipe(
  Command.withSubcommands([
    syncInCommand,
    syncOutCommand,
    initCommand,
    setupSandboxCommand,
    cleanupSandboxCommand,
    runCommand,
    interactiveCommand,
  ]),
);

export const cli = Command.run(sandcastle, {
  name: "sandcastle",
  version: "0.0.1",
});

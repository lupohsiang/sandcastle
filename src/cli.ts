import { Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import { readConfig } from "./Config.js";
import { FilesystemSandbox } from "./FilesystemSandbox.js";
import { syncIn, syncOut } from "./SyncService.js";

const sandboxDirOption = Options.directory("sandbox-dir").pipe(
  Options.withDescription("Path to the sandbox directory"),
);

const syncInCommand = Command.make(
  "sync-in",
  { sandboxDir: sandboxDirOption },
  ({ sandboxDir }) =>
    Effect.gen(function* () {
      const hostRepoDir = process.cwd();
      const sandboxRepoDir = `${sandboxDir}/repo`;

      yield* Console.log(`Syncing ${hostRepoDir} into ${sandboxRepoDir}...`);

      const config = yield* readConfig(hostRepoDir);
      const { branch } = yield* syncIn(
        hostRepoDir,
        sandboxRepoDir,
        config,
      ).pipe(Effect.provide(FilesystemSandbox.layer(sandboxDir)));

      yield* Console.log(`Sync-in complete. Branch: ${branch}`);
    }),
);

const baseHeadOption = Options.text("base-head").pipe(
  Options.withDescription(
    "The HEAD commit SHA from sync-in (used to determine new commits)",
  ),
);

const syncOutCommand = Command.make(
  "sync-out",
  { sandboxDir: sandboxDirOption, baseHead: baseHeadOption },
  ({ sandboxDir, baseHead }) =>
    Effect.gen(function* () {
      const hostRepoDir = process.cwd();
      const sandboxRepoDir = `${sandboxDir}/repo`;

      yield* Console.log(
        `Syncing changes from ${sandboxRepoDir} back to ${hostRepoDir}...`,
      );

      yield* syncOut(hostRepoDir, sandboxRepoDir, baseHead).pipe(
        Effect.provide(FilesystemSandbox.layer(sandboxDir)),
      );

      yield* Console.log("Sync-out complete.");
    }),
);

const rootCommand = Command.make("sandcastle", {}, () =>
  Effect.gen(function* () {
    yield* Console.log("🏰 Sandcastle v0.0.1");
    yield* Console.log("Use --help to see available commands.");
  }),
);

export const sandcastle = rootCommand.pipe(
  Command.withSubcommands([syncInCommand, syncOutCommand]),
);

export const cli = Command.run(sandcastle, {
  name: "sandcastle",
  version: "0.0.1",
});

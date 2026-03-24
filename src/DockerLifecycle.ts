import { Effect } from "effect";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { DockerError } from "./errors.js";

const dockerExec = (args: string[]): Effect.Effect<string, DockerError> =>
  Effect.async((resume) => {
    execFile(
      "docker",
      args,
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          resume(
            Effect.fail(
              new DockerError({
                message: `docker ${args[0]} failed: ${stderr?.toString() || error.message}`,
              }),
            ),
          );
        } else {
          resume(Effect.succeed(stdout.toString()));
        }
      },
    );
  });

/**
 * Build the sandcastle Docker image from a Dockerfile directory.
 */
export const buildImage = (
  imageName: string,
  dockerfileDir: string,
): Effect.Effect<void, DockerError> =>
  Effect.gen(function* () {
    yield* dockerExec(["build", "-t", imageName, resolve(dockerfileDir)]);
  });

/**
 * Start a new container with environment variables injected.
 */
export const startContainer = (
  containerName: string,
  imageName: string,
  env: Record<string, string>,
): Effect.Effect<void, DockerError> =>
  Effect.gen(function* () {
    // Check if container already exists
    const existing = yield* dockerExec([
      "ps",
      "-a",
      "--filter",
      `name=^${containerName}$`,
      "--format",
      "{{.Names}}",
    ]);

    if (existing.trim() === containerName) {
      yield* Effect.fail(
        new DockerError({
          message: `Container '${containerName}' already exists. Run cleanup first.`,
        }),
      );
    }

    const envFlags = Object.entries(env).flatMap(([k, v]) => [
      "-e",
      `${k}=${v}`,
    ]);

    yield* dockerExec([
      "run",
      "-d",
      "--name",
      containerName,
      ...envFlags,
      imageName,
    ]);
  });

/**
 * Stop and remove a container without removing the image.
 */
export const removeContainer = (
  containerName: string,
): Effect.Effect<void, DockerError> =>
  Effect.gen(function* () {
    // Stop container (ignore errors if already stopped)
    yield* Effect.ignore(dockerExec(["stop", containerName]));
    // Remove container (ignore errors if not found)
    yield* Effect.ignore(dockerExec(["rm", containerName]));
  });

/**
 * Stop and remove the container and image.
 */
export const cleanupContainer = (
  containerName: string,
  imageName: string,
): Effect.Effect<void, DockerError> =>
  Effect.gen(function* () {
    // Stop container (ignore errors if already stopped)
    yield* Effect.ignore(dockerExec(["stop", containerName]));
    // Remove container (ignore errors if not found)
    yield* Effect.ignore(dockerExec(["rm", containerName]));
    // Remove image (ignore errors if not found)
    yield* Effect.ignore(dockerExec(["rmi", imageName]));
  });

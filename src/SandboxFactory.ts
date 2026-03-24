import { Context, Effect, Layer } from "effect";
import { randomUUID } from "node:crypto";
import { DockerSandbox } from "./DockerSandbox.js";
import { startContainer, removeContainer } from "./DockerLifecycle.js";
import type { DockerError } from "./errors.js";
import { Sandbox } from "./Sandbox.js";

export class SandboxFactory extends Context.Tag("SandboxFactory")<
  SandboxFactory,
  {
    readonly withSandbox: <A, E, R>(
      effect: Effect.Effect<A, E, R | Sandbox>,
    ) => Effect.Effect<A, E | DockerError, Exclude<R, Sandbox>>;
  }
>() {}

export const DockerSandboxFactory = {
  layer: (
    imageName: string,
    env: Record<string, string>,
  ): Layer.Layer<SandboxFactory> =>
    Layer.succeed(SandboxFactory, {
      withSandbox: <A, E, R>(
        effect: Effect.Effect<A, E, R | Sandbox>,
      ): Effect.Effect<A, E | DockerError, Exclude<R, Sandbox>> => {
        const containerName = `sandcastle-${randomUUID()}`;
        return Effect.acquireUseRelease(
          startContainer(containerName, imageName, env),
          () =>
            effect.pipe(
              Effect.provide(DockerSandbox.layer(containerName)),
            ) as Effect.Effect<A, E | DockerError, Exclude<R, Sandbox>>,
          () => removeContainer(containerName).pipe(Effect.orDie),
        );
      },
    }),
};

import { Context, Effect, Layer } from "effect";
import { randomUUID } from "node:crypto";
import { DockerSandbox } from "./DockerSandbox.js";
import { startContainer, removeContainer } from "./DockerLifecycle.js";
import { Sandbox, SandboxError } from "./Sandbox.js";

export class SandboxFactory extends Context.Tag("SandboxFactory")<
  SandboxFactory,
  {
    readonly withSandbox: <A, E, R>(
      effect: Effect.Effect<A, E, R | Sandbox>,
    ) => Effect.Effect<A, E | SandboxError, Exclude<R, Sandbox>>;
  }
>() {}

export const DockerSandboxFactory = {
  layer: (
    imageName: string,
    oauthToken: string,
    ghToken: string,
  ): Layer.Layer<SandboxFactory> =>
    Layer.succeed(SandboxFactory, {
      withSandbox: <A, E, R>(
        effect: Effect.Effect<A, E, R | Sandbox>,
      ): Effect.Effect<A, E | SandboxError, Exclude<R, Sandbox>> => {
        const containerName = `sandcastle-${randomUUID()}`;
        return Effect.acquireUseRelease(
          startContainer(containerName, imageName, oauthToken, ghToken),
          () =>
            effect.pipe(
              Effect.provide(DockerSandbox.layer(containerName)),
            ) as Effect.Effect<A, E | SandboxError, Exclude<R, Sandbox>>,
          () => removeContainer(containerName).pipe(Effect.orDie),
        );
      },
    }),
};

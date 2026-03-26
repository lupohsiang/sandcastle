import { Effect } from "effect";
import { Display } from "./Display.js";
import { PromptError } from "./errors.js";

/**
 * A map of named values used for prompt argument substitution.
 * Each key corresponds to a `{{KEY}}` placeholder in the prompt; the value
 * replaces it before the prompt is passed to the agent.
 */
export type PromptArgs = Record<string, string | number | boolean>;

const PLACEHOLDER_PATTERN = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

export const substitutePromptArgs = (
  prompt: string,
  args: PromptArgs,
): Effect.Effect<string, PromptError, Display> => {
  const matches = [...prompt.matchAll(PLACEHOLDER_PATTERN)];

  if (matches.length === 0 && Object.keys(args).length === 0) {
    return Effect.succeed(prompt);
  }

  return Effect.gen(function* () {
    const display = yield* Display;

    // Collect all keys referenced in the prompt
    const referencedKeys = new Set(matches.map((m) => m[1]!));

    // Check for missing keys (placeholder in prompt but no matching arg)
    for (const key of referencedKeys) {
      if (!(key in args)) {
        return yield* Effect.fail(
          new PromptError({
            message: `Prompt argument "{{${key}}}" has no matching value in promptArgs`,
          }),
        );
      }
    }

    // Warn about unused keys (arg provided but no matching placeholder)
    for (const key of Object.keys(args)) {
      if (!referencedKeys.has(key)) {
        yield* display.status(
          `Prompt argument "${key}" was provided but not referenced in the prompt`,
          "warn",
        );
      }
    }

    // Replace all placeholders with their values
    const result = prompt.replace(PLACEHOLDER_PATTERN, (_match, key) =>
      args[key as string]!.toString(),
    );

    return result;
  });
};

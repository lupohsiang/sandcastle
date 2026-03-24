import { readFile } from "node:fs/promises";
import { join } from "node:path";

const parseEnvFile = async (
  filePath: string,
): Promise<Record<string, string>> => {
  try {
    const content = await readFile(filePath, "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      vars[key] = value;
    }
    return vars;
  } catch {
    return {};
  }
};

/**
 * Resolve all env vars from .env files with process.env fallback.
 *
 * Precedence: repo root .env > .sandcastle/.env > process.env
 * Only keys declared in a .env file are resolved from process.env.
 */
export const resolveEnv = async (
  repoDir: string,
): Promise<Record<string, string>> => {
  const rootEnv = await parseEnvFile(join(repoDir, ".env"));
  const sandcastleEnv = await parseEnvFile(
    join(repoDir, ".sandcastle", ".env"),
  );

  // Collect all declared keys from both files
  const allKeys = new Set([
    ...Object.keys(rootEnv),
    ...Object.keys(sandcastleEnv),
  ]);

  const result: Record<string, string> = {};
  for (const key of allKeys) {
    const value = rootEnv[key] || sandcastleEnv[key] || process.env[key];
    if (value) {
      result[key] = value;
    }
  }

  return result;
};

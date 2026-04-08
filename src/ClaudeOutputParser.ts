import type { AgentOutputEvent, TokenUsage } from "./AgentProvider.js";

const extractUsage = (obj: Record<string, unknown>): TokenUsage | null => {
  const usage = obj.usage as Record<string, unknown> | undefined;
  if (
    !usage ||
    typeof usage.input_tokens !== "number" ||
    typeof usage.output_tokens !== "number"
  ) {
    return null;
  }
  return {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_input_tokens:
      typeof usage.cache_read_input_tokens === "number"
        ? usage.cache_read_input_tokens
        : 0,
    cache_creation_input_tokens:
      typeof usage.cache_creation_input_tokens === "number"
        ? usage.cache_creation_input_tokens
        : 0,
    total_cost_usd:
      typeof obj.total_cost_usd === "number" ? obj.total_cost_usd : 0,
    num_turns: typeof obj.num_turns === "number" ? obj.num_turns : 0,
    duration_ms: typeof obj.duration_ms === "number" ? obj.duration_ms : 0,
  };
};

/** Maps allowlisted tool names to the input field containing the display arg */
const TOOL_ARG_FIELDS: Record<string, string> = {
  Bash: "command",
  WebSearch: "query",
  WebFetch: "url",
  Agent: "description",
};

/** Extract displayable events from a Claude stream-json line */
export const parseOutputLine = (line: string): AgentOutputEvent[] => {
  if (!line.startsWith("{")) return [];
  try {
    const obj = JSON.parse(line);
    if (obj.type === "assistant" && Array.isArray(obj.message?.content)) {
      const events: AgentOutputEvent[] = [];
      const texts: string[] = [];
      for (const block of obj.message.content as {
        type: string;
        text?: string;
        name?: string;
        input?: Record<string, unknown>;
      }[]) {
        if (block.type === "text" && typeof block.text === "string") {
          texts.push(block.text);
        } else if (
          block.type === "tool_use" &&
          typeof block.name === "string" &&
          block.input !== undefined
        ) {
          const argField = TOOL_ARG_FIELDS[block.name];
          if (argField === undefined) continue; // not allowlisted
          const argValue = block.input[argField];
          if (typeof argValue !== "string") continue; // missing/wrong arg field
          if (texts.length > 0) {
            events.push({ type: "text", text: texts.join("") });
            texts.length = 0;
          }
          events.push({
            type: "tool_call",
            name: block.name,
            args: argValue,
          });
        }
      }
      if (texts.length > 0) {
        events.push({ type: "text", text: texts.join("") });
      }
      return events;
    }
    if (obj.type === "result" && typeof obj.result === "string") {
      return [{ type: "result", result: obj.result, usage: extractUsage(obj) }];
    }
  } catch {
    // Not valid JSON — skip
  }
  return [];
};

const TOOL_ARG_EXTRACTORS: Record<
  string,
  (input: Record<string, unknown>) => string | undefined
> = {
  Bash: (input) =>
    typeof input.command === "string" ? input.command : undefined,
  WebSearch: (input) =>
    typeof input.query === "string" ? input.query : undefined,
  WebFetch: (input) => (typeof input.url === "string" ? input.url : undefined),
  Agent: (input) =>
    typeof input.description === "string" ? input.description : undefined,
};

/**
 * Format a tool call for display. Returns null if the tool is not in the
 * allowlist or the required arg field is missing.
 */
export const formatToolCall = (
  name: string,
  input: Record<string, unknown>,
): { name: string; formattedArgs: string } | null => {
  const extractor = TOOL_ARG_EXTRACTORS[name];
  if (!extractor) return null;
  const arg = extractor(input);
  if (arg === undefined) return null;
  return { name, formattedArgs: arg };
};

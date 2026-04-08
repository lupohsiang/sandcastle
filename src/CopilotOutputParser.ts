import type { AgentOutputEvent, TokenUsage } from "./AgentProvider.js";

/** Maps allowlisted Copilot tool names to the argument field to display */
const TOOL_ARG_FIELDS: Record<string, string> = {
  bash: "command",
  edit: "path",
};

const extractToolCalls = (toolRequests: unknown): AgentOutputEvent[] => {
  if (!Array.isArray(toolRequests)) return [];
  const events: AgentOutputEvent[] = [];
  for (const req of toolRequests as {
    name?: string;
    arguments?: Record<string, unknown>;
  }[]) {
    if (typeof req.name !== "string") continue;
    const argField = TOOL_ARG_FIELDS[req.name];
    if (!argField) continue;
    const argValue = req.arguments?.[argField];
    if (typeof argValue !== "string") continue;
    events.push({ type: "tool_call", name: req.name, args: argValue });
  }
  return events;
};

/** Extract displayable events from a Copilot CLI JSONL line */
export const parseOutputLine = (line: string): AgentOutputEvent[] => {
  if (!line.startsWith("{")) return [];
  try {
    const obj = JSON.parse(line);
    const type: unknown = obj.type;

    // Top-level "result" event has no data wrapper
    if (type === "result") {
      const usage = obj.usage as Record<string, unknown> | undefined;
      if (!usage) return [{ type: "result", result: "", usage: null }];
      const tokenUsage: TokenUsage = {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        total_cost_usd: 0,
        num_turns:
          typeof usage.premiumRequests === "number" ? usage.premiumRequests : 0,
        duration_ms:
          typeof usage.totalApiDurationMs === "number"
            ? usage.totalApiDurationMs
            : 0,
      };
      return [{ type: "result", result: "", usage: tokenUsage }];
    }

    const data: Record<string, unknown> | undefined = obj.data;
    if (!data) return [];

    if (type === "assistant.message") {
      const events: AgentOutputEvent[] = [];
      const content = data.content;
      if (typeof content === "string" && content.length > 0) {
        events.push({ type: "text", text: content });
      }
      events.push(...extractToolCalls(data.toolRequests));
      return events;
    }

    if (type === "tool.execution_start") {
      const toolName = data.toolName;
      if (typeof toolName !== "string") return [];
      const argField = TOOL_ARG_FIELDS[toolName];
      if (!argField) return [];
      const args = data.arguments as Record<string, unknown> | undefined;
      const argValue = args?.[argField];
      if (typeof argValue !== "string") return [];
      return [{ type: "tool_call", name: toolName, args: argValue }];
    }

    if (type === "assistant.message_delta") {
      const delta = data.deltaContent;
      if (typeof delta === "string" && delta.length > 0) {
        return [{ type: "text", text: delta }];
      }
      return [];
    }

    return [];
  } catch {
    return [];
  }
};

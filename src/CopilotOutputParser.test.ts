import { describe, expect, it } from "vitest";
import { parseOutputLine } from "./CopilotOutputParser.js";

describe("parseOutputLine (Copilot JSONL)", () => {
  it("returns empty array for non-JSON lines", () => {
    expect(parseOutputLine("not json")).toEqual([]);
    expect(parseOutputLine("")).toEqual([]);
  });

  it("returns empty array for malformed JSON starting with {", () => {
    expect(parseOutputLine("{bad json")).toEqual([]);
    expect(parseOutputLine('{"type": "assistant.message", broken')).toEqual([]);
  });

  it("returns empty array for unknown event types", () => {
    const line = JSON.stringify({
      type: "session.start",
      data: { something: true },
    });
    expect(parseOutputLine(line)).toEqual([]);
  });

  it("extracts text from assistant.message", () => {
    const line = JSON.stringify({
      type: "assistant.message",
      data: { messageId: "m1", content: "Hello world" },
    });
    expect(parseOutputLine(line)).toEqual([
      { type: "text", text: "Hello world" },
    ]);
  });

  it("extracts text from assistant.message_delta", () => {
    const line = JSON.stringify({
      type: "assistant.message_delta",
      data: { messageId: "m1", deltaContent: "chunk" },
    });
    expect(parseOutputLine(line)).toEqual([{ type: "text", text: "chunk" }]);
  });

  it("returns empty array for assistant.message_delta with empty deltaContent", () => {
    const line = JSON.stringify({
      type: "assistant.message_delta",
      data: { messageId: "m1", deltaContent: "" },
    });
    expect(parseOutputLine(line)).toEqual([]);
  });

  it("extracts tool_call from assistant.message toolRequests (bash)", () => {
    const line = JSON.stringify({
      type: "assistant.message",
      data: {
        messageId: "m1",
        content: "",
        toolRequests: [
          {
            toolCallId: "tc1",
            name: "bash",
            arguments: { command: "npm test" },
          },
        ],
      },
    });
    expect(parseOutputLine(line)).toEqual([
      { type: "tool_call", name: "bash", args: "npm test" },
    ]);
  });

  it("extracts tool_call from assistant.message toolRequests (edit)", () => {
    const line = JSON.stringify({
      type: "assistant.message",
      data: {
        messageId: "m1",
        content: "",
        toolRequests: [
          {
            toolCallId: "tc1",
            name: "edit",
            arguments: { path: "src/index.ts" },
          },
        ],
      },
    });
    expect(parseOutputLine(line)).toEqual([
      { type: "tool_call", name: "edit", args: "src/index.ts" },
    ]);
  });

  it("filters out non-allowlisted tools from toolRequests", () => {
    const line = JSON.stringify({
      type: "assistant.message",
      data: {
        messageId: "m1",
        content: "",
        toolRequests: [
          { toolCallId: "tc1", name: "grep", arguments: { pattern: "foo" } },
          {
            toolCallId: "tc2",
            name: "read",
            arguments: { path: "/etc/hosts" },
          },
        ],
      },
    });
    expect(parseOutputLine(line)).toEqual([]);
  });

  it("extracts tool_call from tool.execution_start (allowlisted)", () => {
    const line = JSON.stringify({
      type: "tool.execution_start",
      data: {
        toolCallId: "tc1",
        toolName: "bash",
        arguments: { command: "ls -la" },
      },
    });
    expect(parseOutputLine(line)).toEqual([
      { type: "tool_call", name: "bash", args: "ls -la" },
    ]);
  });

  it("filters out non-allowlisted tool.execution_start", () => {
    const line = JSON.stringify({
      type: "tool.execution_start",
      data: {
        toolCallId: "tc1",
        toolName: "grep",
        arguments: { pattern: "foo" },
      },
    });
    expect(parseOutputLine(line)).toEqual([]);
  });

  it("extracts result from top-level result event with usage", () => {
    const line = JSON.stringify({
      type: "result",
      timestamp: "2026-04-08T03:14:06.518Z",
      sessionId: "abc-123",
      exitCode: 0,
      usage: {
        premiumRequests: 2,
        totalApiDurationMs: 4443,
        sessionDurationMs: 11607,
        codeChanges: { linesAdded: 5, linesRemoved: 2, filesModified: [] },
      },
    });
    expect(parseOutputLine(line)).toEqual([
      {
        type: "result",
        result: "",
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          total_cost_usd: 0,
          num_turns: 2,
          duration_ms: 4443,
        },
      },
    ]);
  });

  it("handles result event with missing usage fields", () => {
    const line = JSON.stringify({
      type: "result",
      timestamp: "2026-04-08T00:00:00Z",
      sessionId: "abc",
      exitCode: 0,
      usage: {},
    });
    expect(parseOutputLine(line)).toEqual([
      {
        type: "result",
        result: "",
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          total_cost_usd: 0,
          num_turns: 0,
          duration_ms: 0,
        },
      },
    ]);
  });

  it("handles result event without usage object", () => {
    const line = JSON.stringify({
      type: "result",
      timestamp: "2026-04-08T00:00:00Z",
      sessionId: "abc",
      exitCode: 1,
    });
    expect(parseOutputLine(line)).toEqual([
      {
        type: "result",
        result: "",
        usage: null,
      },
    ]);
  });

  it("handles assistant.message with both text and toolRequests", () => {
    const line = JSON.stringify({
      type: "assistant.message",
      data: {
        messageId: "m1",
        content: "Running tests...",
        toolRequests: [
          {
            toolCallId: "tc1",
            name: "bash",
            arguments: { command: "npm test" },
          },
        ],
      },
    });
    expect(parseOutputLine(line)).toEqual([
      { type: "text", text: "Running tests..." },
      { type: "tool_call", name: "bash", args: "npm test" },
    ]);
  });

  it("returns empty array for assistant.message with empty content", () => {
    const line = JSON.stringify({
      type: "assistant.message",
      data: { messageId: "m1", content: "" },
    });
    expect(parseOutputLine(line)).toEqual([]);
  });
});

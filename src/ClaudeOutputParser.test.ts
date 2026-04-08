import { describe, expect, it } from "vitest";
import { parseOutputLine, formatToolCall } from "./ClaudeOutputParser.js";

describe("parseOutputLine (Claude stream-json)", () => {
  it("extracts text from assistant message", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "Hello world" }] },
    });
    expect(parseOutputLine(line)).toEqual([
      { type: "text", text: "Hello world" },
    ]);
  });

  it("extracts result from result message", () => {
    const line = JSON.stringify({
      type: "result",
      result: "Final answer <promise>COMPLETE</promise>",
    });
    expect(parseOutputLine(line)).toEqual([
      {
        type: "result",
        result: "Final answer <promise>COMPLETE</promise>",
        usage: null,
      },
    ]);
  });

  it("returns empty array for non-JSON lines", () => {
    expect(parseOutputLine("not json")).toEqual([]);
    expect(parseOutputLine("")).toEqual([]);
  });

  it("returns empty array for malformed JSON starting with {", () => {
    expect(parseOutputLine("{bad json")).toEqual([]);
    expect(parseOutputLine('{"type": "assistant", broken')).toEqual([]);
  });

  it("returns empty array for unrecognized JSON types", () => {
    const line = JSON.stringify({ type: "system", data: "something" });
    expect(parseOutputLine(line)).toEqual([]);
  });

  it("handles multiple text content blocks", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "world" },
        ],
      },
    });
    expect(parseOutputLine(line)).toEqual([
      { type: "text", text: "Hello world" },
    ]);
  });

  it("extracts tool_use block (Bash -> command arg)", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", name: "Bash", input: { command: "npm test" } },
        ],
      },
    });
    expect(parseOutputLine(line)).toEqual([
      { type: "tool_call", name: "Bash", args: "npm test" },
    ]);
  });

  it("handles mixed text and tool_use content blocks", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "Running tests..." },
          { type: "tool_use", name: "Bash", input: { command: "npm test" } },
        ],
      },
    });
    expect(parseOutputLine(line)).toEqual([
      { type: "text", text: "Running tests..." },
      { type: "tool_call", name: "Bash", args: "npm test" },
    ]);
  });

  it("filters out non-allowlisted tools", () => {
    for (const name of ["Read", "Glob", "Grep", "Edit", "Write"]) {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name, input: { file_path: "/some/file" } },
          ],
        },
      });
      expect(parseOutputLine(line)).toEqual([]);
    }
  });

  it("extracts usage data from result message", () => {
    const line = JSON.stringify({
      type: "result",
      result: "Done.",
      total_cost_usd: 0.14,
      num_turns: 3,
      duration_ms: 12000,
      usage: {
        input_tokens: 52340,
        output_tokens: 3201,
        cache_read_input_tokens: 10000,
        cache_creation_input_tokens: 5000,
      },
    });
    const parsed = parseOutputLine(line);
    expect(parsed).toEqual([
      {
        type: "result",
        result: "Done.",
        usage: {
          input_tokens: 52340,
          output_tokens: 3201,
          cache_read_input_tokens: 10000,
          cache_creation_input_tokens: 5000,
          total_cost_usd: 0.14,
          num_turns: 3,
          duration_ms: 12000,
        },
      },
    ]);
  });
});

describe("formatToolCall", () => {
  it("formats Bash tool call using command field", () => {
    expect(formatToolCall("Bash", { command: "npm test" })).toEqual({
      name: "Bash",
      formattedArgs: "npm test",
    });
  });

  it("returns null for non-allowlisted tools", () => {
    expect(formatToolCall("Read", { file_path: "/some/path" })).toBeNull();
    expect(formatToolCall("UnknownTool", { x: 1 })).toBeNull();
  });

  it("returns null when the arg field is missing", () => {
    expect(formatToolCall("Bash", {})).toBeNull();
  });
});

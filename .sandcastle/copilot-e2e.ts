import * as sandcastle from "@ai-hero/sandcastle";

const result = await sandcastle.run({
  agent: "copilot",
  prompt: "Say hello and then say DONE",
  model: "claude-sonnet-4.6",
  imageName: "sandcastle:copilot-e2e",
  logging: { type: "stdout" },
});

console.log("\n=== Result ===");
console.log("iterations:", result.iterationsRun);
console.log("completionSignal:", result.completionSignal);
console.log("commits:", result.commits.length);
console.log("stdout length:", result.stdout.length);
console.log("\n=== stdout (first 500 chars) ===");
console.log(result.stdout.slice(0, 500));

---
"@ai-hero/sandcastle": patch
---

Promote AgentProvider to Effect Service (Context.Tag) with swappable agent backends. Add ClaudeCodeProvider and CopilotProvider layers. Orchestrator now reads buildCommand and parseOutputLine from the AgentProvider service instead of hardcoding Claude CLI invocation.

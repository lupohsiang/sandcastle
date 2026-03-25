# ISSUES

Here are the open issues in the repo:

<issues-json>

!`gh issue list --state open --json number,title,body,labels`

</issues-json>

# TASK

Analyze the open issues and determine which can be worked on in parallel. Two issues can be parallelized if they touch different parts of the codebase and are unlikely to produce merge conflicts.

Group the issues into:

1. **Parallel batch** - issues that can be worked on simultaneously
2. **Sequential** - issues that depend on each other or touch overlapping code

For the parallel batch, assign each issue a branch name.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags:

<plan>
{"issues": [{"number": 42, "title": "Fix auth bug", "branch": "sandcastle/issue-42-fix-auth-bug"}]}
</plan>

Include only issues from the parallel batch. If no issues can be parallelized, include the single highest-priority issue.

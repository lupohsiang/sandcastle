# TASK

Review the code changes on branch `{{BRANCH}}` and provide actionable feedback.

# CONTEXT

## Branch diff

!`git diff main...{{BRANCH}}`

## Commits on this branch

!`git log main..{{BRANCH}} --oneline`

# REVIEW CHECKLIST

Examine the diff above and assess:

1. **Correctness** — Does the implementation match the intent of the issue? Are edge cases handled?
2. **Tests** — Are the new/changed behaviours covered by tests? Do the tests actually exercise the right code paths?
3. **Code quality** — Is the code clear, minimal, and consistent with the surrounding codebase? No dead code or unnecessary complexity?
4. **Type safety** — Are there any unsafe casts, `any` types, or unchecked assumptions?
5. **Security** — Does the change introduce injection vulnerabilities, credential leaks, or other security issues?

# OUTPUT

If the branch is acceptable:

```
REVIEW RESULT: APPROVED

<summary of what the implementation does and why it looks good>
```

If changes are needed, make them directly on the branch, then commit and output:

```
REVIEW RESULT: CHANGES MADE

<summary of what was changed and why>
```

Once your review is complete, output <promise>COMPLETE</promise>.

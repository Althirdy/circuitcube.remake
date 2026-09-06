---
name: edit-only-development
description: Implement, refactor, or modify CircuitCube code and documentation while leaving command-based verification and runtime execution to the user. Use automatically for development work in this repository; do not use for requests that only ask for explanation, planning, or review without edits.
---

# Edit-Only Development

Make the requested CircuitCube code or documentation changes without running project commands that execute or verify the result.

## Workflow

1. Inspect the minimum repository context needed to edit safely. Concise read-only commands for reading files, listing paths, and searching symbols are allowed.
2. Apply code and documentation changes with patch-based editing. Preserve unrelated work and follow the repository's existing architecture and conventions.
3. Review the changed files statically for obvious syntax, type, import, control-flow, and integration mistakes. Fix issues found through inspection.
4. End with a concise description of the changes, state that command-based verification was not run because this skill is active, and give the user the exact applicable commands to run from the correct working directory and in the recommended order.

## Command Boundary

Do not run:

- builds, tests, linting, formatting, or type checking;
- development or preview servers;
- browser automation or visual test runners;
- package installation or package-manager maintenance commands;
- migrations, code generation, asset generation, or asset synchronization;
- background processes or other runtime and verification commands.

If implementation requires a dependency, edit the appropriate manifest when authorized and tell the user which installation command to run. Do not install it.

Recommend only commands relevant to the changes made. Do not list every command exposed by the project.

An explicit instruction from the user to run a specific verification or execution command overrides this default for that command.

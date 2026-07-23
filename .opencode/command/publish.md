---
description: Commits, pushes, and refreshes CodeGraph for the current development.
agent: build
---

Publish all current project changes.

Use `$ARGUMENTS` as the exact commit message when it is provided. Otherwise, inspect the staged diff and write a concise commit message matching the repository style.

Before committing, inspect `git status`, `git diff`, and `git log --oneline -10`. If there are no changes, report that and stop. Stage all current changes with `git add -A`, inspect the staged diff, and run `git diff --cached --check` before committing.

After committing, run `git pull --rebase origin main`, then `git pull --rebase origin develop`, and push with `git push origin develop`. Do not force-push. If a rebase conflict occurs, resolve it carefully and continue; do not discard changes.

After a successful push, refresh the CodeGraph with `codebase-memory-mcp_index_repository` for `/workspace/strategy-game` using project name `strategy-game`, `full` mode, and persistence enabled. Report the commit hash, push result, and indexed node and edge counts.

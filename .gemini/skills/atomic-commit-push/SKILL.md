---
name: atomic-commit-push
description: Guides the process of creating atomic commits and pushing them to a GitHub repository. Use when changes consist of multiple logical units that should be committed separately for clarity and cleaner history.
---

# Atomic Commit and Push

This skill guides you through the process of decomposing a large set of changes into "atomic" commits—single-purpose, logical units of work—and pushing them to a remote repository.

## Workflow

### 1. Survey Changes

Start by understanding the full scope of uncommitted changes.

- Use `git status` to identify modified, added, and deleted files.
- Use `git diff` (and `git diff --cached` if some are already staged) to review the actual code changes.

### 2. Group into Atomic Units

Identify logical boundaries. A single atomic commit should ideally:

- Fix one bug.
- OR Implement one feature.
- OR Refactor one component.
- OR Update documentation for one area.

**Strategy:** If `File A` and `File B` are part of a feature, but `File C` is a tiny bug fix you did along the way, they belong in separate commits.

### 3. Commit Iteratively

For each identified logical unit:

1. **Stage:** `git add <files>` only for that unit. Use `git add -p` if only parts of a file belong to the current unit.
2. **Verify Stage:** Use `git diff --cached` to ensure _only_ the intended changes are staged.
3. **Message:** Write a high-quality commit message (optionally using the `commit-message` skill).
4. **Commit:** `git commit -m "..."`

### 4. Final Validation & Push

Once all changes are committed:

1. **Check Log:** Use `git log -n <count>` to review your new local commits.
2. **Push:** Execute `git push`. If it fails due to being behind, `git pull --rebase` is generally preferred before pushing again.

## Guidelines

- **No "Kitchen Sink" Commits:** Avoid commits that mix refactors, features, and fixes.
- **Test Between Commits:** If possible, ensure the codebase still builds/passes tests after each atomic commit to maintain a "bisectable" history.
- **Conventional Commits:** Prefer the format `type(scope): description`.

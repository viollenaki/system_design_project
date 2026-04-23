---
name: commit-message
description: Generates a high-quality, conventional commit message based on the current changes.
---

# Commit Message Skill

You are an expert at writing clear, concise, and descriptive commit messages following the Conventional Commits specification.

## Instructions

1.  **Analyze Changes**: Use `git diff --cached` to see the changes staged for commit.
2.  **Identify Type**: Determine the type of change:
    - `feat`: A new feature
    - `fix`: A bug fix
    - `docs`: Documentation only changes
    - `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
    - `refactor`: A code change that neither fixes a bug nor adds a feature
    - `test`: Adding missing tests or correcting existing tests
    - `chore`: Changes to the build process or auxiliary tools and libraries
3.  **Scope**: If applicable, provide a scope in parentheses (e.g., `feat(ui): ...`).
4.  **Subject**: Write a short, imperative mood description. Do not capitalize the first letter and no period at the end.
5.  **Body (Optional)**: If the change is complex, provide a detailed description in the body.
6.  **Footer (Optional)**: Reference issues (e.g., `Fixes #123`) or breaking changes.

## Constraints
- Keep the subject line under 50 characters.
- Use the imperative mood ("Add feature" not "Added feature").
- Always use the `commit-message` prefix when prompted to generate one.

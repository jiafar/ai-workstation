# Conventional Commit Message Generator

You are an expert at writing clear, conventional commit messages following the Conventional Commits specification.

## Git Diff
```
{{diff}}
```

## Task
Analyze the git diff above and generate a conventional commit message.

## Conventional Commits Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files

### Guidelines
1. Use lowercase for type and scope
2. Subject line should be 50 characters or less
3. Do not end subject line with a period
4. Use imperative mood ("add" not "added" or "adds")
5. Separate subject from body with a blank line
6. Body should explain what and why, not how
7. Wrap body at 72 characters
8. Use footer for breaking changes or issue references

## Instructions
1. Analyze the diff carefully
2. Identify the type of change (feat, fix, refactor, etc.)
3. Determine an appropriate scope if applicable
4. Write a clear, concise subject line
5. Add a body paragraph explaining the change if needed
6. Include breaking change notice in footer if applicable

## Output
Return ONLY the commit message, without code blocks or additional commentary.

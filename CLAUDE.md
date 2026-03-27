# Project Instructions

## Git Commits

Every commit MUST include the following co-author trailer:

```
Co-Authored-By: Rosemary <rosemaryrunner@icloud.com>
```

This applies to all commits — features, fixes, refactors, docs, everything.

## Obsidian Vault Sync

There is an Obsidian vault at `obsidian-vault/` that documents the entire app (architecture, data model, backend routes, frontend components, infrastructure, interview prep).

**RULE: After making any code changes to backend/, frontend/, or infra/, you MUST update the corresponding Obsidian vault note(s) to reflect the change.** This includes:

- New or modified API endpoints → update `obsidian-vault/backend/API Reference.md`
- New or modified DynamoDB tables/schemas → update the relevant `obsidian-vault/data-model/*.md`
- New or modified React components → update `obsidian-vault/frontend/Components.md`
- Changes to the API client → update `obsidian-vault/frontend/API Client.md`
- Changes to real-time (SSE/WS) → update `obsidian-vault/backend/Real-time.md`
- Infrastructure changes → update `obsidian-vault/infrastructure/*.md`
- New architectural decisions → update `obsidian-vault/interview/Design Decisions.md`

Keep the vault as the single source of truth for reviewing the app.

## Auto Commit & Push

After every prompt that results in code changes, you MUST:

1. Stage and commit the changes with a descriptive message
2. Push to the remote (`git push origin main`)

This applies to every single change — no exceptions. Do not wait for the user to ask.

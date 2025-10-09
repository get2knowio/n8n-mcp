# Changelog

All notable changes to this project will be documented in this file.

## v0.4.0

### Features
- feat(tags): UUID support for tag IDs with multi-endpoint fallback and improved error messages
- feat(mcp): Numeric workflow ID aliases (numericId) accepted across all workflow operations
- docs: Implementation summary and endpoint compatibility documentation added
- dev: Docker compose devcontainer with bundled n8n sidecar for faster E2E

### Fixes & Improvements
- fix(tags): Normalize tag operation error messages and robust PUT fallback
- fix(client): Guard axios interceptor attachment in mocked test environments
- test: Expanded smoke tests (CLI + MCP stdio) and output helper coverage
- chore(ci): Add opencode slash-command workflow for on-demand coding agent runs
- deps: Bump @modelcontextprotocol/sdk, dotenv, @types/node, typescript

### Notes
Enhanced tag and workflow ID ergonomics plus sturdier integration tests improve reliability and developer experience.

## v0.3.0

- feat: Add end-to-end CLI smoke tests against real n8n
  - New script: `npm run smoke`
  - Loads `.env` automatically (dotenv) and enables source maps for traceable errors
  - Validates list/create/get/activate/webhook-urls/deactivate/delete flows
- fix(cli): Emit pure JSON to stdout for create/get/list/etc. to ease automation
- fix(client): Handle API response shapes with/without `{ data: ... }`
- fix(client): Omit read-only `active` on create/update; ensure minimal `settings: {}`
- docs: Testing guide updated with smoke tests section

Thanks to these improvements, it’s easier to validate real-world connectivity and debug issues with clear, source-mapped stacks.
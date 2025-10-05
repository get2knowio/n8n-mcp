# Changelog

All notable changes to this project will be documented in this file.

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
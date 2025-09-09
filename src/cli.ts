#!/usr/bin/env node

import { N8nClient } from './n8n-client.js';
import { N8nConfig } from './types.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
Usage: node dist/cli.js <command> [options]

Commands:
  list                    List all workflows
  get <id>               Get workflow by ID
  create <file.json>     Create workflow from JSON file
  delete <id>            Delete workflow by ID
  activate <id>          Activate workflow
  deactivate <id>        Deactivate workflow
  get-credential-schema <type>  Get credential schema by type name

Environment variables:
  N8N_BASE_URL           n8n instance URL (default: http://localhost:5678)
  N8N_API_KEY           API key for authentication
  N8N_USERNAME          Username for basic auth
  N8N_PASSWORD          Password for basic auth
`);
    process.exit(1);
  }

  const config: N8nConfig = {
    baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
    apiKey: process.env.N8N_API_KEY,
    username: process.env.N8N_USERNAME,
    password: process.env.N8N_PASSWORD,
  };

  const client = new N8nClient(config);

  try {
    switch (command) {
      case 'list':
        const workflows = await client.listWorkflows();
        console.log(JSON.stringify(workflows, null, 2));
        break;

      case 'get':
        const id = parseInt(args[1]);
        if (!id) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        const workflow = await client.getWorkflow(id);
        console.log(JSON.stringify(workflow, null, 2));
        break;

      case 'create':
        const filename = args[1];
        if (!filename) {
          console.error('Error: JSON file required');
          process.exit(1);
        }
        const fs = await import('fs/promises');
        const workflowData = JSON.parse(await fs.readFile(filename, 'utf8'));
        const created = await client.createWorkflow(workflowData);
        console.log('Created workflow:', JSON.stringify(created, null, 2));
        break;

      case 'delete':
        const deleteId = parseInt(args[1]);
        if (!deleteId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        await client.deleteWorkflow(deleteId);
        console.log(`Workflow ${deleteId} deleted successfully`);
        break;

      case 'activate':
        const activateId = parseInt(args[1]);
        if (!activateId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        const activated = await client.activateWorkflow(activateId);
        console.log('Activated workflow:', JSON.stringify(activated, null, 2));
        break;

      case 'deactivate':
        const deactivateId = parseInt(args[1]);
        if (!deactivateId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        const deactivated = await client.deactivateWorkflow(deactivateId);
        console.log('Deactivated workflow:', JSON.stringify(deactivated, null, 2));
        break;

      case 'get-credential-schema':
        const credentialType = args[1];
        if (!credentialType) {
          console.error('Error: Credential type name required');
          process.exit(1);
        }
        const schema = await client.getCredentialSchema(credentialType);
        console.log(JSON.stringify(schema, null, 2));
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
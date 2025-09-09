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

Variables commands:
  variables list         List all variables
  variables create --key <key> --value <value>  Create a new variable
  variables update <id> --value <value>         Update a variable
  variables delete <id>  Delete a variable

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

      case 'variables':
        await handleVariablesCommand(client, args.slice(1));
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

async function handleVariablesCommand(client: N8nClient, args: string[]) {
  const subCommand = args[0];

  if (!subCommand) {
    console.error('Error: Variables subcommand required (list, create, update, delete)');
    process.exit(1);
  }

  switch (subCommand) {
    case 'list':
      const variables = await client.listVariables();
      console.log(JSON.stringify(variables, null, 2));
      break;

    case 'create':
      const keyIndex = args.indexOf('--key');
      const valueIndex = args.indexOf('--value');
      
      if (keyIndex === -1 || valueIndex === -1 || !args[keyIndex + 1] || !args[valueIndex + 1]) {
        console.error('Error: Both --key and --value are required');
        process.exit(1);
      }
      
      const key = args[keyIndex + 1];
      const value = args[valueIndex + 1];
      const created = await client.createVariable({ key, value });
      console.log(JSON.stringify(created, null, 2));
      break;

    case 'update':
      const updateId = args[1];
      const updateValueIndex = args.indexOf('--value');
      
      if (!updateId || updateValueIndex === -1 || !args[updateValueIndex + 1]) {
        console.error('Error: Variable ID and --value are required');
        process.exit(1);
      }
      
      const newValue = args[updateValueIndex + 1];
      const updated = await client.updateVariable(updateId, { value: newValue });
      console.log(JSON.stringify(updated, null, 2));
      break;

    case 'delete':
      const deleteId = args[1];
      if (!deleteId) {
        console.error('Error: Variable ID required');
        process.exit(1);
      }
      
      const result = await client.deleteVariable(deleteId);
      console.log(JSON.stringify(result, null, 2));
      break;

    default:
      console.error(`Unknown variables command: ${subCommand}`);
      process.exit(1);
  }
}

main();
#!/usr/bin/env node

import { N8nClient } from './n8n-client.js';
import { N8nConfig } from './types.js';

async function handleTagCommands(client: N8nClient, command: string, args: string[]) {
  switch (command) {
    case 'list':
      const limit = args[0] ? parseInt(args[0]) : undefined;
      const cursor = args[1] || undefined;
      const tags = await client.listTags(limit, cursor);
      console.log(JSON.stringify(tags, null, 2));
      break;

    case 'get':
      const getId = parseInt(args[0]);
      if (!getId) {
        console.error('Error: Tag ID required');
        process.exit(1);
      }
      const tag = await client.getTag(getId);
      console.log(JSON.stringify(tag, null, 2));
      break;

    case 'create':
      const name = args[0];
      if (!name) {
        console.error('Error: Tag name required');
        process.exit(1);
      }
      const color = args[1] || undefined;
      const created = await client.createTag({ name, color });
      console.log(JSON.stringify(created, null, 2));
      break;

    case 'update':
      const updateId = parseInt(args[0]);
      if (!updateId) {
        console.error('Error: Tag ID required');
        process.exit(1);
      }
      const updateData: any = {};
      if (args[1]) updateData.name = args[1];
      if (args[2]) updateData.color = args[2];
      
      if (Object.keys(updateData).length === 0) {
        console.error('Error: At least one of name or color must be provided');
        process.exit(1);
      }
      
      const updated = await client.updateTag(updateId, updateData);
      console.log(JSON.stringify(updated, null, 2));
      break;

    case 'delete':
      const deleteId = parseInt(args[0]);
      if (!deleteId) {
        console.error('Error: Tag ID required');
        process.exit(1);
      }
      await client.deleteTag(deleteId);
      console.log(JSON.stringify({ ok: true, message: `Tag ${deleteId} deleted successfully` }, null, 2));
      break;

    default:
      console.error(`Unknown tag command: ${command}`);
      console.error('Available commands: list, get, create, update, delete');
      process.exit(1);
  }
}

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

Tag Commands:
  tags list [limit] [cursor]    List all tags (with optional pagination)
  tags get <id>                 Get tag by ID
  tags create <name> [color]    Create a new tag
  tags update <id> [name] [color]  Update a tag
  tags delete <id>              Delete tag by ID

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

      case 'tags':
        const tagCommand = args[1];
        if (!tagCommand) {
          console.error('Error: Tag command required (list|get|create|update|delete)');
          process.exit(1);
        }
        await handleTagCommands(client, tagCommand, args.slice(2));
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
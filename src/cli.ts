#!/usr/bin/env node

import { N8nClient } from './n8n-client.js';
import { N8nConfig } from './types.js';

async function handleTagCommands(client: N8nClient, command: string, args: string[]) {
  switch (command) {
    case 'list': {
      const limit = args[0] ? parseInt(args[0]) : undefined;
      const cursor = args[1] || undefined;
      const tags = await client.listTags(limit, cursor);
      console.log(JSON.stringify(tags, null, 2));
      break;
    }
    case 'get': {
      const getId = parseInt(args[0]);
      if (!getId) {
        console.error('Error: Tag ID required');
        process.exit(1);
      }
      const tag = await client.getTag(getId);
      console.log(JSON.stringify(tag, null, 2));
      break;
    }
    case 'create': {
      const name = args[0];
      if (!name) {
        console.error('Error: Tag name required');
        process.exit(1);
      }
      const color = args[1] || undefined;
      const created = await client.createTag({ name, color });
      console.log(JSON.stringify(created, null, 2));
      break;
    }
    case 'update': {
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
    }
    case 'delete': {
      const deleteId = parseInt(args[0]);
      if (!deleteId) {
        console.error('Error: Tag ID required');
        process.exit(1);
      }
      await client.deleteTag(deleteId);
      console.log(JSON.stringify({ ok: true, message: `Tag ${deleteId} deleted successfully` }, null, 2));
      break;
    }
    default: {
      console.error(`Unknown tag command: ${command}`);
      console.error('Available commands: list, get, create, update, delete');
      process.exit(1);
    }
  }
}

async function handleVariablesCommand(client: N8nClient, args: string[]) {
  const subCommand = args[0];

  if (!subCommand) {
    console.error('Error: Variables subcommand required (list, create, update, delete)');
    process.exit(1);
  }

  switch (subCommand) {
    case 'list': {
      const variables = await client.listVariables();
      console.log(JSON.stringify(variables, null, 2));
      break;
    }
    case 'create': {
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
    }
    case 'update': {
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
    }
    case 'delete': {
      const deleteId = args[1];
      if (!deleteId) {
        console.error('Error: Variable ID required');
        process.exit(1);
      }

      const result = await client.deleteVariable(deleteId);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    default: {
      console.error(`Unknown variables command: ${subCommand}`);
      process.exit(1);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
Usage: node dist/cli.js <command> [options]

Commands:
  list                       List all workflows
  get <id>                  Get workflow by ID
  create <file.json>        Create workflow from JSON file
  delete <id>               Delete workflow by ID
  activate <id>             Activate workflow
  deactivate <id>           Deactivate workflow
  get-credential-schema <type>  Get credential schema by type name
  workflows tags <id>       List tags for a workflow
  workflows set-tags <id> --tags <comma-separated>  Set tags for a workflow
  executions list [options]              List executions
  executions get <id>                    Get execution by ID
  executions delete <id>                 Delete execution by ID
  webhook-urls <workflowId> <nodeId>     Get webhook URLs for a node
  run-once <workflowId> [input.json]     Execute workflow once
  source-control pull       Pull changes from source control

Options for executions list:
  --limit <number>       Maximum number of executions to return
  --cursor <string>      Cursor for pagination
  --workflow-id <id>     Filter by workflow ID

Variables commands:
  variables list         List all variables
  variables create --key <key> --value <value>  Create a new variable
  variables update <id> --value <value>         Update a variable
  variables delete <id>  Delete a variable

Tag Commands:
  tags list [limit] [cursor]    List all tags (with optional pagination)
  tags get <id>                 Get tag by ID
  tags create <name> [color]    Create a new tag
  tags update <id> [name] [color]  Update a tag
  tags delete <id>              Delete tag by ID

Environment variables:
  N8N_BASE_URL              n8n instance URL (default: http://localhost:5678)
  N8N_API_KEY              API key for authentication
  N8N_USERNAME             Username for basic auth
  N8N_PASSWORD             Password for basic auth
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
      case 'list': {
        // Support optional pagination flags: --limit <n> --cursor <cursor>
        let limit: number | undefined;
        let cursor: string | undefined;
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--limit' && args[i + 1]) {
            limit = parseInt(args[i + 1]);
            i++;
          } else if (args[i] === '--cursor' && args[i + 1]) {
            cursor = args[i + 1];
            i++;
          }
        }

        const workflows = await client.listWorkflows(limit, cursor);
        console.log(JSON.stringify(workflows, null, 2));
        break;
      }
      case 'get': {
        const id = parseInt(args[1]);
        if (!id) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        const workflow = await client.getWorkflow(id);
        console.log(JSON.stringify(workflow, null, 2));
        break;
      }
      case 'create': {
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
      }
      case 'delete': {
        const deleteId = parseInt(args[1]);
        if (!deleteId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        await client.deleteWorkflow(deleteId);
        console.log(`Workflow ${deleteId} deleted successfully`);
        break;
      }
      case 'activate': {
        const activateId = parseInt(args[1]);
        if (!activateId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        const activated = await client.activateWorkflow(activateId);
        console.log('Activated workflow:', JSON.stringify(activated, null, 2));
        break;
      }
      case 'deactivate': {
        const deactivateId = parseInt(args[1]);
        if (!deactivateId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        const deactivated = await client.deactivateWorkflow(deactivateId);
        console.log('Deactivated workflow:', JSON.stringify(deactivated, null, 2));
        break;
      }
      case 'get-credential-schema': {
        const credentialType = args[1];
        if (!credentialType) {
          console.error('Error: Credential type name required');
          process.exit(1);
        }
        const schema = await client.getCredentialSchema(credentialType);
        console.log(JSON.stringify(schema, null, 2));
        break;
      }
      case 'workflows': {
        const subcommand = args[1];
        if (subcommand === 'tags') {
          const workflowId = parseInt(args[2]);
          if (!workflowId) {
            console.error('Error: Workflow ID required');
            process.exit(1);
          }
          const tags = await client.listWorkflowTags(workflowId);
          console.log(JSON.stringify(tags, null, 2));
        } else if (subcommand === 'set-tags') {
          const workflowId = parseInt(args[2]);
          const tagsIndex = args.indexOf('--tags');
          if (!workflowId || tagsIndex === -1 || !args[tagsIndex + 1]) {
            console.error('Error: Workflow ID and --tags are required');
            process.exit(1);
          }
          const tagsArg = args[tagsIndex + 1];
          const tagIds = tagsArg.split(',').map((t) => t.trim());
          const tags = await client.setWorkflowTags(workflowId, tagIds);
          console.log('Workflow tags updated:', JSON.stringify(tags, null, 2));
        } else {
          console.error(`Unknown workflows subcommand: ${subcommand}`);
          process.exit(1);
        }
        break;
      }
      case 'tags': {
        const tagCommand = args[1];
        if (!tagCommand) {
          console.error('Error: Tag command required (list|get|create|update|delete)');
          process.exit(1);
        }
        await handleTagCommands(client, tagCommand, args.slice(2));
        break;
      }
      case 'variables': {
  await handleVariablesCommand(client, args.slice(1));
        break;
      }
      case 'executions': {
        const subCommand = args[1];
        if (!subCommand) {
          console.error('Error: Executions subcommand required (list, get, delete)');
          process.exit(1);
        }

        switch (subCommand) {
          case 'list': {
            const listOptions: { limit?: number; cursor?: string; workflowId?: string } = {};

            for (let i = 2; i < args.length; i++) {
              if (args[i] === '--limit' && args[i + 1]) {
                listOptions.limit = parseInt(args[i + 1]);
                i++;
              } else if (args[i] === '--cursor' && args[i + 1]) {
                listOptions.cursor = args[i + 1];
                i++;
              } else if (args[i] === '--workflow-id' && args[i + 1]) {
                listOptions.workflowId = args[i + 1];
                i++;
              }
            }

            const executions = await client.listExecutions(listOptions);
            console.log(JSON.stringify(executions, null, 2));
            break;
          }
          case 'get': {
            const executionId = args[2];
            if (!executionId) {
              console.error('Error: Execution ID required');
              process.exit(1);
            }
            const execution = await client.getExecution(executionId);
            console.log(JSON.stringify(execution, null, 2));
            break;
          }
          case 'delete': {
            const deleteExecutionId = args[2];
            if (!deleteExecutionId) {
              console.error('Error: Execution ID required');
              process.exit(1);
            }
            await client.deleteExecution(deleteExecutionId);
            console.log(`Execution ${deleteExecutionId} deleted successfully`);
            break;
          }
          default: {
            console.error(`Unknown executions subcommand: ${subCommand}`);
            process.exit(1);
          }
        }
        break;
      }
      case 'webhook-urls': {
        const webhookWorkflowId = parseInt(args[1]);
        const nodeId = args[2];
        if (!webhookWorkflowId || !nodeId) {
          console.error('Error: Workflow ID and Node ID required');
          process.exit(1);
        }
        const urls = await client.getWebhookUrls(webhookWorkflowId, nodeId);
        console.log('Webhook URLs:', JSON.stringify(urls, null, 2));
        break;
      }
      case 'run-once': {
        const runWorkflowId = parseInt(args[1]);
        if (!runWorkflowId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }

        let inputData;
        if (args[2]) {
          const fs = await import('fs/promises');
          inputData = JSON.parse(await fs.readFile(args[2], 'utf8'));
        }

        const execution = await client.runOnce(runWorkflowId, inputData);
        console.log('Execution started:', JSON.stringify(execution, null, 2));
        break;
      }
      case 'source-control': {
        const subCommand = args[1];
        if (subCommand === 'pull') {
          const result = await client.sourceControlPull();
          console.log('Source control pull result:', JSON.stringify(result, null, 2));
        } else {
          console.error(`Unknown source-control subcommand: ${subCommand}`);
          process.exit(1);
        }
        break;
      }
      default: {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
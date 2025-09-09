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
  executions list [options]              List executions
  executions get <id>                    Get execution by ID
  executions delete <id>                 Delete execution by ID
  webhook-urls <workflowId> <nodeId>     Get webhook URLs for a node
  run-once <workflowId> [input.json]     Execute workflow once

Options for executions list:
  --limit <number>       Maximum number of executions to return
  --cursor <string>      Cursor for pagination
  --workflow-id <id>     Filter by workflow ID

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

      case 'executions':
        const subCommand = args[1];
        if (!subCommand) {
          console.error('Error: Executions subcommand required (list, get, delete)');
          process.exit(1);
        }

        switch (subCommand) {
          case 'list':
            const listOptions: { limit?: number; cursor?: string; workflowId?: string } = {};
            
            // Parse options
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

          case 'get':
            const executionId = args[2];
            if (!executionId) {
              console.error('Error: Execution ID required');
              process.exit(1);
            }
            const execution = await client.getExecution(executionId);
            console.log(JSON.stringify(execution, null, 2));
            break;

          case 'delete':
            const deleteExecutionId = args[2];
            if (!deleteExecutionId) {
              console.error('Error: Execution ID required');
              process.exit(1);
            }
            await client.deleteExecution(deleteExecutionId);
            console.log(`Execution ${deleteExecutionId} deleted successfully`);
            break;

          default:
            console.error(`Unknown executions subcommand: ${subCommand}`);
            process.exit(1);
        }
        break;

      case 'webhook-urls':
        const webhookWorkflowId = parseInt(args[1]);
        const nodeId = args[2];
        if (!webhookWorkflowId || !nodeId) {
          console.error('Error: Workflow ID and Node ID required');
          process.exit(1);
        }
        const urls = await client.getWebhookUrls(webhookWorkflowId, nodeId);
        console.log('Webhook URLs:', JSON.stringify(urls, null, 2));
        break;

      case 'run-once':
        const runWorkflowId = parseInt(args[1]);
        if (!runWorkflowId) {
          console.error('Error: Workflow ID required');
          process.exit(1);
        }
        
        let inputData;
        if (args[2]) {
          // If input file provided, read it
          const fs = await import('fs/promises');
          inputData = JSON.parse(await fs.readFile(args[2], 'utf8'));
        }
        
        const execution = await client.runOnce(runWorkflowId, inputData);
        console.log('Execution started:', JSON.stringify(execution, null, 2));
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
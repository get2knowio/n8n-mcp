#!/usr/bin/env node

import { N8nClient } from './n8n-client.js';
import { N8nConfig } from './types.js';
import { printJson, success, error as errorPayload, parseFormatFlags } from './output.js';

async function handleTagCommands(client: N8nClient, command: string, args: string[], fmt: ReturnType<typeof parseFormatFlags>) {
  switch (command) {
    case 'list': {
      const limit = args[0] ? parseInt(args[0]) : undefined;
      const cursor = args[1] || undefined;
      const tags = await client.listTags(limit, cursor);
      printJson(success(tags), fmt);
      break;
    }
    case 'get': {
      const getId = parseInt(args[0]);
      if (!getId) {
        printJson(errorPayload('Tag ID required', 'BAD_INPUT'), fmt);
        process.exit(1);
      }
      const tag = await client.getTag(getId);
      printJson(success(tag), fmt);
      break;
    }
    case 'create': {
      const name = args[0];
      if (!name) {
        printJson(errorPayload('Tag name required', 'BAD_INPUT'), fmt);
        process.exit(1);
      }
      const color = args[1] || undefined;
      const created = await client.createTag({ name, color });
      printJson(success(created), fmt);
      break;
    }
    case 'update': {
      const updateId = parseInt(args[0]);
      if (!updateId) {
        printJson(errorPayload('Tag ID required', 'BAD_INPUT'), fmt);
        process.exit(1);
      }
      const updateData: any = {};
      if (args[1]) updateData.name = args[1];
      if (args[2]) updateData.color = args[2];

      if (Object.keys(updateData).length === 0) {
        printJson(errorPayload('At least one of name or color must be provided', 'BAD_INPUT'), fmt);
        process.exit(1);
      }

      const updated = await client.updateTag(updateId, updateData);
      printJson(success(updated), fmt);
      break;
    }
    case 'delete': {
      const deleteId = parseInt(args[0]);
      if (!deleteId) {
        printJson(errorPayload('Tag ID required', 'BAD_INPUT'), fmt);
        process.exit(1);
      }
      await client.deleteTag(deleteId);
      printJson(success({ id: deleteId }), fmt);
      break;
    }
    default: {
      printJson(errorPayload(`Unknown tag command: ${command}. Available: list, get, create, update, delete`, 'BAD_INPUT'), fmt);
      process.exit(1);
    }
  }
}

async function handleVariablesCommand(client: N8nClient, args: string[], fmt: ReturnType<typeof parseFormatFlags>) {
  const subCommand = args[0];

  if (!subCommand) {
    printJson(errorPayload('Variables subcommand required (list, create, update, delete)', 'BAD_INPUT'), fmt);
    process.exit(1);
  }

  switch (subCommand) {
    case 'list': {
      const variables = await client.listVariables();
      printJson(success(variables), fmt);
      break;
    }
    case 'create': {
      const keyIndex = args.indexOf('--key');
      const valueIndex = args.indexOf('--value');

      if (keyIndex === -1 || valueIndex === -1 || !args[keyIndex + 1] || !args[valueIndex + 1]) {
        printJson(errorPayload('Both --key and --value are required', 'BAD_INPUT'), fmt);
        process.exit(1);
      }

      const key = args[keyIndex + 1];
      const value = args[valueIndex + 1];
      const created = await client.createVariable({ key, value });
      printJson(success(created), fmt);
      break;
    }
    case 'update': {
      const updateId = args[1];
      const updateValueIndex = args.indexOf('--value');

      if (!updateId || updateValueIndex === -1 || !args[updateValueIndex + 1]) {
        printJson(errorPayload('Variable ID and --value are required', 'BAD_INPUT'), fmt);
        process.exit(1);
      }

      const newValue = args[updateValueIndex + 1];
      const updated = await client.updateVariable(updateId, { value: newValue });
      printJson(success(updated), fmt);
      break;
    }
    case 'delete': {
      const deleteId = args[1];
      if (!deleteId) {
        printJson(errorPayload('Variable ID required', 'BAD_INPUT'), fmt);
        process.exit(1);
      }

      const result = await client.deleteVariable(deleteId);
      printJson(success(result), fmt);
      break;
    }
    default: {
      printJson(errorPayload(`Unknown variables command: ${subCommand}`, 'BAD_INPUT'), fmt);
      process.exit(1);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const fmt = parseFormatFlags(args);

  // Handle verbose flags early
  if (args.includes('--verbose') || args.includes('-v')) {
    process.env.MCP_DEBUG = 'debug';
    process.env.MCP_ENABLE_SOURCE_MAPS = '1';
  }

  if (!command) {
    // No subcommand provided: behave as MCP stdio server entrypoint.
    // This supports the VS Code "MCP: Add Server" -> "NPM Package" flow
    // which typically invokes `npx @scope/package` without extra args.
    const { N8nMcpServer } = await import('./index.js');
    const server = new N8nMcpServer();
    await server.run();
    return;
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
        printJson(success(workflows), fmt);
        break;
      }
      case 'get': {
        const idArg = args[1];
        if (!idArg) {
          printJson(errorPayload('Workflow ID required', 'BAD_INPUT'), fmt);
          process.exit(1);
        }
        const workflow = await client.getWorkflow(idArg);
        printJson(success(workflow), fmt);
        break;
      }
      case 'create': {
        const filename = args[1];
        if (!filename) {
          printJson(errorPayload('JSON file required', 'BAD_INPUT'), fmt);
          process.exit(1);
        }
        const fs = await import('fs/promises');
        const workflowData = JSON.parse(await fs.readFile(filename, 'utf8'));
        const created = await client.createWorkflow(workflowData);
        printJson(success(created), fmt);
        break;
      }
      case 'delete': {
        const deleteId = args[1];
        if (!deleteId) {
          printJson(errorPayload('Workflow ID required', 'BAD_INPUT'), fmt);
          process.exit(1);
        }
        await client.deleteWorkflow(deleteId);
        printJson(success({ id: deleteId }), fmt);
        break;
      }
      case 'activate': {
        const activateId = args[1];
        if (!activateId) {
          printJson(errorPayload('Workflow ID required', 'BAD_INPUT'), fmt);
          process.exit(1);
        }
        const activated = await client.activateWorkflow(activateId);
        printJson(success(activated), fmt);
        break;
      }
      case 'deactivate': {
        const deactivateId = args[1];
        if (!deactivateId) {
          printJson(errorPayload('Workflow ID required', 'BAD_INPUT'), fmt);
          process.exit(1);
        }
        const deactivated = await client.deactivateWorkflow(deactivateId);
        printJson(success(deactivated), fmt);
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
          const workflowId = args[2];
          if (!workflowId) {
            printJson(errorPayload('Workflow ID required', 'BAD_INPUT'), fmt);
            process.exit(1);
          }
          const tags = await client.listWorkflowTags(workflowId);
          printJson(success(tags), fmt);
        } else if (subcommand === 'set-tags') {
          const workflowId = args[2];
          const tagsIndex = args.indexOf('--tags');
          if (!workflowId || tagsIndex === -1 || !args[tagsIndex + 1]) {
            printJson(errorPayload('Workflow ID and --tags are required', 'BAD_INPUT'), fmt);
            process.exit(1);
          }
          const tagsArg = args[tagsIndex + 1];
          const tagIds = tagsArg.split(',').map((t) => t.trim());
          const tags = await client.setWorkflowTags(workflowId, tagIds);
          printJson(success(tags), fmt);
        } else {
          printJson(errorPayload(`Unknown workflows subcommand: ${subcommand}`, 'BAD_INPUT'), fmt);
          process.exit(1);
        }
        break;
      }
      case 'tags': {
        const tagCommand = args[1];
        if (!tagCommand) {
          printJson(errorPayload('Tag command required (list|get|create|update|delete)', 'BAD_INPUT'), fmt);
          process.exit(1);
        }
        await handleTagCommands(client, tagCommand, args.slice(2), fmt);
        break;
      }
      case 'variables': {
  await handleVariablesCommand(client, args.slice(1), fmt);
        break;
      }
      case 'executions': {
        const subCommand = args[1];
        if (!subCommand) {
          printJson(errorPayload('Executions subcommand required (list, get, delete)', 'BAD_INPUT'), fmt);
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
            printJson(success(executions), fmt);
            break;
          }
          case 'get': {
            const executionId = args[2];
            if (!executionId) {
              printJson(errorPayload('Execution ID required', 'BAD_INPUT'), fmt);
              process.exit(1);
            }
            const execution = await client.getExecution(executionId);
            printJson(success(execution), fmt);
            break;
          }
          case 'delete': {
            const deleteExecutionId = args[2];
            if (!deleteExecutionId) {
              printJson(errorPayload('Execution ID required', 'BAD_INPUT'), fmt);
              process.exit(1);
            }
            await client.deleteExecution(deleteExecutionId);
            printJson(success({ id: deleteExecutionId }), fmt);
            break;
          }
          default: {
            printJson(errorPayload(`Unknown executions subcommand: ${subCommand}`, 'BAD_INPUT'), fmt);
            process.exit(1);
          }
        }
        break;
      }
      case 'webhook-urls': {
        const webhookWorkflowId = args[1];
        const nodeId = args[2];
        if (!webhookWorkflowId || !nodeId) {
          printJson(errorPayload('Workflow ID and Node ID required', 'BAD_INPUT'), fmt);
          process.exit(1);
        }
        const urls = await client.getWebhookUrls(webhookWorkflowId, nodeId);
        printJson(success(urls), fmt);
        break;
      }
      case 'run-once': {
        const runWorkflowId = args[1];
        if (!runWorkflowId) {
          printJson(errorPayload('Workflow ID required', 'BAD_INPUT'), fmt);
          process.exit(1);
        }

        let inputData;
        if (args[2]) {
          const fs = await import('fs/promises');
          inputData = JSON.parse(await fs.readFile(args[2], 'utf8'));
        }

        const execution = await client.runOnce(runWorkflowId, inputData);
        printJson(success(execution), fmt);
        break;
      }
      case 'source-control': {
        const subCommand = args[1];
        if (subCommand === 'pull') {
          const result = await client.sourceControlPull();
          printJson(success(result), fmt);
        } else {
          printJson(errorPayload(`Unknown source-control subcommand: ${subCommand}`, 'BAD_INPUT'), fmt);
          process.exit(1);
        }
        break;
      }
      default: {
        printJson(errorPayload(`Unknown command: ${command}`, 'BAD_INPUT'), fmt);
        process.exit(1);
      }
    }
  } catch (error) {
    printJson(errorPayload(error, 'UNHANDLED'), parseFormatFlags(args));
    process.exit(1);
  }
}

main();

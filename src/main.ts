#!/usr/bin/env node

// Unified entrypoint to support both VS Code "NPM Package" flow and CLI usage.
// - With `--http` (or MCP_TRANSPORT=http): start the Streamable HTTP MCP server
// - If invoked without args: start MCP stdio server
// - If invoked with args: treat as CLI (same as n8n-mcp)

async function run() {
  const args = process.argv.slice(2);

  if (args.includes('--http') || process.env.MCP_TRANSPORT === 'http') {
    const { startHttpServer } = await import('./http-server.js');
    await startHttpServer();
    return;
  }

  if (args.length === 0) {
    const { N8nMcpServer } = await import('./index.js');
    const server = new N8nMcpServer();
    await server.run();
    return;
  }

  await import('./cli.js');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

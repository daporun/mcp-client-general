#!/usr/bin/env node
import { MCPProcess } from "./runner.js";
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
    console.log(`
mcp - Minimal MCP Client
------------------------

Usage:
  mcp <command> [options]

Commands:
  run <serverCommand>   Run an MCP server and send JSON-RPC messages
  --help                Show this help message

Examples:
  mcp run "node dist/server.js"
  echo '{"jsonrpc":"2.0","id":1,"method":"providers.list"}' | mcp run "node dist/server.js"

`);
    process.exit(0);
}
// Default: forward into MCPProcess
const proc = new MCPProcess(args);
proc.start();
